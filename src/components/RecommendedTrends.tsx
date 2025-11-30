import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RecommendedTrend } from "@/types/trends";

interface RecommendedTrendsProps {
  recommendations: RecommendedTrend[];
  brandName: string;
}

export const RecommendedTrends = ({ recommendations, brandName }: RecommendedTrendsProps) => {
  if (recommendations.length === 0) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold mb-4 text-foreground">Recommended trends</h2>
        <p className="text-muted-foreground">
          Fill in your brand profile and click "Get AI trend suggestions".
        </p>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold mb-4 text-foreground">
        {brandName ? `Recommended trends for ${brandName}` : 'Recommended trends'}
      </h2>
      <div className="space-y-4">
        {recommendations.map((trend) => (
          <Card key={trend.trend_id}>
            <CardHeader>
              <CardTitle className="text-xl">
                {trend.trend_name}
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                ({trend.views_last_60h_millions}M views in last 60h)
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-foreground">{trend.why_good_fit}</p>
              </div>
              
              <div className="border-l-4 border-border pl-4 py-2 bg-muted/30">
                <p className="text-sm italic text-muted-foreground">
                  "{trend.example_hook}"
                </p>
              </div>

              <div>
                <p className="text-sm text-muted-foreground">{trend.angle_summary}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
