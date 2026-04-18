import { useState } from "react";
import { BrandProfileForm } from "@/components/BrandProfileForm";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { TwitterTrends } from "@/components/TwitterTrends";
import { TwitterContent } from "@/components/TwitterContent";
import { WorkspaceStepper, WorkspaceStep } from "@/components/WorkspaceStepper";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import { UserMenu } from "@/components/UserMenu";
import { RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection, TwitterTrendsResponse, TwitterTrend, GeneratedTweet } from "@/types/trends";
import { Sparkles } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { BrandMemory, updateBrandMemory } from "@/lib/brandMemory";
import { toast } from "sonner";
import { ThemeToggle } from "@/components/ThemeToggle";

const Index = () => {
  const { user } = useAuth();
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
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({}),
      });
      if (userProfile) {
        setTrendsLoading(true);
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/recommend-trends`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ user_profile: userProfile, user_id: user?.id || null }),
        });
        if (response.ok) {
          const data = await response.json();
          setRecommendations(data.recommended_trends || []);
        }
        setTrendsLoading(false);
      }
    } catch (err) {
      console.error('Refresh failed:', err);
    } finally {
      setIsRefreshing(false);
    }
  };


  const handleTwitterTrendsReceived = (data: TwitterTrendsResponse) => {
    setTwitterData(data);
    setActiveStep("trends");
    // Clear downstream Twitter state
    setGeneratedTweets([]);
    setSelectedTwitterTrend(null);
    // Clear non-Twitter state
    setRecommendations([]);
    setCreativeDirections([]);
    setDetailedDirection(null);
  };

  const handleGenerateTweets = async (trend: TwitterTrend) => {
    if (!userProfile) {
      setTweetsError('User profile is required');
      return;
    }
    setTweetsLoading(true);
    setTweetsError(null);
    setSelectedTwitterTrend(trend);
    setGeneratedTweets([]);
    setActiveStep("directions");

    const charLimit = userProfile.twitter_user_type === 'premium' ? 25000 : 280;

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-tweet`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          user_profile: userProfile,
          trend,
          topic_angle: userProfile.topic_angle,
          char_limit: charLimit,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setGeneratedTweets(data.tweets || []);
    } catch (err) {
      setTweetsError(err instanceof Error ? err.message : 'Failed to generate tweets');
      toast.error('Tweet generation failed. Please try again.');
    } finally {
      setTweetsLoading(false);
    }
  };

  const handleRefreshTwitterTrends = async () => {
    if (!userProfile || !twitterData) return;
    setIsRefreshingTwitter(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-twitter-trends`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          region: userProfile.twitter_geography || 'UK',
          categories: userProfile.content_categories || [],
          count: 20,
        }),
      });
      if (response.ok) {
        const data = await response.json();
        setTwitterData(data);
        setGeneratedTweets([]);
        setSelectedTwitterTrend(null);
      }
    } catch (err) {
      console.error('Twitter refresh failed:', err);
      toast.error('Could not refresh trends. Try again.');
    } finally {
      setIsRefreshingTwitter(false);
    }
  };

  const handleRecommendationsReceived = (newRecommendations: RecommendedTrend[]) => {
    setRecommendations(newRecommendations);
    setActiveStep("trends");
    // Clear downstream state
    setCreativeDirections([]);
    setDetailedDirection(null);
    // Clear Twitter state
    setTwitterData(null);
    setGeneratedTweets([]);
    setSelectedTwitterTrend(null);
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-directions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          user_profile: userProfile,
          trend_id: trend.trend_id,
          trend_name: trend.trend_name,
          why_good_fit: trend.why_good_fit,
          angle_summary: trend.angle_summary,
          example_hook: trend.example_hook,
          timing: trend.timing,
          region: trend.region,
          user_id: user?.id || null
        })
      });
      if (!response.ok) {
        throw new Error('Failed to generate creative directions');
      }
      const data = await response.json();
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-blueprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`
        },
        body: JSON.stringify({
          user_profile: userProfile,
          trend_id: selectedTrendId,
          chosen_direction: direction,
          user_id: user?.id || null
        })
      });
      if (!response.ok) {
        throw new Error('Failed to generate execution blueprint');
      }
      const data = await response.json();
      setTrendHashtags(data.trend_hashtags || '');
      setDetailedDirection(data.detailed_direction || null);
    } catch (err) {
      setBlueprintError(err instanceof Error ? err.message : 'Failed to load execution blueprint');
    } finally {
      setBlueprintLoading(false);
    }
  };
  const isLoading = trendsLoading || directionsLoading || blueprintLoading || tweetsLoading;

  const renderWorkspaceContent = () => {
    // ── Twitter / Social Pulse flow ───────────────────────────────────────
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
                <button
                  className="text-xs text-primary underline"
                  onClick={() => setActiveStep("trends")}
                >
                  ← Back to trends
                </button>
              </div>
            );
          }
          return (
            <TwitterContent
              trendName={selectedTwitterTrend?.name || ''}
              tweets={generatedTweets}
              charLimit={userProfile?.twitter_user_type === 'premium' ? 25000 : 280}
              onBack={() => setActiveStep("trends")}
            />
          );
        case "blueprint":
          // Twitter doesn't use blueprint — go back to tweets
          return (
            <TwitterContent
              trendName={selectedTwitterTrend?.name || ''}
              tweets={generatedTweets}
              charLimit={userProfile?.twitter_user_type === 'premium' ? 25000 : 280}
              onBack={() => setActiveStep("trends")}
            />
          );
      }
    }

    // ── Default flow (Instagram / TikTok / etc.) ──────────────────────────
    switch (activeStep) {
      case "trends":
        return <RecommendedTrends recommendations={recommendations} brandName={brandName} onViewDirections={handleViewDirections} onRefreshTrends={handleRefreshTrends} isRefreshing={isRefreshing} />;
      case "directions":
        if (directionsError) {
          return <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{directionsError}</p>
            </div>;
        }
        return <CreativeDirections trendName={selectedTrendName} directions={creativeDirections} onViewBlueprint={handleViewBlueprint} onBack={() => setActiveStep("trends")} onFeedback={handleFeedback} />;
      case "blueprint":
        if (blueprintError) {
          return <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{blueprintError}</p>
            </div>;
        }
        return <ExecutionBlueprint trendName={selectedTrendName} ideaTitle={selectedIdeaTitle} blueprint={detailedDirection} trendHashtags={trendHashtags} onBack={() => setActiveStep("directions")} onFeedback={handleFeedback} />;
    }
  };
  return <main className="min-h-screen bg-background studio-glow">
      <div className="h-screen flex flex-col p-3 lg:p-4 w-full max-w-7xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground">Trend Quest</h1>
              <p className="text-xs text-muted-foreground hidden sm:block">Turn live social trends into ready-to-post content</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden md:flex items-center gap-2 text-xs text-muted-foreground">
              <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">Social Media Inspired</span>
              <span className="px-2 py-1 bg-secondary rounded-full">Early beta</span>
            </div>
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>

        {/* Main content: two columns */}
        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Left: Brand Profile */}
          <aside className="w-full lg:w-[360px] xl:w-[380px] flex-shrink-0">
            <div className="h-full bg-card rounded-xl border border-border p-4 shadow-card">
              <BrandProfileForm onRecommendationsReceived={handleRecommendationsReceived} onTwitterTrendsReceived={handleTwitterTrendsReceived} onBrandNameChange={setBrandName} onUserProfileChange={setUserProfile} loading={trendsLoading} setLoading={setTrendsLoading} />
            </div>
          </aside>

          {/* Right: Workspace - fills remaining space */}
          <section className="flex-1 min-w-0 flex flex-col">
            <div className="bg-card rounded-xl border border-border shadow-card flex-1 flex flex-col overflow-hidden w-full">
              {/* Stepper */}
              <div className="p-3 border-b border-border flex items-center justify-between">
                <WorkspaceStepper activeStep={activeStep} hasTrends={recommendations.length > 0 || twitterData !== null} hasDirections={creativeDirections.length > 0 || generatedTweets.length > 0} hasBlueprint={detailedDirection !== null} onStepClick={setActiveStep} />
              </div>

              {/* Content area - fills the workspace */}
              <div className="flex-1 p-4 relative overflow-hidden w-full">
                {isLoading && <WorkspaceLoading step={activeStep} />}
                <div className="h-full w-full">
                  {renderWorkspaceContent()}
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>;
};
export default Index;