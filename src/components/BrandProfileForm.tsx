import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { UserProfile, RecommendedTrend } from "@/types/trends";
import { Sparkles, Zap } from "lucide-react";

interface BrandProfileFormProps {
  onRecommendationsReceived: (recommendations: RecommendedTrend[]) => void;
  onBrandNameChange: (brandName: string) => void;
  onUserProfileChange: (profile: UserProfile) => void;
  loading: boolean;
  setLoading: (loading: boolean) => void;
}

const INDUSTRIES = [
  "Food & beverage",
  "Fashion & beauty",
  "Fitness & wellness",
  "Tech / SaaS",
  "Education",
  "Finance",
  "Gaming",
  "Music & entertainment",
  "Travel & hospitality",
  "Ecommerce / DTC",
  "Other"
];

const NICHES = [
  "Baking",
  "Streetwear",
  "Relationships",
  "Motorsports",
  "Interior design",
  "Crypto",
  "News & memes",
  "Health tips",
  "Parenting",
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
  "Witty but classy",
  "Professional",
  "Casual",
  "Bold / edgy",
  "Educational",
  "Empathetic",
  "High-energy",
  "Minimal & clean"
];

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
  const [userProfile, setUserProfile] = useState<UserProfile>({
    brand_name: '',
    industry: '',
    niche: '',
    audience: '',
    geography: '',
    tone: '',
    content_format: '',
    primary_goal: ''
  });

  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (field: keyof UserProfile, value: string) => {
    setUserProfile(prev => ({ ...prev, [field]: value }));
    if (field === 'brand_name') {
      onBrandNameChange(value);
    }
  };

  const handleSubmit = async () => {
    if (!userProfile.brand_name.trim()) {
      setError('Please enter a brand name');
      return;
    }

    setLoading(true);
    setError(null);
    onUserProfileChange(userProfile);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('recommend-trends', {
        body: { user_profile: userProfile }
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

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Industry</Label>
            <Select value={userProfile.industry} onValueChange={(v) => handleInputChange('industry', v)}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {INDUSTRIES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground uppercase tracking-wider">Niche</Label>
            <Select value={userProfile.niche} onValueChange={(v) => handleInputChange('niche', v)}>
              <SelectTrigger className="bg-secondary/50 border-border/50">
                <SelectValue placeholder="Select" />
              </SelectTrigger>
              <SelectContent>
                {NICHES.map((item) => (
                  <SelectItem key={item} value={item}>{item}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground uppercase tracking-wider">Tone</Label>
          <Select value={userProfile.tone} onValueChange={(v) => handleInputChange('tone', v)}>
            <SelectTrigger className="bg-secondary/50 border-border/50">
              <SelectValue placeholder="Select your vibe" />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((item) => (
                <SelectItem key={item} value={item}>{item}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

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
