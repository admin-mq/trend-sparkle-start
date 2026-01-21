import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandProfile } from "@/hooks/useBrandProfiles";
import { Building2, Briefcase, Globe, MapPin, Pencil, Plus, Sparkles, Loader2 } from "lucide-react";

interface BrandSelectorProps {
  brands: BrandProfile[];
  selectedBrandId: string | null;
  onSelectBrand: (brandId: string) => void;
  onGetTrends: () => void;
  loading?: boolean;
  brandsLoading?: boolean;
}

export const BrandSelector = ({
  brands,
  selectedBrandId,
  onSelectBrand,
  onGetTrends,
  loading = false,
  brandsLoading = false
}: BrandSelectorProps) => {
  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  if (brandsLoading) {
    return (
      <Card>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  // No brands - show CTA
  if (brands.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Create a Brand Profile</h3>
          <p className="text-sm text-muted-foreground mb-4">
            Set up your brand profile once and use it across all tools.
          </p>
          <Button asChild className="gap-2">
            <Link to="/profile">
              <Plus className="w-4 h-4" />
              Create Brand Profile
            </Link>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        {/* Brand Dropdown */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Select Brand</label>
          <Select value={selectedBrandId || ""} onValueChange={onSelectBrand}>
            <SelectTrigger>
              <SelectValue placeholder="Select a brand" />
            </SelectTrigger>
            <SelectContent>
              {brands.map((brand) => (
                <SelectItem key={brand.id} value={brand.id}>
                  <div className="flex items-center gap-2">
                    {brand.logo_url ? (
                      <img
                        src={brand.logo_url}
                        alt={brand.brand_name}
                        className="w-5 h-5 rounded object-cover"
                      />
                    ) : (
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span>{brand.brand_name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Selected Brand Details */}
        {selectedBrand && (
          <div className="space-y-3 pt-2 border-t">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {selectedBrand.logo_url ? (
                  <img
                    src={selectedBrand.logo_url}
                    alt={selectedBrand.brand_name}
                    className="w-10 h-10 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <p className="font-medium">{selectedBrand.brand_name}</p>
                </div>
              </div>
              <Link
                to="/profile"
                className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </Link>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              {selectedBrand.industry && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                  <Briefcase className="w-3 h-3" />
                  {selectedBrand.industry === "Other" ? selectedBrand.industry_other : selectedBrand.industry}
                </span>
              )}
              {selectedBrand.geography && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-secondary text-secondary-foreground">
                  <MapPin className="w-3 h-3" />
                  {selectedBrand.geography}
                </span>
              )}
            </div>

            {selectedBrand.business_summary && (
              <p className="text-sm text-muted-foreground line-clamp-2">
                {selectedBrand.business_summary}
              </p>
            )}
          </div>
        )}

        {/* Get Trends Button */}
        <Button
          onClick={onGetTrends}
          disabled={!selectedBrandId || loading}
          className="w-full gap-2"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Scanning trends…
            </>
          ) : (
            <>
              <Sparkles className="w-4 h-4" />
              Get Trend Recommendations
            </>
          )}
        </Button>

        {/* Link to add more brands */}
        <div className="text-center">
          <Link
            to="/profile"
            className="text-xs text-muted-foreground hover:text-primary"
          >
            + Add another brand
          </Link>
        </div>
      </CardContent>
    </Card>
  );
};
