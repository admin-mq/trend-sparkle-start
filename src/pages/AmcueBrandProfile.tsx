import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuthContext } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Pencil, X, Check, Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";

type BrandMemory = {
  id: string;
  user_id: string;
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
  current_channels: Record<string, unknown> | null;
  monthly_marketing_budget_usd: number | null;
  average_order_value_usd: number | null;
  customer_ltv_usd: number | null;
  competitors: string[] | null;
  brand_voice: string | null;
  notes: string | null;
  last_updated_at: string | null;
  created_at: string | null;
};

type SectionKey = "company" | "audience" | "marketing" | "financials" | "competition" | "notes";

const SECTION_FIELDS: Record<SectionKey, { key: keyof BrandMemory; label: string; type: "text" | "textarea" | "array" | "json" | "number" }[]> = {
  company: [
    { key: "company_name", label: "Company Name", type: "text" },
    { key: "company_description", label: "Description", type: "textarea" },
    { key: "industry", label: "Industry", type: "text" },
    { key: "business_model", label: "Business Model", type: "text" },
    { key: "usp", label: "Unique Selling Proposition", type: "textarea" },
  ],
  audience: [
    { key: "target_audience", label: "Target Audience", type: "textarea" },
    { key: "geographic_markets", label: "Geographic Markets", type: "array" },
    { key: "products_services", label: "Products / Services", type: "textarea" },
  ],
  marketing: [
    { key: "marketing_goals", label: "Marketing Goals", type: "array" },
    { key: "biggest_marketing_challenge", label: "Biggest Challenge", type: "textarea" },
    { key: "current_channels", label: "Current Channels", type: "json" },
  ],
  financials: [
    { key: "monthly_marketing_budget_usd", label: "Monthly Marketing Budget (USD)", type: "number" },
    { key: "average_order_value_usd", label: "Average Order Value (USD)", type: "number" },
    { key: "customer_ltv_usd", label: "Customer LTV (USD)", type: "number" },
  ],
  competition: [
    { key: "competitors", label: "Competitors", type: "array" },
    { key: "brand_voice", label: "Brand Voice", type: "textarea" },
  ],
  notes: [
    { key: "notes", label: "Notes", type: "textarea" },
  ],
};

const SECTION_TITLES: Record<SectionKey, string> = {
  company: "Company",
  audience: "Audience & Market",
  marketing: "Marketing",
  financials: "Financials",
  competition: "Competition",
  notes: "Notes",
};

function displayValue(val: unknown, type: string): string {
  if (val === null || val === undefined || val === "") return "";
  if (type === "array" && Array.isArray(val)) return val.filter(Boolean).join(", ");
  if (type === "json" && typeof val === "object") {
    const obj = val as Record<string, unknown>;
    const entries = Object.entries(obj).filter(([, v]) => v);
    if (entries.length === 0) return "";
    return entries.map(([k, v]) => `${k}: ${v}`).join(", ");
  }
  if (type === "number") return `$${Number(val).toLocaleString()}`;
  return String(val);
}

export default function AmcueBrandProfile() {
  const { user } = useAuthContext();
  const [data, setData] = useState<BrandMemory | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSection, setEditingSection] = useState<SectionKey | null>(null);
  const [editValues, setEditValues] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!user) return;
    setLoading(true);
    const { data: rows, error } = await supabase
      .from("amcue_brand_memory")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Error fetching brand memory:", error);
    }
    setData(rows as BrandMemory | null);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [user]);

  const startEditing = (section: SectionKey) => {
    const fields = SECTION_FIELDS[section];
    const vals: Record<string, unknown> = {};
    fields.forEach((f) => {
      const raw = data?.[f.key];
      if (f.type === "array") {
        vals[f.key] = Array.isArray(raw) ? (raw as string[]).join(", ") : "";
      } else if (f.type === "json") {
        vals[f.key] = raw ? JSON.stringify(raw, null, 2) : "{}";
      } else {
        vals[f.key] = raw ?? "";
      }
    });
    setEditValues(vals);
    setEditingSection(section);
  };

  const cancelEditing = () => {
    setEditingSection(null);
    setEditValues({});
  };

  const saveSection = async () => {
    if (!user || !editingSection) return;
    setSaving(true);

    const fields = SECTION_FIELDS[editingSection];
    const updates: Record<string, unknown> = { user_id: user.id };

    fields.forEach((f) => {
      const raw = editValues[f.key];
      if (f.type === "array") {
        updates[f.key] = String(raw || "").split(",").map((s) => s.trim()).filter(Boolean);
      } else if (f.type === "json") {
        try {
          updates[f.key] = JSON.parse(String(raw || "{}"));
        } catch {
          updates[f.key] = {};
        }
      } else if (f.type === "number") {
        const n = parseFloat(String(raw || "0"));
        updates[f.key] = isNaN(n) ? null : n;
      } else {
        updates[f.key] = raw || null;
      }
    });

    const { error } = await supabase
      .from("amcue_brand_memory")
      .upsert(updates as any, { onConflict: "user_id" });

    if (error) {
      toast.error("Failed to save: " + error.message);
    } else {
      toast.success("Saved!");
      await fetchData();
      setEditingSection(null);
      setEditValues({});
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(var(--accent))] flex items-center justify-center">
          <Brain className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">What Amcue knows about your brand</h1>
          <p className="text-sm text-muted-foreground">
            Amcue builds this profile automatically as you chat. You can also edit any field directly.
          </p>
        </div>
      </div>

      {/* Sections */}
      {(Object.keys(SECTION_FIELDS) as SectionKey[]).map((sectionKey) => {
        const fields = SECTION_FIELDS[sectionKey];
        const isEditing = editingSection === sectionKey;

        return (
          <Card key={sectionKey}>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg">{SECTION_TITLES[sectionKey]}</CardTitle>
              {isEditing ? (
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onClick={cancelEditing} disabled={saving}>
                    <X className="w-4 h-4 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={saveSection} disabled={saving}>
                    {saving ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Check className="w-4 h-4 mr-1" />}
                    Save
                  </Button>
                </div>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => startEditing(sectionKey)}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {fields.map((field) => {
                const val = data?.[field.key];
                const display = displayValue(val, field.type);

                if (isEditing) {
                  const editVal = editValues[field.key] ?? "";
                  return (
                    <div key={field.key} className="space-y-1">
                      <label className="text-sm font-medium text-foreground">{field.label}</label>
                      {field.type === "textarea" || field.type === "json" ? (
                        <Textarea
                          value={String(editVal)}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          rows={field.type === "json" ? 4 : 3}
                          placeholder={field.type === "array" ? "Comma-separated values" : ""}
                        />
                      ) : (
                        <Input
                          type={field.type === "number" ? "number" : "text"}
                          value={String(editVal)}
                          onChange={(e) => setEditValues((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.type === "array" ? "Comma-separated values" : ""}
                        />
                      )}
                      {field.type === "array" && (
Now let me add the route. First let me fix the TS error.
                      )}
                    </div>
                  );
                }

                return (
                  <div key={field.key} className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{field.label}</span>
                    {display ? (
                      field.type === "array" && Array.isArray(val) && (val as string[]).length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {(val as string[]).filter(Boolean).map((item, i) => (
                            <Badge key={i} variant="secondary" className="text-xs">{item}</Badge>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-foreground">{display}</p>
                      )
                    ) : (
                      <p className="text-sm text-muted-foreground italic">Not yet known</p>
                    )}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        );
      })}

      {/* Last updated */}
      <Separator />
      <p className="text-xs text-muted-foreground text-center">
        {data?.last_updated_at
          ? `Last updated: ${new Date(data.last_updated_at).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })}`
          : "No data yet — start chatting with Amcue to build your brand profile."}
      </p>
    </div>
  );
}
