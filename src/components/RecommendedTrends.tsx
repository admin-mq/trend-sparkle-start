import { Button } from "@/components/ui/button";
import { RecommendedTrend } from "@/types/trends";
import { TrendingUp, Eye, ArrowRight } from "lucide-react";

interface RecommendedTrendsProps {
  recommendations: RecommendedTrend[];
  brandName: string;
  onViewDirections: (trend: RecommendedTrend) => void;
}

export const RecommendedTrends = ({ recommendations, brandName, onViewDirections }: RecommendedTrendsProps) => {
  if (recommendations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center py-12">
        <div className="w-16 h-16 rounded-2xl bg-secondary/50 flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No trends yet</h3>
        <p className="text-muted-foreground text-sm max-w-sm">
          Fill in your brand profile and click "Get AI trend suggestions" to discover what's trending for you.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm text-muted-foreground uppercase tracking-wider">
          {brandName ? `Trending for ${brandName}` : 'Recommended trends'}
        </h3>
        <span className="text-xs text-muted-foreground">{recommendations.length} trends</span>
      </div>
      
      <div className="space-y-3 max-h-[calc(100vh-320px)] overflow-y-auto pr-2">
        {recommendations.map((trend) => (
          <div key={trend.trend_id} className="post-card p-4 hover:shadow-glow transition-shadow">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-foreground text-base truncate">
                  {trend.trend_name}
                </h4>
                <div className="flex items-center gap-2 mt-1">
                  <Eye className="w-3 h-3 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {trend.views_last_60h_millions}M views in 60h
                  </span>
                </div>
              </div>
            </div>
            
            <p className="text-sm text-secondary-foreground mt-3 line-clamp-2">
              {trend.why_good_fit}
            </p>
            
            <div className="hook-highlight mt-3">
              <p className="text-sm italic text-foreground">
                "{trend.example_hook}"
              </p>
            </div>

            <p className="text-xs text-muted-foreground mt-3">
              {trend.angle_summary}
            </p>

            <Button 
              onClick={() => onViewDirections(trend)}
              variant="ghost"
              size="sm"
              className="mt-3 text-primary hover:text-primary hover:bg-primary/10 gap-1"
            >
              View creative directions
              <ArrowRight className="w-3 h-3" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
};
