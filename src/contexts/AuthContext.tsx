import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { AuthContextType, UserProfile, SignUpData } from '@/types/auth';

const SESSION_EXPIRY_KEY = 'mq_login_at';
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000; // 24 hours

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [needsProfileCompletion, setNeedsProfileCompletion] = useState(false);

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

    // Phase 1: Set up listener FIRST (required by Supabase), but skip INITIAL_SESSION
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, currentSession) => {
        if (!mounted) return;

        console.log('[Auth] onAuthStateChange:', event, !!currentSession?.user);

        // Skip INITIAL_SESSION — handled by getSession() below
        if (event === 'INITIAL_SESSION') return;

        if (event === 'SIGNED_OUT') {
          setSession(null);
          setUser(null);
          setProfile(null);
          setNeedsProfileCompletion(false);
          setLoading(false);
          return;
        }

        // SIGNED_IN or TOKEN_REFRESHED
        if (currentSession?.user) {
          setSession(currentSession);
          setUser(currentSession.user);
          localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());

          const userProfile = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setProfile(userProfile);
            setNeedsProfileCompletion(!userProfile);
            setLoading(false);
          }
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
              await supabase.auth.signOut();
              return; // SIGNED_OUT event will handle state cleanup
            }
          }

          setSession(currentSession);
          setUser(currentSession.user);

          if (!loginAt) {
            localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
          }

          const userProfile = await fetchProfile(currentSession.user.id);
          if (mounted) {
            setProfile(userProfile);
            setNeedsProfileCompletion(!userProfile);
          }
        }
      } catch (err) {
        console.error('[Auth] getSession error:', err);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    initSession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error) {
        // Set login timestamp for session expiry
        localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
      }

      return { error: error ? new Error(error.message) : null };
    } catch (err) {
      return { error: err as Error };
    }
  };

  const signUp = async (data: SignUpData) => {
    try {
      // Create auth user
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        },
      });

      if (authError) {
        return { error: new Error(authError.message) };
      }

      if (!authData.user) {
        return { error: new Error('Failed to create user') };
      }

      // Create profile
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
        // Don't return error - auth user was created, profile can be created later
      }

      // Set login timestamp
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
