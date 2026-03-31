import { useState, useEffect, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { Loader2, Printer, ArrowLeft, ExternalLink } from "lucide-react";

// ── Types (minimal subset needed for the report) ──────────────────────────────

interface Project {
  brand_name: string;
  domain: string;
  industry: string | null;
  geography: string | null;
  target_audience: string | null;
  competitors: { name: string; domain: string }[];
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
    critical: "#dc2626",
    high: "#ea580c",
    medium: "#d97706",
    low: "#6b7280",
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

// ── PRPrint Page ──────────────────────────────────────────────────────────────

const PRPrint = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const projectId = searchParams.get("project");
  const autoprint = searchParams.get("autoprint") === "1";

  const [project, setProject] = useState<Project | null>(null);
  const [result, setResult] = useState<NarrativeResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const didAutoprint = useRef(false);

  useEffect(() => {
    if (!projectId) { setError("No project specified"); setLoading(false); return; }

    (async () => {
      const { data: proj } = await (supabase as any)
        .from("pr_projects").select("*").eq("id", projectId).single();
      if (!proj) { setError("Project not found"); setLoading(false); return; }
      setProject(proj);

      const { data: job } = await (supabase as any)
        .from("pr_scan_jobs")
        .select("id")
        .eq("project_id", projectId)
        .eq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(1)
        .single();

      if (job) {
        const { data: res } = await (supabase as any)
          .from("pr_narrative_results")
          .select("*")
          .eq("scan_job_id", job.id)
          .single();
        setResult(res || null);
      }

      setLoading(false);
    })();
  }, [projectId]);

  // Auto-trigger print once data is loaded
  useEffect(() => {
    if (!loading && result && autoprint && !didAutoprint.current) {
      didAutoprint.current = true;
      setTimeout(() => window.print(), 600);
    }
  }, [loading, result, autoprint]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="flex items-center gap-2 text-gray-500">
          <Loader2 className="w-5 h-5 animate-spin" />
          <span className="text-sm">Loading report…</span>
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

  const topActions = [...result.recommended_actions]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  const competitors = project.competitors || [];

  return (
    <>
      {/* ── Print CSS ── */}
      <style>{`
        @page {
          size: A4;
          margin: 15mm 15mm 15mm 15mm;
        }
        @media print {
          .no-print { display: none !important; }
          .page-break-before { page-break-before: always; }
          .avoid-break { page-break-inside: avoid; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
        * { -webkit-font-smoothing: antialiased; }
      `}</style>

      {/* ── Action bar (hidden on print) ── */}
      <div className="no-print bg-gray-50 border-b border-gray-200 px-6 py-3 flex items-center justify-between gap-4 sticky top-0 z-10">
        <button
          onClick={() => navigate(`/pr/results?project=${projectId}`)}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" /> Back to results
        </button>
        <div className="flex items-center gap-3">
          <a
            href={`https://${project.domain}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            {project.domain} <ExternalLink className="w-3 h-3" />
          </a>
          <button
            onClick={() => window.print()}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Printer className="w-4 h-4" />
            Print / Save as PDF
          </button>
        </div>
      </div>

      {/* ── Report body ── */}
      <div
        className="bg-white min-h-screen"
        style={{ fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#111827" }}
      >
        <div style={{ maxWidth: 860, margin: "0 auto", padding: "40px 32px 60px" }}>

          {/* ── Cover header ─────────────────────────────────────────────── */}
          <div style={{ borderBottom: "2px solid #111827", paddingBottom: 24, marginBottom: 32 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "#6b7280", marginBottom: 8 }}>
                  Narrative Intelligence Report
                </div>
                <h1 style={{ fontSize: 28, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "#111827" }}>
                  {project.brand_name}
                </h1>
                <div style={{ fontSize: 13, color: "#6b7280", marginTop: 6, display: "flex", alignItems: "center", gap: 16 }}>
                  <span>{project.domain}</span>
                  {project.industry && <span>· {project.industry}</span>}
                  {project.geography && <span>· {project.geography}</span>}
                </div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#6b7280" }}>
                  NarrativeOS
                </div>
                <div style={{ fontSize: 12, color: "#9ca3af", marginTop: 4 }}>{generatedDate}</div>
                <div style={{ fontSize: 11, color: "#d1d5db", marginTop: 2 }}>
                  {result.pages_analyzed} pages analysed
                </div>
              </div>
            </div>
          </div>

          {/* ── Executive summary ─────────────────────────────────────────── */}
          {result.executive_summary && (
            <div className="avoid-break" style={{ marginBottom: 36 }}>
              <SectionLabel>Executive Summary</SectionLabel>
              <div style={{
                background: "#f9fafb",
                borderLeft: "4px solid #4f46e5",
                borderRadius: "0 8px 8px 0",
                padding: "16px 20px",
                fontSize: 13.5,
                lineHeight: 1.75,
                color: "#374151",
              }}>
                {result.executive_summary}
              </div>
            </div>
          )}

          {/* ── Scores ────────────────────────────────────────────────────── */}
          <div className="avoid-break" style={{ marginBottom: 36 }}>
            <SectionLabel>Score Overview</SectionLabel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 12 }}>
              {scores.map(({ label, value, invert }) => {
                const { label: valLabel, color } = scoreLabel(value, invert);
                const barWidth = value == null ? 0 : invert ? 100 - value : value;
                return (
                  <div key={label} style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "16px 12px",
                    textAlign: "center",
                    background: "#fff",
                  }}>
                    <div style={{ fontSize: 30, fontWeight: 800, color, lineHeight: 1 }}>{valLabel}</div>
                    <div style={{ fontSize: 11, fontWeight: 600, color: "#374151", marginTop: 6, marginBottom: 8 }}>{label}</div>
                    <div style={{ background: "#f3f4f6", borderRadius: 4, height: 4 }}>
                      <div style={{ background: color, borderRadius: 4, height: 4, width: `${barWidth}%`, transition: "none" }} />
                    </div>
                    {invert && <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 4 }}>Lower is better</div>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Brand narratives ──────────────────────────────────────────── */}
          {result.brand_narratives.length > 0 && (
            <div className="avoid-break" style={{ marginBottom: 36 }}>
              <SectionLabel>Brand Narrative Themes</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {result.brand_narratives.slice(0, 7).map((n, i) => {
                  const statusColors: Record<string, string> = {
                    strong: "#059669", emerging: "#2563eb", weak: "#d97706", missing: "#dc2626",
                  };
                  const barColor = statusColors[n.status] || "#6b7280";
                  return (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{ minWidth: 200, maxWidth: 200 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                          <span style={{ fontSize: 12.5, fontWeight: 600, color: "#111827" }}>{n.theme}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: `${barColor}15`, color: barColor, textTransform: "capitalize",
                          }}>{n.status}</span>
                        </div>
                        <div style={{ background: "#f3f4f6", borderRadius: 4, height: 5 }}>
                          <div style={{ background: barColor, borderRadius: 4, height: 5, width: `${n.strength}%` }} />
                        </div>
                        <div style={{ fontSize: 10, color: "#9ca3af", marginTop: 2 }}>{n.strength}/100</div>
                      </div>
                      <div style={{ flex: 1, fontSize: 12, color: "#6b7280", lineHeight: 1.6, paddingTop: 2 }}>
                        {n.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Proof gaps ────────────────────────────────────────────────── */}
          {result.proof_gaps.length > 0 && (
            <div className="avoid-break page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>Proof Gaps</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {result.proof_gaps.map((gap, i) => {
                  const color = severityColor(gap.severity);
                  return (
                    <div key={i} className="avoid-break" style={{
                      borderLeft: `4px solid ${color}`,
                      background: `${color}08`,
                      borderRadius: "0 8px 8px 0",
                      padding: "12px 16px",
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                        <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{gap.gap_type}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                          background: `${color}15`, color, textTransform: "capitalize",
                        }}>{gap.severity}</span>
                      </div>
                      <p style={{ margin: 0, fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>{gap.description}</p>
                      {gap.narrative_affected && (
                        <p style={{ margin: "4px 0 0", fontSize: 11, color: "#9ca3af" }}>
                          Affects: <em>{gap.narrative_affected}</em>
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Recommended actions ───────────────────────────────────────── */}
          {topActions.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <SectionLabel>Recommended Actions</SectionLabel>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {topActions.map((action, i) => (
                  <div key={i} className="avoid-break" style={{
                    border: "1px solid #e5e7eb",
                    borderRadius: 10,
                    padding: "14px 16px",
                    background: "#fff",
                  }}>
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: "50%",
                        background: "#eef2ff", color: "#4f46e5",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        fontSize: 11, fontWeight: 800, flexShrink: 0, marginTop: 1,
                      }}>
                        {i + 1}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{action.title}</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: `${effortColor(action.effort)}15`, color: effortColor(action.effort),
                          }}>{action.effort} effort</span>
                          <span style={{
                            fontSize: 10, fontWeight: 600, padding: "1px 6px", borderRadius: 4,
                            background: `${impactColor(action.expected_impact)}15`, color: impactColor(action.expected_impact),
                          }}>{action.expected_impact} impact</span>
                        </div>
                        <p style={{ margin: "0 0 6px", fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                          {action.why_it_matters}
                        </p>
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

          {/* ── Competitor overview ───────────────────────────────────────── */}
          {competitors.length > 0 && Object.keys(result.competitor_narratives).length > 0 && (
            <div className="avoid-break page-break-before" style={{ marginBottom: 36 }}>
              <SectionLabel>Competitor Narrative Overview</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: competitors.length > 1 ? "1fr 1fr" : "1fr", gap: 16 }}>
                {competitors.map((comp) => {
                  const themes = result.competitor_narratives[comp.domain] || [];
                  if (themes.length === 0) return null;
                  const sorted = [...themes].sort((a, b) => b.strength - a.strength);
                  return (
                    <div key={comp.domain} style={{ border: "1px solid #e5e7eb", borderRadius: 10, padding: "14px 16px" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 10 }}>
                        {comp.name || comp.domain}
                        <span style={{ fontWeight: 400, color: "#9ca3af", marginLeft: 6 }}>{comp.domain}</span>
                      </div>
                      {sorted.slice(0, 5).map((n, i) => (
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
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── Footer ────────────────────────────────────────────────────── */}
          <div style={{
            borderTop: "1px solid #e5e7eb",
            paddingTop: 20,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
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

// ── Section label helper ──────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: "0.12em",
      textTransform: "uppercase",
      color: "#9ca3af",
      borderBottom: "1px solid #f3f4f6",
      paddingBottom: 6,
      marginBottom: 14,
    }}>
      {children}
    </div>
  );
}

export default PRPrint;
