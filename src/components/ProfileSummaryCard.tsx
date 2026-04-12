import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Building2, MapPin, Briefcase, Pencil, Sparkles } from "lucide-react";
import { UserProfileData } from "@/hooks/useUserProfile";

interface ProfileSummaryCardProps {
  profile: UserProfileData;
  onGetTrends: () => void;
  loading?: boolean;
}

export const ProfileSummaryCard = ({ profile, onGetTrends, loading }: ProfileSummaryCardProps) => {
  const displayIndustry = profile.industry === "Other" && profile.industry_other 
    ? profile.industry_other 
    : profile.industry;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-foreground">Using Profile</h2>
        <Link to="/profile">
          <Button variant="ghost" size="sm" className="gap-1.5 text-muted-foreground hover:text-foreground">
            <Pencil className="w-3.5 h-3.5" />
            Edit
          </Button>
        </Link>
      </div>

      <div className="flex-1 space-y-4">
        {/* Logo & Brand Name */}
        <div className="flex items-center gap-3">
          {profile.logo_url ? (
            <img
              src={profile.logo_url}
              alt={profile.brand_name || "Brand logo"}
              className="w-12 h-12 rounded-lg object-cover border border-border"
            />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="w-5 h-5 text-primary" />
            </div>
          )}
          <div>
            <p className="font-semibold text-foreground">{profile.brand_name}</p>
            {profile.full_name && (
              <p className="text-sm text-muted-foreground">{profile.full_name}</p>
            )}
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          {displayIndustry && (
            <div className="flex items-center gap-2 text-sm">
              <Briefcase className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{displayIndustry}</span>
            </div>
          )}
          {profile.geography && (
            <div className="flex items-center gap-2 text-sm">
              <MapPin className="w-4 h-4 text-muted-foreground" />
              <span className="text-foreground">{profile.geography}</span>
            </div>
          )}
        </div>

        {profile.business_summary && (
          <p className="text-sm text-muted-foreground border-t border-border pt-3">
            {profile.business_summary}
          </p>
        )}
      </div>

      <Button 
        onClick={onGetTrends} 
        disabled={loading}
        className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Scanning trends…' : 'Get AI trend suggestions'}
      </Button>
    </div>
  );
};
