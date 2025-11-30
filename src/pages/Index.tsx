import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

interface Trend {
  trend_id: string;
  trend_name: string;
  views_last_60h_millions: number | null;
}

const Index = () => {
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

        <div className="space-y-4">
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
