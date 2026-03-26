import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Brain, ArrowLeft, Pencil, Check, X, Loader2, Building2,
  Users, Target, DollarSign, Swords, Mic2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "@/hooks/use-toast";

// ── Types ─────────────────────────────────────────────────────────────────────

interface BrandMemory {
  company_name: string | null;
  company_description: string | null;
  industry: string | null;
  business_model: string | null;
  usp: string | null;
  target_audience: string | null;
  geographic_markets: string[] | null;
  products_services: string | null;
  marketing_goals: string[] | null;
  biggest_marketing_challenge: string | null;
  current_channels: Record<string, any> | null;
  monthly_marketing_budget_usd: number | null;
  average_order_value_usd: number | null;
  customer_ltv_usd: number | null;
  competitors: string[] | null;
  brand_voice: string | null;
  notes: string | null;
  last_updated_at: string | null;
}

const EMPTY: BrandMemory = {
  company_name: null, company_description: null, industry: null,
  business_model: null, usp: null, target_audience: null,
  geographic_markets: null, products_services: null, marketing_goals: null,
  biggest_marketing_challenge: null, current_channels: null,
  monthly_marketing_budget_usd: null, average_order_value_usd: null,
  customer_ltv_usd: null, competitors: null, brand_voice: null,
  notes: null, last_updated_at: null,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function Empty() {
  return <span className="text-muted-foreground/50 italic text-xs">Not yet known — Amcue will fill this as you chat</span>;
}

function ArrayBadges({ items }: { items: string[] | null }) {
  if (!items?.length) return <Empty />;
  return (
    <div className="flex flex-wrap gap-1.5">
      {items.map((v) => (
        <Badge key={v} variant="secondary" className="text-xs">{v}</Badge>
      ))}
    </div>
  );
}

function USDValue({ value }: { value: number | null }) {
  if (value == null) return <Empty />;
  return <span className="font-medium">${Number(value).toLocaleString()} USD</span>;
}

// ── Inline edit field ─────────────────────────────────────────────────────────

interface EditFieldProps {
  label: string;
  value: string;
  onSave: (val: string) => Promise<void>;
  multiline?: boolean;
  placeholder?: string;
}

function EditField({ label, value, onSave, multiline, placeholder }: EditFieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    await onSave(draft);
    setSaving(false);
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        {multiline ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            rows={3}
            className="text-sm"
            autoFocus
          />
        ) : (
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={placeholder}
            className="text-sm h-8"
            autoFocus
            onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); if (e.key === "Escape") handleCancel(); }}
          />
        )}
        <div className="flex gap-1.5">
          <Button size="sm" className="h-6 text-xs gap-1" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={handleCancel}>
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-2">
      <div className="space-y-0.5 min-w-0">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="text-sm text-foreground">
          {value ? value : <Empty />}
        </div>
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
        onClick={() => { setDraft(value); setEditing(true); }}
      >
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ── Array edit field ──────────────────────────────────────────────────────────

function ArrayEditField({ label, items, onSave }: {
  label: string; items: string[] | null; onSave: (items: string[]) => Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState((items || []).join(", "));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const arr = draft.split(",").map((s) => s.trim()).filter(Boolean);
    await onSave(arr);
    setSaving(false);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Comma separated values…"
          className="text-sm h-8"
          autoFocus
          onKeyDown={(e) => { if (e.key === "Enter") void handleSave(); if (e.key === "Escape") setEditing(false); }}
        />
        <p className="text-[10px] text-muted-foreground">Separate items with commas</p>
        <div className="flex gap-1.5">
          <Button size="sm" className="h-6 text-xs gap-1" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />} Save
          </Button>
          <Button size="sm" variant="ghost" className="h-6 text-xs gap-1" onClick={() => setEditing(false)}>
            <X className="w-3 h-3" /> Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="group flex items-start justify-between gap-2">
      <div className="space-y-1 min-w-0">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <ArrayBadges items={items} />
      </div>
      <Button
        variant="ghost"
        size="icon"
        className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-1"
        onClick={() => { setDraft((items || []).join(", ")); setEditing(true); }}
      >
        <Pencil className="w-3 h-3" />
      </Button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────

const AmcueBrandProfile = () => {
  const navigate = useNavigate();
  const [memory, setMemory] = useState<BrandMemory>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);

    const { data } = await (supabase as any)
      .from("amcue_brand_memory")
      .select("*")
      .eq("user_id", user.id)
      .single();

    setMemory(data || EMPTY);
    setLoading(false);
  }, []);

  useEffect(() => { void load(); }, [load]);

  const saveField = useCallback(async (field: string, value: any) => {
    if (!userId) return;
    const { error } = await (supabase as any)
      .from("amcue_brand_memory")
      .upsert(
        { user_id: userId, [field]: value, last_updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    if (error) {
      toast({ title: "Failed to save", description: error.message, variant: "destructive" });
    } else {
      setMemory((prev) => ({ ...prev, [field]: value, last_updated_at: new Date().toISOString() }));
      toast({ title: "Saved", description: "Brand profile updated." });
    }
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">

      {/* Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/amcue")}>
          <ArrowLeft className="w-4 h-4" />
        </Button>
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
            <Brain className="w-4 h-4 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-base font-bold text-foreground leading-tight">Amcue's Brand Knowledge</h1>
            <p className="text-[10px] text-muted-foreground">
              {memory.last_updated_at
                ? `Last updated ${new Date(memory.last_updated_at).toLocaleDateString()}`
                : "Amcue builds this automatically as you chat — hover any field to edit manually"}
            </p>
          </div>
        </div>
      </div>

      {/* Notice */}
      <div className="bg-primary/5 border border-primary/20 rounded-lg px-4 py-3 text-xs text-muted-foreground">
        Amcue automatically updates this profile as you chat. You can also hover any field and click the pencil icon to edit it directly.
      </div>

      {/* 1. Company */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" /> Company
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <EditField label="Company Name" value={memory.company_name || ""} placeholder="e.g. Acme Ltd"
            onSave={(v) => saveField("company_name", v)} />
          <Separator />
          <EditField label="Description" value={memory.company_description || ""} multiline placeholder="What does the company do?"
            onSave={(v) => saveField("company_description", v)} />
          <Separator />
          <EditField label="Industry" value={memory.industry || ""} placeholder="e.g. DTC Fashion, SaaS, Legal"
            onSave={(v) => saveField("industry", v)} />
          <Separator />
          <EditField label="Business Model" value={memory.business_model || ""} placeholder="e.g. B2C, D2C, B2B SaaS, Marketplace"
            onSave={(v) => saveField("business_model", v)} />
          <Separator />
          <EditField label="Unique Selling Proposition (USP)" value={memory.usp || ""} multiline placeholder="What makes you different?"
            onSave={(v) => saveField("usp", v)} />
        </CardContent>
      </Card>

      {/* 2. Audience & Market */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Users className="w-4 h-4 text-primary" /> Audience & Market
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <EditField label="Target Audience" value={memory.target_audience || ""} multiline
            placeholder="Who is your ideal customer? Age, interests, job title, pain points…"
            onSave={(v) => saveField("target_audience", v)} />
          <Separator />
          <EditField label="Products / Services" value={memory.products_services || ""} multiline
            placeholder="What do you sell?"
            onSave={(v) => saveField("products_services", v)} />
          <Separator />
          <ArrayEditField label="Geographic Markets" items={memory.geographic_markets}
            onSave={(v) => saveField("geographic_markets", v)} />
        </CardContent>
      </Card>

      {/* 3. Marketing */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Target className="w-4 h-4 text-primary" /> Marketing
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <ArrayEditField label="Marketing Goals" items={memory.marketing_goals}
            onSave={(v) => saveField("marketing_goals", v)} />
          <Separator />
          <EditField label="Biggest Marketing Challenge" value={memory.biggest_marketing_challenge || ""} multiline
            placeholder="What's the hardest problem you're trying to solve right now?"
            onSave={(v) => saveField("biggest_marketing_challenge", v)} />
          <Separator />
          <div className="space-y-1">
            <span className="text-xs font-medium text-muted-foreground">Current Channels</span>
            <div className="text-sm text-foreground">
              {memory.current_channels
                ? <pre className="text-xs bg-secondary/50 rounded p-2 overflow-x-auto">{JSON.stringify(memory.current_channels, null, 2)}</pre>
                : <Empty />}
            </div>
            <p className="text-[10px] text-muted-foreground">Amcue updates this automatically when you tell it which channels you use</p>
          </div>
        </CardContent>
      </Card>

      {/* 4. Financials */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-primary" /> Financials
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Monthly Marketing Budget</span>
              <div className="text-sm"><USDValue value={memory.monthly_marketing_budget_usd} /></div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Avg. Order Value</span>
              <div className="text-sm"><USDValue value={memory.average_order_value_usd} /></div>
            </div>
            <div className="space-y-1">
              <span className="text-xs font-medium text-muted-foreground">Customer LTV</span>
              <div className="text-sm"><USDValue value={memory.customer_ltv_usd} /></div>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground">Tell Amcue your budget and it will save these automatically</p>
        </CardContent>
      </Card>

      {/* 5. Competition & Voice */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Swords className="w-4 h-4 text-primary" /> Competition & Brand Voice
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <ArrayEditField label="Competitors" items={memory.competitors}
            onSave={(v) => saveField("competitors", v)} />
          <Separator />
          <EditField label="Brand Voice" value={memory.brand_voice || ""} multiline
            placeholder="e.g. Bold, direct, witty — like a knowledgeable friend, not a corporate brand"
            onSave={(v) => saveField("brand_voice", v)} />
        </CardContent>
      </Card>

      {/* 6. Notes */}
      <Card>
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Mic2 className="w-4 h-4 text-primary" /> Amcue's Notes
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <EditField label="Additional context" value={memory.notes || ""} multiline
            placeholder="Anything else Amcue should know about your brand…"
            onSave={(v) => saveField("notes", v)} />
        </CardContent>
      </Card>

      <div className="pb-6" />
    </div>
  );
};

export default AmcueBrandProfile;
