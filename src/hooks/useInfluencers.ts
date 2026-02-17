import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface Influencer {
  id: string;
  name: string;
  username: string;
  followers: number;
  niche_audience: string | null;
  geography: string | null;
  created_at: string;
}

export interface InfluencerFilters {
  search: string;
  niche: string;
  geography: string;
  followersMin: string;
  followersMax: string;
}

export function useInfluencers(filters: InfluencerFilters) {
  const { user } = useAuth();
  const [influencers, setInfluencers] = useState<Influencer[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchInfluencers = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    let query = supabase
      .from("influencers")
      .select("*")
      .order("created_at", { ascending: false });

    if (filters.search) {
      query = query.or(`name.ilike.%${filters.search}%,username.ilike.%${filters.search}%`);
    }
    if (filters.niche && filters.niche !== "any") {
      query = query.eq("niche_audience", filters.niche);
    }
    if (filters.geography && filters.geography !== "any") {
      query = query.eq("geography", filters.geography);
    }
    if (filters.followersMin) {
      query = query.gte("followers", parseInt(filters.followersMin) || 0);
    }
    if (filters.followersMax) {
      query = query.lte("followers", parseInt(filters.followersMax) || 999999999);
    }

    const { data, error } = await query;
    if (error) {
      toast.error("Failed to load influencers");
    } else {
      setInfluencers(data || []);
    }
    setLoading(false);
  }, [user, filters]);

  useEffect(() => {
    fetchInfluencers();
  }, [fetchInfluencers]);

  const addInfluencer = async (values: {
    name: string;
    username: string;
    followers: number;
    niche_audience: string;
    geography: string;
  }) => {
    if (!user) return false;
    const { error } = await supabase.from("influencers").insert({
      ...values,
      user_id: user.id,
    });
    if (error) {
      toast.error("Failed to add influencer");
      return false;
    }
    toast.success("Influencer added successfully!");
    await fetchInfluencers();
    return true;
  };

  const bulkAddInfluencers = async (rows: { name: string; username: string; followers: number; niche_audience: string; geography: string }[]) => {
    if (!user) return false;
    const payload = rows.map((r) => ({ ...r, user_id: user.id }));
    const { error } = await supabase.from("influencers").insert(payload);
    if (error) {
      toast.error("Bulk upload failed");
      return false;
    }
    toast.success(`Successfully imported ${rows.length} influencer${rows.length !== 1 ? "s" : ""}`);
    await fetchInfluencers();
    return true;
  };

  return { influencers, loading, addInfluencer, bulkAddInfluencers, refetch: fetchInfluencers };
}
