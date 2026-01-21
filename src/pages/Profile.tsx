import { useState, useEffect, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useUserProfile } from "@/hooks/useUserProfile";
import { toast } from "sonner";
import { User, Building2, Globe, Upload, Link, Save, Loader2 } from "lucide-react";

const INDUSTRIES = [
  "Retail & E-commerce",
  "FMCG / Consumer Goods",
  "Technology & Software (SaaS/AI)",
  "Media, Entertainment & Gaming",
  "Healthcare & Pharmaceuticals",
  "Finance & Insurance",
  "Hospitality & Tourism",
  "Food Services (restaurants/cloud kitchens)",
  "Professional Services (consulting/legal/HR)",
  "Education & Training (edtech/upskilling)",
  "Other"
];

const GEOGRAPHIES = [
  "Global",
  "US & Canada",
  "UK & Europe",
  "India",
  "Middle East",
  "Southeast Asia",
  "Latin America",
  "Custom"
];

const Profile = () => {
  const { profile, loading, saveProfile, uploadLogo } = useUserProfile();
  
  const [formData, setFormData] = useState({
    full_name: "",
    brand_name: "",
    industry: "",
    industry_other: "",
    geography: "",
    business_summary: "",
    website: "",
    instagram: "",
    tiktok: "",
    youtube: "",
    linkedin: "",
  });
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || "",
        brand_name: profile.brand_name || "",
        industry: profile.industry || "",
        industry_other: profile.industry_other || "",
        geography: profile.geography || "",
        business_summary: profile.business_summary || "",
        website: profile.website || "",
        instagram: profile.instagram || "",
        tiktok: profile.tiktok || "",
        youtube: profile.youtube || "",
        linkedin: profile.linkedin || "",
      });
      setLogoUrl(profile.logo_url);
    }
  }, [profile]);

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error("Please upload an image file");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("Image must be less than 5MB");
      return;
    }

    setUploading(true);
    const { url, error } = await uploadLogo(file);
    setUploading(false);

    if (error) {
      toast.error(error);
    } else if (url) {
      setLogoUrl(url);
      toast.success("Logo uploaded!");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.brand_name.trim()) {
      toast.error("Brand name is required");
      return;
    }

    setSaving(true);
    const { success, error } = await saveProfile({
      ...formData,
      logo_url: logoUrl,
    });
    setSaving(false);

    if (success) {
      toast.success("Profile saved");
    } else {
      toast.error(error || "Failed to save profile");
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-4 lg:p-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-foreground">Profile</h1>
          <p className="text-muted-foreground mt-1">
            Set up your brand info once and all tools will use it automatically.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Personal & Brand Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <User className="w-4 h-4" />
                Brand Information
              </CardTitle>
              <CardDescription>Basic information about you and your brand</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="full_name">Full name</Label>
                  <Input
                    id="full_name"
                    value={formData.full_name}
                    onChange={(e) => handleChange("full_name", e.target.value)}
                    placeholder="Your name"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="brand_name">Brand name *</Label>
                  <Input
                    id="brand_name"
                    value={formData.brand_name}
                    onChange={(e) => handleChange("brand_name", e.target.value)}
                    placeholder="Your brand"
                    required
                  />
                </div>
              </div>

              {/* Logo Upload */}
              <div className="space-y-2">
                <Label>Brand logo (optional)</Label>
                <div className="flex items-center gap-4">
                  {logoUrl ? (
                    <img
                      src={logoUrl}
                      alt="Brand logo"
                      className="w-16 h-16 rounded-lg object-cover border border-border"
                    />
                  ) : (
                    <div className="w-16 h-16 rounded-lg bg-secondary flex items-center justify-center border border-border">
                      <Building2 className="w-6 h-6 text-muted-foreground" />
                    </div>
                  )}
                  <div>
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleLogoUpload}
                      accept="image/*"
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                    >
                      {uploading ? (
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4 mr-2" />
                      )}
                      Upload logo
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">Max 5MB, JPG/PNG</p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="business_summary">Business summary (optional)</Label>
                <Textarea
                  id="business_summary"
                  value={formData.business_summary}
                  onChange={(e) => handleChange("business_summary", e.target.value)}
                  placeholder="Describe your business in 1–2 lines"
                  rows={2}
                />
              </div>
            </CardContent>
          </Card>

          {/* Industry & Geography */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Globe className="w-4 h-4" />
                Industry & Market
              </CardTitle>
              <CardDescription>Help us understand your market context</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Select value={formData.industry} onValueChange={(v) => handleChange("industry", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select industry" />
                    </SelectTrigger>
                    <SelectContent>
                      {INDUSTRIES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Geography</Label>
                  <Select value={formData.geography} onValueChange={(v) => handleChange("geography", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select geography" />
                    </SelectTrigger>
                    <SelectContent>
                      {GEOGRAPHIES.map((item) => (
                        <SelectItem key={item} value={item}>{item}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.industry === "Other" && (
                <div className="space-y-2">
                  <Label htmlFor="industry_other">Specify industry</Label>
                  <Input
                    id="industry_other"
                    value={formData.industry_other}
                    onChange={(e) => handleChange("industry_other", e.target.value)}
                    placeholder="Your industry"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Social Links */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg">
                <Link className="w-4 h-4" />
                Social Links
              </CardTitle>
              <CardDescription>Optional links to your website and social profiles</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => handleChange("website", e.target.value)}
                  placeholder="https://yoursite.com"
                />
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="instagram">Instagram</Label>
                  <Input
                    id="instagram"
                    value={formData.instagram}
                    onChange={(e) => handleChange("instagram", e.target.value)}
                    placeholder="@yourbrand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tiktok">TikTok</Label>
                  <Input
                    id="tiktok"
                    value={formData.tiktok}
                    onChange={(e) => handleChange("tiktok", e.target.value)}
                    placeholder="@yourbrand"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="youtube">YouTube</Label>
                  <Input
                    id="youtube"
                    value={formData.youtube}
                    onChange={(e) => handleChange("youtube", e.target.value)}
                    placeholder="@yourchannel"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="linkedin">LinkedIn</Label>
                  <Input
                    id="linkedin"
                    value={formData.linkedin}
                    onChange={(e) => handleChange("linkedin", e.target.value)}
                    placeholder="company/yourbrand"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Button */}
          <div className="flex justify-end">
            <Button type="submit" disabled={saving} className="min-w-[140px]">
              {saving ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Save className="w-4 h-4 mr-2" />
              )}
              Save Profile
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Profile;
