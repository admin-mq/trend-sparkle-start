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

  const checkSessionExpiry = useCallback(async () => {
    const loginAt = localStorage.getItem(SESSION_EXPIRY_KEY);
    if (loginAt) {
      const loginTime = new Date(loginAt).getTime();
      const now = Date.now();
      if (now - loginTime > SESSION_DURATION_MS) {
        // Session expired, force logout
        await supabase.auth.signOut();
        localStorage.removeItem(SESSION_EXPIRY_KEY);
        return true;
      }
    }
    return false;
  }, []);

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
    let initialLoadDone = false;

    const initAuth = async () => {
      const expired = await checkSessionExpiry();
      if (expired) {
        if (mounted) setLoading(false);
        return;
      }

      // Set up auth state listener FIRST
      const { data: { subscription } } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          if (!mounted) return;

          setSession(session);
          setUser(session?.user ?? null);

          if (session?.user) {
            // Only check profile after initial load is done to avoid race condition
            if (initialLoadDone) {
              const userProfile = await fetchProfile(session.user.id);
              if (mounted) {
                setProfile(userProfile);
                setNeedsProfileCompletion(!userProfile);
              }
            }
          } else {
            setProfile(null);
            setNeedsProfileCompletion(false);
          }

          // Don't set loading false here during initial load — let getSession handle it
          if (initialLoadDone && mounted) {
            setLoading(false);
          }
        }
      );

      // THEN check for existing session
      const { data: { session } } = await supabase.auth.getSession();
      if (mounted) {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          if (!localStorage.getItem(SESSION_EXPIRY_KEY)) {
            localStorage.setItem(SESSION_EXPIRY_KEY, new Date().toISOString());
          }

          const userProfile = await fetchProfile(session.user.id);
          if (mounted) {
            setProfile(userProfile);
            setNeedsProfileCompletion(!userProfile);
          }
        }

        initialLoadDone = true;
        setLoading(false);
      }

      return () => {
        mounted = false;
        subscription.unsubscribe();
      };
    };

    initAuth();

    return () => {
      mounted = false;
    };
  }, [checkSessionExpiry, fetchProfile]);

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
