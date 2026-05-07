import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/contexts/AuthContext';
import type { DetailedDirection } from '@/types/trends';

// ── SavedBlueprint (auto-saved Execution Blueprints) ───────────────────
//
// Every time the user reaches the Blueprint stage in Trend Quest and
// `setDetailedDirection` lands a successful generate-blueprint
// response, we upsert a row here. No TTL — these are real drafts.
// Surfaced on /tweet-drafts (sidebar "My Drafts") in the Blueprints tab.
//
// Uniqueness: (user, brand, trend, direction_title). Re-running
// generate-blueprint for the same direction overwrites — the user
// shouldn't see a pile of revisions of the same idea.

export interface SavedBlueprint {
  id: string;
  user_id: string;
  brand_id: string | null;
  brand_name: string | null;
  trend_id: string;
  trend_name: string;
  trend_category: string | null;
  region: string | null;
  trend_hashtags: string | null;
  direction_title: string;
  direction_summary: string | null;
  blueprint: DetailedDirection;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

interface SaveBlueprintInput {
  brand_id?: string | null;
  brand_name?: string | null;
  trend_id: string;
  trend_name: string;
  trend_category?: string | null;
  region?: string | null;
  trend_hashtags?: string | null;
  direction_title: string;
  direction_summary?: string | null;
  blueprint: DetailedDirection;
}

export function useSavedBlueprints(brandId?: string | null | undefined) {
  const { user } = useAuthContext();
  const [blueprints, setBlueprints] = useState<SavedBlueprint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBlueprints = useCallback(async () => {
    if (!user) {
      setBlueprints([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('user_saved_blueprints')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (brandId === null) query = query.is('brand_id', null);
      else if (typeof brandId === 'string') query = query.eq('brand_id', brandId);
      const { data, error: e } = await query;
      if (e) throw e;
      setBlueprints((data || []) as unknown as SavedBlueprint[]);
    } catch (err: any) {
      console.error('[useSavedBlueprints] fetch failed:', err);
      setError(err?.message || 'Failed to load saved blueprints');
      setBlueprints([]);
    } finally {
      setLoading(false);
    }
  }, [user, brandId]);

  useEffect(() => { fetchBlueprints(); }, [fetchBlueprints]);

  const saveBlueprint = useCallback(async (input: SaveBlueprintInput) => {
    if (!user) return { ok: false as const, error: 'Not signed in' };
    try {
      const { error: e } = await supabase
        .from('user_saved_blueprints')
        .upsert(
          {
            user_id: user.id,
            brand_id: input.brand_id ?? null,
            brand_name: input.brand_name ?? null,
            trend_id: input.trend_id,
            trend_name: input.trend_name,
            trend_category: input.trend_category ?? null,
            region: input.region ?? null,
            trend_hashtags: input.trend_hashtags ?? null,
            direction_title: input.direction_title,
            direction_summary: input.direction_summary ?? null,
            blueprint: input.blueprint,
          },
          { onConflict: 'user_id,brand_id,trend_id,direction_title' }
        );
      if (e) throw e;
      await fetchBlueprints();
      return { ok: true as const };
    } catch (err: any) {
      console.error('[useSavedBlueprints] saveBlueprint failed:', err);
      return { ok: false as const, error: err?.message || 'Save failed' };
    }
  }, [user, fetchBlueprints]);

  const toggleFavorite = useCallback(async (id: string, isFavorite: boolean) => {
    if (!user) return { ok: false as const };
    // Optimistic update.
    setBlueprints(prev => prev.map(b => b.id === id ? { ...b, is_favorite: isFavorite } : b));
    try {
      const { error: e } = await supabase
        .from('user_saved_blueprints')
        .update({ is_favorite: isFavorite })
        .eq('id', id)
        .eq('user_id', user.id);
      if (e) throw e;
      return { ok: true as const };
    } catch (err) {
      // Roll back optimistic update on failure.
      setBlueprints(prev => prev.map(b => b.id === id ? { ...b, is_favorite: !isFavorite } : b));
      return { ok: false as const };
    }
  }, [user]);

  const removeBlueprint = useCallback(async (id: string) => {
    if (!user) return { ok: false as const };
    try {
      const { error: e } = await supabase
        .from('user_saved_blueprints')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (e) throw e;
      setBlueprints(prev => prev.filter(b => b.id !== id));
      return { ok: true as const };
    } catch (err) {
      console.error('[useSavedBlueprints] removeBlueprint failed:', err);
      return { ok: false as const };
    }
  }, [user]);

  return {
    blueprints,
    loading,
    error,
    saveBlueprint,
    toggleFavorite,
    removeBlueprint,
    refresh: fetchBlueprints,
  };
}
