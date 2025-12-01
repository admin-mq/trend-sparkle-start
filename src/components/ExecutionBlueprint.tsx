import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DetailedDirection } from "@/types/trends";

interface ExecutionBlueprintProps {
  trendName: string;
  ideaTitle: string;
  blueprint: DetailedDirection | null;
  loading: boolean;
  error: string | null;
}

export const ExecutionBlueprint = ({ trendName, ideaTitle, blueprint, loading, error }: ExecutionBlueprintProps) => {
  if (loading) {
    return (
      <div className="mb-8">
        <p className="text-center text-muted-foreground">Loading execution blueprint…</p>
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

  if (!blueprint) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-foreground mb-4">
        Execution blueprint for {trendName} – {ideaTitle}
      </h2>
      <Card>
        <CardHeader>
          <CardTitle>Concept</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-foreground">{blueprint.concept}</p>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Script Outline</h3>
            <ul className="list-disc list-inside space-y-1">
              {blueprint.script_outline.map((item, index) => (
                <li key={index} className="text-foreground">{item}</li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Caption</h3>
            <div className="bg-muted/30 p-4 rounded-md">
              <p className="text-foreground">{blueprint.caption}</p>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Hashtags</h3>
            <div className="flex flex-wrap gap-2">
              {blueprint.recommended_hashtags.map((tag, index) => (
                <span key={index} className="text-sm bg-muted px-3 py-1 rounded-full text-foreground">
                  {tag}
                </span>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground mb-2">Extra Tips</h3>
            <ul className="list-disc list-inside space-y-1">
              {blueprint.extra_tips.map((tip, index) => (
                <li key={index} className="text-muted-foreground">{tip}</li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
