import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { BrandProfileForm } from "@/components/BrandProfileForm";
import { RecommendedTrends } from "@/components/RecommendedTrends";
import { CreativeDirections } from "@/components/CreativeDirections";
import { Trend, RecommendedTrend, CreativeDirection, UserProfile } from "@/types/trends";

const Index = () => {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<RecommendedTrend[]>([]);
  const [brandName, setBrandName] = useState<string>('');
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [creativeDirections, setCreativeDirections] = useState<CreativeDirection[]>([]);
  const [selectedTrendName, setSelectedTrendName] = useState<string>('');
  const [directionsLoading, setDirectionsLoading] = useState(false);
  const [directionsError, setDirectionsError] = useState<string | null>(null);

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
