import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BrandSelector } from "@/components/BrandSelector";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { TwitterTrends } from "@/components/TwitterTrends";
import { TwitterContent } from "@/components/TwitterContent";
import { WorkspaceStepper, WorkspaceStep } from "@/components/WorkspaceStepper";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import {
  TrendQuestInputValues,
  deriveToneString,
  getPrimaryTone,
  getToneMeterLabel
} from "@/components/TrendQuestInputs";
import { RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection, TwitterTrendsResponse, TwitterTrend, GeneratedTweet } from "@/types/trends";
import { useAuth } from "@/hooks/useAuth";
import { useBrandProfiles, BrandProfile } from "@/hooks/useBrandProfiles";
import { BrandMemory, updateBrandMemory } from "@/lib/brandMemory";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";

const DEFAULT_INPUT_VALUES: TrendQuestInputValues = {
  audience: "",
  audience_other: "",
  content_format: "",
  content_format_other: "",
  primary_goal: "",
  tones: ["casual"],
  tone_intensity: 3,
  platform: "Instagram",
  topic_angle: "",
  content_categories: [],
  twitter_geography: "UK",
  twitter_user_type: "standard",
};

const TrendQuest = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { brands, loading: brandsLoading } = useBrandProfiles();
  
  // Selected brand
  const [selectedBrandId, setSelectedBrandId] = useState<string | null>(null);
  
  // Trend Quest inputs (non-brand fields)
  const [inputValues, setInputValues] = useState<TrendQuestInputValues>(DEFAULT_INPUT_VALUES);
  
  // Step navigation
  const [activeStep, setActiveStep] = useState<WorkspaceStep>("trends");

  // Brand profile & recommendations
  const [recommendations, setRecommendations] = useState<RecommendedTrend[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Creative directions
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>([]);
  const [selectedTrendName, setSelectedTrendName] = useState<string>('');
  const [selectedTrendId, setSelectedTrendId] = useState<string>('');
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

  // Blueprint
  const [detailedDirection, setDetailedDirection] = useState<DetailedDirection | null>(null);
  const [selectedIdeaTitle, setSelectedIdeaTitle] = useState<string>('');
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [trendHashtags, setTrendHashtags] = useState<string>('');
  
  // Twitter / Social Pulse state
  const [twitterData, setTwitterData] = useState<TwitterTrendsResponse | null>(null);
  const [generatedTweets, setGeneratedTweets] = useState<GeneratedTweet[]>([]);
  const [selectedTwitterTrend, setSelectedTwitterTrend] = useState<TwitterTrend | null>(null);
  const [tweetsLoading, setTweetsLoading] = useState(false);
  const [tweetsError, setTweetsError] = useState<string | null>(null);
  const [isRefreshingTwitter, setIsRefreshingTwitter] = useState(false);

  // Brand memory for learning from feedback
  const [brandMemory, setBrandMemory] = useState<BrandMemory | null>(null);

  // Auto-select first brand if only one exists
  useEffect(() => {
    if (brands.length > 0 && !selectedBrandId) {
      setSelectedBrandId(brands[0].id);
    }
  }, [brands, selectedBrandId]);

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

  // Update brand name and profile when brand selection or inputs change
  useEffect(() => {
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
  }, [selectedBrandId, brands, inputValues]);

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
      await supabase.functions.invoke('fetch-trends', { body: {} });
      if (userProfile) {
        const { data } = await supabase.functions.invoke('recommend-trends', {
          body: { user_profile: userProfile, user_id: user?.id || null }
        });
        if (data?.recommended_trends) setRecommendations(data.recommended_trends);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRecommendationsReceived = (newRecommendations: RecommendedTrend[]) => {
    setRecommendations(newRecommendations);
    setActiveStep("trends");
    // Clear downstream state
    setCreativeDirections([]);
    setDetailedDirection(null);
  };

  // Get trends — branches on platform
  const handleGetTrends = async () => {
    if (!selectedBrandId || !userProfile) return;

    const isTwitter = inputValues.platform === 'Twitter';

    if (isTwitter) {
      // ── Twitter / Social Pulse path ──
      setTrendsLoading(true);
      try {
        const { data, error: fnError } = await supabase.functions.invoke('fetch-twitter-trends', {
          body: {
            region: inputValues.twitter_geography || 'UK',
            categories: inputValues.content_categories || [],
            count: 20,
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
        }
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error('Failed to load recommendations');
      }

      if (!data || !data.recommended_trends) {
        throw new Error('Invalid response from recommendation service');
      }

      handleRecommendationsReceived(data.recommended_trends);
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
    setActiveStep("directions");

    const charLimit = inputValues.twitter_user_type === 'premium' ? 25000 : 280;

    try {
      const { data, error: fnError } = await supabase.functions.invoke('generate-tweet', {
        body: {
          user_profile: userProfile,
          trend,
          topic_angle: inputValues.topic_angle || undefined,
          char_limit: charLimit,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Failed to generate tweets');
      setGeneratedTweets(data.tweets || []);
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
          count: 20,
        },
      });
      if (fnError) throw new Error(fnError.message);
      if (data?.trends) {
        setTwitterData(data);
        setGeneratedTweets([]);
        setSelectedTwitterTrend(null);
        setActiveStep("trends");
      }
    } catch (err) {
      toast.error('Could not refresh trends. Try again.');
    } finally {
      setIsRefreshingTwitter(false);
    }
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

  const handleViewBlueprint = async (direction: CreativeDirection) => {
    if (!userProfile) {
      setBlueprintError('User profile is required');
      return;
    }
    setBlueprintLoading(true);
    setBlueprintError(null);
    setSelectedIdeaTitle(direction.title);
    setActiveStep("blueprint");
    try {
      const { data, error } = await supabase.functions.invoke('generate-blueprint', {
        body: {
          user_profile: userProfile,
          trend_id: selectedTrendId,
          chosen_direction: direction,
          user_id: user?.id || null
        }
      });
      if (error) throw new Error('Failed to generate execution blueprint');
      setTrendHashtags(data.trend_hashtags || '');
      setDetailedDirection(data.detailed_direction || null);
    } catch (err) {
      setBlueprintError(err instanceof Error ? err.message : 'Failed to load execution blueprint');
    } finally {
      setBlueprintLoading(false);
    }
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
            />
          );
      }
    }

    // ── Default flow ──
    switch (activeStep) {
      case "trends":
        return <RecommendedTrends recommendations={recommendations} brandName={brandName} onViewDirections={handleViewDirections} onRefreshTrends={handleRefreshTrends} isRefreshing={isRefreshing} />;
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
        return <ExecutionBlueprint trendName={selectedTrendName} ideaTitle={selectedIdeaTitle} blueprint={detailedDirection} trendHashtags={trendHashtags} onBack={() => setActiveStep("directions")} onOptimizeHashtags={detailedDirection ? handleOptimizeHashtags : undefined} onFeedback={handleFeedback} />;
    }
  };

  return (
    <div className="h-full p-4 lg:p-6">
      <div className="h-full flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
        {/* Left: Brand Selector Panel */}
        <aside className="w-full lg:w-[360px] xl:w-[380px] flex-shrink-0">
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
