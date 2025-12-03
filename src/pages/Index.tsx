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
        console.error('Error fetching trends:', err);
        setError('Failed to load trends');
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
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-directions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          user_profile: userProfile,
          trend_id: trend.trend_id,
          trend_name: trend.trend_name
        }),
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

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-blueprint`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          user_profile: userProfile,
          trend_id: selectedTrendId,
          chosen_direction: direction
        }),
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
