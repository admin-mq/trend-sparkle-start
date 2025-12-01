import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreativeDirection } from "@/types/trends";

interface CreativeDirectionsProps {
  trendName: string;
  directions: CreativeDirection[];
  loading: boolean;
  error: string | null;
}

export const CreativeDirections = ({ trendName, directions, loading, error }: CreativeDirectionsProps) => {
  if (loading) {
    return (
      <div className="mb-8">
        <p className="text-center text-muted-foreground">Loading creative directions…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-8">
        <p className="text-center text-red-500">Error: {error}</p>
      </div>
    );
  }

  if (directions.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4">
        Creative directions for {trendName}
      </h2>
      <div className="space-y-4">
        {directions.map((direction) => (
          <Card key={direction.idea_id}>
            <CardHeader>
              <CardTitle className="text-xl">{direction.title}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-foreground">{direction.summary}</p>
              <blockquote className="italic text-muted-foreground border-l-4 border-border pl-4">
                {direction.hook}
              </blockquote>
              <p className="text-sm text-muted-foreground">{direction.visual_idea}</p>
              <p className="text-sm font-medium text-foreground">
                CTA: {direction.suggested_cta}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
