import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { useAuthContext } from '@/contexts/AuthContext';
import type { SavedTweetDraft, DraftGeneration } from '@/types/trends';

// ── Row → typed draft ────────────────────────────────────────────────────────
function rowToDraft(row: any): SavedTweetDraft {
  return {
    id: row.id,
    user_id: row.user_id,
    brand_id: row.brand_id ?? null,
    brand_name: row.brand_name ?? null,
    generation_id: row.generation_id,
    trend_name: row.trend_name,
    trend_category: row.trend_category ?? null,
    trend_metadata: row.trend_metadata ?? null,
    region: row.region ?? null,
    topic_angle: row.topic_angle ?? null,
    draft_id: row.draft_id,
    angle: row.angle ?? null,
    tweet_text: row.tweet_text,
    char_count: row.char_count ?? 0,
    char_limit: row.char_limit ?? 280,
    hashtags: Array.isArray(row.hashtags) ? row.hashtags : [],
    over_limit: !!row.over_limit,
    live_context_source: row.live_context_source ?? null,
    live_context_preview: row.live_context_preview ?? null,
    is_favorite: !!row.is_favorite,
    posted_at: row.posted_at ?? null,
    created_at: row.created_at,
  };
}

// ── Group flat drafts into generations (3 drafts per click) ──────────────────
function groupByGeneration(drafts: SavedTweetDraft[]): DraftGeneration[] {
  const map = new Map<string, DraftGeneration>();

  for (const d of drafts) {
    let g = map.get(d.generation_id);
    if (!g) {
      g = {
        generation_id: d.generation_id,
        trend_name: d.trend_name,
        trend_category: d.trend_category,
        region: d.region,
        brand_name: d.brand_name,
        topic_angle: d.topic_angle,
        live_context_source: d.live_context_source,
        live_context_preview: d.live_context_preview,
        created_at: d.created_at,
        drafts: [],
      };
      map.set(d.generation_id, g);
    }
    g.drafts.push(d);
  }

  // Sort drafts within a generation by draft_id; sort generations newest first
  for (const g of map.values()) {
    g.drafts.sort((a, b) => a.draft_id - b.draft_id);
  }
  return Array.from(map.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
  );
}

export function useTweetDrafts() {
  const { user } = useAuthContext();
  const [drafts, setDrafts] = useState<SavedTweetDraft[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDrafts = useCallback(async () => {
    if (!user?.id) {
      setDrafts([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data, error: fetchError } = await (supabase as any)
        .from('tweet_drafts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(500);

      if (fetchError) throw fetchError;
      setDrafts((data || []).map(rowToDraft));
    } catch (err: any) {
      console.error('[useTweetDrafts] fetch failed:', err);
      setError(err?.message || 'Failed to load saved drafts');
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  useEffect(() => {
    fetchDrafts();
  }, [fetchDrafts]);

  const generations = useMemo(() => groupByGeneration(drafts), [drafts]);

  // ── Mutations (optimistic) ────────────────────────────────────────────────
  const toggleFavorite = useCallback(
    async (id: string, next: boolean) => {
      // Optimistic update
      setDrafts(prev => prev.map(d => (d.id === id ? { ...d, is_favorite: next } : d)));

      const { error: err } = await (supabase as any)
        .from('tweet_drafts')
        .update({ is_favorite: next })
        .eq('id', id);

      if (err) {
        // Revert on failure
        setDrafts(prev => prev.map(d => (d.id === id ? { ...d, is_favorite: !next } : d)));
        return { success: false, error: err.message };
      }
      return { success: true };
    },
    []
  );

  const markPosted = useCallback(
    async (id: string, posted: boolean) => {
      const value = posted ? new Date().toISOString() : null;
      setDrafts(prev => prev.map(d => (d.id === id ? { ...d, posted_at: value } : d)));

      const { error: err } = await (supabase as any)
        .from('tweet_drafts')
        .update({ posted_at: value })
        .eq('id', id);

      if (err) {
        setDrafts(prev => prev.map(d => (d.id === id ? { ...d, posted_at: posted ? null : new Date().toISOString() } : d)));
        return { success: false, error: err.message };
      }
      return { success: true };
    },
    []
  );

  const deleteDraft = useCallback(
    async (id: string) => {
      const previous = drafts;
      setDrafts(prev => prev.filter(d => d.id !== id));

      const { error: err } = await (supabase as any)
        .from('tweet_drafts')
        .delete()
        .eq('id', id);

      if (err) {
        setDrafts(previous);
        return { success: false, error: err.message };
      }
      return { success: true };
    },
    [drafts]
  );

  const deleteGeneration = useCallback(
    async (generation_id: string) => {
      const previous = drafts;
      setDrafts(prev => prev.filter(d => d.generation_id !== generation_id));

      const { error: err } = await (supabase as any)
        .from('tweet_drafts')
        .delete()
        .eq('generation_id', generation_id);

      if (err) {
        setDrafts(previous);
        return { success: false, error: err.message };
      }
      return { success: true };
    },
    [drafts]
  );

  return {
    drafts,
    generations,
    loading,
    error,
    refetch: fetchDrafts,
    toggleFavorite,
    markPosted,
    deleteDraft,
    deleteGeneration,
  };
}
