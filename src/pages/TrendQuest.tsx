import { useState, useEffect } from "react";
import { BrandProfileForm } from "@/components/BrandProfileForm";
import { ProfileSummaryCard } from "@/components/ProfileSummaryCard";
import { ProfileMissingCard } from "@/components/ProfileMissingCard";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { WorkspaceStepper, WorkspaceStep } from "@/components/WorkspaceStepper";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import { RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection } from "@/types/trends";
import { useAuth } from "@/hooks/useAuth";
import { useUserProfile } from "@/hooks/useUserProfile";
import { BrandMemory, updateBrandMemory } from "@/lib/brandMemory";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const TrendQuest = () => {
  const { user } = useAuth();
  const { profile, loading: profileLoading, isAuthenticated } = useUserProfile();
  
  // Step navigation
  const [activeStep, setActiveStep] = useState<WorkspaceStep>("trends");

  // Brand profile & recommendations
  const [recommendations, setRecommendations] = useState<RecommendedTrend[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);

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
  
  // Brand memory for learning from feedback
  const [brandMemory, setBrandMemory] = useState<BrandMemory | null>(null);

  // Check if user has a complete profile
  const hasCompleteProfile = profile && profile.brand_name;

  // Build UserProfile from saved profile data
  const buildProfileFromSaved = (): UserProfile => {
    const industry = profile?.industry === "Other" && profile?.industry_other
      ? profile.industry_other
      : (profile?.industry || "");

    return {
      brand_name: profile?.brand_name || "",
      business_summary: profile?.business_summary || "",
      industry: industry,
      niche: "",
      audience: "",
      geography: profile?.geography || "",
      content_format: "",
      primary_goal: "",
      tone: "casual",
      tones: ["casual"],
      primary_tone: "casual",
      tone_intensity: 3,
      tone_meter_label: "Vibe meter"
    };
  };

  // Update brand name when profile loads
  useEffect(() => {
    if (hasCompleteProfile && profile.brand_name) {
      setBrandName(profile.brand_name);
    }
  }, [hasCompleteProfile, profile]);

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

  const handleRecommendationsReceived = (newRecommendations: RecommendedTrend[]) => {
    setRecommendations(newRecommendations);
    setActiveStep("trends");
    // Clear downstream state
    setCreativeDirections([]);
    setDetailedDirection(null);
  };

  // Quick action using saved profile
  const handleGetTrendsFromProfile = async () => {
    if (!hasCompleteProfile) return;

    const fullProfile = buildProfileFromSaved();
    setUserProfile(fullProfile);
    setBrandName(profile.brand_name!);
    setTrendsLoading(true);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recommend-trends', {
        body: { user_profile: fullProfile, user_id: user?.id || null }
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

  const isLoading = trendsLoading || directionsLoading || blueprintLoading;

  const renderWorkspaceContent = () => {
    switch (activeStep) {
      case "trends":
        return <RecommendedTrends recommendations={recommendations} brandName={brandName} onViewDirections={handleViewDirections} />;
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
        return <ExecutionBlueprint trendName={selectedTrendName} ideaTitle={selectedIdeaTitle} blueprint={detailedDirection} trendHashtags={trendHashtags} onBack={() => setActiveStep("directions")} onFeedback={handleFeedback} />;
    }
  };

  // Determine what to show in the left panel
  const renderLeftPanel = () => {
    // If profile is loading, show nothing special
    if (profileLoading) {
      return (
        <div className="h-full bg-card rounded-xl border border-border p-4 shadow-card flex items-center justify-center">
          <div className="animate-pulse text-muted-foreground">Loading...</div>
        </div>
      );
    }

    // If user is logged in and has a complete profile, show summary card
    if (isAuthenticated && hasCompleteProfile) {
      return (
        <div className="h-full bg-card rounded-xl border border-border p-4 shadow-card">
          <ProfileSummaryCard 
            profile={profile} 
            onGetTrends={handleGetTrendsFromProfile}
            loading={trendsLoading}
          />
        </div>
      );
    }

    // If user is logged in but no profile, show prompt to complete profile
    if (isAuthenticated && !hasCompleteProfile) {
      return (
        <div className="h-full bg-card rounded-xl border border-border shadow-card">
          <ProfileMissingCard />
        </div>
      );
    }

    // Not logged in: show full form as fallback
    return (
      <div className="h-full bg-card rounded-xl border border-border p-4 shadow-card">
        <BrandProfileForm 
          onRecommendationsReceived={handleRecommendationsReceived} 
          onBrandNameChange={setBrandName} 
          onUserProfileChange={setUserProfile} 
          loading={trendsLoading} 
          setLoading={setTrendsLoading} 
        />
      </div>
    );
  };

  return (
    <div className="h-full p-4 lg:p-6">
      <div className="h-full flex flex-col lg:flex-row gap-4 max-w-7xl mx-auto">
        {/* Left: Profile/Brand Panel */}
        <aside className="w-full lg:w-[360px] xl:w-[380px] flex-shrink-0">
          {renderLeftPanel()}
        </aside>

        {/* Right: Workspace */}
        <section className="flex-1 min-w-0 flex flex-col">
          <div className="bg-card rounded-xl border border-border shadow-card flex-1 flex flex-col overflow-hidden">
            {/* Stepper */}
            <div className="p-3 border-b border-border">
              <WorkspaceStepper 
                activeStep={activeStep} 
                hasTrends={recommendations.length > 0} 
                hasDirections={creativeDirections.length > 0} 
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
