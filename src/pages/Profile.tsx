import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBrandProfiles, BrandProfileInput } from "@/hooks/useBrandProfiles";
import { toast } from "sonner";
import { Building2, Globe, Upload, Save, Loader2, Plus, Pencil, Trash2, X, Briefcase } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const INDUSTRIES = [
  "Retail & E-commerce",
  "FMCG/Consumer Goods",
  "Technology & Software (SaaS/AI)",
  "Media/Entertainment & Gaming",
  "Healthcare & Pharmaceuticals",
  "Finance & Insurance",
  "Hospitality & Tourism",
  "Food Services",
  "Professional Services",
  "Education & Training",
  "Other"
];

const GEOGRAPHIES = [
  "Global",
  "North America",
  "Europe",
  "Asia Pacific",
  "Latin America",
  "Middle East & Africa",
  "United States",
  "United Kingdom",
  "India",
  "Australia"
];

const Profile = () => {
  const { brands, loading, createBrand, updateBrand, deleteBrand, uploadLogo } = useBrandProfiles();
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState<BrandProfileInput>({
    brand_name: "",
    industry: "",
    industry_other: "",
    geography: "",
    business_summary: "",
    logo_url: ""
  });

  const resetForm = () => {
    setFormData({
      brand_name: "",
      industry: "",
      industry_other: "",
      geography: "",
      business_summary: "",
      logo_url: ""
    });
    setEditingId(null);
    setIsCreating(false);
  };

  const startEditing = (brand: typeof brands[0]) => {
    setFormData({
      brand_name: brand.brand_name,
      industry: brand.industry || "",
      industry_other: brand.industry_other || "",
      geography: brand.geography || "",
      business_summary: brand.business_summary || "",
      logo_url: brand.logo_url || ""
    });
    setEditingId(brand.id);
    setIsCreating(false);
  };

  const startCreating = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be less than 2MB");
      return;
    }

    setUploading(true);
    const { url, error } = await uploadLogo(file);
    setUploading(false);

    if (error) {
      toast.error(error);
      return;
    }

    if (url) {
      setFormData(prev => ({ ...prev, logo_url: url }));
      toast.success("Logo uploaded");
    }
  };

  const handleSave = async () => {
    if (!formData.brand_name.trim()) {
      toast.error("Brand name is required");
      return;
    }

    setSaving(true);

    if (editingId) {
      const { success, error } = await updateBrand(editingId, formData);
      if (success) {
        toast.success("Brand profile updated");
        resetForm();
      } else {
        toast.error(error || "Failed to update");
      }
    } else {
      const { success, error } = await createBrand(formData);
      if (success) {
        toast.success("Brand profile created");
        resetForm();
      } else {
        toast.error(error || "Failed to create");
      }
    }

    setSaving(false);
  };

  const handleDelete = async (id: string) => {
    const { success, error } = await deleteBrand(id);
    if (success) {
      toast.success("Brand profile deleted");
      if (editingId === id) resetForm();
    } else {
      toast.error(error || "Failed to delete");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isFormOpen = isCreating || editingId !== null;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Brand Profiles</h1>
          <p className="text-muted-foreground">Manage your brand profiles for use across all tools</p>
        </div>
        {!isFormOpen && (
          <Button onClick={startCreating} className="gap-2">
            <Plus className="w-4 h-4" />
            Add New Brand
          </Button>
        )}
      </div>

      {/* Brand Form */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{editingId ? "Edit Brand" : "Create New Brand"}</CardTitle>
                <CardDescription>
                  {editingId ? "Update your brand profile details" : "Add a new brand profile"}
                </CardDescription>
              </div>
              <Button variant="ghost" size="icon" onClick={resetForm}>
                <X className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Logo Upload */}
            <div className="space-y-2">
              <Label>Brand Logo</Label>
              <div className="flex items-center gap-4">
                {formData.logo_url ? (
                  <img
                    src={formData.logo_url}
                    alt="Brand logo"
                    className="w-16 h-16 rounded-lg object-cover border"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <Input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoUpload}
                    className="hidden"
                    id="logo-upload"
                    disabled={uploading}
                  />
                  <Label
                    htmlFor="logo-upload"
                    className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-secondary transition-colors"
                  >
                    {uploading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Upload className="w-4 h-4" />
                    )}
                    {uploading ? "Uploading..." : "Upload Logo"}
                  </Label>
                </div>
              </div>
            </div>

            {/* Brand Name */}
            <div className="space-y-2">
              <Label htmlFor="brand_name">Brand Name *</Label>
              <Input
                id="brand_name"
                value={formData.brand_name}
                onChange={(e) => setFormData(prev => ({ ...prev, brand_name: e.target.value }))}
                placeholder="Enter brand name"
              />
            </div>

            {/* Industry */}
            <div className="space-y-2">
              <Label>Industry</Label>
              <Select
                value={formData.industry || ""}
                onValueChange={(value) => setFormData(prev => ({ 
                  ...prev, 
                  industry: value,
                  industry_other: value === "Other" ? prev.industry_other : ""
                }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select industry" />
                </SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => (
                    <SelectItem key={industry} value={industry}>
                      {industry}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {formData.industry === "Other" && (
                <Input
                  value={formData.industry_other || ""}
                  onChange={(e) => setFormData(prev => ({ ...prev, industry_other: e.target.value }))}
                  placeholder="Specify your industry"
                  className="mt-2"
                />
              )}
            </div>

            {/* Geography */}
            <div className="space-y-2">
              <Label>Geography</Label>
              <Select
                value={formData.geography || ""}
                onValueChange={(value) => setFormData(prev => ({ ...prev, geography: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select geography" />
                </SelectTrigger>
                <SelectContent>
                  {GEOGRAPHIES.map((geo) => (
                    <SelectItem key={geo} value={geo}>
                      {geo}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Business Summary */}
            <div className="space-y-2">
              <Label htmlFor="business_summary">Business Summary</Label>
              <Textarea
                id="business_summary"
                value={formData.business_summary || ""}
                onChange={(e) => setFormData(prev => ({ ...prev, business_summary: e.target.value }))}
                placeholder="Brief description of your brand (1-2 sentences)"
                rows={2}
              />
            </div>

            {/* Save Button */}
            <div className="flex gap-3">
              <Button onClick={handleSave} disabled={saving} className="gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingId ? "Update Brand" : "Create Brand"}
              </Button>
              <Button variant="outline" onClick={resetForm}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Brand List */}
      {brands.length === 0 && !isFormOpen ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Building2 className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No brand profiles yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first brand profile to get started with Trend Quest and other tools.
            </p>
            <Button onClick={startCreating} className="gap-2">
              <Plus className="w-4 h-4" />
              Create Your First Brand
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {brands.map((brand) => (
            <Card key={brand.id} className={editingId === brand.id ? "ring-2 ring-primary" : ""}>
              <CardContent className="p-4">
                <div className="flex items-center gap-4">
                  {brand.logo_url ? (
                    <img
                      src={brand.logo_url}
                      alt={brand.brand_name}
                      className="w-12 h-12 rounded-lg object-cover border"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{brand.brand_name}</h3>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      {brand.industry && (
                        <span className="flex items-center gap-1">
                          <Briefcase className="w-3 h-3" />
                          {brand.industry === "Other" ? brand.industry_other : brand.industry}
                        </span>
                      )}
                      {brand.geography && (
                        <span className="flex items-center gap-1">
                          <Globe className="w-3 h-3" />
                          {brand.geography}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => startEditing(brand)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive">
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Delete Brand Profile?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will permanently delete "{brand.brand_name}". This action cannot be undone.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleDelete(brand.id)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default Profile;
