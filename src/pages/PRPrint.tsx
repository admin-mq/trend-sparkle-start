import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Printer, ArrowLeft, ExternalLink } from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface Project {
  brand_name: string;
  domain: string;
  industry: string | null;
  geography: string | null;
  target_audience: string | null;
  competitors: { name: string; domain: string }[];
  tracked_prompts: { prompt_text: string }[];
}

interface NarrativeResult {
  narrative_score: number | null;
  authority_score: number | null;
  proof_density_score: number | null;
  risk_score: number | null;
  opportunity_score: number | null;
  brand_narratives: { theme: string; strength: number; description: string; status: string }[];
  competitor_narratives: Record<string, { theme: string; strength: number; description: string }[]>;
  proof_gaps: { gap_type: string; description: string; severity: string; narrative_affected: string }[];
  recommended_actions: {
    title: string;
    action_type: string;
    priority: number;
    effort: string;
    expected_impact: string;
    why_it_matters: string;
    what_to_do: string;
  }[];
  executive_summary: string | null;
  pages_analyzed: number;
  created_at: string;
}

interface VisibilityResult {
  prompt_text: string;
  brand_present: boolean;
  brand_position: number | null;
  brand_context: string | null;
  why_absent: string | null;
  analysis_summary: string | null;
  visibility_score: number;
  competitor_presence: Record<string, boolean>;
}

interface ExternalMention {
  url: string;
  title: string | null;
  summary: string | null;
  sentiment: string | null;
  proof_signals: string[];
  brand_mentions: { brand: string; framing: string }[];
  status: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function scoreLabel(score: number | null, invert = false) {
  if (score == null) return { label: "N/A", color: "#6b7280" };
  const s = invert ? 100 - score : score;
  if (s >= 70) return { label: String(score), color: "#059669" };
  if (s >= 40) return { label: String(score), color: "#d97706" };
  return { label: String(score), color: "#dc2626" };
}

function severityColor(severity: string) {
  const map: Record<string, string> = {
    critical: "#dc2626", high: "#ea580c", medium: "#d97706", low: "#6b7280",
  };
  return map[severity] || "#6b7280";
}

function effortColor(effort: string) {
  const map: Record<string, string> = { low: "#059669", medium: "#d97706", high: "#ea580c" };
  return map[effort] || "#6b7280";
}

function impactColor(impact: string) {
  const map: Record<string, string> = { high: "#7c3aed", medium: "#2563eb", low: "#6b7280" };
  return map[impact] || "#6b7280";
}

function sentimentColor(sentiment: string | null) {
  if (!sentiment) return "#6b7280";
  const s = sentiment.toLowerCase();
  if (s === "positive") return "#059669";
  if (s === "negative") return "#dc2626";
  return "#d97706";
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, letterSpacing: "0.12em",
      textTransform: "uppercase", color: "#9ca3af",
      borderBottom: "1px solid #f3f4f6", paddingBottom: 6, marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: "1px 7px", borderRadius: 4,
      background: `${color}18`, color, textTransform: "capitalize",
    }}>{label}</span>
  );
}

// ── PRPrint Page ──────────────────────────────────────────────────────────────

const PRPrint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("project");
  const autoprint = searchParams.get("autoprint") === "1";

  const [project, setProject]           = useState<Project | null>(null);
  const [result, setResult]             = useState<NarrativeResult | null>(null);
  const [visibility, setVisibility]     = useState<VisibilityResult[]>([]);
  const [mentions, setMentions]         = useState<ExternalMention[]>([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState<string | null>(null);
  const didAutoprint                    = useRef(false);

  useEffect(() => {
    if (!projectId) { setError("No project specified"); setLoading(false); return; }

    (async () => {
      // Project
      const { data: proj } = await (supabase as any)
        .from("pr_projects").select("*").eq("id", projectId).single();
      if (!proj) { setError("Project not found"); setLoading(false); return; }
      setProject(proj);

      // Latest completed scan job
      const { data: job } = await (supabase as any)
        .from("pr_scan_jobs")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (job) {
        // Narrative results
        const { data: res } = await (supabase as any)
          .from("pr_narrative_results")
          .select("*")
          .eq("scan_job_id", job.id)
          .single();
        setResult(res || null);
      }

      // Latest visibility run + results
      const { data: visRun } = await (supabase as any)
        .from("pr_visibility_runs")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (visRun) {
        const { data: visRows } = await (supabase as any)
          .from("pr_visibility_results")
          .select("prompt_text, brand_present, brand_position, brand_context, why_absent, analysis_summary, visibility_score, competitor_presence")
          .eq("run_id", visRun.id)
          .order("visibility_score", { ascending: false });
        setVisibility(visRows || []);
      }

      // External mentions (completed only)
      const { data: mentionRows } = await (supabase as any)
        .from("pr_external_mentions")
        .select("url, title, summary, sentiment, proof_signals, brand_mentions, status")
        .eq("project_id", projectId)
        .eq("status", "done")
        .order("created_at", { ascending: false });
      setMentions(mentionRows || []);

      setLoading(false);
    })();
  }, [projectId]);

  // Auto-trigger print once all data is loaded
  useEffect(() => {
    if (!loading && result && autoprint && !didAutoprint.current) {
      didAutoprint.current = true;
      setTimeout(() => window.print(), 800);
    }
  }, [loading, result, autoprint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-gray-500">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-sm">Loading full report…</span>
        </div>
      </div>
    );
  }

  if (error || !project || !result) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center flex-col gap-3">
        <p className="text-red-600 text-sm">{error || "No report data found. Run an analysis first."}</p>
        <button onClick={() => navigate("/pr")} className="text-sm text-blue-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to PR
        </button>
      </div>
    );
  }

  const generatedDate = result.created_at
    ? new Date(result.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })
    : new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

  const scores = [
    { label: "Narrative",     value: result.narrative_score,      invert: false },
    { label: "Authority",     value: result.authority_score,      invert: false },
    { label: "Proof Density", value: result.proof_density_score,  invert: false },
    { label: "Risk",          value: result.risk_score,           invert: true  },
    { label: "Opportunity",   value: result.opportunity_score,    invert: false },
  ];

  const allActions = [...result.recommended_actions].sort((a, b) => b.priority - a.priority);
  const competitors = project.competitors || [];

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @page { size: A4; margin: 14mm 14mm 14mm 14mm; }
        @media print {
          .no-print { display: none !important; }
          .page-break-before { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* ── Action bar (screen only) ── */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(`/pr/results?project=${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to results
        </button>
        <div className="flex items-center gap-3">
          <a href={`https://${project.domain}`} target="_blank" rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
            {project.domain} <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4" /> Print / Save as PDF
          </button>
        </div>
      </div>

      {/* ── Report body ── */}
      <div className="bg-white min-h-screen"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#111827" }}>
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 60px" }}>

          {/* ── 1. Cover header ───────────────────────────────────────────── */}
          <div style={{ borderBottom: "2px solid #111827", paddingBottom: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>
                  Narrative Intelligence Report
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#111827" }}>
                  {project.brand_name}
                </h1>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
                  <span>{project.domain}</span>
                  {project.industry && <span>· {project.industry}</span>}
                  {project.geography && <span>· {project.geography}</span>}
                  {project.target_audience && <span>· {project.target_audience}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>NarrativeOS</div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{generatedDate}</div>
                <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 2 }}>{result.pages_analyzed} pages analysed</div>
              </div>
            </div>
          </div>

          {/* ── 2. Table of contents ──────────────────────────────────────── */}
          <div className="avoid-break" style={{ marginBottom: 36 }}>
            <SectionLabel>Contents</SectionLabel>
            {[
              "Executive Summary",
              "Score Overview",
              "Brand Narrative Themes",
              result.proof_gaps.length > 0 && "Proof Gaps",
              allActions.length > 0 && "Recommended Actions",
              competitors.length > 0 && "Competitor Analysis",
              visibility.length > 0 && "AI Search Visibility",
              mentions.length > 0 && "External Mentions",
            ].filter(Boolean).map((title, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0", borderBottom: "1px dotted #f3f4f6" }}>
                <span style={{ fontSize: 11, color: "#9ca3af", minWidth: 20 }}>{i + 1}</span>
                <span style={{ fontSize: 12, color: "#374151" }}>{title as string}</span>
              </div>
            ))}
          </div>

          {/* ── 3. Executive summary ──────────────────────────────────────── */}
          {result.executive_summary && (
            <div className="avoid-break" style={{ marginBottom: 36 }}>
              <SectionLabel>Executive Summary</SectionLabel>
              <div style={{
                background: "#f9fafb", borderLeft: "4px solid #4f46e5",
                borderRadius: "0 8px 8px 0", padding: "16px 20px",
                fontSize: 13.5, lineHeight: 1.75, color: "#374151",
              }}>
                {result.executive_summary}
              </div>
            </div>
          )}

          {/* ── 4. Scores ─────────────────────────────────────────────────── */}
          <div className="avoid-break" style={{ marginBottom: 36 }}>
            <SectionLabel>Score Overview</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {scores.map(({ label, value, invert }) => {
                const { label: valLabel, color } = scoreLabel(value, invert);
                const barWidth = value == null ? 0 : invert ? 100 - value : value;
                return (
                  <div key={label} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "16px 12px", textAlign: "center", background: "#fff" }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{valLabel}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 6, marginBottom: 8 }}>{label}</div>
                    <div style={{ background: "#f3f4f6", borderRadius: 4, height: 4 }}>
                      <div style={{ background: color, borderRadius: 4, height: 4, width: `${barWidth}%` }} />
                    </div>
                    {invert && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Lower is better</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── 5. Brand narrative themes ─────────────────────────────────── */}
          {result.brand_narratives.length > 0 && (
            <div className="avoid-break" style={{ marginBottom: 36 }}>
              <SectionLabel>Brand Narrative Themes</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.brand_narratives.map((n, i) => {
                  const statusColors: Record<string, string> = {
                    strong: "#059669", emerging: "#2563eb", weak: "#d97706", missing: "#dc2626",
                  };
                  const barColor = statusColors[n.status] || "#6b7280";
                  return (
                    <div key={i} className="avoid-break" style={{ display: "flex", alignItems: "flex-start", gap: 16, padding: "10px 12px", background: "#f9fafb", borderRadius: 8 }}>
                      <div style={{ minWidth: 200, maxWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{n.theme}</span>
                          <Chip label={n.status} color={barColor} />
                        </div>
                        <div style={{ background: "#e5e7eb", borderRadius: 4, height: 5 }}>
                          <div style={{ background: barColor, borderRadius: 4, height: 5, width: `${n.strength}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 3 }}>Strength: {n.strength}/100</div>
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "#6b7280", lineHeight: 1.65, paddingTop: 2 }}>{n.description}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 6. Proof gaps ─────────────────────────────────────────────── */}
          {result.proof_gaps.length > 0 && (
            <div className="page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>Proof Gaps ({result.proof_gaps.length})</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.proof_gaps.map((gap, i) => {
                  const color = severityColor(gap.severity);
                  return (
                    <div key={i} className="avoid-break" style={{
                      borderLeft: `4px solid ${color}`, background: `${color}08`,
                      borderRadius: "0 8px 8px 0", padding: "12px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{gap.gap_type}</span>
                        <Chip label={gap.severity} color={color} />
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{gap.description}</p>
                      {gap.narrative_affected && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
                          Affects narrative: <em>{gap.narrative_affected}</em>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 7. Recommended actions (ALL) ──────────────────────────────── */}
          {allActions.length > 0 && (
            <div className="page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>Recommended Actions ({allActions.length})</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {allActions.map((action, i) => (
                  <div key={i} className="avoid-break" style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px", background: "#fff" }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#eef2ff", color: "#4f46e5",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
                      }}>{i + 1}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{action.title}</span>
                          <Chip label={`${action.effort} effort`} color={effortColor(action.effort)} />
                          <Chip label={`${action.expected_impact} impact`} color={impactColor(action.expected_impact)} />
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{action.why_it_matters}</p>
                        {action.what_to_do && (
                          <div style={{ background: "#f9fafb", borderRadius: 6, padding: "8px 10px" }}>
                            <span style={{ fontSize: 11, fontWeight: 600, color: "#374151" }}>What to do: </span>
                            <span style={{ fontSize: 11, color: "#6b7280" }}>{action.what_to_do}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 8. Competitor narratives ──────────────────────────────────── */}
          {competitors.length > 0 && Object.keys(result.competitor_narratives).length > 0 && (
            <div className="page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>Competitor Analysis</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: competitors.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
                {competitors.map((comp) => {
                  const themes = result.competitor_narratives[comp.domain] || [];
                  if (themes.length === 0) return null;
                  const sorted = [...themes].sort((a, b) => b.strength - a.strength);
                  return (
                    <div key={comp.domain} className="avoid-break" style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 12 }}>
                        {comp.name || comp.domain}
                        <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6, fontSize: 11 }}>{comp.domain}</span>
                      </div>
                      {sorted.map((n, i) => (
                        <div key={i} style={{ marginBottom: 8 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 3 }}>
                            <span style={{ fontSize: 11, color: "#374151" }}>{n.theme}</span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b7280" }}>{n.strength}</span>
                          </div>
                          <div style={{ background: "#f3f4f6", borderRadius: 3, height: 4 }}>
                            <div style={{
                              background: n.strength >= 70 ? "#ea580c" : n.strength >= 40 ? "#d97706" : "#d1d5db",
                              borderRadius: 3, height: 4, width: `${n.strength}%`,
                            }} />
                          </div>
                          {n.description && (
                            <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2, lineHeight: 1.4 }}>{n.description}</div>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 9. AI Search Visibility ───────────────────────────────────── */}
          {visibility.length > 0 && (
            <div className="page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>AI Search Visibility</SectionLabel>
              <p style={{ fontSize: 12, color: "#6b7280", marginBottom: 14, lineHeight: 1.6 }}>
                Whether <strong>{project.brand_name}</strong> appears when buyers ask AI tools (ChatGPT, Perplexity, Google AI) the queries below.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {visibility.map((v, i) => {
                  const presentColor = v.brand_present ? "#059669" : "#dc2626";
                  return (
                    <div key={i} className="avoid-break" style={{
                      border: `1px solid ${v.brand_present ? "#d1fae5" : "#fee2e2"}`,
                      borderRadius: 8, padding: "12px 14px",
                      background: v.brand_present ? "#f0fdf4" : "#fff5f5",
                    }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 600, color: "#111827", marginBottom: 4 }}>
                            "{v.prompt_text}"
                          </div>
                          {v.brand_present ? (
                            <div style={{ fontSize: 11, color: "#059669" }}>
                              ✓ Brand mentioned{v.brand_position ? ` · Position #${v.brand_position}` : ""}
                              {v.brand_context && (
                                <span style={{ color: "#6b7280", fontStyle: "italic" }}> — "{v.brand_context}"</span>
                              )}
                            </div>
                          ) : (
                            <div style={{ fontSize: 11, color: "#dc2626" }}>
                              ✗ Brand not found
                              {v.why_absent && <span style={{ color: "#6b7280" }}> — {v.why_absent}</span>}
                            </div>
                          )}
                          {v.analysis_summary && (
                            <div style={{ fontSize: 11, color: "#6b7280", marginTop: 4, lineHeight: 1.5 }}>{v.analysis_summary}</div>
                          )}
                        </div>
                        <div style={{ textAlign: "right", flexShrink: 0 }}>
                          <div style={{ fontSize: 18, fontWeight: 800, color: presentColor }}>{v.visibility_score}</div>
                          <div style={{ fontSize: 9, color: "#9ca3af" }}>score</div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 10. External mentions ─────────────────────────────────────── */}
          {mentions.length > 0 && (
            <div className="page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>External Mentions ({mentions.length})</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {mentions.map((m, i) => {
                  const sColor = sentimentColor(m.sentiment);
                  return (
                    <div key={i} className="avoid-break" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "12px 14px", background: "#fff" }}>
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12.5, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                            {m.title || m.url}
                          </div>
                          <div style={{ fontSize: 10, color: "#9ca3af", wordBreak: "break-all" }}>{m.url}</div>
                        </div>
                        {m.sentiment && <Chip label={m.sentiment} color={sColor} />}
                      </div>
                      {m.summary && (
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{m.summary}</p>
                      )}
                      {m.proof_signals?.length > 0 && (
                        <div style={{ marginBottom: 6 }}>
                          <span style={{ fontSize: 10, fontWeight: 600, color: "#374151" }}>Proof signals: </span>
                          <span style={{ fontSize: 11, color: "#6b7280" }}>{m.proof_signals.join(" · ")}</span>
                        </div>
                      )}
                      {m.brand_mentions?.length > 0 && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {m.brand_mentions.map((bm, j) => (
                            <div key={j} style={{ fontSize: 10, background: "#f3f4f6", borderRadius: 4, padding: "2px 7px", color: "#374151" }}>
                              <strong>{bm.brand}</strong>: {bm.framing}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, color: "#9ca3af" }}>
              Generated by <strong style={{ color: "#6b7280" }}>NarrativeOS</strong> · {generatedDate}
            </span>
            <span style={{ fontSize: 11, color: "#d1d5db" }}>
              {project.brand_name} · {project.domain}
            </span>
          </div>

        </div>
      </div>
    </>
  );
};

export default PRPrint;
