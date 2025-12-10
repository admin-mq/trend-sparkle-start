import { useState } from "react";
import { BrandProfileForm } from "@/components/BrandProfileForm";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { WorkspaceStepper, WorkspaceStep } from "@/components/WorkspaceStepper";
import { WorkspaceLoading } from "@/components/WorkspaceLoading";
import { RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection } from "@/types/trends";
import { Sparkles } from "lucide-react";
const Index = () => {
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
  const handleRecommendationsReceived = (newRecommendations: RecommendedTrend[]) => {
    setRecommendations(newRecommendations);
    setActiveStep("trends");
    // Clear downstream state
    setCreativeDirections([]);
    setDetailedDirection(null);
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
          trend_name: trend.trend_name
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
          chosen_direction: direction
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
          return <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{directionsError}</p>
            </div>;
        }
        return <CreativeDirections trendName={selectedTrendName} directions={creativeDirections} onViewBlueprint={handleViewBlueprint} onBack={() => setActiveStep("trends")} />;
      case "blueprint":
        if (blueprintError) {
          return <div className="flex items-center justify-center h-full">
              <p className="text-destructive">{blueprintError}</p>
            </div>;
        }
        return <ExecutionBlueprint trendName={selectedTrendName} ideaTitle={selectedIdeaTitle} blueprint={detailedDirection} trendHashtags={trendHashtags} onBack={() => setActiveStep("directions")} />;
    }
  };
  return <main className="min-h-screen bg-background studio-glow">
      <div className="h-screen flex flex-col p-4 lg:p-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-glow">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Trend Quest</h1>
              <p className="text-xs text-muted-foreground">Turn live social trends into ready-to-post content</p>
            </div>
          </div>
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
            <span className="px-2 py-1 bg-primary/10 text-primary rounded-full">Social Media Inspired</span>
            <span className="px-2 py-1 bg-secondary rounded-full">Early beta</span>
          </div>
        </header>

        {/* Main content: two columns */}
        <div className="flex-1 flex gap-4 lg:gap-6 min-h-0">
          {/* Left: Brand Profile */}
          <aside className="w-80 lg:w-96 flex-shrink-0">
            <div className="h-full bg-card rounded-xl border border-border p-5 shadow-card">
              <BrandProfileForm onRecommendationsReceived={handleRecommendationsReceived} onBrandNameChange={setBrandName} onUserProfileChange={setUserProfile} loading={trendsLoading} setLoading={setTrendsLoading} />
            </div>
          </aside>

          {/* Right: Workspace */}
          <section className="flex-1 flex flex-col min-w-0">
            <div className="bg-card rounded-xl border border-border shadow-card flex-1 flex flex-col overflow-hidden">
              {/* Stepper */}
              <div className="p-4 border-b border-border flex items-center justify-between">
                <WorkspaceStepper activeStep={activeStep} hasTrends={recommendations.length > 0} hasDirections={creativeDirections.length > 0} hasBlueprint={detailedDirection !== null} onStepClick={setActiveStep} />
              </div>

              {/* Content area */}
              <div className="flex-1 p-4 lg:p-6 relative overflow-hidden">
                {isLoading && <WorkspaceLoading step={activeStep} />}
                {renderWorkspaceContent()}
              </div>
            </div>
          </section>
        </div>
      </div>
    </main>;
};
export default Index;