import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BrandProfileForm } from "@/components/BrandProfileForm";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { ExecutionBlueprint } from "@/components/ExecutionBlueprint";
import { Trend, RecommendedTrend, CreativeDirection, UserProfile, DetailedDirection } from "@/types/trends";

const Index = () => {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrend[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>([]);
  const [selectedTrendName, setSelectedTrendName] = useState<string>('');
  const [selectedTrendId, setSelectedTrendId] = useState<string>('');
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);
  const [detailedDirection, setDetailedDirection] = useState<DetailedDirection | null>(null);
  const [selectedIdeaTitle, setSelectedIdeaTitle] = useState<string>('');
  const [blueprintLoading, setBlueprintLoading] = useState(false);
  const [blueprintError, setBlueprintError] = useState<string | null>(null);
  const [trendHashtags, setTrendHashtags] = useState<string>('');

  useEffect(() => {
    const fetchTrends = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('trends')
          .select('trend_id, trend_name, views_last_60h_millions, region, premium_only, active')
          .eq('region', 'Global')
          .eq('premium_only', false)
          .eq('active', true)
          .order('views_last_60h_millions', { ascending: false })
          .limit(5);

        if (error) {
          throw error;
        }

        setTrends(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchTrends();
  }, []);

  const handleViewDirections = async (trend: RecommendedTrend) => {
    if (!userProfile) {
      setDirectionsError('User profile is required');
      return;
    }

    setDirectionsLoading(true);
    setDirectionsError(null);
    setSelectedTrendName(trend.trend_name);
    setSelectedTrendId(trend.trend_id);
    setDetailedDirection(null); // Clear previous blueprint

    try {
      // Fetch the full trend record from Supabase
      const { data: trendData, error: trendError } = await supabase
        .from('trends')
        .select('*')
        .eq('trend_id', trend.trend_id)
        .maybeSingle();

      if (trendError) {
        throw trendError;
      }

      if (!trendData) {
        throw new Error('Trend not found');
      }

      // Generate 5 mocked creative directions
      const directions: CreativeDirection[] = Array.from({ length: 5 }, (_, i) => ({
        idea_id: i + 1,
        title: `Idea ${i + 1} for ${trendData.trend_name}`,
        summary: `Short summary of how ${userProfile.brand_name} could use ${trendData.trend_name} in their content.`,
        hook: `Example hook line mentioning ${trendData.trend_name} and ${userProfile.brand_name}`,
        visual_idea: `Simple description of what the visual could look like for this idea.`,
        suggested_cta: `Suggested call-to-action for this idea.`
      }));

      setCreativeDirections(directions);
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

    try {
      // Fetch the full trend record from Supabase
      const { data: trendData, error: trendError } = await supabase
        .from('trends')
        .select('*')
        .eq('trend_id', selectedTrendId)
        .maybeSingle();

      if (trendError) {
        throw trendError;
      }

      if (!trendData) {
        throw new Error('Trend not found');
      }

      // Store the trend hashtags
      setTrendHashtags(trendData.hashtags || '');

      // Generate mocked detailed direction
      const blueprint: DetailedDirection = {
        concept: `High-level idea of how ${userProfile.brand_name} can use ${trendData.trend_name} with the idea "${direction.title}". This approach combines the trending content style with your brand's unique voice to create engaging content that resonates with your audience.`,
        script_outline: [
          `Slide 1: Hook about ${trendData.trend_name} that grabs attention for ${userProfile.brand_name}`,
          `Slide 2: Explain the connection between ${trendData.trend_name} and your audience's needs`,
          `Slide 3: Show how ${userProfile.brand_name} uniquely approaches this trend`,
          `Slide 4: Present the main value proposition using ${direction.title}`,
          `Slide 5: Include social proof or results related to ${trendData.trend_name}`,
          `Slide 6: End with a strong call-to-action: ${direction.suggested_cta}`
        ],
        caption: `🔥 ${trendData.trend_name} is taking over, and here's how ${userProfile.brand_name} is making it work! ${direction.hook} Ready to see the results? Check out our approach and let us know what you think! ${direction.suggested_cta}`,
        recommended_hashtags: [
          `#${trendData.trend_name.replace(/\s+/g, '')}`,
          '#marketing',
          '#content',
          `#${userProfile.brand_name.replace(/\s+/g, '')}`,
          '#trending',
          '#socialmedia'
        ],
        extra_tips: [
          `Post during peak engagement hours for your ${userProfile.audience} audience`,
          `Use the trending audio or format associated with ${trendData.trend_name}`,
          `Keep the visual style consistent with your brand identity`,
          `Engage with comments quickly to boost algorithmic reach`,
          `Consider creating a series of posts around this trend for maximum impact`
        ]
      };

      setDetailedDirection(blueprint);
    } catch (err) {
      setBlueprintError(err instanceof Error ? err.message : 'Failed to load execution blueprint');
    } finally {
      setBlueprintLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-16 max-w-4xl">
        <div className="text-center mb-12 space-y-4">
          <h1 className="text-5xl font-bold tracking-tight text-foreground">
            Trend Test
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Top 5 trends from Supabase (Global, non-premium, active).
          </p>
        </div>

        <BrandProfileForm 
          onRecommendationsReceived={setRecommendations}
          onBrandNameChange={setBrandName}
          onUserProfileChange={setUserProfile}
        />

        <RecommendedTrends 
          recommendations={recommendations}
          brandName={brandName}
          onViewDirections={handleViewDirections}
        />

        <CreativeDirections 
          trendName={selectedTrendName}
          directions={creativeDirections}
          loading={directionsLoading}
          error={directionsError}
          onViewBlueprint={handleViewBlueprint}
        />

        <ExecutionBlueprint 
          trendName={selectedTrendName}
          ideaTitle={selectedIdeaTitle}
          blueprint={detailedDirection}
          loading={blueprintLoading}
          error={blueprintError}
          trendHashtags={trendHashtags}
        />

        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground">
            Top 5 trends from Supabase
          </h2>
          <p className="text-muted-foreground">
            Global, non-premium, active trends
          </p>
          {loading && (
            <p className="text-center text-muted-foreground">Loading trends…</p>
          )}

          {error && (
            <p className="text-center text-red-500">Error: {error}</p>
          )}

          {!loading && !error && trends.length > 0 && (
            <ul className="space-y-3 max-w-2xl mx-auto">
              {trends.map((trend) => (
                <li key={trend.trend_id} className="text-foreground">
                  <span className="font-bold">{trend.trend_name}</span>
                  <span className="text-sm text-muted-foreground ml-2">
                    ({trend.views_last_60h_millions}M views in last 60h)
                  </span>
                </li>
              ))}
            </ul>
          )}

          {!loading && !error && trends.length === 0 && (
            <p className="text-center text-muted-foreground">No trends found.</p>
          )}
        </div>
      </div>
    </main>
  );
};

export default Index;
