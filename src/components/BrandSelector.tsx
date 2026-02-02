import { Link } from "react-router-dom";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { BrandProfile } from "@/hooks/useBrandProfiles";
import { TrendQuestInputs, TrendQuestInputValues } from "@/components/TrendQuestInputs";
import { Building2, Briefcase, MapPin, Pencil, Plus, Sparkles, Loader2 } from "lucide-react";
interface BrandSelectorProps {
  brands: BrandProfile[];
  selectedBrandId: string | null;
  onSelectBrand: (brandId: string) => void;
  onGetTrends: () => void;
  loading?: boolean;
  brandsLoading?: boolean;
  inputValues: TrendQuestInputValues;
  onInputChange: (values: TrendQuestInputValues) => void;
}
export const BrandSelector = ({
  brands,
  selectedBrandId,
  onSelectBrand,
  onGetTrends,
  loading = false,
  brandsLoading = false,
  inputValues,
  onInputChange
}: BrandSelectorProps) => {
  const selectedBrand = brands.find(b => b.id === selectedBrandId);

  // Check if required fields are filled
  const isFormValid = selectedBrandId && inputValues.audience && inputValues.content_format && inputValues.primary_goal;
  if (brandsLoading) {
    return <Card className="h-full">
        <CardContent className="p-6 flex items-center justify-center h-full">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>;
  }

  // No brands - show CTA
  if (brands.length === 0) {
    return <Card className="h-full">
        <CardContent className="p-6 text-center">
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Building2 className="w-6 h-6 text-primary" />
          </div>
          <h3 className="font-semibold mb-2">Create a Brand Profile (in one easy step)</h3>
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
      </Card>;
  }
  return <Card className="h-full flex flex-col">
      <ScrollArea className="flex-1">
        <CardContent className="p-4 space-y-4">
          {/* Brand Dropdown */}
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Select Brand</label>
            <Select value={selectedBrandId || ""} onValueChange={onSelectBrand}>
              <SelectTrigger>
                <SelectValue placeholder="Select a brand" />
              </SelectTrigger>
              <SelectContent>
                {brands.map(brand => <SelectItem key={brand.id} value={brand.id}>
                    <div className="flex items-center gap-2">
                      {brand.logo_url ? <img src={brand.logo_url} alt={brand.brand_name} className="w-5 h-5 rounded object-cover" /> : <Building2 className="w-4 h-4 text-muted-foreground" />}
                      <span>{brand.brand_name}</span>
                    </div>
                  </SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Selected Brand Details */}
          {selectedBrand && <div className="space-y-2 pt-2 border-t">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {selectedBrand.logo_url ? <img src={selectedBrand.logo_url} alt={selectedBrand.brand_name} className="w-8 h-8 rounded-lg object-cover border" /> : <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-muted-foreground" />
                    </div>}
                  <p className="font-medium text-sm">{selectedBrand.brand_name}</p>
                </div>
                <Link to="/profile" className="text-xs text-muted-foreground hover:text-primary flex items-center gap-1">
                  <Pencil className="w-3 h-3" />
                  Edit
                </Link>
              </div>

              <div className="flex flex-wrap gap-1.5 text-xs">
                {selectedBrand.industry && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    <Briefcase className="w-3 h-3" />
                    {selectedBrand.industry === "Other" ? selectedBrand.industry_other : selectedBrand.industry}
                  </span>}
                {selectedBrand.geography && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                    <MapPin className="w-3 h-3" />
                    {selectedBrand.geography}
                  </span>}
              </div>

              {selectedBrand.business_summary && <p className="text-xs text-muted-foreground line-clamp-2">
                  {selectedBrand.business_summary}
                </p>}
            </div>}

          {selectedBrand && <TrendQuestInputs values={inputValues} onChange={onInputChange} />}

          {/* Get Trends Button */}
          <div className="pt-2">
            <Button onClick={onGetTrends} disabled={!isFormValid || loading} className="w-full gap-2">
              {loading ? <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Scanning trends…
                </> : <>
                  <Sparkles className="w-4 h-4" />
                  Get Trend Recommendations
                </>}
            </Button>
          </div>

          {/* Link to add more brands */}
          <div className="text-center pb-2">
            <Link to="/profile" className="text-xs text-muted-foreground hover:text-primary">
              + Add another brand
            </Link>
          </div>
        </CardContent>
      </ScrollArea>
    </Card>;
};