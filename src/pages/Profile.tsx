import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useBrandProfiles, BrandProfileInput } from "@/hooks/useBrandProfiles";
import { useAuthContext } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  Building2, Globe, Upload, Save, Loader2, Plus, X,
  Sparkles, Users, Star, MapPin, Instagram, Info, AtSign, CheckCircle2, Link2
} from "lucide-react";
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

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

// ─── Creator Profile ──────────────────────────────────────────────────────────

type ReferenceAccount = {
  id: string;
  instagram_handle: string;
  display_name: string | null;
  profile_picture_url: string | null;
  tone_analysis: Record<string, unknown> | null;
};

function CreatorProfile() {
  const { user } = useAuthContext();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState("");
  const [niche, setNiche] = useState("");
  const [location, setLocation] = useState("");
  const [bio, setBio] = useState("");
  const [isFaceless, setIsFaceless] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);

  const [igConnection, setIgConnection] = useState<{ username: string } | null>(null);
  const [igConnecting, setIgConnecting] = useState(false);

  const [referenceAccounts, setReferenceAccounts] = useState<ReferenceAccount[]>([]);
  const [newHandle, setNewHandle] = useState("");
  const [addingHandle, setAddingHandle] = useState(false);
  const [refLoading, setRefLoading] = useState(true);

  // Load profile + instagram connection + reference accounts on mount
  useEffect(() => {
    if (!user) return;

    const loadAll = async () => {
      const [profileRes, igRes, refRes] = await Promise.all([
        supabase.from("user_profiles").select("full_name,industry,industry_other,location,business_summary").eq("user_id", user.id).maybeSingle(),
        supabase.from("instagram_connections").select("username").eq("user_id", user.id).maybeSingle(),
        supabase.from("creator_reference_accounts").select("id,instagram_handle,display_name,profile_picture_url,tone_analysis").eq("user_id", user.id).order("created_at", { ascending: false }),
      ]);

      if (profileRes.data) {
        setFullName(profileRes.data.full_name || "");
        setNiche((profileRes.data as any).industry || "");
        setLocation(profileRes.data.location || "");
        setBio(profileRes.data.business_summary || "");
        setIsFaceless((profileRes.data as any).industry_other === "faceless");
      }
      setLoadingProfile(false);

      if (igRes.data) setIgConnection({ username: igRes.data.username });

      if (refRes.data) setReferenceAccounts(refRes.data as ReferenceAccount[]);
      setRefLoading(false);
    };

    loadAll();
  }, [user]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("user_profiles").upsert(
      { user_id: user.id, full_name: fullName, industry: niche, industry_other: isFaceless ? "faceless" : null, location, business_summary: bio },
      { onConflict: "user_id" }
    );
    setSaving(false);
    if (error) toast.error("Failed to save profile");
    else {
      toast.success("Profile saved");
      navigate("/dashboard");
    }
  };

  const handleConnectInstagram = async () => {
    if (!user) { toast.error("Sign in to connect Instagram"); return; }
    setIgConnecting(true);
    try {
      const redirectUri = `${window.location.origin}/instagram-callback`;
      const { data, error } = await supabase.functions.invoke("instagram-auth", {
        body: { action: "initiate", redirect_uri: redirectUri },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message);
      window.location.href = data.url;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Instagram connection");
      setIgConnecting(false);
    }
  };

  const handleAddReferenceAccount = async () => {
    if (!newHandle.trim() || !user) return;
    const handle = newHandle.replace("@", "").toLowerCase().trim();
    if (referenceAccounts.some(r => r.instagram_handle === handle)) {
      toast.error("Already added");
      setNewHandle("");
      return;
    }
    setAddingHandle(true);
    const { data, error } = await supabase.from("creator_reference_accounts").insert({
      user_id: user.id,
      instagram_handle: handle,
    }).select("id,instagram_handle,display_name,profile_picture_url,tone_analysis").single();
    setAddingHandle(false);
    if (error) { toast.error("Failed to add account"); return; }
    setReferenceAccounts(prev => [data as ReferenceAccount, ...prev]);
    setNewHandle("");
    toast.success(`@${handle} added. Head to Analysis to run a full style analysis.`);
  };

  const handleRemoveReferenceAccount = async (id: string, handle: string) => {
    const { error } = await supabase.from("creator_reference_accounts").delete().eq("id", id);
    if (error) { toast.error("Failed to remove"); return; }
    setReferenceAccounts(prev => prev.filter(r => r.id !== id));
    toast.success(`@${handle} removed`);
  };

  if (loadingProfile) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="p-6 max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Creator Profile</h1>
          <p className="text-muted-foreground">Your personal profile used by Amcue to personalise your content strategy</p>
        </div>

        {/* Meta / Instagram connection */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Instagram className="w-4 h-4" /> Meta Account
            </CardTitle>
            <CardDescription>Connect your Instagram to unlock richer analysis and auto-import captions.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Button
                disabled
                variant="outline"
                className="gap-2 border-pink-500/20 text-pink-400/50 cursor-not-allowed"
              >
                <Link2 className="w-4 h-4" />
                Connect Meta Account
              </Button>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-muted text-muted-foreground border border-border">
                Coming Soon
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Profile details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Your Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="full_name">Name</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="niche">Niche</Label>
              <Input
                id="niche"
                value={niche}
                onChange={e => setNiche(e.target.value)}
                placeholder="e.g. Fitness, Finance, Travel, Fashion…"
              />
            </div>

            <div className="space-y-2">
              <Label>Geography</Label>
              <Select value={location || ""} onValueChange={setLocation}>
                <SelectTrigger>
                  <SelectValue placeholder="Where do you create content?" />
                </SelectTrigger>
                <SelectContent>
                  {GEOGRAPHIES.map(geo => (
                    <SelectItem key={geo} value={geo}>{geo}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Who you are on social media</Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="1-2 lines about your content style, audience, and what you create"
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Is this a Faceless account?</Label>
              <p className="text-xs text-muted-foreground">Faceless accounts don't show the creator's face in content.</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFaceless(false)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    !isFaceless
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  No
                </button>
                <button
                  type="button"
                  onClick={() => setIsFaceless(true)}
                  className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${
                    isFaceless
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  Yes
                </button>
              </div>
            </div>

            <Button onClick={handleSaveProfile} disabled={saving} className="gap-2">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Profile
            </Button>
          </CardContent>
        </Card>

        {/* Reference Accounts — Coming Soon */}
        <div className="relative">
          {/* Overlay */}
          <div className="absolute inset-0 z-10 rounded-xl bg-background/60 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 pointer-events-none">
            <span className="text-xs font-medium px-3 py-1 rounded-full bg-muted text-muted-foreground border border-border">
              Coming Soon
            </span>
          </div>
          {/* Blurred card content */}
          <div className="pointer-events-none select-none opacity-50">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <AtSign className="w-4 h-4" /> Reference Accounts
              </CardTitle>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button type="button" className="text-muted-foreground hover:text-foreground transition-colors">
                    <Info className="w-4 h-4" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="right" className="max-w-xs text-sm">
                  A reference account is a creator whose content style you admire. Amcue analyses their tone, writing style, and hooks — then uses those insights to tailor content suggestions to match your preferred style.
                </TooltipContent>
              </Tooltip>
            </div>
            <CardDescription>Instagram handles of creators you look up to</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Add handle */}
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">@</span>
                <Input
                  value={newHandle}
                  onChange={e => setNewHandle(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && handleAddReferenceAccount()}
                  placeholder="instagramhandle"
                  className="pl-7"
                  disabled={addingHandle}
                />
              </div>
              <Button
                type="button"
                onClick={handleAddReferenceAccount}
                disabled={!newHandle.trim() || addingHandle}
                variant="outline"
                className="gap-1.5 flex-shrink-0"
              >
                {addingHandle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Add
              </Button>
            </div>

            {/* List */}
            {refLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : referenceAccounts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No reference accounts yet. Add a creator you admire above.
              </p>
            ) : (
              <div className="space-y-2">
                {referenceAccounts.map(account => (
                  <div key={account.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/40 border border-border/40 group">
                    {account.profile_picture_url ? (
                      <img src={account.profile_picture_url} alt={account.instagram_handle} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center flex-shrink-0">
                        <Instagram className="w-4 h-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        @{account.instagram_handle}
                        {account.display_name && (
                          <span className="text-muted-foreground font-normal ml-1">· {account.display_name}</span>
                        )}
                      </p>
                      {account.tone_analysis ? (
                        <p className="text-[11px] text-primary/70">Style analysed</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Go to Analysis to run style analysis</p>
                      )}
                    </div>
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <button
                          type="button"
                          className="flex-shrink-0 p-1 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>Remove @{account.instagram_handle}?</AlertDialogTitle>
                          <AlertDialogDescription>
                            This will remove this reference account and any style analysis associated with it.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                          <AlertDialogAction
                            onClick={() => handleRemoveReferenceAccount(account.id, account.instagram_handle)}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Remove
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
          </div>{/* end pointer-events-none blur wrapper */}
        </div>{/* end relative Coming Soon container */}
      </div>
    </TooltipProvider>
  );
}

// ─── Brand Profile ────────────────────────────────────────────────────────────

const Profile = () => {
  const { user: authUser, profile: authProfile } = useAuthContext();

  const isCreator =
    authProfile?.account_type === "creator" ||
    authUser?.user_metadata?.account_type === "creator";

  if (isCreator) return <CreatorProfile />;

  return <BrandProfile />;
};

function BrandProfile() {
  const { brands, loading, createBrand, updateBrand, uploadLogo } = useBrandProfiles();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  type Competitor = { name: string; domain: string; type: 'local' | 'national' | 'global' | 'manual'; why_relevant: string; is_aspirational: boolean };
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [competitorsLoading, setCompetitorsLoading] = useState(false);
  const [competitorsError, setCompetitorsError] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [competitorsDiscovered, setCompetitorsDiscovered] = useState(false);
  const [formData, setFormData] = useState<BrandProfileInput>({
    brand_name: "",
    industry: "",
    industry_other: "",
    geography: "",
    business_summary: "",
    logo_url: ""
  });

  // Auto-populate form from the user's single saved brand on first load.
  const initialized = useRef(false);
  useEffect(() => {
    if (loading || initialized.current) return;
    initialized.current = true;
    if (brands.length > 0) {
      const brand = brands[0];
      setFormData({
        brand_name: brand.brand_name,
        industry: brand.industry || "",
        industry_other: brand.industry_other || "",
        geography: brand.geography || "",
        business_summary: brand.business_summary || "",
        logo_url: brand.logo_url || ""
      });
      setEditingId(brand.id);
      const saved = (brand as any).competitors ?? [];
      setCompetitors(saved);
      setCompetitorsDiscovered(saved.length > 0);
    }
  }, [loading]); // eslint-disable-line react-hooks/exhaustive-deps

  const COMPETITOR_TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    local:    { label: 'Local',    className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', icon: <MapPin className="w-3 h-3" /> },
    national: { label: 'National', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30',   icon: <Building2 className="w-3 h-3" /> },
    global:   { label: 'Global',   className: 'bg-violet-500/15 text-violet-400 border-violet-500/30', icon: <Globe className="w-3 h-3" /> },
    manual:   { label: 'Custom',   className: 'bg-blue-500/15 text-blue-400 border-blue-500/30',       icon: <Plus className="w-3 h-3" /> },
  };

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
    const brand = brands[0];
    if (brand) {
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
      const saved = (brand as any).competitors ?? [];
      setCompetitors(saved);
      setCompetitorsDiscovered(saved.length > 0);
      setCompetitorsError(null);
      setManualInput('');
    } else {
      setFormData({ brand_name: "", industry: "", industry_other: "", geography: "", business_summary: "", logo_url: "" });
      setEditingId(null);
      setIsCreating(true);
      setWebsiteUrl('');
      setCompetitors([]);
      setCompetitorsDiscovered(false);
      setCompetitorsError(null);
      setManualInput('');
    }
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image file"); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Image must be less than 2MB"); return; }
    setUploading(true);
    const { url, error } = await uploadLogo(file);
    setUploading(false);
    if (error) { toast.error(error); return; }
    if (url) { setFormData(prev => ({ ...prev, logo_url: url })); toast.success("Logo uploaded"); }
  };

  const handleSave = async () => {
    if (!formData.brand_name.trim()) { toast.error("Brand name is required"); return; }
    setSaving(true);
    const payload = {
      ...formData,
      competitors: competitors.map(({ name, domain, type, why_relevant, is_aspirational }) => ({ name, domain, type, why_relevant, is_aspirational })),
    };
    const brandId = brands[0]?.id ?? editingId;
    if (brandId) {
      const { success, error } = await updateBrand(brandId, payload);
      if (success) toast.success("Brand profile updated");
      else toast.error(error || "Failed to update");
    } else {
      const { success, error, brand: newBrand } = await createBrand(payload);
      if (success) {
        toast.success("Brand profile created");
        if (newBrand) { setEditingId(newBrand.id); setIsCreating(false); }
      } else toast.error(error || "Failed to create");
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Brand Profile</h1>
        <p className="text-muted-foreground">Your brand profile is used across all tools</p>
      </div>

      <Card>
          <CardHeader>
            <CardTitle>{editingId ? "Edit Brand" : "Create Brand"}</CardTitle>
            <CardDescription>{editingId ? "Update your brand profile details" : "Set up your brand profile to get started"}</CardDescription>
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
                  <img src={formData.logo_url} alt="Brand logo" className="w-16 h-16 rounded-lg object-cover border" />
                ) : (
                  <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center">
                    <Building2 className="w-6 h-6 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <Input type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" id="logo-upload" disabled={uploading} />
                  <Label htmlFor="logo-upload" className="inline-flex items-center gap-2 px-3 py-2 text-sm border rounded-md cursor-pointer hover:bg-secondary transition-colors">
                    {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
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
              <Select value={formData.industry || ""} onValueChange={(value) => setFormData(prev => ({ ...prev, industry: value, industry_other: value === "Other" ? prev.industry_other : "" }))}>
                <SelectTrigger><SelectValue placeholder="Select industry" /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map((industry) => <SelectItem key={industry} value={industry}>{industry}</SelectItem>)}
                </SelectContent>
              </Select>
              {formData.industry === "Other" && (
                <Input value={formData.industry_other || ""} onChange={(e) => setFormData(prev => ({ ...prev, industry_other: e.target.value }))} placeholder="Specify your industry" className="mt-2" />
              )}
            </div>

            {/* Geography */}
            <div className="space-y-2">
              <Label>Geography</Label>
              <Select value={formData.geography || ""} onValueChange={(value) => setFormData(prev => ({ ...prev, geography: value }))}>
                <SelectTrigger><SelectValue placeholder="Select geography" /></SelectTrigger>
                <SelectContent>
                  {GEOGRAPHIES.map((geo) => <SelectItem key={geo} value={geo}>{geo}</SelectItem>)}
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
                  <button type="button" onClick={handleDiscoverCompetitors} disabled={competitorsLoading} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors disabled:opacity-50">
                    {competitorsLoading ? <><Loader2 className="w-3 h-3 animate-spin" /> Finding…</> : <><Sparkles className="w-3 h-3" /> {competitorsDiscovered ? 'Refresh' : 'Discover'}</>}
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
                        <button type="button" onClick={() => handleRemoveCompetitor(c.domain)} className="flex-shrink-0 mt-0.5 p-0.5 rounded text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 transition-colors opacity-0 group-hover:opacity-100">
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <Input value={manualInput} onChange={(e) => setManualInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && handleAddManual()} placeholder="Add competitor domain…" className="text-sm h-9" />
                <Button type="button" variant="outline" size="sm" onClick={handleAddManual} disabled={!manualInput.trim()} className="h-9 px-3 flex-shrink-0">
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>

              {!competitorsDiscovered && !competitorsLoading && competitors.length === 0 && formData.brand_name.trim() && (
                <p className="text-xs text-muted-foreground text-center">Click <span className="text-primary font-medium">Discover</span> to auto-find competitors, or add manually above.</p>
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
              <Button variant="outline" onClick={resetForm}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
    </div>
  );
}

export default Profile;
