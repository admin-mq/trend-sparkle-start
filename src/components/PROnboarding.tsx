import { useState, useEffect } from "react";
import {
  Megaphone, Globe, Plus, Trash2, Target, Clock,
  ChevronRight, ChevronLeft, AlertCircle, Loader2, Sparkles,
  BarChart2, Shield, Zap, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";
import { InfoTooltip } from "@/components/InfoTooltip";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Competitor {
  name: string;
  domain: string;
}

interface PrProject {
  id: string;
  brand_name: string;
  domain: string;
  industry: string | null;
  geography: string | null;
  competitors: Competitor[];
}

interface PROnboardingProps {
  onCreated: (project: PrProject) => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeDomain(raw: string): string {
  return raw.trim().replace(/^https?:\/\//i, "").replace(/\/.*$/, "").toLowerCase();
}

function calcNextScanAt(freq: string): string | null {
  const d = new Date();
  if (freq === "daily")        d.setDate(d.getDate() + 1);
  else if (freq === "weekly")  d.setDate(d.getDate() + 7);
  else if (freq === "monthly") d.setDate(d.getDate() + 30);
  else return null;
  return d.toISOString();
}

// ── Step progress dots ────────────────────────────────────────────────────────

function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 mb-8">
      {Array.from({ length: total }).map((_, i) => (
        <div
          key={i}
          className={`rounded-full transition-all duration-300 ${
            i < current
              ? "w-2 h-2 bg-primary"
              : i === current
              ? "w-6 h-2 bg-primary"
              : "w-2 h-2 bg-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

// ── Step 0: Welcome ───────────────────────────────────────────────────────────

function WelcomeStep({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Logo mark */}
      <div className="flex justify-center">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
          <Megaphone className="w-10 h-10 text-primary" />
        </div>
      </div>

      {/* Headline */}
      <div className="space-y-3">
        <h1 className="text-3xl font-bold text-foreground tracking-tight">
          Welcome to Narrative OS
        </h1>
        <p className="text-muted-foreground text-base max-w-sm mx-auto leading-relaxed">
          Understand how the internet and AI tools perceive your brand — then fix it.
        </p>
      </div>

      {/* Value props */}
      <div className="grid grid-cols-1 gap-3 text-left max-w-sm mx-auto">
        {[
          {
            icon: BarChart2,
            color: "text-indigo-400",
            bg: "bg-indigo-500/10",
            title: "Deep brand scan",
            desc: "We crawl your website, press coverage, and reviews to score your narrative.",
          },
          {
            icon: Shield,
            color: "text-emerald-400",
            bg: "bg-emerald-500/10",
            title: "Competitor benchmarking",
            desc: "See which themes your competitors own and where you're losing ground.",
          },
          {
            icon: Zap,
            color: "text-amber-400",
            bg: "bg-amber-500/10",
            title: "Prioritised action plan",
            desc: "Get a ranked list of exactly what to create, fix, or amplify.",
          },
        ].map(({ icon: Icon, color, bg, title, desc }) => (
          <div key={title} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-card">
            <div className={`w-8 h-8 rounded-lg ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
              <Icon className={`w-4 h-4 ${color}`} />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CTA */}
      <div className="space-y-2">
        <Button size="lg" className="w-full max-w-sm gap-2 text-base h-12" onClick={onNext}>
          Get started <ArrowRight className="w-5 h-5" />
        </Button>
        <p className="text-xs text-muted-foreground">Takes about 2 minutes to set up</p>
      </div>
    </div>
  );
}

// ── Step 1: Brand ─────────────────────────────────────────────────────────────

interface BrandStepProps {
  brandName: string; setBrandName: (v: string) => void;
  domain: string; setDomain: (v: string) => void;
  industry: string; setIndustry: (v: string) => void;
  geography: string; setGeography: (v: string) => void;
  audience: string; setAudience: (v: string) => void;
  setBusinessSummary: (v: string) => void;
  setNiche: (v: string) => void;
  error: string | null;
  prefilled?: boolean;
  onNext: () => void;
}

function BrandStep({
  brandName, setBrandName, domain, setDomain,
  industry, setIndustry, geography, setGeography,
  audience, setAudience, setBusinessSummary, setNiche,
  error, prefilled, onNext,
}: BrandStepProps) {
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  async function handleAnalyze() {
    const url = websiteUrl.trim();
    if (!url) return;
    setIsAnalyzing(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('analyze-brand-website', {
        body: { website_url: url }
      });
      if (fnError || !data?.brand_profile) return;
      const p = data.brand_profile;
      if (p.brand_name) setBrandName(p.brand_name);
      if (p.industry)   setIndustry(p.industry);
      if (p.geography)  setGeography(p.geography);
      if (p.target_audience) setAudience(p.target_audience);
      // Capture rich context for downstream steps (find-competitors etc.)
      if (p.business_summary) setBusinessSummary(p.business_summary);
      if (p.niche)            setNiche(p.niche);
      // Extract clean domain from the URL they pasted
      const extracted = url.replace(/^https?:\/\//i, '').replace(/\/.*$/, '').toLowerCase();
      if (extracted && !domain) setDomain(extracted);
    } catch {
      // fail silently — user can fill manually
    } finally {
      setIsAnalyzing(false);
    }
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 1 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">Tell us about your brand</h2>
        <p className="text-sm text-muted-foreground">
          We'll crawl your website and score how you're positioned online.
        </p>
      </div>

      {/* Pre-filled from profile banner */}
      {prefilled && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400 px-1">
          <Sparkles className="w-3 h-3 shrink-0" />
          Pre-filled from your Brand Profile — add your domain to continue.
        </div>
      )}

      {/* Auto-fill from URL */}
      <div className="space-y-2 p-3 rounded-lg border border-primary/20 bg-primary/5">
        <Label className="text-xs font-medium flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          Auto-fill from website
        </Label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              className="pl-8 text-sm h-9"
              placeholder="e.g. dreamhomestore.co.uk"
              value={websiteUrl}
              onChange={(e) => setWebsiteUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAnalyze()}
              disabled={isAnalyzing}
            />
          </div>
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 border-primary/40 text-primary hover:bg-primary/10 whitespace-nowrap"
            onClick={handleAnalyze}
            disabled={isAnalyzing || !websiteUrl.trim()}
          >
            {isAnalyzing
              ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Analysing…</>
              : <><Sparkles className="w-3.5 h-3.5" /> Analyse</>
            }
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">Paste your URL to auto-fill the fields below.</p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label>Brand name <span className="text-destructive">*</span></Label>
          <Input
            placeholder="Acme Inc."
            value={brandName}
            onChange={(e) => setBrandName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && onNext()}
            autoFocus
          />
        </div>

        <div className="space-y-1.5">
          <Label>Website domain <span className="text-destructive">*</span></Label>
          <div className="relative">
            <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="acme.com"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onNext()}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label>Industry</Label>
            <Input
              placeholder="SaaS, Agency, eComm…"
              value={industry}
              onChange={(e) => setIndustry(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Geography</Label>
            <Input
              placeholder="Global, UK, US…"
              value={geography}
              onChange={(e) => setGeography(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>
            Target audience
            <span className="text-muted-foreground font-normal ml-1 text-xs">(optional)</span>
          </Label>
          <Input
            placeholder="e.g. B2B SaaS founders, 50–500 employees"
            value={audience}
            onChange={(e) => setAudience(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <Button className="w-full gap-2 h-11" onClick={onNext}>
        Continue <ChevronRight className="w-4 h-4" />
      </Button>
    </div>
  );
}

// ── Step 2: Competitors ───────────────────────────────────────────────────────

interface CompetitorsStepProps {
  competitors: Competitor[];
  discovering: boolean;
  discoverError: string | null;
  fromProfile?: boolean;
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: "name" | "domain", value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function CompetitorsStep({ competitors, discovering, discoverError, fromProfile, onAdd, onRemove, onUpdate, onNext, onBack }: CompetitorsStepProps) {
  const hasDiscovered = !discovering && !discoverError && competitors.some(c => c.domain);
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 2 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">Who are you up against?</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {discovering
            ? "Searching the web for your top competitors…"
            : "Optional but powerful — we'll run a head-to-head narrative comparison against each one."}
        </p>
      </div>

      {/* Discovery status banner */}
      {discovering && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground px-3 py-2.5 rounded-lg bg-primary/5 border border-primary/20">
          <Loader2 className="w-4 h-4 animate-spin text-primary shrink-0" />
          <span>Finding your top competitors…</span>
        </div>
      )}
      {hasDiscovered && (
        <div className="flex items-center gap-1.5 text-xs text-emerald-400">
          <Sparkles className="w-3 h-3" />
          {fromProfile ? 'Pulled from your Brand Profile — edit or remove as needed' : 'Auto-populated — edit or remove as needed'}
        </div>
      )}
      {!discovering && discoverError && (
        <p className="text-xs text-muted-foreground">{discoverError}</p>
      )}

      {/* Skeleton while discovering */}
      {discovering ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-9 rounded-md bg-muted/50 animate-pulse" />
              <div className="h-9 rounded-md bg-muted/30 animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          {competitors.map((c, i) => (
            <div key={i} className="flex gap-2 items-start">
              <div className="flex-1 space-y-1.5">
                <Input
                  placeholder={`Competitor ${i + 1} name`}
                  value={c.name}
                  onChange={(e) => onUpdate(i, "name", e.target.value)}
                />
                <div className="relative">
                  <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    className="pl-8 text-sm h-9"
                    placeholder="competitor.com"
                    value={c.domain}
                    onChange={(e) => onUpdate(i, "domain", e.target.value)}
                  />
                </div>
              </div>
              {competitors.length > 1 && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-9 w-9 mt-0.5 text-muted-foreground hover:text-destructive"
                  onClick={() => onRemove(i)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              )}
            </div>
          ))}

          {competitors.length < 4 && (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 w-full border-dashed" onClick={onAdd}>
              <Plus className="w-3.5 h-3.5" /> Add competitor
            </Button>
          )}
        </div>
      )}

      <div className="flex gap-3">
        <Button variant="ghost" className="gap-1.5 h-11 w-24 shrink-0" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 gap-2 h-11" disabled={discovering} onClick={onNext}>
          Continue <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      {!discovering && (
        <button
          onClick={onNext}
          className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center -mt-2"
        >
          Skip for now →
        </button>
      )}
    </div>
  );
}

// ── Step 3: Prompts ───────────────────────────────────────────────────────────

interface PromptsStepProps {
  promptText: string; setPromptText: (v: string) => void;
  scanFrequency: "weekly" | "monthly" | "manual";
  setScanFrequency: (v: "weekly" | "monthly" | "manual") => void;
  suggesting: boolean;
  onRegenerate: () => void;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: () => void;
}

function PromptsStep({
  promptText, setPromptText,
  scanFrequency, setScanFrequency,
  suggesting, onRegenerate,
  saving, error, onBack, onCreate,
}: PromptsStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 3 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">What are buyers searching for?</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          {suggesting
            ? "Generating AI search queries for your brand…"
            : "We'll check if your brand appears in AI answers for these queries."}
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label className="flex items-center gap-1.5">
              <Target className="w-4 h-4 text-muted-foreground" /> AI Search Queries
              <InfoTooltip text="Real questions your buyers might type into a live AI search. We run each prompt through Marketers Quest sonar (live web search) and check whether your domain appears in the real citations the engine returns — or your brand name in the answer text." size={12} />
              <span className="text-muted-foreground font-normal text-xs">(one per line)</span>
            </Label>
            {!suggesting && (
              <button
                type="button"
                onClick={onRegenerate}
                className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition-colors"
              >
                <Sparkles className="w-3 h-3" /> Regenerate
              </button>
            )}
          </div>
          {suggesting ? (
            <div className="space-y-2 rounded-md border border-border p-3">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="h-4 rounded bg-muted/50 animate-pulse"
                  style={{ width: `${65 + (i % 3) * 12}%` }}
                />
              ))}
            </div>
          ) : (
            <Textarea
              rows={5}
              className="text-sm resize-none"
              placeholder={
                "best influencer marketing agency UK\ntop carbon accounting software for SMEs\nleading PR tool for startups"
              }
              value={promptText}
              onChange={(e) => setPromptText(e.target.value)}
            />
          )}
          {!suggesting && promptText && (
            <p className="text-xs text-emerald-400 flex items-center gap-1">
              <Sparkles className="w-3 h-3" /> Auto-generated — edit freely or regenerate
            </p>
          )}
        </div>

        <div className="space-y-2 pt-1 border-t border-border">
          <Label className="flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-muted-foreground" /> Rescan frequency
          </Label>
          <div className="grid grid-cols-3 gap-2">
            {(["weekly", "monthly", "manual"] as const).map((freq) => (
              <button
                key={freq}
                type="button"
                onClick={() => setScanFrequency(freq)}
                className={`rounded-lg border px-3 py-2.5 text-xs font-medium transition-colors ${
                  scanFrequency === freq
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/50 hover:text-foreground"
                }`}
              >
                {freq === "weekly" ? "Weekly" : freq === "monthly" ? "Monthly" : "Manual only"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      <div className="space-y-2">
        <div className="flex gap-3">
          <Button variant="ghost" className="gap-1.5 h-12 w-24 shrink-0" onClick={onBack} disabled={saving}>
            <ChevronLeft className="w-4 h-4" /> Back
          </Button>
          <Button className="flex-1 gap-2 h-12 text-base" onClick={onCreate} disabled={saving || suggesting}>
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
            ) : suggesting ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Preparing…</>
            ) : (
              <><CheckCircle2 className="w-4 h-4" /> Start my first analysis</>
            )}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">
          Your first scan takes 1–3 minutes. We'll show results as soon as it's done.
        </p>
      </div>
    </div>
  );
}

// ── Main onboarding component ─────────────────────────────────────────────────

export function PROnboarding({ onCreated }: PROnboardingProps) {
  const [step, setStep] = useState(0); // 0=welcome, 1=brand, 2=competitors, 3=prompts
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [prefilledFromProfile, setPrefilledFromProfile] = useState(false);

  // Brand step state
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("Global");
  const [audience, setAudience] = useState("");
  // Rich context captured from analyze-brand-website / brand profile.
  // Forwarded to find-competitors so it can ground its search in what the
  // brand actually sells (not just its name + industry label).
  const [businessSummary, setBusinessSummary] = useState("");
  const [niche, setNiche] = useState("");

  // Pre-fill from brand profile on mount
  useEffect(() => {
    async function prefill() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await (supabase as any)
        .from('brand_profiles')
        .select('brand_name, industry, geography, business_summary, competitors')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!data) return;
      if (data.brand_name) setBrandName(data.brand_name);
      if (data.industry)   setIndustry(data.industry);
      if (data.geography)  setGeography(data.geography);
      if (data.business_summary) {
        setAudience(data.business_summary);
        setBusinessSummary(data.business_summary);
      }
      const savedCompetitors: { name: string; domain: string }[] = (data.competitors ?? [])
        .filter((c: any) => c.domain)
        .slice(0, 4)
        .map((c: any) => ({ name: c.name || c.domain, domain: c.domain }));
      if (savedCompetitors.length > 0) setCompetitors(savedCompetitors);
      setPrefilledFromProfile(true);
    }
    void prefill();
  }, []);

  // Competitors step state
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", domain: "" }]);
  const [discovering, setDiscovering] = useState(false);
  const [discoverError, setDiscoverError] = useState<string | null>(null);

  // Prompts step state
  const [promptText, setPromptText] = useState("");
  const [scanFrequency, setScanFrequency] = useState<"weekly" | "monthly" | "manual">("weekly");
  const [suggesting, setSuggesting] = useState(false);

  async function suggestPrompts(opts?: { bName?: string; bDomain?: string; bIndustry?: string; bGeo?: string; bAudience?: string; bCompetitors?: Competitor[] }) {
    const bName = opts?.bName ?? brandName;
    const bDomain = opts?.bDomain ?? domain;
    const bIndustry = opts?.bIndustry ?? industry;
    const bGeo = opts?.bGeo ?? geography;
    const bAudience = opts?.bAudience ?? audience;
    const bCompetitors = opts?.bCompetitors ?? competitors;
    if (!bName.trim()) return;
    setSuggesting(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('suggest-pr-prompts', {
        body: { brand_name: bName, domain: bDomain, industry: bIndustry, geography: bGeo, audience: bAudience, competitors: bCompetitors }
      });
      if (fnError) throw new Error(fnError.message);
      const lines: string[] = data?.prompts ?? [];
      if (lines.length > 0) setPromptText(lines.join('\n'));
    } catch {
      // fail silently — user can type prompts manually
    } finally {
      setSuggesting(false);
    }
  }

  function validateBrand(): string | null {
    if (!brandName.trim()) return "Brand name is required";
    if (!domain.trim()) return "Domain is required";
    return null;
  }

  async function discoverCompetitors(bName: string, bDomain: string, bIndustry: string, bGeo: string) {
    setDiscovering(true);
    setDiscoverError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('find-competitors', {
        body: {
          brand_name: bName,
          brand_url: bDomain || '',
          industry: bIndustry || '',
          geography: bGeo || 'Global',
          country: bGeo || 'Global',
          // Rich context — lets the function ground its search in what the
          // brand actually sells, not just the name. If empty, the function
          // will crawl the brand_url itself to derive these.
          business_summary: businessSummary || '',
          niche: niche || '',
        }
      });
      if (fnError) throw new Error(fnError.message);
      const found: Competitor[] = (data?.competitors ?? [])
        .slice(0, 4)
        .map((c: any) => ({ name: c.name, domain: c.domain }));
      if (found.length > 0) {
        setCompetitors(found);
        // If the function derived business_summary/niche server-side, capture
        // them so subsequent re-runs pass the same context.
        if (data?.derived_context?.business_summary && !businessSummary) {
          setBusinessSummary(data.derived_context.business_summary);
        }
        if (data?.derived_context?.niche && !niche) {
          setNiche(data.derived_context.niche);
        }
      } else {
        setDiscoverError('No competitors found — add them manually below.');
      }
    } catch {
      setDiscoverError('Could not auto-find competitors — add them manually below.');
    } finally {
      setDiscovering(false);
    }
  }

  function handleBrandNext() {
    const err = validateBrand();
    if (err) { setError(err); return; }
    setError(null);
    setStep(2);
    // Only auto-discover if no profile competitors were pre-loaded
    const hasProfileCompetitors = competitors.some(c => c.domain.trim());
    if (!hasProfileCompetitors) {
      setCompetitors([{ name: "", domain: "" }]);
      void discoverCompetitors(brandName, domain, industry, geography);
    }
  }

  function addCompetitor() {
    if (competitors.length < 4) setCompetitors([...competitors, { name: "", domain: "" }]);
  }
  function removeCompetitor(i: number) {
    setCompetitors(competitors.filter((_, idx) => idx !== i));
  }
  function updateCompetitor(i: number, field: "name" | "domain", value: string) {
    const updated = [...competitors];
    updated[i] = { ...updated[i], [field]: value };
    setCompetitors(updated);
  }

  async function handleCreate() {
    const err = validateBrand();
    if (err) { setError(err); return; }
    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const validCompetitors = competitors
        .filter((c) => c.domain.trim())
        .map((c) => ({ name: c.name.trim() || c.domain.trim(), domain: normalizeDomain(c.domain) }));

      const trackedPrompts = promptText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean)
        .map((p) => ({ prompt_text: p, geography: geography || "Global" }));

      const { data: project, error: projErr } = await (supabase as any)
        .from("pr_projects")
        .insert({
          user_id: user.id,
          brand_name: brandName.trim(),
          domain: normalizeDomain(domain),
          industry: industry.trim() || null,
          geography: geography.trim() || "Global",
          target_audience: audience.trim() || null,
          competitors: validCompetitors,
          tracked_prompts: trackedPrompts,
          scan_frequency: scanFrequency,
          next_scan_at: calcNextScanAt(scanFrequency),
        })
        .select()
        .single();

      if (projErr || !project) throw new Error(projErr?.message || "Failed to create project");
      onCreated(project);
    } catch (e: any) {
      setError(e?.message || "Something went wrong");
      setSaving(false);
    }
  }

  return (
    <div className="min-h-[75vh] flex items-center justify-center py-12 px-4">
      <div className="w-full max-w-md">
        {/* Step dots (shown on steps 1-3) */}
        {step > 0 && <StepDots current={step - 1} total={3} />}

        {step === 0 && <WelcomeStep onNext={() => setStep(1)} />}

        {step === 1 && (
          <BrandStep
            brandName={brandName} setBrandName={setBrandName}
            domain={domain} setDomain={setDomain}
            industry={industry} setIndustry={setIndustry}
            geography={geography} setGeography={setGeography}
            audience={audience} setAudience={setAudience}
            setBusinessSummary={setBusinessSummary}
            setNiche={setNiche}
            error={error}
            prefilled={prefilledFromProfile}
            onNext={handleBrandNext}
          />
        )}

        {step === 2 && (
          <CompetitorsStep
            competitors={competitors}
            discovering={discovering}
            discoverError={discoverError}
            fromProfile={prefilledFromProfile}
            onAdd={addCompetitor}
            onRemove={removeCompetitor}
            onUpdate={updateCompetitor}
            onNext={() => { setStep(3); void suggestPrompts(); }}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PromptsStep
            promptText={promptText} setPromptText={setPromptText}
            scanFrequency={scanFrequency} setScanFrequency={setScanFrequency}
            suggesting={suggesting}
            onRegenerate={() => void suggestPrompts()}
            saving={saving}
            error={error}
            onBack={() => setStep(2)}
            onCreate={handleCreate}
          />
        )}
      </div>
    </div>
  );
}
