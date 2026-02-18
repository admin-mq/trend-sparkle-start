import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/contexts/AuthContext';

export interface BrandProfile {
  id: string;
  user_id: string;
  session_id?: string;
  brand_name: string;
  industry: string | null;
  industry_other: string | null;
  geography: string | null;
  business_summary: string | null;
  logo_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface BrandProfileInput {
  brand_name: string;
  industry?: string | null;
  industry_other?: string | null;
  geography?: string | null;
  business_summary?: string | null;
  logo_url?: string | null;
}

export function useBrandProfiles() {
  const { user } = useAuthContext();
  const userId = user?.id ?? null;
  const [brands, setBrands] = useState<BrandProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBrands = useCallback(async () => {
    if (!userId) {
      setBrands([]);
      setLoading(false);
      return;
    }
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('brand_profiles')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (fetchError) throw fetchError;
      setBrands(data || []);
    } catch (err) {
      console.error('Error fetching brand profiles:', err);
      setError('Failed to load brand profiles');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    fetchBrands();
  }, [fetchBrands]);

  const createBrand = async (input: BrandProfileInput): Promise<{ success: boolean; brand?: BrandProfile; error?: string }> => {
    if (!userId) return { success: false, error: 'You must be logged in to create a brand' };

    try {
      const { data, error: insertError } = await (supabase as any)
        .from('brand_profiles')
        .insert({
          user_id: userId,
          ...input
        })
        .select()
        .single();

      if (insertError) throw insertError;
      
      await fetchBrands();
      return { success: true, brand: data };
    } catch (err: any) {
      console.error('Error creating brand profile:', err);
      return { success: false, error: err?.message || 'Failed to create brand profile' };
    }
  };

  const updateBrand = async (id: string, input: Partial<BrandProfileInput>): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'You must be logged in' };

    try {
      const { error: updateError } = await (supabase as any)
        .from('brand_profiles')
        .update({
          ...input,
          updated_at: new Date().toISOString()
        })
        .eq('id', id)
        .eq('user_id', userId);

      if (updateError) throw updateError;
      
      await fetchBrands();
      return { success: true };
    } catch (err: any) {
      console.error('Error updating brand profile:', err);
      return { success: false, error: err?.message || 'Failed to update brand profile' };
    }
  };

  const deleteBrand = async (id: string): Promise<{ success: boolean; error?: string }> => {
    if (!userId) return { success: false, error: 'You must be logged in' };

    try {
      const { error: deleteError } = await (supabase as any)
        .from('brand_profiles')
        .delete()
        .eq('id', id)
        .eq('user_id', userId);

      if (deleteError) throw deleteError;
      
      await fetchBrands();
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting brand profile:', err);
      return { success: false, error: err?.message || 'Failed to delete brand profile' };
    }
  };

  const uploadLogo = async (file: File): Promise<{ url: string | null; error: string | null }> => {
    if (!userId) return { url: null, error: 'You must be logged in' };

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}/${crypto.randomUUID()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('brand-logos')
        .upload(fileName, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from('brand-logos')
        .getPublicUrl(fileName);

      return { url: urlData.publicUrl, error: null };
    } catch (err: any) {
      console.error('Error uploading logo:', err);
      return { url: null, error: err?.message || 'Failed to upload logo' };
    }
  };

  return {
    brands,
    loading,
    error,
    createBrand,
    updateBrand,
    deleteBrand,
    uploadLogo,
    refetch: fetchBrands
  };
}
