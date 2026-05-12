import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabaseClient';
import { AuthContextType, UserProfile, SignUpData } from '@/types/auth';
import { markCreatorWelcomePending } from '@/components/CreatorWelcomeOverlay';

const SESSION_EXPIRY_KEY = 'mq_login_at';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours
const OAUTH_GRACE_MS = 3000;

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionResolved = useRef(false);
  const intentionalSignOut = useRef(false);
  // Prevents handleSession from resolving loading while signUp() profile insert is in-flight
  const profileInsertPending = useRef(false);

  const fetchProfile = useCallback(async (userId: string): Promise<{ data: UserProfile | null; failed: boolean }> => {
    try {
      const result = await Promise.race([
        supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', userId)
          .maybeSingle(),
        new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
        ),
      ]);

      if (result.error) {
        console.error('[Auth] Error fetching profile:', result.error);
        return { data: null, failed: true };
      }
      return { data: result.data as UserProfile | null, failed: false };
    } catch (err) {
      console.error('[Auth] fetchProfile failed/timed out:', err);
      return { data: null, failed: true };
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

      const { data: userProfile, failed } = await fetchProfile(currentSession.user.id);
      if (!mounted) return;

      // signUp() is mid-flight — SIGNED_IN fired before the profile insert committed.
      // Keep user/session in state but hold loading=true so Auth.tsx doesn't redirect.
      // signUp() will set the profile and release loading after the insert.
      if (profileInsertPending.current) {
        setSession(currentSession);
        setUser(currentSession.user);
        return;
      }

      const isGoogleUser = currentSession.user.app_metadata?.provider === 'google';

      if (!userProfile && !failed && isGoogleUser) {
        // New Google OAuth user — silently create profile from Google metadata + localStorage type
        const pendingType = localStorage.getItem('mq_pending_acct_type') as import('@/types/auth').AccountType | null;
        const accountType: import('@/types/auth').AccountType = pendingType === 'creator' ? 'creator' : 'brand';
        const meta = currentSession.user.user_metadata;
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .insert({
            user_id: currentSession.user.id,
            account_type: accountType,
            full_name: meta?.full_name || meta?.name || null,
            email: currentSession.user.email || null,
            location: null,
          })
          .select()
          .maybeSingle();
        localStorage.removeItem('mq_pending_acct_type');
        if (accountType === 'creator') markCreatorWelcomePending();
        if (mounted) {
          setProfile(newProfile as UserProfile | null);
          setLoading(false);
        }
      } else {
        setProfile(userProfile);
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
      profileInsertPending.current = true;

      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
          data: { account_type: data.accountType },
        },
      });

      if (authError) {
        profileInsertPending.current = false;
        return { error: new Error(authError.message) };
      }
      if (!authData.user) {
        profileInsertPending.current = false;
        return { error: new Error('Failed to create user') };
      }

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

      profileInsertPending.current = false;

      if (profileError) {
        console.error('Profile creation error:', profileError);
      } else {
        // Fetch the committed profile and resolve loading — handleSession was held
        const { data: newProfile } = await supabase
          .from('user_profiles')
          .select('*')
          .eq('user_id', authData.user.id)
          .maybeSingle();
        setProfile(newProfile as UserProfile | null);
      }

      setLoading(false);
      localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
      return { error: null };
    } catch (err) {
      profileInsertPending.current = false;
      return { error: err as Error };
    }
  };

  const signInWithGoogle = async (accountType?: import('@/types/auth').AccountType) => {
    try {
      // Store in localStorage — survives the full PKCE OAuth redirect cycle
      // (sessionStorage is wiped on cross-origin navigation; URL params can be
      // stripped by Supabase's detectSessionInUrl URL cleanup)
      if (accountType) {
        localStorage.setItem('mq_pending_acct_type', accountType);
      }
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: { redirectTo: `${window.location.origin}/dashboard` },
      });
      if (error) localStorage.removeItem('mq_pending_acct_type');
      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      localStorage.removeItem('mq_pending_acct_type');
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
        signInWithGoogle,
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
