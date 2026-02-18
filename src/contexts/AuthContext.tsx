import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { AuthContextType, UserProfile, SignUpData } from '@/types/auth';

const SESSION_EXPIRY_KEY = 'mq_login_at';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const OAUTH_GRACE_MS = 3000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);
  const sessionResolved = useRef(false);
  // Only honor SIGNED_OUT events when we explicitly trigger sign-out
  const intentionalSignOut = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<UserProfile | null> => {
    try {
      const result = await Promise.race([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 4000)
        ),
      ]);

      if (result.error) {
        console.error('[Auth] Error fetching profile:', result.error);
        return null;
      }
      return result.data as UserProfile | null;
    } catch (err) {
      console.error('[Auth] fetchProfile failed/timed out:', err);
      return null;
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    let graceTimeout: ReturnType<typeof setTimeout> | null = null;

    // Hard safety: never stay loading longer than 5 seconds
    const safetyTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.warn('[Auth] Safety timeout reached – forcing loading=false');
        sessionResolved.current = true;
        setLoading(false);
      }
    }, 5000);

    const handleSession = async (currentSession: Session) => {
      if (!mounted) return;
      sessionResolved.current = true;
      if (graceTimeout) clearTimeout(graceTimeout);

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

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log('[Auth] onAuthStateChange:', event, !!currentSession?.user);

        if (event === 'INITIAL_SESSION') {
          if (currentSession?.user) {
            console.log('[Auth] INITIAL_SESSION has valid session, using it');
            await handleSession(currentSession);
          } else {
            console.log('[Auth] INITIAL_SESSION has no session, resolving loading');
            sessionResolved.current = true;
            if (graceTimeout) clearTimeout(graceTimeout);
            setLoading(false);
          }
          return;
        }

        if (event === 'SIGNED_OUT') {
          if (intentionalSignOut.current) {
            intentionalSignOut.current = false;
            sessionResolved.current = true;
            if (graceTimeout) clearTimeout(graceTimeout);
            setSession(null);
            setUser(null);
            setProfile(null);
            setNeedsProfileCompletion(false);
            setLoading(false);
          } else {
            console.log('[Auth] Ignoring non-intentional SIGNED_OUT (stale token refresh)');
          }
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED
        if (currentSession?.user) {
          await handleSession(currentSession);
        }
      }
    );

    const initSession = async () => {
      try {
        const { data: { session: currentSession } } = await supabase.auth.getSession();
        if (!mounted) return;

        console.log('[Auth] getSession:', !!currentSession?.user);

        if (currentSession?.user) {
          const loginAt = localStorage.getItem(SESSION_EXPIRY_KEY);
          if (loginAt) {
            const elapsed = Date.now() - new Date(loginAt).getTime();
            if (elapsed > SESSION_DURATION_MS) {
              console.log('[Auth] Session expired, signing out');
              localStorage.removeItem(SESSION_EXPIRY_KEY);
              intentionalSignOut.current = true;
              await supabase.auth.signOut();
              return;
            }
          }
          await handleSession(currentSession);
        } else if (!sessionResolved.current) {
          graceTimeout = setTimeout(() => {
            if (mounted && !sessionResolved.current) {
              console.log('[Auth] Grace period expired, no session found');
              setLoading(false);
            }
          }, OAUTH_GRACE_MS);
        }
      } catch (err) {
        console.error('[Auth] getSession error:', err);
        if (mounted) setLoading(false);
      }
    };

    initSession();

    return () => {
      mounted = false;
      clearTimeout(safetyTimeout);
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
      intentionalSignOut.current = true;
      localStorage.removeItem(SESSION_EXPIRY_KEY);
      // Clear state immediately so UI redirects without waiting for listener
      setUser(null);
      setSession(null);
      setProfile(null);
      setNeedsProfileCompletion(false);
      const { error } = await supabase.auth.signOut();
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      intentionalSignOut.current = false;
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
