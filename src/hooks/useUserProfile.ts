import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface UserProfileData {
  user_id: string;
  full_name: string | null;
  brand_name: string | null;
  industry: string | null;
  industry_other: string | null;
  geography: string | null;
  business_summary: string | null;
  logo_url: string | null;
  website: string | null;
  instagram: string | null;
  tiktok: string | null;
  youtube: string | null;
  linkedin: string | null;
  updated_at: string | null;
}

export function useUserProfile() {
  const { user, loading: authLoading } = useAuth();
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    if (!user) {
      setProfile(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (fetchError) {
        throw fetchError;
      }

      setProfile(data);
    } catch (err) {
      console.error('Error fetching user profile:', err);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      fetchProfile();
    }
  }, [authLoading, fetchProfile]);

  const saveProfile = async (profileData: Partial<Omit<UserProfileData, 'user_id' | 'updated_at'>>) => {
    if (!user) {
      return { success: false, error: 'Not authenticated' };
    }

    try {
      const { data: existing } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (existing) {
        // Update
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            ...profileData,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (updateError) throw updateError;
      } else {
        // Insert
        const { error: insertError } = await supabase
          .from('user_profiles')
          .insert({
            user_id: user.id,
            ...profileData
          });

        if (insertError) throw insertError;
      }

      await fetchProfile();
      return { success: true };
    } catch (err) {
      console.error('Error saving profile:', err);
      return { success: false, error: 'Failed to save profile' };
    }
  };

  const uploadLogo = async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!user) {
      return { url: null, error: 'Not authenticated' };
    }

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/logo.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('brand-logos')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl, error: null };
    } catch (err) {
      console.error('Error uploading logo:', err);
      return { url: null, error: 'Failed to upload logo' };
    }
  };

  return {
    profile,
    loading: authLoading || loading,
    error,
    saveProfile,
    uploadLogo,
    refetch: fetchProfile,
    isAuthenticated: !!user
  };
}
