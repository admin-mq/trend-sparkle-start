import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Users, Megaphone, Target, Palette, Twitter } from "lucide-react";

const PLATFORMS = [
  { value: 'Instagram',  label: 'Instagram',  icon: '📸' },
  { value: 'Twitter',    label: 'X',          icon: '𝕏' },
  { value: 'TikTok',     label: 'TikTok',     icon: '🎵' },
  { value: 'LinkedIn',   label: 'LinkedIn',   icon: '💼' },
  { value: 'YouTube',    label: 'YouTube',    icon: '▶️' },
] as const;

const TWITTER_REGIONS = [
  'UK', 'USA', 'India', 'Canada', 'Australia', 'Global',
  'Nigeria', 'South Africa', 'Pakistan', 'Brazil',
] as const;

const TREND_CATEGORIES = [
  'Entertainment', 'News', 'Tech', 'Entrepreneurship',
  'Sports', 'Fashion', 'Finance', 'Music', 'Gaming', 'Lifestyle',
] as const;

const TWITTER_FORMAT_OPTIONS = [
  'Single tweet',
  'Twitter thread',
] as const;

const AUDIENCE_OPTIONS = [
  "Gen Z",
  "Millennials",
  "Gen X",
  "Parents",
  "Couples",
  "Students",
  "Working professionals",
  "Founders/SMBs",
  "Marketers/Agencies",
  "B2B Buyers",
  "Other"
] as const;

const CONTENT_FORMAT_OPTIONS = [
  "Short video (Reels/TikTok)",
  "Carousel",
  "Static image",
  "Stories",
  "Long-form video (YouTube)",
  "Threads (X/LinkedIn)",
  "Newsletter/Blog",
  "Other"
] as const;

const PRIMARY_GOAL_OPTIONS = [
  "More followers",
  "More engagement",
  "More leads",
  "More sales",
  "More app downloads",
  "More website traffic",
  "Brand awareness",
  "Community building"
] as const;

const TONE_OPTIONS = [
  "casual",
  "professional",
  "educational",
  "high-energy",
  "minimal & clean",
  "bold / edgy",
  "playful",
  "sarcastic",
  "wholesome",
  "luxury / premium",
  "naughty",
  "savage"
] as const;


// Priority order for determining primary tone (highest to lowest)
const TONE_PRIORITY: string[] = [
  "naughty",
  "savage",
  "bold / edgy",
  "sarcastic",
  "playful",
  "high-energy",
  "luxury / premium",
  "educational",
  "professional",
  "minimal & clean",
  "casual"
];

// Meter label mapping
const TONE_METER_LABELS: Record<string, string> = {
  naughty: "Spice meter",
  savage: "Roast meter",
  "bold / edgy": "Edge meter",
  sarcastic: "Sass meter",
  playful: "Fun meter",
  "high-energy": "Hype meter",
  "luxury / premium": "Prestige meter",
  educational: "Depth meter",
  professional: "Formality meter",
  "minimal & clean": "Minimalism meter",
  casual: "Vibe meter",
  wholesome: "Warmth meter"
};

// Intensity descriptions per tone
const INTENSITY_DESCRIPTIONS: Record<string, string[]> = {
  naughty: ["Subtle hint", "Flirty", "Spicy", "Hot", "Fire 🔥"],
  savage: ["Light jab", "Witty", "Sharp", "Brutal", "Scorched 💀"],
  "bold / edgy": ["Understated", "Confident", "Bold", "Daring", "Provocative"],
  sarcastic: ["Dry", "Wry", "Cutting", "Biting", "Maximum snark"],
  playful: ["Chill", "Light", "Playful", "Bouncy", "Pure joy"],
  "high-energy": ["Relaxed", "Upbeat", "Energetic", "Hyped", "Explosive 🚀"],
  "luxury / premium": ["Elevated", "Refined", "Luxurious", "Elite", "Ultra-premium"],
  educational: ["Surface", "Informative", "Deep dive", "Expert", "Masterclass"],
  professional: ["Relaxed", "Business casual", "Professional", "Corporate", "Executive"],
  "minimal & clean": ["Expressive", "Clean", "Minimal", "Sparse", "Ultra-minimal"],
  casual: ["Neutral", "Relaxed", "Casual", "Very casual", "BFF vibes"],
  wholesome: ["Neutral", "Warm", "Heartfelt", "Touching", "Pure love 💛"]
};

export interface TrendQuestInputValues {
  audience: string;
  audience_other: string;
  content_format: string;
  content_format_other: string;
  primary_goal: string;
  tones: string[];
  tone_intensity: number;
  // New fields
  platform: string;
  topic_angle: string;
  content_categories: string[];
  twitter_geography: string;
  twitter_user_type: 'standard' | 'premium';
}

interface TrendQuestInputsProps {
  values: TrendQuestInputValues;
  onChange: (values: TrendQuestInputValues) => void;
}

export const TrendQuestInputs = ({ values, onChange }: TrendQuestInputsProps) => {
  // Compute primary tone based on priority
  const primaryTone = TONE_PRIORITY.find(t => values.tones.includes(t)) || values.tones[0] || "casual";
  const meterLabel = TONE_METER_LABELS[primaryTone] || "Vibe meter";
  const intensityDescriptions = INTENSITY_DESCRIPTIONS[primaryTone] || INTENSITY_DESCRIPTIONS.casual;

  const handleToneToggle = (tone: string) => {
    const newTones = values.tones.includes(tone)
      ? values.tones.filter(t => t !== tone)
      : [...values.tones, tone];
    
    // Ensure at least one tone is selected
    if (newTones.length === 0) return;
    
    onChange({ ...values, tones: newTones });
  };

  const handleChange = <K extends keyof TrendQuestInputValues>(key: K, value: TrendQuestInputValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const isTwitter = values.platform === 'Twitter';

  return (
    <div className="space-y-4 pt-4 border-t">

      {/* ── Platform selector ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Platform</Label>
        <div className="grid grid-cols-5 gap-1">
          {PLATFORMS.map((p) => (
            <button
              key={p.value}
              type="button"
              onClick={() => handleChange("platform", p.value)}
              className={`flex flex-col items-center gap-0.5 py-2 px-1 rounded-lg border text-[10px] font-medium transition-colors ${
                values.platform === p.value
                  ? 'bg-primary/15 border-primary text-primary'
                  : 'bg-muted/40 border-border/50 text-muted-foreground hover:border-primary/40'
              }`}
            >
              <span className="text-sm leading-none">{p.icon}</span>
              <span className="leading-tight">{p.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Topic angle (all platforms, optional) ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          Topic angle <span className="font-normal">(optional)</span>
        </Label>
        <Input
          value={values.topic_angle}
          onChange={(e) => handleChange("topic_angle", e.target.value)}
          placeholder="e.g. fat loss tips, product launch, morning routine"
          className="h-8 text-sm"
        />
      </div>

      {/* ── Trend categories (optional) ── */}
      <div className="space-y-1.5">
        <Label className="text-xs font-medium text-muted-foreground">
          Trend categories <span className="font-normal">(optional)</span>
        </Label>
        <div className="flex flex-wrap gap-1">
          {TREND_CATEGORIES.map((cat) => {
            const active = values.content_categories.includes(cat);
            return (
              <button
                key={cat}
                type="button"
                onClick={() => handleChange(
                  "content_categories",
                  active
                    ? values.content_categories.filter(c => c !== cat)
                    : [...values.content_categories, cat]
                )}
                className={`text-[10px] font-medium px-2 py-0.5 rounded-full border transition-colors ${
                  active
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-muted/40 text-muted-foreground border-border/50 hover:border-primary/40'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Twitter-specific settings ── */}
      {isTwitter && (
        <div className="space-y-3 p-3 rounded-lg border border-[#1DA1F2]/30 bg-[#1DA1F2]/5">
          <div className="flex items-center gap-1.5">
            <Twitter className="w-3.5 h-3.5 text-[#1DA1F2]" />
            <Label className="text-xs font-semibold text-[#1DA1F2]">X / Twitter settings</Label>
          </div>

          {/* Trend region */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Trend region</Label>
            <Select value={values.twitter_geography} onValueChange={(v) => handleChange("twitter_geography", v)}>
              <SelectTrigger className="h-8 text-sm bg-background border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TWITTER_REGIONS.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Account type */}
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">Account type</Label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleChange("twitter_user_type", "standard")}
                className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors ${
                  values.twitter_user_type === 'standard'
                    ? 'bg-primary/15 border-primary'
                    : 'bg-background border-border/50 hover:border-primary/40'
                }`}
              >
                <span className={`text-xs font-semibold ${values.twitter_user_type === 'standard' ? 'text-primary' : 'text-foreground'}`}>Standard</span>
                <span className="text-[10px] text-muted-foreground">280 chars</span>
              </button>
              <button
                type="button"
                onClick={() => handleChange("twitter_user_type", "premium")}
                className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors ${
                  values.twitter_user_type === 'premium'
                    ? 'bg-primary/15 border-primary'
                    : 'bg-background border-border/50 hover:border-primary/40'
                }`}
              >
                <span className={`text-xs font-semibold ${values.twitter_user_type === 'premium' ? 'text-primary' : 'text-foreground'}`}>Premium ✓</span>
                <span className="text-[10px] text-muted-foreground">25,000 chars</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Audience */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Users className="w-3 h-3" />
          Audience
        </Label>
        <Select value={values.audience} onValueChange={(v) => handleChange("audience", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select audience" />
          </SelectTrigger>
          <SelectContent>
            {AUDIENCE_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {values.audience === "Other" && (
          <Input
            placeholder="Describe your audience"
            value={values.audience_other}
            onChange={(e) => handleChange("audience_other", e.target.value)}
            className="h-8 text-sm mt-1"
          />
        )}
      </div>

      {/* Content Format — hidden for Twitter */}
      {!isTwitter && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Megaphone className="w-3 h-3" />
            Content Format
          </Label>
          <Select value={values.content_format} onValueChange={(v) => handleChange("content_format", v)}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Select format" />
            </SelectTrigger>
            <SelectContent>
              {CONTENT_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {values.content_format === "Other" && (
            <Input
              placeholder="Describe format"
              value={values.content_format_other}
              onChange={(e) => handleChange("content_format_other", e.target.value)}
              className="h-8 text-sm mt-1"
            />
          )}
        </div>
      )}

      {/* Twitter format */}
      {isTwitter && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Megaphone className="w-3 h-3" />
            Format
          </Label>
          <Select
            value={values.content_format || 'Single tweet'}
            onValueChange={(v) => handleChange("content_format", v)}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TWITTER_FORMAT_OPTIONS.map((opt) => (
                <SelectItem key={opt} value={opt}>{opt}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Primary Goal */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Target className="w-3 h-3" />
          Primary Goal
        </Label>
        <Select value={values.primary_goal} onValueChange={(v) => handleChange("primary_goal", v)}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder="Select goal" />
          </SelectTrigger>
          <SelectContent>
            {PRIMARY_GOAL_OPTIONS.map((opt) => (
              <SelectItem key={opt} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Tones Multi-Select */}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
          <Palette className="w-3 h-3" />
          Tone(s)
        </Label>
        <div className="flex flex-wrap gap-1.5">
          {TONE_OPTIONS.map((tone) => {
            const isSelected = values.tones.includes(tone);
            return (
              <Badge
                key={tone}
                variant={isSelected ? "default" : "outline"}
                className={`cursor-pointer text-xs py-0.5 px-2 transition-colors ${
                  isSelected
                    ? "bg-primary text-primary-foreground hover:bg-primary/90"
                    : "hover:bg-muted"
                }`}
                onClick={() => handleToneToggle(tone)}
              >
                {tone}
                {isSelected && values.tones.length > 1 && (
                  <X className="w-2.5 h-2.5 ml-1" />
                )}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Tone Intensity Meter */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs font-medium text-muted-foreground">{meterLabel}</Label>
          <span className="text-xs font-medium text-primary">
            {intensityDescriptions[values.tone_intensity - 1]}
          </span>
        </div>
        <Slider
          value={[values.tone_intensity]}
          onValueChange={([v]) => handleChange("tone_intensity", v)}
          min={1}
          max={5}
          step={1}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground">
          <span>1</span>
          <span>2</span>
          <span>3</span>
          <span>4</span>
          <span>5</span>
        </div>
      </div>

    </div>
  );
};

// Helper to derive tone string for backend compatibility
export const deriveToneString = (tones: string[]): string => {
  return tones.join(", ");
};

// Helper to get primary tone from tones array
export const getPrimaryTone = (tones: string[]): string => {
  return TONE_PRIORITY.find(t => tones.includes(t)) || tones[0] || "casual";
};

// Helper to get meter label
export const getToneMeterLabel = (primaryTone: string): string => {
  return TONE_METER_LABELS[primaryTone] || "Vibe meter";
};
