import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { X, Users, Megaphone, Target, Palette } from "lucide-react";

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

  return (
    <div className="space-y-4 pt-4 border-t">
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

      {/* Content Format */}
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
