import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { BrandSelector } from "@/components/BrandSelector";
import { CreatorSelector } from "@/components/CreatorSelector";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { SavedTrends } from "@/components/SavedTrends";
import { TwitterTrends } from "@/components/TwitterTrends";
import { TwitterContent } from "@/components/TwitterContent";
import { WorkspaceStepper, WorkspaceStep } from "@/components/WorkspaceStepper";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import { useSavedTrends } from "@/hooks/useSavedTrends";
import { useSavedBlueprints } from "@/hooks/useSavedBlueprints";
import {
  TrendQuestInputValues,
  deriveToneString,
  getPrimaryTone,
  getToneMeterLabel,
  mapGeographyToLocation,
  industryToCategories,
} from "@/components/TrendQuestInputs";
import { RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection, TwitterTrendsResponse, TwitterTrend, GeneratedTweet } from "@/types/trends";
import { useAuth } from "@/hooks/useAuth";
import { useAuthContext } from "@/contexts/AuthContext";
import { useBrandProfiles, BrandProfile } from "@/hooks/useBrandProfiles";
import { BrandMemory, updateBrandMemory } from "@/lib/brandMemory";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

// ── Session persistence ────────────────────────────────────────────────────────
// Results survive navigation away and back. They're only replaced when the
// user clicks "Get Trend Recommendations" and a new fetch completes.

const STORAGE_KEY = 'mq_trend_quest_v1';

function loadSession(currentUserId?: string) {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    // Discard session if it belongs to a different user
    if (currentUserId && parsed.userId && parsed.userId !== currentUserId) {
      sessionStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch { return null; }
}

// ─────────────────────────────────────────────────────────────────────────────

const DEFAULT_INPUT_VALUES: TrendQuestInputValues = {
  audience: "",
  audience_other: "",
  content_format: "",
  content_format_other: "",
  primary_goal: "",
  tones: ["casual"],
  tone_intensity: 3,
  platform: "Twitter",
  topic_angle: "",
  content_categories: [],
  // Defaults to UK; overridden in the brand-load effect below from
  // brand_profiles.geography (or creator profile location). User can
  // change in the dropdown once on screen.
  target_location: "UK",
  twitter_geography: "UK",
  twitter_user_type: "standard",
};

type CreatorProfileData = {
  full_name: string | null;
  industry: string | null;
  industry_other: string | null;
  location: string | null;
  business_summary: string | null;
  is_faceless: boolean;
};

const TrendQuest = () => {
  const { user } = useAuth();
  const { user: authUser, profile: authProfile } = useAuthContext();
  const navigate = useNavigate();
  const { brands, loading: brandsLoading } = useBrandProfiles();

  const isCreator =
    authProfile?.account_type === "creator" ||
    authUser?.user_metadata?.account_type === "creator";

  // Load previously persisted session once at mount, scoped to current user
  const session = useMemo(() => loadSession(user?.id), [user?.id]);

  const [creatorProfile, setCreatorProfile] = useState<CreatorProfileData | null>(null);

  // Selected brand
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(session?.selectedBrandId ?? null);

  // Trend Quest inputs (non-brand fields)
  const [inputValues, setInputValues] = useState<TrendQuestInputValues>(session?.inputValues ?? DEFAULT_INPUT_VALUES);

  // Step navigation
  const [activeStep, setActiveStep] = useState<WorkspaceStep>(session?.activeStep ?? "trends");

  // Brand profile & recommendations
  const [recommendations, setRecommendations] = useState<RecommendedTrend[]>(session?.recommendations ?? []);
  const [categoryFallback, setCategoryFallback] = useState<boolean>(session?.categoryFallback ?? false);
  const [brandName, setBrandName] = useState<string>(session?.brandName ?? '');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // ── Saved Trends (My Trends) — 48h-TTL bookmarks ────────────────────────
  // Scope to active brand for brand accounts, null for creator profiles.
  // The hook returns un-expired bookmarks only (read-time filter).
  const savedTrendsBrandScope = isCreator ? null : (selectedBrandId || null);
  const {
    savedTrends,
    loading: savedTrendsLoading,
    saveTrend,
    removeTrend,
    count: savedTrendsCount,
  } = useSavedTrends(savedTrendsBrandScope);
  const savedTrendIds = useMemo(
    () => new Set(savedTrends.map(s => s.trend_id)),
    [savedTrends]
  );

  // ── Saved Blueprints (My Drafts) — auto-save on blueprint reach ─────────
  // No TTL. Re-running generate-blueprint for the same direction overwrites
  // (unique key includes direction_title). Surfaced on /tweet-drafts.
  const { saveBlueprint } = useSavedBlueprints(savedTrendsBrandScope);

  // Creative directions
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>(session?.creativeDirections ?? []);
  const [selectedTrendName, setSelectedTrendName] = useState<string>(session?.selectedTrendName ?? '');
  const [selectedTrendId, setSelectedTrendId] = useState<string>(session?.selectedTrendId ?? '');
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  // Blueprint
  const [detailedDirection, setDetailedDirection] = useState<DetailedDirection | null>(session?.detailedDirection ?? null);
  const [selectedIdeaTitle, setSelectedIdeaTitle] = useState<string>(session?.selectedIdeaTitle ?? '');
  const [selectedDirection, setSelectedDirection] = useState<CreativeDirection | null>(session?.selectedDirection ?? null);
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [trendHashtags, setTrendHashtags] = useState<string>(session?.trendHashtags ?? '');

  // Twitter / Social Pulse state
  const [twitterData, setTwitterData] = useState<TwitterTrendsResponse | null>(session?.twitterData ?? null);
  const [generatedTweets, setGeneratedTweets] = useState<GeneratedTweet[]>(session?.generatedTweets ?? []);
  const [tweetsSaved, setTweetsSaved] = useState<boolean>(session?.tweetsSaved ?? false);
  const [tweetsSaveError, setTweetsSaveError] = useState<string | null>(session?.tweetsSaveError ?? null);
  const [tweetsLiveContextSource, setTweetsLiveContextSource] = useState<'live' | 'stale' | 'none' | null>(session?.tweetsLiveContextSource ?? null);
  const [tweetsLiveContextPreview, setTweetsLiveContextPreview] = useState<string | null>(session?.tweetsLiveContextPreview ?? null);
  const [selectedTwitterTrend, setSelectedTwitterTrend] = useState<TwitterTrend | null>(session?.selectedTwitterTrend ?? null);
  const [tweetsLoading, setTweetsLoading] = useState(false);
  const [tweetsError, setTweetsError] = useState<string | null>(null);
  const [isRefreshingTwitter, setIsRefreshingTwitter] = useState(false);

  // Brand memory for learning from feedback
  const [brandMemory, setBrandMemory] = useState<BrandMemory | null>(null);

  // ── Persist state to sessionStorage whenever results/inputs change ───────
  useEffect(() => {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify({
        userId: user?.id,
        selectedBrandId,
        inputValues,
        activeStep,
        recommendations,
        categoryFallback,
        brandName,
        creativeDirections,
        selectedTrendName,
        selectedTrendId,
        detailedDirection,
        selectedIdeaTitle,
        selectedDirection,
        trendHashtags,
        twitterData,
        generatedTweets,
        tweetsSaved,
        tweetsSaveError,
        tweetsLiveContextSource,
        tweetsLiveContextPreview,
        selectedTwitterTrend,
      }));
    } catch { /* quota exceeded — silent */ }
  }, [
    user?.id,
    selectedBrandId, inputValues, activeStep,
    recommendations, categoryFallback, brandName,
    creativeDirections, selectedTrendName, selectedTrendId,
    detailedDirection, selectedIdeaTitle, selectedDirection, trendHashtags,
    twitterData, generatedTweets, tweetsSaved, tweetsSaveError,
    tweetsLiveContextSource, tweetsLiveContextPreview, selectedTwitterTrend,
  ]);

  // Auto-select first brand if only one exists
  useEffect(() => {
    if (brands.length > 0 && !selectedBrandId) {
      setSelectedBrandId(brands[0].id);
    }
  }, [brands, selectedBrandId]);

  // Default target_location from the active brand / creator profile's
  // geography. Only fires when the user hasn't manually picked one yet
  // (we track that by comparing against the DEFAULT_INPUT_VALUES default
  // 'UK' value AND the previously-derived default — once the user
  // changes the dropdown, we never overwrite their choice on a brand
  // switch). The `mapGeographyToLocation` helper falls back to null on
  // unknown strings; we keep the existing value in that case.
  const [autoLocationDerived, setAutoLocationDerived] = useState<string | null>(null);
  useEffect(() => {
    let geography: string | null | undefined;
    if (isCreator) {
      geography = creatorProfile?.location;
    } else if (selectedBrandId) {
      geography = brands.find(b => b.id === selectedBrandId)?.geography;
    }
    const mapped = mapGeographyToLocation(geography);
    if (!mapped) return;
    // Only auto-apply when the user hasn't overridden — i.e. the current
    // value still matches the last value WE auto-set, OR it's the
    // hardcoded initial default and we've never auto-set anything.
    setInputValues(prev => {
      const userTouched = autoLocationDerived !== null && prev.target_location !== autoLocationDerived;
      if (userTouched) return prev;
      if (prev.target_location === mapped) return prev;
      return { ...prev, target_location: mapped };
    });
    setAutoLocationDerived(mapped);
  }, [isCreator, creatorProfile, selectedBrandId, brands]);  // autoLocationDerived intentionally omitted to avoid feedback loop

  // ── Auto-derive trend categories from brand industry ───────────────────
  // Mirrors the location auto-derive above. Brand industry "Technology &
  // Software (SaaS/AI)" → Tech + Entrepreneurship pre-filled. The user
  // can still toggle chips to override; once they do, we never overwrite
  // their choice on a brand switch (we compare against the last value WE
  // auto-set to detect override). We persist the derived value in
  // autoCategoriesDerived as a JSON string so the same-value check works.
  const [autoCategoriesDerived, setAutoCategoriesDerived] = useState<string | null>(null);
  useEffect(() => {
    let industry: string | null | undefined;
    if (isCreator) {
      industry = creatorProfile?.industry === 'Other' && creatorProfile?.industry_other
        ? creatorProfile.industry_other
        : creatorProfile?.industry;
    } else if (selectedBrandId) {
      const b = brands.find(b => b.id === selectedBrandId);
      industry = b?.industry === 'Other' && b?.industry_other ? b.industry_other : b?.industry;
    }
    const mapped = industryToCategories(industry);
    if (mapped.length === 0) return; // unknown industry — leave chips alone
    const mappedKey = JSON.stringify(mapped);
    setInputValues(prev => {
      const prevKey = JSON.stringify(prev.content_categories);
      const userTouched = autoCategoriesDerived !== null && prevKey !== autoCategoriesDerived;
      if (userTouched) return prev;
      if (prevKey === mappedKey) return prev;
      return { ...prev, content_categories: mapped };
    });
    setAutoCategoriesDerived(mappedKey);
  }, [isCreator, creatorProfile, selectedBrandId, brands]);  // autoCategoriesDerived intentionally omitted to avoid feedback loop

  // Build UserProfile by merging brand data + trend quest inputs
  const buildUserProfile = (brand: BrandProfile, inputs: TrendQuestInputValues): UserProfile => {
    const industry = brand.industry === "Other" && brand.industry_other
      ? brand.industry_other
      : (brand.industry || "");

    const audience = inputs.audience === "Other" && inputs.audience_other
      ? inputs.audience_other
      : inputs.audience;

    const contentFormat = inputs.content_format === "Other" && inputs.content_format_other
      ? inputs.content_format_other
      : inputs.content_format;

    const primaryTone = getPrimaryTone(inputs.tones);

    return {
      brand_name: brand.brand_name,
      business_summary: brand.business_summary || "",
      industry: industry,
      niche: "",
      audience: audience,
      geography: brand.geography || "",
      content_format: contentFormat,
      primary_goal: inputs.primary_goal,
      tone: deriveToneString(inputs.tones),
      tones: inputs.tones,
      primary_tone: primaryTone,
      tone_intensity: inputs.tone_intensity,
      tone_meter_label: getToneMeterLabel(primaryTone),
      // New platform fields
      platform: inputs.platform as any,
      topic_angle: inputs.topic_angle || undefined,
      content_categories: inputs.content_categories.length > 0 ? inputs.content_categories : undefined,
      twitter_geography: inputs.platform === 'Twitter' ? inputs.twitter_geography : undefined,
      twitter_user_type: inputs.platform === 'Twitter' ? inputs.twitter_user_type : undefined,
    };
  };

  const buildCreatorProfile = (cp: CreatorProfileData, inputs: TrendQuestInputValues): UserProfile => {
    const audience = inputs.audience === "Other" && inputs.audience_other
      ? inputs.audience_other
      : inputs.audience;
    const contentFormat = inputs.content_format === "Other" && inputs.content_format_other
      ? inputs.content_format_other
      : inputs.content_format;
    const primaryTone = getPrimaryTone(inputs.tones);
    // Prefer AI-parsed persona fields; fall back to raw profile fields
    const persona = (cp as any).creator_persona;
    const resolvedNiche = persona?.niche || cp.industry || "";
    const resolvedLocation = persona?.location_normalized || cp.location || "";
    return {
      brand_name: cp.full_name || resolvedNiche || "Creator",
      business_summary: persona?.summary || cp.business_summary || "",
      industry: resolvedNiche,
      niche: resolvedNiche,
      audience,
      geography: resolvedLocation,
      content_format: contentFormat,
      primary_goal: inputs.primary_goal,
      tone: deriveToneString(inputs.tones),
      tones: inputs.tones,
      primary_tone: primaryTone,
      tone_intensity: inputs.tone_intensity,
      tone_meter_label: getToneMeterLabel(primaryTone),
      platform: inputs.platform as any,
      topic_angle: inputs.topic_angle || undefined,
      content_categories: inputs.content_categories.length > 0 ? inputs.content_categories : undefined,
      twitter_geography: inputs.platform === "Twitter" ? inputs.twitter_geography : undefined,
      twitter_user_type: inputs.platform === "Twitter" ? inputs.twitter_user_type : undefined,
      is_faceless: cp.is_faceless,
    };
  };

  // Update brand name and profile when brand selection or inputs change
  useEffect(() => {
    if (isCreator) {
      if (creatorProfile?.industry) {
        setBrandName(creatorProfile.full_name || creatorProfile.industry || "Creator");
        setUserProfile(buildCreatorProfile(creatorProfile, inputValues));
      } else {
        setBrandName('');
        setUserProfile(null);
      }
      return;
    }
    if (selectedBrandId) {
      const brand = brands.find(b => b.id === selectedBrandId);
      if (brand) {
        setBrandName(brand.brand_name);
        setUserProfile(buildUserProfile(brand, inputValues));
      }
    } else {
      setBrandName('');
      setUserProfile(null);
    }
  }, [selectedBrandId, brands, inputValues, isCreator, creatorProfile]);

  const handleFeedback = async (params: {
    outputType: "hook" | "caption" | "blueprint";
    newOutput: string;
    userFeedback: "love" | "ok" | "dislike";
  }) => {
    if (!userProfile?.brand_name) return;

    const result = await updateBrandMemory({
      brand_profile: userProfile,
      current_memory: brandMemory,
      new_output: params.newOutput,
      output_type: params.outputType,
      user_feedback: params.userFeedback,
      user_id: user?.id || null,
    });

    if (result.success && result.updated_memory) {
      setBrandMemory(result.updated_memory);
      toast.success("Feedback saved! AI will learn from this.");
    } else {
      console.error("Failed to update brand memory:", result.error);
    }
  };

  const handleRefreshTrends = async () => {
    setIsRefreshing(true);
    try {
      // Note: recommend-trends now owns the cooldown decision. Within 2h
      // it'll reshuffle from the cached candidate pool (no fetch-trends
      // re-run needed) and return cooldown_active=true. After 2h, it
      // falls through to a fresh DB query and we run fetch-trends in the
      // background to refill the pool. We deliberately DON'T await
      // fetch-trends in the cooldown path — that would defeat the cache.
      if (userProfile) {
        const { data } = await supabase.functions.invoke('recommend-trends', {
          body: {
            user_profile: userProfile,
            user_id: user?.id || null,
            location: inputValues.target_location,
            brand_id: !isCreator ? (selectedBrandId || undefined) : undefined,
            selected_categories: inputValues.content_categories.length > 0 ? inputValues.content_categories : undefined,
            refresh: true,
          }
        });
        if (data?.recommended_trends) {
          setRecommendations(data.recommended_trends);
          setCategoryFallback(!!data.category_fallback);
          if (data.cooldown_active) {
            // Honest copy: tell the user we're recycling because we just
            // ran a fetch <2h ago. The "less relevant trends" framing is
            // accurate — un-served picks are exhausted, we're scraping
            // the bottom of the same pool.
            toast.message("Too soon to refresh", {
              description:
                "Showing less-relevant trends from your last batch. We refresh the source data every 2 hours to avoid spamming our upstream APIs.",
              duration: 6000,
            });
          }
        }
      }
    } catch (err) {
      console.error('Refresh failed:', err);
      toast.error('Refresh failed. Try again.');
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRecommendationsReceived = (
    newRecommendations: RecommendedTrend[],
    opts?: { categoryFallback?: boolean },
  ) => {
    setRecommendations(newRecommendations);
    setCategoryFallback(!!opts?.categoryFallback);
    setActiveStep("trends");
    // Clear downstream state
    setCreativeDirections([]);
    setDetailedDirection(null);
  };

  // Get trends — branches on platform
  const handleGetTrends = async () => {
    if (!userProfile) return;
    if (!isCreator && !selectedBrandId) return;

    const isTwitter = inputValues.platform === 'Twitter';

    if (isTwitter) {
      // ── Twitter / Social Pulse path ──
      setTrendsLoading(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-twitter-trends', {
          body: {
            region: inputValues.twitter_geography || 'UK',
            categories: inputValues.content_categories || [],
            count: 60,
            user_niche: userProfile?.niche || userProfile?.industry || undefined,
          },
        });
        if (fnError) throw new Error(fnError.message || 'Failed to fetch Twitter trends');
        if (!data || !data.trends) throw new Error('Invalid response from Twitter trends service');

        setTwitterData(data);
        setActiveStep("trends");
        setGeneratedTweets([]);
        setSelectedTwitterTrend(null);
        // Clear normal-flow state
        setRecommendations([]);
        setCreativeDirections([]);
        setDetailedDirection(null);
      } catch (err) {
        console.error('Twitter trends error:', err);
        toast.error(err instanceof Error ? err.message : 'Failed to fetch Twitter trends');
      } finally {
        setTrendsLoading(false);
      }
      return;
    }

    // ── Standard platform path ──
    setTrendsLoading(true);
    // Clear Twitter state when switching platforms
    setTwitterData(null);
    setGeneratedTweets([]);
    setSelectedTwitterTrend(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recommend-trends', {
        body: {
          user_profile: userProfile,
          user_id: user?.id || null,
          selected_categories: inputValues.content_categories.length > 0 ? inputValues.content_categories : undefined,
          // 2026-05-06: drives both the trends-table region filter AND the
          // user_trend_sessions cooldown scoping. Send the explicit dropdown
          // value, not the brand profile geography — user override wins.
          location: inputValues.target_location,
          brand_id: !isCreator ? (selectedBrandId || undefined) : undefined,
        }
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error('Failed to load recommendations');
      }

      if (!data || !data.recommended_trends) {
        throw new Error('Invalid response from recommendation service');
      }

      handleRecommendationsReceived(data.recommended_trends, {
        categoryFallback: !!data.category_fallback,
      });
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      toast.error('Failed to load recommendations');
    } finally {
      setTrendsLoading(false);
    }
  };

  const handleGenerateTweets = async (trend: TwitterTrend) => {
    if (!userProfile) {
      toast.error('User profile is required');
      return;
    }
    setTweetsLoading(true);
    setTweetsError(null);
    setSelectedTwitterTrend(trend);
    setGeneratedTweets([]);
    setTweetsSaved(false);
    setTweetsSaveError(null);
    setTweetsLiveContextSource(null);
    setTweetsLiveContextPreview(null);
    setActiveStep("directions");

    const charLimit = inputValues.twitter_user_type === 'premium' ? 25000 : 280;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-tweet', {
        body: {
          user_profile: userProfile,
          trend,
          topic_angle: inputValues.topic_angle || undefined,
          char_limit: charLimit,
          brand_id: selectedBrandId || undefined,
          region: inputValues.twitter_geography || undefined,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Failed to generate tweets');
      setGeneratedTweets(data.tweets || []);
      setTweetsSaved(!!data?.saved);
      setTweetsSaveError(data?.save_error ?? null);
      setTweetsLiveContextSource(data?.live_context_source ?? null);
      setTweetsLiveContextPreview(data?.live_context_preview ?? null);
      if (data?.saved) {
        toast.success('Drafts saved to My Drafts');
      } else if (data?.tweets?.length) {
        // Generation worked but persistence didn't — non-blocking, just inform
        toast.message('Drafts generated (not saved)', {
          description: data?.save_error || 'Saving failed — drafts will only live in this session.',
        });
      }
    } catch (err) {
      setTweetsError(err instanceof Error ? err.message : 'Failed to generate tweets');
      toast.error('Tweet generation failed. Please try again.');
    } finally {
      setTweetsLoading(false);
    }
  };

  const handleRefreshTwitterTrends = async () => {
    if (!twitterData) return;
    setIsRefreshingTwitter(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-twitter-trends', {
        body: {
          region: inputValues.twitter_geography || 'UK',
          categories: inputValues.content_categories || [],
          count: 60,
          user_niche: userProfile?.niche || userProfile?.industry || undefined,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.trends) {
        setTwitterData(data);
        setGeneratedTweets([]);
        setSelectedTwitterTrend(null);
        setTweetsSaved(false);
        setTweetsSaveError(null);
        setTweetsLiveContextSource(null);
        setTweetsLiveContextPreview(null);
        setActiveStep("trends");
      }
    } catch (err) {
      toast.error('Could not refresh trends. Try again.');
    } finally {
      setIsRefreshingTwitter(false);
    }
  };

  // Click-to-save handler for the Trends tab. Always optimistic-toast on
  // success; we don't want the save action to feel laggy. The hook does
  // a refetch under the hood so savedTrendIds updates within ~1 RTT.
  const handleSaveTrend = async (trend: RecommendedTrend) => {
    if (savedTrendIds.has(trend.trend_id)) {
      toast.message("Already in My Trends");
      return;
    }
    const result = await saveTrend({
      brand_id: savedTrendsBrandScope,
      trend,
    });
    if (result.ok) {
      toast.success("Saved to My Trends", {
        description: "Lives there for 48 hours.",
      });
    } else {
      toast.error(result.error || "Could not save trend");
    }
  };

  const handleSaveTwitterTrend = async (trend: TwitterTrend) => {
    const region = inputValues.twitter_geography || 'UK';
    const trendId = `twitter-${region}-${trend.name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`;
    if (savedTrendIds.has(trendId)) {
      toast.message("Already in My Trends");
      return;
    }
    const snapshot: RecommendedTrend = {
      trend_id: trendId,
      trend_name: trend.name,
      category: trend.category,
      region,
      why_good_fit: trend.why_trending || '',
      example_hook: trend.niche_hook || trend.marketer_signal || '',
      angle_summary: trend.niche_hook || '',
      source: 'twitter',
      twitter_trend_data: trend,
      views_last_60h_millions: null,
    };
    const result = await saveTrend({ brand_id: savedTrendsBrandScope, trend: snapshot });
    if (result.ok) {
      toast.success("Saved to My Trends", { description: "Lives there for 48 hours." });
    } else {
      toast.error(result.error || "Could not save trend");
    }
  };

  const handleRemoveSavedTrend = async (id: string) => {
    const result = await removeTrend(id);
    if (!result.ok) toast.error("Could not remove");
  };

  // Used by the SavedTrends panel "Use this trend" button. Re-uses the
  // existing handleViewDirections path so the trend flows back into the
  // normal Ideas → Blueprint funnel.
  const handleUseSavedTrend = async (trend: RecommendedTrend) => {
    await handleViewDirections(trend);
  };

  const handleViewDirections = async (trend: RecommendedTrend) => {
    if (!userProfile) {
      setDirectionsError('User profile is required');
      return;
    }
    setDirectionsLoading(true);
    setDirectionsError(null);
    setSelectedTrendName(trend.trend_name);
    setSelectedTrendId(trend.trend_id);
    setDetailedDirection(null);
    setActiveStep("directions");
    try {
      const { data, error } = await supabase.functions.invoke('generate-directions', {
        body: {
          user_profile: userProfile,
          trend_id: trend.trend_id,
          trend_name: trend.trend_name,
          user_id: user?.id || null
        }
      });
      if (error) throw new Error('Failed to generate creative directions');
      setCreativeDirections(data.creative_directions || []);
    } catch (err) {
      setDirectionsError(err instanceof Error ? err.message : 'Failed to load creative directions');
    } finally {
      setDirectionsLoading(false);
    }
  };

  const handleViewBlueprint = async (direction: CreativeDirection, opts?: { detailed?: boolean }) => {
    if (!userProfile) {
      setBlueprintError('User profile is required');
      return;
    }
    setBlueprintLoading(true);
    setBlueprintError(null);
    setSelectedIdeaTitle(direction.title);
    setSelectedDirection(direction);
    setActiveStep("blueprint");
    try {
      const { data, error } = await supabase.functions.invoke('generate-blueprint', {
        body: {
          user_profile: userProfile,
          trend_id: selectedTrendId,
          chosen_direction: direction,
          user_id: user?.id || null,
          detailed: opts?.detailed === true,
        }
      });
      if (error) throw new Error('Failed to generate execution blueprint');
      setTrendHashtags(data.trend_hashtags || '');
      setDetailedDirection(data.detailed_direction || null);

      // ── Auto-save to My Drafts ────────────────────────────────────────
      // The user reached the Blueprint stage — that's our "this is real
      // intent" signal. Persist it so they can come back to it later.
      // Upsert key = (user, brand, trend, direction_title), so re-running
      // generate-blueprint for the same idea overwrites instead of piling
      // up revisions. Save failures are silent (we already gave the user
      // the visible blueprint; a missed background save shouldn't block
      // the UI). We DO log them.
      if (data.detailed_direction) {
        const brandRow = !isCreator && selectedBrandId
          ? brands.find(b => b.id === selectedBrandId)
          : null;
        try {
          const result = await saveBlueprint({
            brand_id: savedTrendsBrandScope,
            brand_name: brandRow?.brand_name ?? userProfile.brand_name ?? null,
            trend_id: selectedTrendId,
            trend_name: selectedTrendName,
            trend_category: null,
            region: inputValues.target_location,
            trend_hashtags: data.trend_hashtags || null,
            direction_title: direction.title,
            direction_summary: direction.summary ?? null,
            blueprint: data.detailed_direction,
          });
          if (!result.ok) {
            console.warn('[TrendQuest] blueprint auto-save failed:', result.error);
          }
        } catch (saveErr) {
          console.warn('[TrendQuest] blueprint auto-save threw:', saveErr);
        }
      }
    } catch (err) {
      setBlueprintError(err instanceof Error ? err.message : 'Failed to load execution blueprint');
    } finally {
      setBlueprintLoading(false);
    }
  };

  const handleRegenerateBlueprint = async () => {
    if (!selectedDirection) return;
    await handleViewBlueprint(selectedDirection);
  };

  const handleGenerateDetailed = async () => {
    if (!selectedDirection) return;
    await handleViewBlueprint(selectedDirection, { detailed: true });
  };

  const isLoading = trendsLoading || directionsLoading || blueprintLoading || tweetsLoading;

  const handleOptimizeHashtags = () => {
    if (!detailedDirection || !userProfile) return;
    navigate("/hashtag-analysis", {
      state: {
        fromTrendQuest:  true,
        caption:         detailedDirection.caption,
        idea_title:      selectedIdeaTitle,
        trend_name:      selectedTrendName,
        trend_id:        selectedTrendId,
        trend_hashtags:  trendHashtags,
        brand_profile:   userProfile,
      },
    });
  };

  const renderWorkspaceContent = () => {
    // My Trends is platform-agnostic — render it regardless of which
    // upstream flow (recommend-trends vs twitter) the user came from.
    if (activeStep === "saved_trends") {
      return (
        <SavedTrends
          savedTrends={savedTrends}
          loading={savedTrendsLoading}
          onUseTrend={handleUseSavedTrend}
          onRemoveTrend={handleRemoveSavedTrend}
          onGenerateTweets={handleGenerateTweets}
        />
      );
    }

    // ── Twitter / Social Pulse flow ──
    if (twitterData) {
      switch (activeStep) {
        case "trends":
          return (
            <TwitterTrends
              data={twitterData}
              onGenerateTweets={handleGenerateTweets}
              onRefresh={handleRefreshTwitterTrends}
              isRefreshing={isRefreshingTwitter}
              onSaveTrend={handleSaveTwitterTrend}
              savedTrendIds={savedTrendIds}
            />
          );
        case "directions":
          if (tweetsError) {
            return (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2">
                <p className="text-destructive text-sm">{tweetsError}</p>
                <button className="text-xs text-primary underline" onClick={() => setActiveStep("trends")}>
                  ← Back to trends
                </button>
              </div>
            );
          }
          return (
            <TwitterContent
              trendName={selectedTwitterTrend?.name || ''}
              tweets={generatedTweets}
              charLimit={inputValues.twitter_user_type === 'premium' ? 25000 : 280}
              onBack={() => setActiveStep("trends")}
              saved={tweetsSaved}
              saveError={tweetsSaveError}
              liveContextSource={tweetsLiveContextSource}
              liveContextPreview={tweetsLiveContextPreview}
            />
          );
        case "blueprint":
          // Twitter has no blueprint — stay on tweet drafts
          return (
            <TwitterContent
              trendName={selectedTwitterTrend?.name || ''}
              tweets={generatedTweets}
              charLimit={inputValues.twitter_user_type === 'premium' ? 25000 : 280}
              onBack={() => setActiveStep("trends")}
              saved={tweetsSaved}
              saveError={tweetsSaveError}
              liveContextSource={tweetsLiveContextSource}
              liveContextPreview={tweetsLiveContextPreview}
            />
          );
      }
    }

    // ── Default flow ──
    switch (activeStep) {
      case "trends":
        return (
          <RecommendedTrends
            recommendations={recommendations}
            brandName={brandName}
            onViewDirections={handleViewDirections}
            onRefreshTrends={handleRefreshTrends}
            isRefreshing={isRefreshing}
            onSaveTrend={handleSaveTrend}
            savedTrendIds={savedTrendIds}
            categoryFallback={categoryFallback}
            isCreator={isCreator}
          />
        );
      case "directions":
        if (directionsError) {
          return (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{directionsError}</p>
            </div>
          );
        }
        return <CreativeDirections trendName={selectedTrendName} directions={creativeDirections} onViewBlueprint={handleViewBlueprint} onBack={() => setActiveStep("trends")} onFeedback={handleFeedback} />;
      case "blueprint":
        if (blueprintError) {
          return (
            <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{blueprintError}</p>
            </div>
          );
        }
        return <ExecutionBlueprint trendName={selectedTrendName} ideaTitle={selectedIdeaTitle} blueprint={detailedDirection} trendHashtags={trendHashtags} onBack={() => setActiveStep("directions")} onDeepHashtagAnalysis={detailedDirection ? handleOptimizeHashtags : undefined} userProfile={userProfile} contentFormat={inputValues.content_format} onFeedback={handleFeedback} onRegenerate={selectedDirection ? handleRegenerateBlueprint : undefined} onGenerateDetailed={selectedDirection ? handleGenerateDetailed : undefined} regenerating={blueprintLoading} />;
    }
  };

  return (
    <div className="h-full p-4 lg:p-6">
      <div className="h-full flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
        {/* Left: Profile Selector Panel */}
        <aside className="w-full lg:w-[360px] xl:w-[380px] flex-shrink-0">
          {isCreator ? (
            <CreatorSelector
              onGetTrends={handleGetTrends}
              loading={trendsLoading}
              inputValues={inputValues}
              onInputChange={setInputValues}
              onProfileLoaded={setCreatorProfile}
            />
          ) : (
            <BrandSelector
              brands={brands}
              selectedBrandId={selectedBrandId}
              onSelectBrand={setSelectedBrandId}
              onGetTrends={handleGetTrends}
              loading={trendsLoading}
              brandsLoading={brandsLoading}
              inputValues={inputValues}
              onInputChange={setInputValues}
            />
          )}
        </aside>

        {/* Right: Workspace */}
        <section className="flex-1 min-w-0 flex flex-col">
          <div className="bg-card rounded-xl border border-border shadow-card flex-1 flex flex-col overflow-hidden">
            {/* Stepper */}
            <div className="p-3 border-b border-border">
              <WorkspaceStepper
                activeStep={activeStep}
                hasTrends={recommendations.length > 0 || twitterData !== null}
                hasDirections={creativeDirections.length > 0 || generatedTweets.length > 0}
                hasBlueprint={detailedDirection !== null}
                hasSavedTrends={savedTrendsCount > 0}
                onStepClick={setActiveStep}
              />
            </div>

            {/* Content area */}
            <div className="flex-1 p-4 relative overflow-hidden">
              {isLoading && <WorkspaceLoading step={activeStep} />}
              <div className="h-full w-full">
                {renderWorkspaceContent()}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default TrendQuest;
