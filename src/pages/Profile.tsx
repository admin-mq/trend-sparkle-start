import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBrandProfiles, BrandProfileInput } from "@/hooks/useBrandProfiles";
import { toast } from "sonner";
import { Building2, Globe, Upload, Save, Loader2, Plus, Pencil, Trash2, X, Briefcase, Sparkles, Users, Star, MapPin } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
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
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  // Competitor state
  type Competitor = { name: string; domain: string; type: 'local' | 'national' | 'global' | 'manual'; why_relevant: string; is_aspirational: boolean };
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [competitorsDiscovered, setCompetitorsDiscovered] = useState(false);

  const COMPETITOR_TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    local:    { label: 'Local',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <MapPin className="w-3 h-3" /> },
    national: { label: 'National', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   icon: <Building2 className="w-3 h-3" /> },
    global:   { label: 'Global',   className: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: <Globe className="w-3 h-3" /> },
    manual:   { label: 'Custom',   className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: <Plus className="w-3 h-3" /> },
  };
  
  const [formData, setFormData] = useState<BrandProfileInput>({
    brand_name: "",
    industry: "",
    industry_other: "",
    geography: "",
    business_summary: "",
    logo_url: ""
  });

  const INDUSTRIES_PROFILE = [
    "Retail & E-commerce", "FMCG/Consumer Goods", "Technology & Software (SaaS/AI)",
    "Media/Entertainment & Gaming", "Healthcare & Pharmaceuticals", "Finance & Insurance",
    "Hospitality & Tourism", "Food Services", "Professional Services", "Education & Training", "Other"
  ];

  const GEOGRAPHIES_PROFILE = [
    "Global", "North America", "Europe", "Asia Pacific", "Latin America",
    "Middle East & Africa", "United States", "United Kingdom", "India", "Australia"
  ];

  const handleAnalyzeWebsite = async () => {
    if (!websiteUrl.trim()) return;
    setIsAnalyzing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-brand-website', {
        body: { website_url: websiteUrl.trim() }
      });
      if (fnError || !data?.brand_profile) {
        toast.error(data?.error || 'Could not analyse website. Fill in details manually.');
        return;
      }
      const p = data.brand_profile;
      setFormData(prev => ({
        ...prev,
        brand_name: p.brand_name || prev.brand_name,
        business_summary: p.business_summary || prev.business_summary,
        industry: INDUSTRIES_PROFILE.includes(p.industry) ? p.industry : (p.industry ? 'Other' : prev.industry),
        industry_other: !INDUSTRIES_PROFILE.includes(p.industry) && p.industry ? p.industry : prev.industry_other,
        geography: GEOGRAPHIES_PROFILE.includes(p.geography) ? p.geography : prev.geography,
      }));
      toast.success('Brand profile auto-filled from website!');
    } catch {
      toast.error('Analysis failed. Please fill in details manually.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleDiscoverCompetitors = async () => {
    if (!formData.brand_name.trim()) return;
    setCompetitorsLoading(true);
    setCompetitorsError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('find-competitors', {
        body: {
          brand_name: formData.brand_name,
          brand_url: websiteUrl || '',
          industry: formData.industry === 'Other' ? (formData.industry_other || '') : (formData.industry || ''),
          geography: formData.geography || '',
          country: formData.geography || '',
        }
      });
      if (fnError) throw new Error(fnError.message);
      setCompetitors(data?.competitors ?? []);
      setCompetitorsDiscovered(true);
    } catch {
      setCompetitorsError('Could not find competitors. Add them manually below.');
    } finally {
      setCompetitorsLoading(false);
    }
  };

  const handleRemoveCompetitor = (domain: string) => {
    setCompetitors(prev => prev.filter(c => c.domain !== domain));
  };

  const handleAddManual = () => {
    const val = manualInput.trim();
    if (!val) return;
    const domain = val.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
    const name = domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
    if (competitors.some(c => c.domain === domain)) { setManualInput(''); return; }
    setCompetitors(prev => [...prev, { name, domain, type: 'manual', why_relevant: 'Added manually', is_aspirational: false }]);
    setManualInput('');
  };

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
    setWebsiteUrl('');
    setCompetitors([]);
    setCompetitorsDiscovered(false);
    setCompetitorsError(null);
    setManualInput('');
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
    setCompetitors([]);
    setCompetitorsDiscovered(false);
    setCompetitorsError(null);
    setManualInput('');
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
            {/* Website URL Auto-fill */}
            <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
              <Label className="text-sm font-medium flex items-center gap-1.5">
                <Globe className="w-3.5 h-3.5 text-primary" />
                Auto-fill from website
              </Label>
              <div className="flex gap-2">
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAnalyzeWebsite()}
                  placeholder="e.g. apple.com"
                  disabled={isAnalyzing}
                  className="flex-1"
                />
                <Button
                  onClick={handleAnalyzeWebsite}
                  disabled={isAnalyzing || !websiteUrl.trim()}
                  variant="outline"
                  className="gap-1.5 border-primary/40 text-primary hover:bg-primary/10 whitespace-nowrap"
                >
                  {isAnalyzing ? (
                    <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
                  ) : (
                    <><Sparkles className="w-3.5 h-3.5" /> Analyse</>
                  )}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">Paste your website URL to auto-fill the fields below.</p>
            </div>

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

            {/* Competitor Discovery */}
            <div className="space-y-3 border-t pt-4">
              <div className="flex items-center justify-between">
                <Label className="flex items-center gap-1.5">
                  <Users className="w-4 h-4" /> Competitors
                </Label>
                {formData.brand_name.trim() && (
                  <button
                    type="button"
                    onClick={handleDiscoverCompetitors}
                    disabled={competitorsLoading}
                    className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
                  >
                    {competitorsLoading
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding…</>
                      : <><Sparkles className="w-3 h-3" /> {competitorsDiscovered ? 'Refresh' : 'Discover'}</>
                    }
                  </button>
                )}
              </div>

              {competitorsError && <p className="text-xs text-destructive">{competitorsError}</p>}

              {competitors.length > 0 && (
                <div className="space-y-2">
                  {competitors.map((c) => {
                    const cfg = COMPETITOR_TYPE_CONFIG[c.type] ?? COMPETITOR_TYPE_CONFIG.manual;
                    return (
                      <div key={c.domain} className="flex items-start gap-2 p-2.5 rounded-lg bg-secondary/40 border border-border/40 group">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium truncate">{c.name}</span>
                            {c.is_aspirational && <Star className="w-3 h-3 text-amber-400 fill-amber-400 flex-shrink-0" />}
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${cfg.className}`}>
                              {cfg.icon}{cfg.label}
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.domain}</p>
                          {c.why_relevant && c.why_relevant !== 'Added manually' && (
                            <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{c.why_relevant}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveCompetitor(c.domain)}
                          className="flex-shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Input
                  value={manualInput}
                  onChange={(e) => setManualInput(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleAddManual()}
                  placeholder="Add competitor domain…"
                  className="text-sm h-9"
                />
                <Button type="button" variant="outline" size="sm" onClick={handleAddManual} disabled={!manualInput.trim()} className="h-9 px-3 flex-shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {!competitorsDiscovered && !competitorsLoading && competitors.length === 0 && formData.brand_name.trim() && (
                <p className="text-xs text-muted-foreground text-center">
                  Click <span className="text-primary font-medium">Discover</span> to auto-find competitors, or add manually above.
                </p>
              )}
              {!formData.brand_name.trim() && (
                <p className="text-xs text-muted-foreground">Enter a brand name above to discover competitors.</p>
              )}
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
