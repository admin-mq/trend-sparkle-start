import { useState } from "react";
import {
  Megaphone, Globe, Plus, Trash2, Target, Clock,
  ChevronRight, ChevronLeft, AlertCircle, Loader2,
  BarChart2, Shield, Zap, ArrowRight, CheckCircle2,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabaseClient";

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
  error: string | null;
  onNext: () => void;
}

function BrandStep({
  brandName, setBrandName, domain, setDomain,
  industry, setIndustry, geography, setGeography,
  audience, setAudience, error, onNext,
}: BrandStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 1 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">Tell us about your brand</h2>
        <p className="text-sm text-muted-foreground">
          We'll crawl your website and score how you're positioned online.
        </p>
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
  onAdd: () => void;
  onRemove: (i: number) => void;
  onUpdate: (i: number, field: "name" | "domain", value: string) => void;
  onNext: () => void;
  onBack: () => void;
}

function CompetitorsStep({ competitors, onAdd, onRemove, onUpdate, onNext, onBack }: CompetitorsStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 2 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">Who are you up against?</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          Optional but powerful — we'll run a head-to-head narrative comparison against each one.
        </p>
      </div>

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

      <div className="flex gap-3">
        <Button variant="ghost" className="gap-1.5 h-11 w-24 shrink-0" onClick={onBack}>
          <ChevronLeft className="w-4 h-4" /> Back
        </Button>
        <Button className="flex-1 gap-2 h-11" onClick={onNext}>
          Continue <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
      <button
        onClick={onNext}
        className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors text-center -mt-2"
      >
        Skip for now →
      </button>
    </div>
  );
}

// ── Step 3: Prompts ───────────────────────────────────────────────────────────

interface PromptsStepProps {
  promptText: string; setPromptText: (v: string) => void;
  scanFrequency: "weekly" | "monthly" | "manual";
  setScanFrequency: (v: "weekly" | "monthly" | "manual") => void;
  saving: boolean;
  error: string | null;
  onBack: () => void;
  onCreate: () => void;
}

function PromptsStep({
  promptText, setPromptText,
  scanFrequency, setScanFrequency,
  saving, error, onBack, onCreate,
}: PromptsStepProps) {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-right-4 duration-300">
      <div className="text-center space-y-1">
        <p className="text-xs font-semibold text-primary uppercase tracking-widest">Step 3 of 3</p>
        <h2 className="text-2xl font-bold text-foreground">What are buyers searching for?</h2>
        <p className="text-sm text-muted-foreground max-w-xs mx-auto">
          We'll check if your brand appears in AI answers for these prompts. Optional — you can add them later.
        </p>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1.5">
            <Target className="w-4 h-4 text-muted-foreground" /> AI prompts to track
            <span className="text-muted-foreground font-normal text-xs">(one per line)</span>
          </Label>
          <Textarea
            rows={5}
            className="text-sm resize-none"
            placeholder={
              "best influencer marketing agency UK\ntop carbon accounting software for SMEs\nleading PR tool for startups"
            }
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
          />
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
          <Button className="flex-1 gap-2 h-12 text-base" onClick={onCreate} disabled={saving}>
            {saving ? (
              <><Loader2 className="w-4 h-4 animate-spin" /> Setting up…</>
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

  // Brand step state
  const [brandName, setBrandName] = useState("");
  const [domain, setDomain] = useState("");
  const [industry, setIndustry] = useState("");
  const [geography, setGeography] = useState("Global");
  const [audience, setAudience] = useState("");

  // Competitors step state
  const [competitors, setCompetitors] = useState<Competitor[]>([{ name: "", domain: "" }]);

  // Prompts step state
  const [promptText, setPromptText] = useState("");
  const [scanFrequency, setScanFrequency] = useState<"weekly" | "monthly" | "manual">("weekly");

  function validateBrand(): string | null {
    if (!brandName.trim()) return "Brand name is required";
    if (!domain.trim()) return "Domain is required";
    return null;
  }

  function handleBrandNext() {
    const err = validateBrand();
    if (err) { setError(err); return; }
    setError(null);
    setStep(2);
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
            error={error}
            onNext={handleBrandNext}
          />
        )}

        {step === 2 && (
          <CompetitorsStep
            competitors={competitors}
            onAdd={addCompetitor}
            onRemove={removeCompetitor}
            onUpdate={updateCompetitor}
            onNext={() => setStep(3)}
            onBack={() => setStep(1)}
          />
        )}

        {step === 3 && (
          <PromptsStep
            promptText={promptText} setPromptText={setPromptText}
            scanFrequency={scanFrequency} setScanFrequency={setScanFrequency}
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
