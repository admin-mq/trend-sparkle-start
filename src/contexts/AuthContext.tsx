import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UserProfile, SignUpData } from '@/types/auth';

const SESSION_EXPIRY_KEY = 'mq_login_at';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const OAUTH_GRACE_MS = 3000; // Wait up to 3s for OAuth SIGNED_IN event

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const sessionResolved = useRef(false);
  const initialLoadDone = useRef(false);

  const fetchProfile = useCallback(async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        return null;
      }
      return data as UserProfile | null;
    } catch (err) {
      console.error('Error fetching profile:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let graceTimeout: ReturnType<typeof setTimeout> | null = null;

    const handleSession = async (currentSession: Session) => {
      if (!mounted) return;
      sessionResolved.current = true;

      setSession(currentSession);
      setUser(currentSession.user);
      localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());

      const userProfile = await fetchProfile(currentSession.user.id);
      if (mounted) {
        setProfile(userProfile);
        setNeedsProfileCompletion(!userProfile);
        setLoading(false);
      }
    };

    // Phase 1: Set up listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log('[Auth] onAuthStateChange:', event, !!currentSession?.user);

        // FIX 1: Handle INITIAL_SESSION if it has a valid session
        // (Lovable auth module may have already called setSession before mount)
        if (event === 'INITIAL_SESSION') {
          if (currentSession?.user) {
            console.log('[Auth] INITIAL_SESSION has valid session, using it');
            if (graceTimeout) clearTimeout(graceTimeout);
            await handleSession(currentSession);
          }
          // If no session, skip — let getSession + grace period handle it
          return;
        }

        // FIX 2: During initial load, ignore SIGNED_OUT from stale token refresh
        if (event === 'SIGNED_OUT') {
          if (!initialLoadDone.current) {
            console.log('[Auth] Ignoring SIGNED_OUT during initial load (stale token refresh)');
            return;
          }
          // Real sign-out after initialization
          sessionResolved.current = true;
          if (graceTimeout) clearTimeout(graceTimeout);
          setSession(null);
          setUser(null);
          setProfile(null);
          setNeedsProfileCompletion(false);
          setLoading(false);
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED — this is the key for OAuth
        if (currentSession?.user) {
          if (graceTimeout) clearTimeout(graceTimeout);
          await handleSession(currentSession);
        }
      }
    );

    // Phase 2: Explicit getSession() for initial load
    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        console.log('[Auth] getSession:', !!currentSession?.user);

        if (currentSession?.user) {
          // Check session expiry
          const loginAt = localStorage.getItem(SESSION_EXPIRY_KEY);
          if (loginAt) {
            const elapsed = Date.now() - new Date(loginAt).getTime();
            if (elapsed > SESSION_DURATION_MS) {
              console.log('[Auth] Session expired, signing out');
              localStorage.removeItem(SESSION_EXPIRY_KEY);
              initialLoadDone.current = true; // Mark done BEFORE signOut so SIGNED_OUT is handled
              await supabase.auth.signOut();
              return;
            }
          }

          await handleSession(currentSession);
        } else if (!sessionResolved.current) {
          // No session from getSession(). Could be an OAuth redirect in progress.
          // Wait briefly for SIGNED_IN event before declaring "no user".
          graceTimeout = setTimeout(() => {
            if (mounted && !sessionResolved.current) {
              console.log('[Auth] Grace period expired, no session found');
              setLoading(false);
            }
          }, OAUTH_GRACE_MS);
        }
        // If sessionResolved is already true (INITIAL_SESSION handled it), do nothing
      } catch (err) {
        console.error('[Auth] getSession error:', err);
        if (mounted) {
          setLoading(false);
        }
      } finally {
        initialLoadDone.current = true;
      }
    };

    initSession();

    return () => {
      mounted = false;
      if (graceTimeout) clearTimeout(graceTimeout);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (!error) {
        localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
      }
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) return { error: new Error(authError.message) };
      if (!authData.user) return { error: new Error('Failed to create user') };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          user_id: authData.user.id,
          account_type: data.accountType,
          full_name: data.fullName || null,
          brand_name: data.brandName || null,
          email: data.email,
          location: data.location,
        });

      if (profileError) {
        console.error('Profile creation error:', profileError);
      }

      localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
      return { error: null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      setProfile(null);
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        needsProfileCompletion,
        setNeedsProfileCompletion,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuthContext must be used within an AuthProvider');
  }
  return context;
}
