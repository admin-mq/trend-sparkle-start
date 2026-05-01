import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { TrendQuestInputs, TrendQuestInputValues } from "@/components/TrendQuestInputs";
import { supabase } from "@/lib/supabaseClient";
import { useAuth } from "@/hooks/useAuth";
import { UserCircle, MapPin, Tag, Loader2, Pencil, Sparkles } from "lucide-react";

type CreatorProfileData = {
  full_name: string | null;
  industry: string | null;
  location: string | null;
  business_summary: string | null;
};

interface CreatorSelectorProps {
  onGetTrends: () => void;
  loading?: boolean;
  inputValues: TrendQuestInputValues;
  onInputChange: (values: TrendQuestInputValues) => void;
  onProfileLoaded: (profile: CreatorProfileData | null) => void;
}

export const CreatorSelector = ({
  onGetTrends,
  loading = false,
  inputValues,
  onInputChange,
  onProfileLoaded,
}: CreatorSelectorProps) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<CreatorProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_profiles")
      .select("full_name,industry,location,business_summary")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        const p = data as CreatorProfileData | null;
        setProfile(p);
        onProfileLoaded(p);
        setProfileLoading(false);
      });
  }, [user]);

  const isTwitter = inputValues.platform === "Twitter";
  const isFormValid =
    profile?.industry &&
    inputValues.audience &&
    inputValues.primary_goal &&
    (isTwitter || inputValues.content_format);

  if (profileLoading) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No niche set → profile incomplete
  if (!profile?.industry) {
    return (
      <Card className="h-full">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <UserCircle className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Complete your Creator Profile</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Tell us your niche and content style so we can find the right trends for you.
          </p>
          <Button asChild className="gap-2">
            <Link to="/profile">
              <Pencil className="w-4 h-4" />
              Set Up Creator Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-4">
          {/* Creator info */}
          <div className="space-y-2 pb-2 border-b">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <UserCircle className="w-4 h-4 text-primary" />
                </div>
                <p className="font-medium text-sm">{profile.full_name || "Your Profile"}</p>
              </div>
              <Link
                to="/profile"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </Link>
            </div>

            <div className="flex flex-wrap gap-1.5 text-xs">
              {profile.industry && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  <Tag className="w-3 h-3" />
                  {profile.industry}
                </span>
              )}
              {profile.location && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                  <MapPin className="w-3 h-3" />
                  {profile.location}
                </span>
              )}
            </div>

            {profile.business_summary && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {profile.business_summary}
              </p>
            )}
          </div>

          <TrendQuestInputs values={inputValues} onChange={onInputChange} />

          {/* Get Trends Button */}
          <div className="pt-2">
            <Button
              onClick={onGetTrends}
              disabled={!isFormValid || loading}
              className="w-full gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isTwitter ? "Fetching X trends…" : "Scanning trends…"}
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  {isTwitter ? "Get X / Twitter Trends" : "Get Trend Recommendations"}
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>
  );
};
