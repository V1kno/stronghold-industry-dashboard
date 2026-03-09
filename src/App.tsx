import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, ScatterChart,
  Scatter, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis
} from "recharts";

/* ── Color Palette ── */
const C = {
  bg: "#0a0e1a",
  card: "#111827",
  border: "#1e293b",
  accent: "#f59e0b",
  text: "#f1f5f9",
  muted: "#94a3b8",
  dim: "#64748b",
  blue: "#3b82f6",
  purple: "#a78bfa",
  cyan: "#06b6d4",
  green: "#22c55e",
  red: "#ef4444",
  orange: "#f97316",
  pink: "#ec4899",
};

const BCOL = [
  "#3b82f6", "#a78bfa", "#06b6d4", "#f59e0b", "#22c55e",
  "#ef4444", "#f97316", "#ec4899", "#14b8a6", "#8b5cf6",
];
const PCOL = ["#ef4444", "#f59e0b", "#22c55e", "#06b6d4"];

const PRESETS = [
  "Managed Services (MSP)", "Cybersecurity", "Cloud Computing",
  "Healthcare IT", "Financial Services", "Legal Tech",
  "Manufacturing", "Retail & E-Commerce",
];

/* ── Tiny Components ── */
const Card = ({ children, style }: { children: any; style?: any }) => (
  <div style={{
    background: C.card,
    border: `1px solid ${C.border}`,
    borderRadius: 16,
    padding: 24,
    ...style,
  }}>
    {children}
  </div>
);

const Label = ({ children }: { children: any }) => (
  <div style={{
    fontSize: 12, fontWeight: 700, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.12em",
    marginBottom: 16, fontFamily: "monospace",
  }}>
    {children}
  </div>
);

const Metric = ({ label, value, sub, color = C.accent }: { label: string; value: any; sub?: string; color?: string }) => (
  <div style={{
    flex: "1 1 150px", padding: "18px 16px", borderRadius: 14,
    background: `${color}08`, border: `1px solid ${color}22`,
    textAlign: "center",
  }}>
    <div style={{ fontSize: 10, textTransform: "uppercase", color: C.dim, fontFamily: "monospace" }}>
      {label}
    </div>
    <div style={{ fontSize: 30, fontWeight: 800, color, marginTop: 4, fontFamily: "monospace" }}>
      {value}
    </div>
    {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 4 }}>{sub}</div>}
  </div>
);

const Badge = ({ level }: { level: string }) => {
  const c = (level === "High" || level === "Critical") ? C.red
    : level === "Medium" ? C.accent : C.green;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "3px 10px",
      borderRadius: 6, background: `${c}18`, color: c,
      textTransform: "uppercase", fontFamily: "monospace",
    }}>
      {level}
    </span>
  );
};

const Arrow = ({ t }: { t: string }) => {
  const map = {
    up: { i: "↑", c: C.green },
    down: { i: "↓", c: C.red },
    stable: { i: "→", c: C.accent },
  };
  const v = map[t] || map.stable;
  return <span style={{ color: v.c, fontWeight: 700, fontFamily: "monospace" }}>{v.i}</span>;
};

const Stat = ({ label, val, col }: { label: string; val: any; col?: string }) => (
  <div style={{ textAlign: "center", flex: "1 1 70px" }}>
    <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>
      {label}
    </div>
    <div style={{ fontSize: 20, fontWeight: 800, color: col || C.text, fontFamily: "monospace", marginTop: 2 }}>
      {val}
    </div>
  </div>
);

const ChartTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#1e293b", border: `1px solid ${C.border}`,
      borderRadius: 10, padding: "10px 14px", fontSize: 12,
    }}>
      <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color || C.accent }}>
          {p.name}: {p.value}
        </div>
      ))}
    </div>
  );
};

/* ── Robust JSON parser ── */
function parseJSON(text: string) {
  // Strip markdown fences
  let s = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();

  // Direct parse attempt
  try { return JSON.parse(s); } catch {}

  // Brace-matching extraction
  let depth = 0;
  let start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (s[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        try { return JSON.parse(s.slice(start, i + 1)); } catch {}
      }
    }
  }

  // Regex fallback with bracket repair
  const m = s.match(/\{[\s\S]*\}/);
  if (m) {
    let r = m[0].replace(/,\s*([}\]])/g, "$1");
    const openBrackets = (r.match(/\[/g) || []).length;
    const closeBrackets = (r.match(/\]/g) || []).length;
    for (let i = 0; i < openBrackets - closeBrackets; i++) r += "]";
    const openBraces = (r.match(/\{/g) || []).length;
    const closeBraces = (r.match(/\}/g) || []).length;
    for (let i = 0; i < openBraces - closeBraces; i++) r += "}";
    try { return JSON.parse(r); } catch {}
  }

  throw new Error("Could not parse JSON from response");
}

/* ── API helper with timeout + retry ── */
async function apiCall(prompt: string, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    try {
      const resp = await fetch("/api/claude", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 6000,
          tools: [{ type: "web_search_20250305", name: "web_search" }],
          messages: [{ role: "user", content: prompt }],
        }),
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errBody = await resp.json().catch(() => ({}));
        throw new Error(errBody?.error?.message || `HTTP ${resp.status}`);
      }

      const data = await resp.json();

      if (data.error) throw new Error(data.error.message);

      // Extract all text blocks from response (skipping tool_use/tool_result blocks)
      const textParts = (data.content || [])
        .filter(block => block.type === "text")
        .map(block => block.text)
        .join("\n");

      if (!textParts.trim()) throw new Error("Empty text response");

      return parseJSON(textParts);
    } catch (e) {
      clearTimeout(timeoutId);
      if (attempt < retries) {
        await new Promise(r => setTimeout(r, 2000 + attempt * 1000));
        continue;
      }
      throw e;
    }
  }
}

/* ── Data fetchers ── */
const fetchOverview = (ind: string) => apiCall(
  `Analyze "${ind}" industry. Web search for current data. Return ONLY valid JSON (no markdown, no backticks, no extra text):
{"industryName":"str","marketSize":"str","growthRate":"str","aiAdoptionRate":0,"summary":"str(2 sentences)","aiReadinessScore":0,"disruptionRisk":"Low|Medium|High|Critical","aiMaturityDistribution":{"Early":0,"Growing":0,"Mature":0,"Leading":0},"aiAdoptionBySegment":[{"segment":"str","adoptionRate":0,"maturity":"str"}],"topAIUseCases":[{"useCase":"str","impactScore":0,"adoptionLevel":"Low|Medium|High","description":"str"}],"marketTrends":[{"trend":"str","impact":"High|Medium|Low","timeframe":"str","description":"str"}]}
Provide 5 segments, 5 use cases, 4 trends. Use real numbers. Keep strings short.`
);

const fetchCompetitive = (ind: string) => apiCall(
  `Competitive landscape of "${ind}" industry. Web search for current data. Return ONLY valid JSON (no markdown, no backticks, no extra text):
{"competitors":[{"name":"str","marketSharePct":0,"aiInvestmentScore":0,"strengths":["str"],"weaknesses":["str"],"aiStrategy":"str","hq":"str"}],"kpis":[{"name":"str","industryAvg":"str","topQuartile":"str","unit":"str","trend":"up|down|stable","description":"str"}],"competitiveInsight":"str(2 sentences)"}
Provide 6 real competitors, 5 KPIs. Keep strings short.`
);

const fetchLabor = (ind: string) => apiCall(
  `Using Anthropic's "Labor market impacts of AI" (March 2026) observed-exposure framework, analyze "${ind}" labor market. Web search for data. Return ONLY valid JSON (no markdown, no backticks, no extra text):
{"topExposedOccupations":[{"occupation":"str","observedExposure":0,"theoreticalExposure":0,"leadingTask":"str","blsGrowthPct":0}],"exposureByCategory":[{"category":"str","theoretical":0,"observed":0}],"workforceDemographics":{"highExposure":{"avgAge":0,"femalePct":0,"bachelorsPlusPct":0,"avgHourlyWage":0,"workers":"str"},"lowExposure":{"avgAge":0,"femalePct":0,"bachelorsPlusPct":0,"avgHourlyWage":0,"workers":"str"}},"hiringTrends":{"youngWorkerImpactPct":0,"overallTrend":"str","postAIHiringShift":"str","projectedGrowth2034":"str"},"keyInsights":["str","str","str"],"riskAssessment":{"automationRiskLevel":"Low|Medium|High|Critical","timelineToImpact":"str","mostVulnerableRoles":["str","str","str"],"mostResilientRoles":["str","str","str"]}}
Provide 6 occupations, 6 categories. Keep strings short.`
);

/* ── Report HTML generator ── */
function genReport(ov: any, cp: any, ind: string) {
  const segRows = (ov?.aiAdoptionBySegment || []).map(s =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${s.segment}</td>
     <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${s.adoptionRate}%</td>
     <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${s.maturity}</td></tr>`
  ).join("");

  const compRows = (cp?.competitors || []).map(c =>
    `<tr><td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${c.name}</td>
     <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${c.marketSharePct}%</td>
     <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${c.aiInvestmentScore}/10</td>
     <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0">${c.aiStrategy}</td></tr>`
  ).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ind} Report</title>
<style>body{font-family:-apple-system,sans-serif;margin:0;padding:40px;background:#f8fafc;color:#0f172a}
h1{font-size:28px}h2{font-size:18px;margin-top:28px;border-bottom:2px solid #f59e0b;padding-bottom:6px}
table{width:100%;border-collapse:collapse;margin-top:10px}
th{text-align:left;padding:8px 12px;background:#f1f5f9;font-size:11px;text-transform:uppercase}
.m{display:flex;gap:14px;margin:16px 0}.mb{flex:1;padding:18px;border-radius:12px;text-align:center}
.ml{font-size:10px;text-transform:uppercase;color:#64748b}.mv{font-size:32px;font-weight:800;margin-top:4px}</style>
</head><body>
<h1>${ov?.industryName || ind} Industry Report</h1>
<p style="color:#64748b">${new Date().toLocaleDateString()} · Stronghold Data</p>
<p style="max-width:700px;line-height:1.6">${ov?.summary || ""}</p>
<div class="m">
  <div class="mb" style="background:#eff6ff;border:1px solid #93c5fd"><div class="ml">Market Size</div><div class="mv" style="color:#2563eb">${ov?.marketSize || "—"}</div></div>
  <div class="mb" style="background:#fefce8;border:1px solid #fcd34d"><div class="ml">AI Adoption</div><div class="mv" style="color:#d97706">${ov?.aiAdoptionRate || 0}%</div></div>
  <div class="mb" style="background:#f0fdf4;border:1px solid #86efac"><div class="ml">Growth</div><div class="mv" style="color:#16a34a">${ov?.growthRate || "—"}</div></div>
</div>
<h2>AI Adoption by Segment</h2>
<table><thead><tr><th>Segment</th><th>Rate</th><th>Maturity</th></tr></thead><tbody>${segRows}</tbody></table>
<h2>Competitive Landscape</h2>
<p>${cp?.competitiveInsight || ""}</p>
<table><thead><tr><th>Company</th><th>Share</th><th>AI</th><th>Strategy</th></tr></thead><tbody>${compRows}</tbody></table>
<div style="margin-top:40px;border-top:2px solid #e2e8f0;padding-top:16px;text-align:center;color:#94a3b8;font-size:12px">
  Built by <strong>Avion Bryant</strong> · CTO of Stronghold Data
</div></body></html>`;
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ══════════════════════════════════════════
   MAIN DASHBOARD COMPONENT
   ══════════════════════════════════════════ */
export default function Dashboard() {
  const [ind, setInd] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [ov, setOv] = useState(null);
  const [cp, setCp] = useState(null);
  const [lm, setLm] = useState(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [exp, setExp] = useState(false);
  const timerRef = useRef(null);
  const resRef = useRef(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const run = async () => {
    if (!ind.trim()) return;
    setErr(""); setOv(null); setCp(null); setLm(null);
    setLoading(true); setTab("overview"); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);

    const errs = [];

    try {
      setPhase("① Industry overview & AI adoption...");
      const o = await fetchOverview(ind.trim());
      setOv(o);
    } catch (e) { errs.push("Overview: " + e.message); }

    try {
      setPhase("② Competitive landscape & KPIs...");
      const c = await fetchCompetitive(ind.trim());
      setCp(c);
    } catch (e) { errs.push("Competitive: " + e.message); }

    try {
      setPhase("③ Labor market impact...");
      const l = await fetchLabor(ind.trim());
      setLm(l);
    } catch (e) { errs.push("Labor: " + e.message); }

    if (errs.length) setErr(errs.join(" | "));

    // Auto-select first available tab
    setTab(ov ? "overview" : cp ? "competitive" : lm ? "labor" : "overview");

    clearInterval(timerRef.current);
    timerRef.current = null;
    setLoading(false);
    setPhase("");
    setTimeout(() => resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  /* ── Derived data ── */
  const has = ov || cp || lm;

  const matD = ov?.aiMaturityDistribution
    ? Object.entries(ov.aiMaturityDistribution).map(([name, value]) => ({ name, value }))
    : [];

  const segD = (ov?.aiAdoptionBySegment || []).map((s, i) => ({
    ...s, fill: BCOL[i % BCOL.length],
  }));

  const radD = (ov?.topAIUseCases || []).map(u => ({
    uc: u.useCase.length > 18 ? u.useCase.slice(0, 16) + "…" : u.useCase,
    impact: u.impactScore,
    full: u.useCase,
  }));

  const scatD = (cp?.competitors || []).map((c, i) => ({
    ...c,
    x: c.marketSharePct,
    y: c.aiInvestmentScore,
    fill: BCOL[i % BCOL.length],
  }));

  const occD = (lm?.topExposedOccupations || []).map((o, i) => ({
    ...o,
    nm: o.occupation.length > 22 ? o.occupation.slice(0, 20) + "…" : o.occupation,
    fill: BCOL[i % BCOL.length],
  }));

  const lmRad = (lm?.exposureByCategory || []).map(c => ({
    cat: c.category.length > 15 ? c.category.slice(0, 13) + "…" : c.category,
    theoretical: c.theoretical,
    observed: c.observed,
  }));

  const hi = lm?.workforceDemographics?.highExposure;
  const lo = lm?.workforceDemographics?.lowExposure;

  const TABS = [
    { id: "overview", icon: "📊", l: "Overview", need: ov },
    { id: "adoption", icon: "🤖", l: "AI Adoption", need: ov },
    { id: "competitive", icon: "🎯", l: "Competitive", need: cp },
    { id: "kpis", icon: "📈", l: "KPIs", need: cp },
    { id: "labor", icon: "👥", l: "Labor Market", need: lm },
  ];

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  /* ── Export menu actions ── */
  const exportActions = [
    {
      l: "Preview Report", i: "👁",
      fn: () => {
        if (!ov) return;
        const w = window.open("", "_blank");
        if (w) { w.document.write(genReport(ov, cp, ind)); w.document.close(); }
        setExp(false);
      },
    },
    {
      l: "Download HTML", i: "📄",
      fn: () => {
        if (!ov) return;
        downloadFile(genReport(ov, cp, ind), `${ind.replace(/\s+/g, "_")}_Report.html`, "text/html");
        setExp(false);
      },
    },
    {
      l: "Download CSV", i: "📊",
      fn: () => {
        let csv = "Section,Field,Value\n";
        if (ov) {
          csv += `Overview,Market Size,"${ov.marketSize}"\n`;
          csv += `Overview,Growth,"${ov.growthRate}"\n`;
          csv += `Overview,AI Adoption,${ov.aiAdoptionRate}%\n`;
          (ov.aiAdoptionBySegment || []).forEach(s => {
            csv += `Segment,${s.segment},${s.adoptionRate}%\n`;
          });
        }
        if (cp) {
          (cp.competitors || []).forEach(c => {
            csv += `Competitor,${c.name},${c.marketSharePct}%\n`;
          });
        }
        if (lm) {
          (lm.topExposedOccupations || []).forEach(o => {
            csv += `Labor,${o.occupation},${o.observedExposure}%\n`;
          });
        }
        downloadFile(csv, `${ind.replace(/\s+/g, "_")}_Data.csv`, "text/csv");
        setExp(false);
      },
    },
  ];

  /* ──────────── RENDER ──────────── */
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, BlinkMacSystemFont, sans-serif", paddingBottom: 80 }}>
      <style>{`
        @keyframes fu { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes sp { to { transform: rotate(360deg) } }
        @keyframes pu { 0%, 100% { opacity: 1 } 50% { opacity: .5 } }
      `}</style>

      {/* ═══════ HEADER ═══════ */}
      <div style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1a1040 50%, #0f172a 100%)",
        borderBottom: `1px solid ${C.border}`,
        padding: "40px 32px 36px",
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.cyan, boxShadow: `0 0 12px ${C.cyan}` }} />
            <span style={{ fontSize: 12, fontFamily: "monospace", color: C.cyan, letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Industry Intelligence Engine
            </span>
          </div>
          <h1 style={{
            fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1.1,
            background: "linear-gradient(135deg, #f1f5f9 0%, #06b6d4 100%)",
            WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          }}>
            Industry Dashboard
          </h1>
          <p style={{ color: C.muted, fontSize: 15, marginTop: 10, maxWidth: 640 }}>
            AI adoption, competitive landscape, KPIs, and labor market impact — powered by live research + Anthropic's labor framework.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}` }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
            <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>
              Built by <span style={{ color: C.text, fontWeight: 700 }}>Avion Bryant</span> · <span style={{ color: C.accent }}>CTO of Stronghold Data</span>
            </span>
          </div>
        </div>
      </div>

      {/* ═══════ CONTENT ═══════ */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── INPUT CARD ── */}
        <Card style={{ marginBottom: 24 }}>
          <Label>① Select or Enter an Industry</Label>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {PRESETS.map(p => (
              <button key={p} onClick={() => setInd(p)} style={{
                padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                cursor: "pointer",
                border: ind === p ? `1px solid ${C.cyan}` : `1px solid ${C.border}`,
                background: ind === p ? `${C.cyan}18` : "transparent",
                color: ind === p ? C.cyan : C.muted,
              }}>
                {p}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <input
              value={ind}
              onChange={e => setInd(e.target.value)}
              placeholder="Or type any industry..."
              onKeyDown={e => e.key === "Enter" && !loading && run()}
              style={{
                flex: 1, padding: "14px 18px", borderRadius: 12,
                border: `1px solid ${C.border}`, background: "#0f172a",
                color: C.text, fontSize: 15, outline: "none",
              }}
            />
            <button
              onClick={run}
              disabled={loading || !ind.trim()}
              style={{
                padding: "14px 32px", borderRadius: 12, border: "none",
                fontSize: 15, fontWeight: 700,
                cursor: loading ? "wait" : "pointer",
                background: loading ? C.border : `linear-gradient(135deg, ${C.cyan}, ${C.blue})`,
                color: loading ? C.dim : "#fff",
              }}
            >
              {loading ? "Analyzing..." : "Analyze Industry"}
            </button>
          </div>

          {/* Loading indicator */}
          {loading && (
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16 }}>
              <div style={{
                width: 18, height: 18,
                border: `2px solid ${C.cyan}`, borderTopColor: "transparent",
                borderRadius: "50%", animation: "sp 0.8s linear infinite",
              }} />
              <span style={{ fontSize: 13, color: C.cyan, fontFamily: "monospace", animation: "pu 1.5s ease-in-out infinite" }}>
                {phase}
              </span>
              <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace", marginLeft: "auto" }}>
                {fmt(elapsed)}
              </span>
            </div>
          )}

          {/* Error display */}
          {err && (
            <div style={{
              marginTop: 14, padding: "12px 16px", borderRadius: 10,
              background: `${C.orange}12`, border: `1px solid ${C.orange}33`,
              color: C.orange, fontSize: 13,
            }}>
              {err}
            </div>
          )}
        </Card>

        {/* ═══════ RESULTS ═══════ */}
        {has && (
          <div ref={resRef} style={{ animation: "fu 0.5s ease-out" }}>

            {/* Tab bar + Export */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
              <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
                {TABS.map(t => {
                  const dis = !t.need;
                  return (
                    <button
                      key={t.id}
                      onClick={() => !dis && setTab(t.id)}
                      style={{
                        padding: "8px 18px", borderRadius: 10, fontSize: 13,
                        fontWeight: 600, cursor: dis ? "default" : "pointer",
                        whiteSpace: "nowrap",
                        border: tab === t.id
                          ? `1px solid ${t.id === "labor" ? C.pink : C.cyan}`
                          : `1px solid ${C.border}`,
                        background: tab === t.id
                          ? `${t.id === "labor" ? C.pink : C.cyan}18`
                          : "transparent",
                        color: dis ? C.border
                          : tab === t.id ? (t.id === "labor" ? C.pink : C.cyan)
                          : C.muted,
                        opacity: dis ? 0.4 : 1,
                      }}
                    >
                      {t.icon} {t.l}
                    </button>
                  );
                })}
              </div>

              {/* Export dropdown */}
              <div style={{ position: "relative" }}>
                <button onClick={() => setExp(!exp)} style={{
                  padding: "8px 20px", borderRadius: 10, border: "none",
                  background: `linear-gradient(135deg, ${C.accent}, #d97706)`,
                  color: "#0a0e1a", fontSize: 12, fontWeight: 700, cursor: "pointer",
                }}>
                  ↗ Export
                </button>
                {exp && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: C.card, border: `1px solid ${C.border}`,
                    borderRadius: 12, padding: 6, zIndex: 100, minWidth: 200,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
                  }}>
                    {exportActions.map(o => (
                      <button
                        key={o.l} onClick={o.fn}
                        style={{
                          display: "flex", alignItems: "center", gap: 10,
                          width: "100%", padding: "10px 14px", borderRadius: 8,
                          border: "none", background: "transparent",
                          color: C.text, cursor: "pointer", textAlign: "left", fontSize: 13,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = "#1e293b"}
                        onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                      >
                        <span style={{ fontSize: 16 }}>{o.i}</span>
                        <span style={{ fontWeight: 600 }}>{o.l}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ═══ OVERVIEW TAB ═══ */}
            {tab === "overview" && ov && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <Metric label="Market Size" value={ov.marketSize} color={C.blue} />
                  <Metric label="AI Adoption" value={`${ov.aiAdoptionRate}%`} color={C.cyan} />
                  <Metric label="Growth" value={ov.growthRate} color={C.green} />
                  <Metric label="AI Readiness" value={`${ov.aiReadinessScore}/100`} color={C.purple} />
                  <Metric label="Disruption" value={ov.disruptionRisk} color={
                    ov.disruptionRisk === "Critical" ? C.red
                    : ov.disruptionRisk === "High" ? C.orange : C.accent
                  } />
                </div>

                <Card>
                  <Label>Executive Summary</Label>
                  <p style={{ fontSize: 15, lineHeight: 1.7, color: C.muted, margin: 0 }}>{ov.summary}</p>
                  {cp?.competitiveInsight && (
                    <p style={{ fontSize: 14, lineHeight: 1.7, color: C.dim, margin: "12px 0 0", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
                      {cp.competitiveInsight}
                    </p>
                  )}
                </Card>

                <Card>
                  <Label>Market Trends</Label>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {(ov.marketTrends || []).map((t, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 14, padding: "14px 16px", borderRadius: 12,
                        background: "#0f172a", border: `1px solid ${C.border}`, alignItems: "flex-start",
                      }}>
                        <Badge level={t.impact} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 14, fontWeight: 600 }}>{t.trend}</div>
                          <div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{t.description}</div>
                        </div>
                        <span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {t.timeframe}
                        </span>
                      </div>
                    ))}
                  </div>
                </Card>
              </div>
            )}

            {/* ═══ AI ADOPTION TAB ═══ */}
            {tab === "adoption" && ov && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Card style={{ flex: "2 1 400px" }}>
                    <Label>AI Adoption by Segment</Label>
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={segD} layout="vertical" margin={{ left: 20, right: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => `${v}%`} />
                        <YAxis type="category" dataKey="segment" width={130} tick={{ fill: C.muted, fontSize: 11 }} />
                        <Tooltip content={<ChartTooltip />} />
                        <Bar dataKey="adoptionRate" name="Adoption %" radius={[0, 6, 6, 0]} barSize={22}>
                          {segD.map((s, i) => <Cell key={i} fill={s.fill} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </Card>

                  <Card style={{ flex: "1 1 260px" }}>
                    <Label>Maturity Distribution</Label>
                    <ResponsiveContainer width="100%" height={300}>
                      <PieChart>
                        <Pie
                          data={matD} cx="50%" cy="50%"
                          innerRadius={55} outerRadius={95}
                          paddingAngle={4} dataKey="value"
                          label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        >
                          {matD.map((_, i) => <Cell key={i} fill={PCOL[i]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </Card>
                </div>

                <Card>
                  <Label>Top AI Use Cases</Label>
                  <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ flex: "1 1 340px" }}>
                      <ResponsiveContainer width="100%" height={280}>
                        <RadarChart data={radD}>
                          <PolarGrid stroke={C.border} />
                          <PolarAngleAxis dataKey="uc" tick={{ fill: C.dim, fontSize: 10 }} />
                          <PolarRadiusAxis domain={[0, 10]} tick={{ fill: C.dim, fontSize: 10 }} />
                          <Radar name="Impact" dataKey="impact" stroke={C.cyan} fill={C.cyan} fillOpacity={0.2} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                    <div style={{ flex: "1 1 280px" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                        <thead>
                          <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                            {["Use Case", "Impact", "Adoption"].map(h => (
                              <th key={h} style={{
                                textAlign: "left", padding: 8, color: C.dim,
                                fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: "monospace",
                              }}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {(ov.topAIUseCases || []).map((u, i) => (
                            <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                              <td style={{ padding: "10px 8px", fontWeight: 500, maxWidth: 200 }}>{u.useCase}</td>
                              <td style={{ padding: "10px 8px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                  <div style={{ width: 48, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}>
                                    <div style={{ width: `${u.impactScore * 10}%`, height: "100%", borderRadius: 3, background: C.cyan }} />
                                  </div>
                                  <span style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{u.impactScore}/10</span>
                                </div>
                              </td>
                              <td style={{ padding: "10px 8px" }}><Badge level={u.adoptionLevel} /></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </Card>
              </div>
            )}

            {/* ═══ COMPETITIVE TAB ═══ */}
            {tab === "competitive" && cp && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                <Card>
                  <Label>Market Share vs AI Investment</Label>
                  <ResponsiveContainer width="100%" height={360}>
                    <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} />
                      <XAxis type="number" dataKey="x" tick={{ fill: C.dim, fontSize: 11 }}
                        tickFormatter={v => `${v}%`}
                        label={{ value: "Market Share %", position: "insideBottom", offset: -10, fill: C.dim, fontSize: 12 }}
                      />
                      <YAxis type="number" dataKey="y" domain={[0, 10]} tick={{ fill: C.dim, fontSize: 11 }}
                        label={{ value: "AI Investment", angle: -90, position: "insideLeft", fill: C.dim, fontSize: 12 }}
                      />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: "#1e293b", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12, maxWidth: 260 }}>
                            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{d.name}</div>
                            <div style={{ color: C.muted }}>Share: <span style={{ color: C.cyan }}>{d.marketSharePct}%</span></div>
                            <div style={{ color: C.muted }}>AI: <span style={{ color: C.accent }}>{d.aiInvestmentScore}/10</span></div>
                            <div style={{ color: C.dim, marginTop: 4, fontSize: 11 }}>{d.aiStrategy}</div>
                          </div>
                        );
                      }} />
                      <Scatter data={scatD} shape={({ cx, cy, payload }) => (
                        <g>
                          <circle cx={cx} cy={cy} r={Math.max(8, payload.marketSharePct * 1.2)}
                            fill={payload.fill} fillOpacity={0.3} stroke={payload.fill} strokeWidth={2} />
                          <text x={cx} y={cy - Math.max(10, payload.marketSharePct * 1.2) - 6}
                            textAnchor="middle" fill={C.muted} fontSize={10}>{payload.name}</text>
                        </g>
                      )} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </Card>

                <Card style={{ overflowX: "auto" }}>
                  <Label>Competitor Profiles</Label>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}>
                    <thead>
                      <tr style={{ borderBottom: `1px solid ${C.border}` }}>
                        {["Company", "Share", "AI", "Strengths", "Weakness", "Strategy"].map(h => (
                          <th key={h} style={{
                            textAlign: "left", padding: "10px 8px", color: C.dim,
                            fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: "monospace",
                          }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(cp.competitors || []).map((c, i) => (
                        <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ fontWeight: 600 }}>{c.name}</div>
                            {c.hq && <div style={{ fontSize: 11, color: C.dim }}>{c.hq}</div>}
                          </td>
                          <td style={{ padding: "12px 8px", fontFamily: "monospace", color: C.cyan }}>{c.marketSharePct}%</td>
                          <td style={{ padding: "12px 8px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <div style={{ width: 48, height: 6, borderRadius: 3, background: "#1e293b", overflow: "hidden" }}>
                                <div style={{ width: `${c.aiInvestmentScore * 10}%`, height: "100%", borderRadius: 3, background: C.accent }} />
                              </div>
                              <span style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{c.aiInvestmentScore}/10</span>
                            </div>
                          </td>
                          <td style={{ padding: "12px 8px", fontSize: 12, color: C.green, maxWidth: 180 }}>{(c.strengths || []).join(", ")}</td>
                          <td style={{ padding: "12px 8px", fontSize: 12, color: C.red, maxWidth: 140 }}>{(c.weaknesses || []).join(", ")}</td>
                          <td style={{ padding: "12px 8px", fontSize: 12, color: C.dim, maxWidth: 180 }}>{c.aiStrategy}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </Card>
              </div>
            )}

            {/* ═══ KPIs TAB ═══ */}
            {tab === "kpis" && cp && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
                {(cp.kpis || []).map((k, i) => (
                  <Card key={i} style={{ padding: 20 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, maxWidth: "80%" }}>{k.name}</div>
                      <Arrow t={k.trend} />
                    </div>
                    <div style={{ display: "flex", gap: 16, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>Avg</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.muted, fontFamily: "monospace" }}>{k.industryAvg}</div>
                      </div>
                      <div style={{ width: 1, background: C.border }} />
                      <div>
                        <div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>Top</div>
                        <div style={{ fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>{k.topQuartile}</div>
                      </div>
                    </div>
                    <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{k.description}</div>
                  </Card>
                ))}
              </div>
            )}

            {/* ═══ LABOR MARKET TAB ═══ */}
            {tab === "labor" && lm && (
              <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
                {/* Banner */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 18px", borderRadius: 12,
                  background: `${C.pink}08`, border: `1px solid ${C.pink}22`,
                }}>
                  <span style={{ fontSize: 16 }}>📄</span>
                  <span style={{ fontSize: 12, color: C.muted }}>
                    Based on Anthropic's <span style={{ color: C.pink, fontWeight: 700 }}>"Labor market impacts of AI"</span> (March 2026) — observed exposure framework.
                  </span>
                </div>

                {/* Top metrics */}
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  <Metric
                    label="Automation Risk"
                    value={lm.riskAssessment?.automationRiskLevel || "—"}
                    color={lm.riskAssessment?.automationRiskLevel === "Critical" ? C.red
                      : lm.riskAssessment?.automationRiskLevel === "High" ? C.orange : C.accent}
                  />
                  <Metric label="Timeline" value={lm.riskAssessment?.timelineToImpact || "—"} color={C.purple} />
                  <Metric label="Young Worker Δ" value={`${lm.hiringTrends?.youngWorkerImpactPct || 0}%`} sub="Job finding rate" color={C.red} />
                  <Metric label="Growth 2034" value={lm.hiringTrends?.projectedGrowth2034 || "—"} sub="BLS projection" color={C.green} />
                </div>

                {/* Exposed Occupations Chart */}
                <Card>
                  <Label>Top Exposed Occupations</Label>
                  <ResponsiveContainer width="100%" height={Math.max(260, occD.length * 42)}>
                    <BarChart data={occD} layout="vertical" margin={{ left: 30, right: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} />
                      <XAxis type="number" domain={[0, 100]} tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={v => `${v}%`} />
                      <YAxis type="category" dataKey="nm" width={155} tick={{ fill: C.muted, fontSize: 11 }} />
                      <Tooltip content={({ active, payload }) => {
                        if (!active || !payload?.length) return null;
                        const d = payload[0]?.payload;
                        return (
                          <div style={{ background: "#1e293b", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12, maxWidth: 300 }}>
                            <div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{d.occupation}</div>
                            <div style={{ color: C.pink }}>Observed: {d.observedExposure}%</div>
                            <div style={{ color: C.blue }}>Theoretical: {d.theoreticalExposure}%</div>
                            <div style={{ color: C.dim, marginTop: 4 }}>
                              BLS: <span style={{ color: d.blsGrowthPct >= 0 ? C.green : C.red }}>
                                {d.blsGrowthPct > 0 ? "+" : ""}{d.blsGrowthPct}%
                              </span>
                            </div>
                            <div style={{ color: C.dim, fontSize: 11, marginTop: 2 }}>{d.leadingTask}</div>
                          </div>
                        );
                      }} />
                      <Bar dataKey="theoreticalExposure" name="Theoretical" fill={C.blue} fillOpacity={0.3} radius={[0, 6, 6, 0]} barSize={14} />
                      <Bar dataKey="observedExposure" name="Observed" fill={C.pink} radius={[0, 6, 6, 0]} barSize={14} />
                    </BarChart>
                  </ResponsiveContainer>
                  <div style={{ display: "flex", gap: 20, justifyContent: "center", marginTop: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: C.blue, opacity: 0.4 }} />
                      <span style={{ fontSize: 11, color: C.dim }}>Theoretical</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 12, height: 12, borderRadius: 3, background: C.pink }} />
                      <span style={{ fontSize: 11, color: C.dim }}>Observed</span>
                    </div>
                  </div>
                </Card>

                {/* Radar + Demographics */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Card style={{ flex: "1 1 400px" }}>
                    <Label>Exposure by Category</Label>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={lmRad}>
                        <PolarGrid stroke={C.border} />
                        <PolarAngleAxis dataKey="cat" tick={{ fill: C.dim, fontSize: 9 }} />
                        <PolarRadiusAxis domain={[0, 100]} tick={{ fill: C.dim, fontSize: 9 }} />
                        <Radar name="Theoretical" dataKey="theoretical" stroke={C.blue} fill={C.blue} fillOpacity={0.15} />
                        <Radar name="Observed" dataKey="observed" stroke={C.pink} fill={C.pink} fillOpacity={0.25} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </Card>

                  {hi && lo && (
                    <Card style={{ flex: "1 1 320px" }}>
                      <Label>Demographics: High vs Low Exposure</Label>
                      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                        <div style={{ padding: 16, borderRadius: 12, background: `${C.pink}08`, border: `1px solid ${C.pink}22` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.pink, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>
                            🔴 High Exposure
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <Stat label="Age" val={hi.avgAge} col={C.text} />
                            <Stat label="Female" val={`${hi.femalePct}%`} col={C.pink} />
                            <Stat label="BA+" val={`${hi.bachelorsPlusPct}%`} col={C.purple} />
                            <Stat label="$/hr" val={`$${hi.avgHourlyWage}`} col={C.green} />
                          </div>
                          <div style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: "monospace" }}>~{hi.workers} workers</div>
                        </div>
                        <div style={{ padding: 16, borderRadius: 12, background: `${C.cyan}08`, border: `1px solid ${C.cyan}22` }}>
                          <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 12 }}>
                            🟢 Low Exposure
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                            <Stat label="Age" val={lo.avgAge} col={C.text} />
                            <Stat label="Female" val={`${lo.femalePct}%`} col={C.pink} />
                            <Stat label="BA+" val={`${lo.bachelorsPlusPct}%`} col={C.purple} />
                            <Stat label="$/hr" val={`$${lo.avgHourlyWage}`} col={C.green} />
                          </div>
                          <div style={{ fontSize: 10, color: C.dim, marginTop: 8, fontFamily: "monospace" }}>~{lo.workers} workers</div>
                        </div>
                      </div>
                    </Card>
                  )}
                </div>

                {/* Hiring Trends */}
                <Card>
                  <Label>Hiring Trends</Label>
                  <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                    {[
                      { ic: "📉", l: "Overall", t: lm.hiringTrends?.overallTrend },
                      { ic: "🤖", l: "Post-AI Shift", t: lm.hiringTrends?.postAIHiringShift },
                    ].map((it, i) => (
                      <div key={i} style={{
                        flex: "1 1 260px", padding: "16px 18px", borderRadius: 12,
                        background: "#0f172a", border: `1px solid ${C.border}`,
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                          <span style={{ fontSize: 18 }}>{it.ic}</span>
                          <span style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", fontFamily: "monospace" }}>{it.l}</span>
                        </div>
                        <div style={{ fontSize: 14, lineHeight: 1.6 }}>{it.t}</div>
                      </div>
                    ))}
                  </div>
                </Card>

                {/* Insights + Risk */}
                <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
                  <Card style={{ flex: "1 1 380px" }}>
                    <Label>Key Insights</Label>
                    {(lm.keyInsights || []).map((ins, i) => (
                      <div key={i} style={{
                        display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10,
                        background: "#0f172a", border: `1px solid ${C.border}`, marginBottom: 10,
                      }}>
                        <span style={{ fontSize: 18, flexShrink: 0 }}>{["💡", "⚡", "🔮"][i % 3]}</span>
                        <span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{ins}</span>
                      </div>
                    ))}
                  </Card>

                  <Card style={{ flex: "1 1 280px" }}>
                    <Label>Risk Assessment</Label>
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>
                        Vulnerable Roles
                      </div>
                      {(lm.riskAssessment?.mostVulnerableRoles || []).map((r, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 0", borderBottom: i < 2 ? `1px solid ${C.border}22` : "none",
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.red }} />
                          <span style={{ fontSize: 13 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: C.dim, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 6 }}>
                        Resilient Roles
                      </div>
                      {(lm.riskAssessment?.mostResilientRoles || []).map((r, i) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 8,
                          padding: "8px 0", borderBottom: i < 2 ? `1px solid ${C.border}22` : "none",
                        }}>
                          <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
                          <span style={{ fontSize: 13 }}>{r}</span>
                        </div>
                      ))}
                    </div>
                  </Card>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ EMPTY STATE ═══ */}
        {!has && !loading && (
          <div style={{ textAlign: "center", padding: "80px 20px" }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>🔍</div>
            <div style={{ fontSize: 18, fontWeight: 600, color: C.muted }}>Select an industry to begin</div>
            <div style={{ fontSize: 14, color: C.dim, marginTop: 8 }}>
              AI research · Competitive intel · KPIs · Labor market impact
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
