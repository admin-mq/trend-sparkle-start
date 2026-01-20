import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, RecommendedTrend } from "@/types/trends";
import { useAuth } from "@/hooks/useAuth";
import { Sparkles, Zap, ChevronDown, Flame, Skull, Zap as ZapIcon, MessageCircle, PartyPopper, Rocket, Crown, GraduationCap, Briefcase, Minimize2, Coffee } from "lucide-react";

interface BrandProfileFormProps {
  onRecommendationsReceived: (recommendations: RecommendedTrend[]) => void;
  onBrandNameChange: (brandName: string) => void;
  onUserProfileChange: (profile: UserProfile) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

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

const AUDIENCES = [
  "Gen Z",
  "Millennials",
  "Gen Z & Millennials",
  "Parents",
  "Professionals",
  "Students",
  "Everyone",
  "Custom"
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

const TONES = [
  "Casual",
  "Professional",
  "Educational",
  "High-energy",
  "Minimal & clean",
  "Bold / edgy",
  "Playful",
  "Sarcastic",
  "Wholesome",
  "Luxury / premium",
  "Naughty",
  "Savage"
];

// Priority order for determining primary tone (highest priority first)
const TONE_PRIORITY: string[] = [
  "Naughty",
  "Savage",
  "Bold / edgy",
  "Sarcastic",
  "Playful",
  "High-energy",
  "Luxury / premium",
  "Educational",
  "Professional",
  "Minimal & clean",
  "Wholesome",
  "Casual"
];

// Meter label mapping
const TONE_METER_LABELS: Record<string, string> = {
  "Naughty": "Spice meter",
  "Savage": "Roast meter",
  "Bold / edgy": "Edge meter",
  "Sarcastic": "Sass meter",
  "Playful": "Fun meter",
  "High-energy": "Hype meter",
  "Luxury / premium": "Prestige meter",
  "Educational": "Depth meter",
  "Professional": "Formality meter",
  "Minimal & clean": "Minimalism meter",
  "Wholesome": "Warmth meter",
  "Casual": "Vibe meter"
};

// Helper text for each meter
const TONE_METER_HELPER: Record<string, string> = {
  "Naughty": "1 = cheeky · 3 = bold innuendo · 5 = A-rated brand energy (non-explicit)",
  "Savage": "1 = light banter · 3 = sharp humour · 5 = ruthless but brand-safe",
  "Bold / edgy": "1 = slightly provocative · 3 = attention-grabbing · 5 = unapologetically bold",
  "Sarcastic": "1 = subtle wit · 3 = dry humour · 5 = maximum snark",
  "Playful": "1 = light-hearted · 3 = fun & bouncy · 5 = full goofball energy",
  "High-energy": "1 = upbeat · 3 = excited · 5 = hype overload",
  "Luxury / premium": "1 = refined · 3 = exclusive · 5 = ultra-aspirational",
  "Educational": "1 = casual tips · 3 = informative · 5 = deep-dive expert",
  "Professional": "1 = approachable · 3 = polished · 5 = corporate formal",
  "Minimal & clean": "1 = slightly sparse · 3 = clean aesthetic · 5 = ultra-minimal",
  "Wholesome": "1 = friendly · 3 = heartwarming · 5 = pure wholesome vibes",
  "Casual": "1 = relaxed · 3 = conversational · 5 = ultra-chill"
};

// Icons for each tone
const TONE_ICONS: Record<string, React.ReactNode> = {
  "Naughty": <Flame className="w-4 h-4" />,
  "Savage": <Skull className="w-4 h-4" />,
  "Bold / edgy": <ZapIcon className="w-4 h-4" />,
  "Sarcastic": <MessageCircle className="w-4 h-4" />,
  "Playful": <PartyPopper className="w-4 h-4" />,
  "High-energy": <Rocket className="w-4 h-4" />,
  "Luxury / premium": <Crown className="w-4 h-4" />,
  "Educational": <GraduationCap className="w-4 h-4" />,
  "Professional": <Briefcase className="w-4 h-4" />,
  "Minimal & clean": <Minimize2 className="w-4 h-4" />,
  "Wholesome": <Coffee className="w-4 h-4" />,
  "Casual": <Coffee className="w-4 h-4" />
};

const CONTENT_FORMATS = [
  "Short-form video (Reels / TikTok / Shorts)",
  "Carousel post",
  "Single image",
  "Story",
  "Mix of formats"
];

const PRIMARY_GOALS = [
  "Sales",
  "Leads",
  "App downloads",
  "Saves",
  "Profile visits",
  "Follower growth",
  "Engagement",
  "Website traffic"
];

export const BrandProfileForm = ({ 
  onRecommendationsReceived, 
  onBrandNameChange, 
  onUserProfileChange,
  loading,
  setLoading
}: BrandProfileFormProps) => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<Omit<UserProfile, 'tone' | 'tones' | 'primary_tone' | 'tone_intensity' | 'tone_meter_label'>>({
    brand_name: '',
    business_summary: '',
    industry: '',
    niche: '',
    audience: '',
    geography: '',
    content_format: '',
    primary_goal: ''
  });
  const [customIndustry, setCustomIndustry] = useState('');

  const [selectedTones, setSelectedTones] = useState<string[]>([]);
  const [toneIntensity, setToneIntensity] = useState<number>(3);
  const [error, setError] = useState<string | null>(null);

  // Derive primary tone based on priority
  const primaryTone = useMemo(() => {
    if (selectedTones.length === 0) return null;
    for (const tone of TONE_PRIORITY) {
      if (selectedTones.includes(tone)) {
        return tone;
      }
    }
    return selectedTones[0];
  }, [selectedTones]);

  const toneMeterLabel = primaryTone ? TONE_METER_LABELS[primaryTone] : null;
  const toneMeterHelper = primaryTone ? TONE_METER_HELPER[primaryTone] : null;

  const handleInputChange = (field: keyof typeof userProfile, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
    if (field === 'brand_name') {
      onBrandNameChange(value);
    }
  };

  const handleToneToggle = (tone: string) => {
    setSelectedTones(prev => {
      if (prev.includes(tone)) {
        return prev.filter(t => t !== tone);
      }
      return [...prev, tone];
    });
  };

  const buildUserProfile = (): UserProfile => {
    // Build the tone string for backward compatibility
    let toneString = "casual";
    if (selectedTones.length === 1) {
      toneString = selectedTones[0];
    } else if (selectedTones.length > 1) {
      toneString = selectedTones.join(" + ");
    }

    // Use custom industry text if "Other" is selected
    const finalIndustry = userProfile.industry === "Other" && customIndustry.trim() 
      ? customIndustry.trim() 
      : userProfile.industry;

    return {
      ...userProfile,
      industry: finalIndustry,
      tone: toneString,
      tones: selectedTones.length > 0 ? selectedTones : ["casual"],
      primary_tone: primaryTone || "casual",
      tone_intensity: toneIntensity,
      tone_meter_label: toneMeterLabel || "Vibe meter"
    };
  };

  const handleSubmit = async () => {
    if (!userProfile.brand_name.trim()) {
      setError('Please enter a brand name');
      return;
    }

    setLoading(true);
    setError(null);
    
    const fullProfile = buildUserProfile();
    onUserProfileChange(fullProfile);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recommend-trends', {
        body: { user_profile: fullProfile, user_id: user?.id || null }
      });

      if (functionError) {
        console.error('Edge function error:', functionError);
        throw new Error('Failed to load recommendations');
      }

      if (!data || !data.recommended_trends) {
        throw new Error('Invalid response from recommendation service');
      }

      onRecommendationsReceived(data.recommended_trends);
    } catch (err) {
      console.error('Error fetching recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
          <Zap className="w-4 h-4 text-primary" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">Brand Profile</h2>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <div className="space-y-2">
          <Label htmlFor="brand_name" className="text-xs text-muted-foreground uppercase tracking-wider">Brand name</Label>
          <Input
            id="brand_name"
            value={userProfile.brand_name}
            onChange={(e) => handleInputChange('brand_name', e.target.value)}
            placeholder="Your brand"
            className="bg-secondary/50 border-border/50 focus:border-primary"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="business_summary" className="text-xs text-muted-foreground uppercase tracking-wider">Business summary (optional)</Label>
          <Textarea
            id="business_summary"
            value={userProfile.business_summary || ''}
            onChange={(e) => handleInputChange('business_summary', e.target.value)}
            placeholder="Describe your business in 1–2 lines"
            className="bg-secondary/50 border-border/50 focus:border-primary min-h-[60px] resize-none"
            rows={2}
          />
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Industry</Label>
          <Select value={userProfile.industry} onValueChange={(v) => handleInputChange('industry', v)}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select industry" />
            </SelectTrigger>
            <SelectContent>
              {INDUSTRIES.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {userProfile.industry === "Other" && (
            <Input
              value={customIndustry}
              onChange={(e) => setCustomIndustry(e.target.value)}
              placeholder="Specify your industry"
              className="bg-secondary/50 border-border/50 focus:border-primary mt-2"
            />
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="niche" className="text-xs text-muted-foreground uppercase tracking-wider">Niche (optional)</Label>
          <Textarea
            id="niche"
            value={userProfile.niche}
            onChange={(e) => handleInputChange('niche', e.target.value)}
            placeholder="Optional: add a niche or sub-category in 1 line"
            className="bg-secondary/50 border-border/50 focus:border-primary min-h-[50px] resize-none"
            rows={2}
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Audience</Label>
            <Select value={userProfile.audience} onValueChange={(v) => handleInputChange('audience', v)}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {AUDIENCES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Geography</Label>
            <Select value={userProfile.geography} onValueChange={(v) => handleInputChange('geography', v)}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {GEOGRAPHIES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Multi-select Tone */}
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tone</Label>
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="w-full justify-between bg-secondary/50 border-border/50 hover:bg-secondary/70 text-left font-normal"
              >
                <span className={selectedTones.length === 0 ? "text-muted-foreground" : ""}>
                  {selectedTones.length === 0 
                    ? "Select tone(s)" 
                    : selectedTones.length === 1 
                      ? selectedTones[0]
                      : `${selectedTones.length} tones selected`}
                </span>
                <ChevronDown className="w-4 h-4 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[280px] p-2 bg-card border-border" align="start">
              <div className="space-y-1 max-h-[300px] overflow-y-auto">
                {TONES.map((tone) => (
                  <div
                    key={tone}
                    className="flex items-center gap-3 px-2 py-2 rounded-md hover:bg-secondary/50 cursor-pointer"
                    onClick={() => handleToneToggle(tone)}
                  >
                    <Checkbox
                      checked={selectedTones.includes(tone)}
                      onCheckedChange={() => handleToneToggle(tone)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{tone}</span>
                  </div>
                ))}
              </div>
            </PopoverContent>
          </Popover>
          
          {/* Selected tones pills */}
          {selectedTones.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {selectedTones.map((tone) => (
                <span
                  key={tone}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-primary/20 text-primary cursor-pointer hover:bg-primary/30"
                  onClick={() => handleToneToggle(tone)}
                >
                  {tone}
                  <span className="text-primary/60">×</span>
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Dynamic Tone Meter */}
        {primaryTone && (
          <div className="space-y-3 p-3 rounded-lg bg-secondary/30 border border-border/50">
            <div className="flex items-center gap-2">
              <span className="text-primary">{TONE_ICONS[primaryTone]}</span>
              <Label className="text-sm font-medium text-foreground">{toneMeterLabel}</Label>
              <span className="ml-auto text-sm font-semibold text-primary">{toneIntensity}/5</span>
            </div>
            <Slider
              value={[toneIntensity]}
              onValueChange={([val]) => setToneIntensity(val)}
              min={1}
              max={5}
              step={1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">{toneMeterHelper}</p>
          </div>
        )}

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Content format</Label>
          <Select value={userProfile.content_format} onValueChange={(v) => handleInputChange('content_format', v)}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_FORMATS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Primary goal</Label>
          <Select value={userProfile.primary_goal} onValueChange={(v) => handleInputChange('primary_goal', v)}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue placeholder="What's the goal?" />
            </SelectTrigger>
            <SelectContent>
              {PRIMARY_GOALS.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error && (
        <p className="text-destructive text-sm mt-3">{error}</p>
      )}

      <Button 
        onClick={handleSubmit} 
        disabled={loading}
        className="w-full mt-4 bg-primary hover:bg-primary/90 text-primary-foreground gap-2"
      >
        <Sparkles className="w-4 h-4" />
        {loading ? 'Scanning trends…' : 'Get AI trend suggestions'}
      </Button>
    </div>
  );
};
