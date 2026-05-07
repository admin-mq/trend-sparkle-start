import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/contexts/AuthContext';
import type { RecommendedTrend } from '@/types/trends';

// ── SavedTrend (48h TTL bookmark of a clicked Recommended Trend) ─────────
//
// The shape mirrors RecommendedTrend (so My Trends can render the SAME
// card UI) plus a small bookmark envelope. We store the full snapshot
// in `trend_snapshot` jsonb at save-time; reads hydrate that back into
// the standard RecommendedTrend interface so callers don't need to
// special-case anything.
//
// Expiry: rows expire 48h after saved_at via the `expires_at` column.
// Reads filter on `expires_at > now()` since we can't put now() in a
// partial-index predicate (Postgres rejects non-IMMUTABLE expressions).

export interface SavedTrend {
  id: string;
  user_id: string;
  brand_id: string | null;
  trend_id: string;
  trend_name: string;
  trend_category: string | null;
  region: string | null;
  trend_snapshot: RecommendedTrend;
  saved_at: string;
  expires_at: string;
}

interface SaveTrendInput {
  brand_id?: string | null;
  trend: RecommendedTrend;
}

/**
 * Hook for the My Trends tab. Returns:
 *   - savedTrends: un-expired bookmarks for the current user
 *     (optionally scoped to a brand_id when provided)
 *   - saveTrend: upsert-on-click
 *   - removeTrend: explicit unsave (the trash button)
 *   - refresh: manual refetch
 *
 * The brand_id parameter scopes the read query — pass the active brand
 * so a creator switching brands doesn't see another brand's bookmarks.
 * Pass `null` for creator-only profiles. Pass `undefined` to read ALL
 * brands' bookmarks for this user.
 */
export function useSavedTrends(brandId?: string | null | undefined) {
  const { user } = useAuthContext();
  const [savedTrends, setSavedTrends] = useState<SavedTrend[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSavedTrends = useCallback(async () => {
    if (!user) {
      setSavedTrends([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('user_saved_trends')
        .select('*')
        .eq('user_id', user.id)
        // Filter expired rows out at the DB level. The 48h TTL lives in
        // the column; we just respect it on read.
        .gt('expires_at', new Date().toISOString())
        .order('saved_at', { ascending: false });

      // brand_id scoping: undefined = no scoping, null = creator path,
      // string = specific brand. Postgres treats NULL specially in
      // .eq() — use .is() for the null case.
      if (brandId === null) query = query.is('brand_id', null);
      else if (typeof brandId === 'string') query = query.eq('brand_id', brandId);

      const { data, error: e } = await query;
      if (e) throw e;
      setSavedTrends((data || []) as unknown as SavedTrend[]);
    } catch (err: any) {
      console.error('[useSavedTrends] fetch failed:', err);
      setError(err?.message || 'Failed to load saved trends');
      setSavedTrends([]);
    } finally {
      setLoading(false);
    }
  }, [user, brandId]);

  useEffect(() => { fetchSavedTrends(); }, [fetchSavedTrends]);

  const saveTrend = useCallback(async ({ brand_id, trend }: SaveTrendInput) => {
    if (!user) {
      return { ok: false as const, error: 'Not signed in' };
    }
    try {
      // UPSERT on (user_id, brand_id, trend_id). Re-clicking the same
      // trend bumps saved_at + expires_at instead of erroring on the
      // unique constraint.
      const nowIso = new Date().toISOString();
      const expiresIso = new Date(Date.now() + 48 * 3600 * 1000).toISOString();
      const { error: e } = await supabase
        .from('user_saved_trends')
        .upsert(
          {
            user_id: user.id,
            brand_id: brand_id ?? null,
            trend_id: trend.trend_id,
            trend_name: trend.trend_name,
            trend_category: trend.category ?? null,
            region: trend.region ?? null,
            trend_snapshot: trend,
            saved_at: nowIso,
            expires_at: expiresIso,
          },
          { onConflict: 'user_id,brand_id,trend_id' }
        );
      if (e) throw e;
      // Optimistic refresh — cheap, single round-trip after the upsert.
      await fetchSavedTrends();
      return { ok: true as const };
    } catch (err: any) {
      console.error('[useSavedTrends] saveTrend failed:', err);
      return { ok: false as const, error: err?.message || 'Save failed' };
    }
  }, [user, fetchSavedTrends]);

  const removeTrend = useCallback(async (id: string) => {
    if (!user) return { ok: false as const };
    try {
      const { error: e } = await supabase
        .from('user_saved_trends')
        .delete()
        .eq('id', id)
        .eq('user_id', user.id);
      if (e) throw e;
      setSavedTrends(prev => prev.filter(t => t.id !== id));
      return { ok: true as const };
    } catch (err) {
      console.error('[useSavedTrends] removeTrend failed:', err);
      return { ok: false as const };
    }
  }, [user]);

  const count = useMemo(() => savedTrends.length, [savedTrends]);

  return {
    savedTrends,
    loading,
    error,
    count,
    saveTrend,
    removeTrend,
    refresh: fetchSavedTrends,
  };
}
