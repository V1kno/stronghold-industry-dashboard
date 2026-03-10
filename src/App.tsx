import { useState, useRef, useEffect } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis, ScatterChart, Scatter
} from "recharts";

/* ═══ PALETTE ═══ */
const C = {
  bg: "#060b18", card: "#0d1425", border: "#1a2744",
  accent: "#f59e0b", text: "#f1f5f9", muted: "#94a3b8", dim: "#64748b",
  blue: "#3b82f6", purple: "#a78bfa", cyan: "#06b6d4",
  green: "#22c55e", red: "#ef4444", orange: "#f97316", pink: "#ec4899",
  gold: "#fbbf24", teal: "#14b8a6",
};
const BCOL = ["#3b82f6","#a78bfa","#06b6d4","#f59e0b","#22c55e","#ef4444","#f97316","#ec4899","#14b8a6","#8b5cf6"];
const PCOL = ["#ef4444","#f59e0b","#22c55e","#06b6d4"];
const PRESETS = ["Managed Services (MSP)","Cybersecurity","Cloud Computing","Healthcare IT","Financial Services","Legal Tech","Manufacturing","Retail & E-Commerce"];

/* ═══ COMPONENTS ═══ */
const Card = ({ children, style, glow }: { children: any; style?: any; glow?: string }) => (
  <div style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 16, padding: 24, ...(glow ? { boxShadow: `0 0 30px ${glow}15` } : {}), ...style }}>{children}</div>
);
const SLabel = ({ children, color }: { children: any; color?: string }) => (
  <div style={{ fontSize: 11, fontWeight: 700, color: color || C.dim, textTransform: "uppercase", letterSpacing: "0.14em", marginBottom: 14, fontFamily: "monospace" }}>{children}</div>
);
const Metric = ({ label, value, sub, color = C.accent, source }: { label: string; value: any; sub?: string; color?: string; source?: string }) => (
  <div style={{ flex: "1 1 150px", padding: "18px 16px", borderRadius: 14, background: `${color}06`, border: `1px solid ${color}20`, textAlign: "center", position: "relative" }}>
    <div style={{ fontSize: 9, textTransform: "uppercase", color: C.dim, fontFamily: "monospace", letterSpacing: "0.1em" }}>{label}</div>
    <div style={{ fontSize: 28, fontWeight: 800, color, marginTop: 4, fontFamily: "monospace" }}>{value}</div>
    {sub && <div style={{ fontSize: 10, color: C.dim, marginTop: 2 }}>{sub}</div>}
    {source && <div style={{ fontSize: 8, color: `${C.green}88`, marginTop: 4, fontFamily: "monospace" }}>📡 {source}</div>}
  </div>
);
const Badge = ({ level }: { level: string }) => {
  const c = level === "High" || level === "Critical" ? C.red : level === "Medium" ? C.accent : C.green;
  return <span style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, background: `${c}18`, color: c, textTransform: "uppercase", fontFamily: "monospace" }}>{level}</span>;
};
const SourceTag = ({ text }: { text: string }) => (
  <span style={{ fontSize: 9, padding: "2px 8px", borderRadius: 4, background: `${C.green}10`, color: `${C.green}aa`, fontFamily: "monospace", border: `1px solid ${C.green}20` }}>📡 {text}</span>
);

/* ═══ JSON PARSER ═══ */
function parseJSON(text: string) {
  let s = text.replace(/```json\s*/gi, "").replace(/```/g, "").trim();
  s = s.replace(/<\/?antml:cite[^>]*>/g, "").replace(/<\/?cite[^>]*>/g, "");
  try { return JSON.parse(s); } catch {}
  let depth = 0, start = -1;
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "{") { if (depth === 0) start = i; depth++; } else if (s[i] === "}") { depth--; if (depth === 0 && start >= 0) { try { return JSON.parse(s.slice(start, i + 1)); } catch {} } }
  }
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { let r = m[0].replace(/,\s*([}\]])/g, "$1"); try { return JSON.parse(r); } catch {} }
  throw new Error("Could not parse JSON");
}

/* ═══ API HELPERS ═══ */
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function fetchLiveData(industry: string) {
  try {
    const resp = await fetch("/api/data", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ industry }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch { return null; }
}

async function aiCall(prompt: string) {
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const resp = await fetch("/api/claude", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 4096, messages: [{ role: "user", content: prompt }] }),
      });
      if (!resp.ok) {
        if (resp.status === 429 && attempt === 0) { await sleep(60000); continue; }
        const err = await resp.json().catch(() => ({}));
        throw new Error(err?.error?.message || `HTTP ${resp.status}`);
      }
      const data = await resp.json();
      let text = (data.content || []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("\n");
      text = text.replace(/<\/?antml:cite[^>]*>/g, "").replace(/<\/?cite[^>]*>/g, "");
      return parseJSON(text);
    } catch (e) {
      if (attempt === 0) { await sleep(3000); continue; }
      throw e;
    }
  }
}

/* ═══ BUILD CONTEXT FROM LIVE DATA ═══ */
function buildDataContext(live: any) {
  if (!live || !live.dataAvailable) return "No live data available.";
  const parts: string[] = [];
  if (live.employment) {
    parts.push(`BLS Employment: ${live.employment.countFormatted} workers (as of ${live.employment.asOf}, series ${live.employment.seriesId})`);
  }
  if (live.employmentGrowthPct !== null) {
    parts.push(`Employment YoY Growth: ${live.employmentGrowthPct}%`);
  }
  if (live.wages) {
    parts.push(`BLS Avg Hourly Wage: $${live.wages.avgHourly}/hr ($${live.wages.avgAnnualFormatted}/yr, series ${live.wages.seriesId})`);
  }
  if (live.macro?.gdpGrowthPct) parts.push(`GDP Growth: ${live.macro.gdpGrowthPct}%`);
  if (live.macro?.unemploymentPct) parts.push(`Unemployment: ${live.macro.unemploymentPct}%`);
  if (live.macro?.inflationPct) parts.push(`Inflation (CPI YoY): ${live.macro.inflationPct}%`);
  if (live.macro?.laborProductivityGrowth) parts.push(`Labor Productivity Growth: ${live.macro.laborProductivityGrowth}%`);
  return parts.join(". ");
}

/* ═══ FETCHERS (use real data as context for Claude) ═══ */
const fetchOverview = (ind: string, dataCtx: string) => aiCall(
  `Analyze "${ind}" industry using this REAL government data: ${dataCtx}
Return ONLY valid JSON. Use the real BLS/FRED numbers provided above - do NOT make up employment or wage figures:
{"industryName":"str","marketSize":"str","growthRate":"str","aiAdoptionRate":0,"summary":"str(2 sent referencing the real data)","aiReadinessScore":0,"disruptionRisk":"Low|Medium|High|Critical","aiMaturityDistribution":{"Early":0,"Growing":0,"Mature":0,"Leading":0},"aiAdoptionBySegment":[{"segment":"str","adoptionRate":0,"maturity":"str"}],"topAIUseCases":[{"useCase":"str","impactScore":0,"adoptionLevel":"Low|Medium|High","description":"str"}],"marketTrends":[{"trend":"str","impact":"High|Medium|Low","timeframe":"str","description":"str"}]}
5 segments, 5 use cases, 4 trends. Short strings.`);

const fetchCompetitive = (ind: string, dataCtx: string) => aiCall(
  `Competitive landscape of "${ind}" with context: ${dataCtx}
Return ONLY valid JSON:
{"competitors":[{"name":"str","marketSharePct":0,"aiInvestmentScore":0,"strengths":["str"],"weaknesses":["str"],"aiStrategy":"str","hq":"str"}],"kpis":[{"name":"str","industryAvg":"str","topQuartile":"str","unit":"str","trend":"up|down|stable","description":"str"}],"competitiveInsight":"str(2 sent)"}
6 real competitors, 5 KPIs. Short strings.`);

const fetchLabor = (ind: string, dataCtx: string) => aiCall(
  `Analyze "${ind}" labor market using this REAL data: ${dataCtx}
Return ONLY valid JSON. Reference the actual BLS wage and employment data above:
{"topExposedOccupations":[{"occupation":"str","observedExposure":0,"theoreticalExposure":0,"leadingTask":"str","blsGrowthPct":0}],"exposureByCategory":[{"category":"str","theoretical":0,"observed":0}],"workforceDemographics":{"highExposure":{"avgAge":0,"femalePct":0,"bachelorsPlusPct":0,"avgHourlyWage":0,"workers":"str"},"lowExposure":{"avgAge":0,"femalePct":0,"bachelorsPlusPct":0,"avgHourlyWage":0,"workers":"str"}},"hiringTrends":{"youngWorkerImpactPct":0,"overallTrend":"str","postAIHiringShift":"str","projectedGrowth2034":"str"},"keyInsights":["str","str","str"],"riskAssessment":{"automationRiskLevel":"Low|Medium|High|Critical","timelineToImpact":"str","mostVulnerableRoles":["str","str","str"],"mostResilientRoles":["str","str","str"]}}
6 occupations, 6 categories. Use real BLS wage data for demographics. Short strings.`);

/* ═══ REPORT GENERATOR ═══ */
function genReport(ov: any, cp: any, lm: any, ind: string, live: any) {
  const liveSection = live?.dataAvailable ? `
    <h2>📡 Live Government Data</h2>
    <div style="padding:16px;background:#f0fdf4;border:1px solid #86efac;border-radius:12px;margin-bottom:16px">
      <div style="font-size:11px;font-weight:700;color:#166534;text-transform:uppercase;margin-bottom:8px">Bureau of Labor Statistics + Federal Reserve</div>
      <table style="width:100%;border-collapse:collapse">
        ${live.employment ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">Employment</td><td style="padding:6px 0;text-align:right;font-family:monospace">${live.employment.countFormatted} workers</td></tr>` : ''}
        ${live.employmentGrowthPct !== null ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">Employment Growth (YoY)</td><td style="padding:6px 0;text-align:right;font-family:monospace;color:${live.employmentGrowthPct >= 0 ? '#16a34a' : '#dc2626'}">${live.employmentGrowthPct > 0 ? '+' : ''}${live.employmentGrowthPct}%</td></tr>` : ''}
        ${live.wages ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">Avg Hourly Wage</td><td style="padding:6px 0;text-align:right;font-family:monospace">$${live.wages.avgHourly}/hr (${live.wages.avgAnnualFormatted}/yr)</td></tr>` : ''}
        ${live.macro?.gdpGrowthPct ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">GDP Growth</td><td style="padding:6px 0;text-align:right;font-family:monospace">${live.macro.gdpGrowthPct}%</td></tr>` : ''}
        ${live.macro?.unemploymentPct ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">Unemployment Rate</td><td style="padding:6px 0;text-align:right;font-family:monospace">${live.macro.unemploymentPct}%</td></tr>` : ''}
        ${live.macro?.inflationPct ? `<tr><td style="padding:6px 0;color:#334155;font-weight:600">Inflation (CPI YoY)</td><td style="padding:6px 0;text-align:right;font-family:monospace">${live.macro.inflationPct}%</td></tr>` : ''}
      </table>
      <div style="font-size:10px;color:#64748b;margin-top:8px">Data as of ${live.timestamp?.split('T')[0] || 'latest available'} · Sources: api.bls.gov, api.stlouisfed.org</div>
    </div>` : '';

  const seg = (ov?.aiAdoptionBySegment||[]).map((s: any)=>`<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${s.segment}</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:center">${s.adoptionRate}%</td><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0">${s.maturity}</td></tr>`).join("");
  const comp = (cp?.competitors||[]).map((c: any)=>`<tr><td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;font-weight:600">${c.name}</td><td style="padding:8px 12px;text-align:center">${c.marketSharePct}%</td><td style="padding:8px 12px;text-align:center">${c.aiInvestmentScore}/10</td><td style="padding:8px 12px;font-size:12px;color:#64748b">${c.aiStrategy}</td></tr>`).join("");

  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>${ind} Industry Report | Stronghold Data</title>
<style>body{font-family:-apple-system,sans-serif;margin:0;padding:40px;background:#fff;color:#0f172a;max-width:900px;margin:0 auto}h1{font-size:28px}h2{font-size:18px;margin:28px 0 12px;border-bottom:2px solid #f59e0b;padding-bottom:6px}table{width:100%;border-collapse:collapse;margin:10px 0}th{text-align:left;padding:8px 12px;background:#f8fafc;font-size:11px;text-transform:uppercase;color:#64748b}.m{display:flex;gap:14px;margin:16px 0;flex-wrap:wrap}.mb{flex:1;padding:18px;border-radius:12px;text-align:center;min-width:120px}.ml{font-size:10px;text-transform:uppercase;color:#64748b}.mv{font-size:32px;font-weight:800;margin-top:4px}</style></head><body>
<div style="text-align:center;padding:30px 0;border-bottom:3px solid #f59e0b;margin-bottom:24px">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.2em;color:#f59e0b;font-weight:700">Stronghold Data</div>
  <h1 style="margin:8px 0 4px">${ov?.industryName||ind} Industry Report</h1>
  <p style="color:#64748b;margin:0">${new Date().toLocaleDateString("en-US",{year:"numeric",month:"long",day:"numeric"})} · Enriched with live government data</p>
</div>
<p style="max-width:700px;line-height:1.7;font-size:15px">${ov?.summary||""}</p>
<div class="m">
  <div class="mb" style="background:#eff6ff;border:1px solid #93c5fd"><div class="ml">Market Size</div><div class="mv" style="color:#2563eb">${ov?.marketSize||"—"}</div></div>
  <div class="mb" style="background:#fefce8;border:1px solid #fcd34d"><div class="ml">AI Adoption</div><div class="mv" style="color:#d97706">${ov?.aiAdoptionRate||0}%</div></div>
  <div class="mb" style="background:#f0fdf4;border:1px solid #86efac"><div class="ml">Growth</div><div class="mv" style="color:#16a34a">${ov?.growthRate||"—"}</div></div>
</div>
${liveSection}
<h2>AI Adoption by Segment</h2><table><thead><tr><th>Segment</th><th>Rate</th><th>Maturity</th></tr></thead><tbody>${seg}</tbody></table>
<h2>Competitive Landscape</h2><p>${cp?.competitiveInsight||""}</p><table><thead><tr><th>Company</th><th>Share</th><th>AI</th><th>Strategy</th></tr></thead><tbody>${comp}</tbody></table>
<div style="margin-top:40px;border-top:2px solid #e2e8f0;padding-top:16px;text-align:center;color:#94a3b8;font-size:12px">Built by <strong>Avion Bryant</strong> · CTO of Stronghold Data<br><span style="font-size:10px">Government data sourced from BLS (api.bls.gov) and FRED (api.stlouisfed.org)</span></div></body></html>`;
}

function dl(c: string, f: string, t: string) { const b = new Blob([c], { type: t }), u = URL.createObjectURL(b), a = document.createElement("a"); a.href = u; a.download = f; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(u); }

/* ══════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════ */
export default function Dashboard() {
  const [ind, setInd] = useState("");
  const [loading, setLoading] = useState(false);
  const [phase, setPhase] = useState("");
  const [elapsed, setElapsed] = useState(0);
  const [live, setLive] = useState<any>(null);
  const [ov, setOv] = useState<any>(null);
  const [cp, setCp] = useState<any>(null);
  const [lm, setLm] = useState<any>(null);
  const [err, setErr] = useState("");
  const [tab, setTab] = useState("overview");
  const [exp, setExp] = useState(false);
  const timerRef = useRef<any>(null);
  const resRef = useRef<any>(null);

  useEffect(() => { return () => { if (timerRef.current) clearInterval(timerRef.current); }; }, []);

  const run = async () => {
    if (!ind.trim()) return;
    setErr(""); setLive(null); setOv(null); setCp(null); setLm(null);
    setLoading(true); setTab("overview"); setElapsed(0);
    timerRef.current = setInterval(() => setElapsed(p => p + 1), 1000);
    const errs: string[] = [];

    // Phase 0: Fetch LIVE data (no tokens used!)
    setPhase("📡 Fetching live BLS & FRED data...");
    let liveData: any = null;
    try {
      liveData = await fetchLiveData(ind.trim());
      setLive(liveData);
    } catch (e: any) { /* non-fatal */ }

    const dataCtx = buildDataContext(liveData);

    // Phase 1: Industry Overview (with real data context)
    try {
      setPhase("① Industry overview (enriched with live data)...");
      const o = await fetchOverview(ind.trim(), dataCtx);
      setOv(o);
    } catch (e: any) { errs.push("Overview: " + e.message); }

    setPhase("⏳ Rate limit cooldown..."); await sleep(45000);

    // Phase 2: Competitive
    try {
      setPhase("② Competitive landscape & KPIs...");
      const c = await fetchCompetitive(ind.trim(), dataCtx);
      setCp(c);
    } catch (e: any) { errs.push("Competitive: " + e.message); }

    setPhase("⏳ Rate limit cooldown..."); await sleep(45000);

    // Phase 3: Labor
    try {
      setPhase("③ Labor market impact (using BLS wage data)...");
      const l = await fetchLabor(ind.trim(), dataCtx);
      setLm(l);
    } catch (e: any) { errs.push("Labor: " + e.message); }

    if (errs.length) setErr(errs.join(" | "));
    clearInterval(timerRef.current); timerRef.current = null;
    setLoading(false); setPhase("");
    setTimeout(() => resRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  };

  const has = ov || cp || lm;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  const matD = ov?.aiMaturityDistribution ? Object.entries(ov.aiMaturityDistribution).map(([n, v]) => ({ name: n, value: v as number })) : [];
  const segD = (ov?.aiAdoptionBySegment || []).map((s: any, i: number) => ({ ...s, fill: BCOL[i % BCOL.length] }));
  const scatD = (cp?.competitors || []).map((c: any, i: number) => ({ ...c, x: c.marketSharePct, y: c.aiInvestmentScore, fill: BCOL[i % BCOL.length] }));
  const occD = (lm?.topExposedOccupations || []).map((o: any) => ({ ...o, nm: o.occupation.length > 22 ? o.occupation.slice(0, 20) + "…" : o.occupation }));
  const lmRad = (lm?.exposureByCategory || []).map((c: any) => ({ cat: c.category.length > 15 ? c.category.slice(0, 13) + "…" : c.category, theoretical: c.theoretical, observed: c.observed }));
  const hi = lm?.workforceDemographics?.highExposure;
  const lo = lm?.workforceDemographics?.lowExposure;

  const TABS = [
    { id: "overview", icon: "📊", l: "Overview", need: ov },
    { id: "livedata", icon: "📡", l: "Live Data", need: live?.dataAvailable },
    { id: "adoption", icon: "🤖", l: "AI Adoption", need: ov },
    { id: "competitive", icon: "🎯", l: "Competitive", need: cp },
    { id: "kpis", icon: "📈", l: "KPIs", need: cp },
    { id: "labor", icon: "👥", l: "Labor Market", need: lm },
  ];

  const exportActions = [
    { l: "Preview Report", i: "👁", fn: () => { const w = window.open("", "_blank"); if (w) { w.document.write(genReport(ov, cp, lm, ind, live)); w.document.close(); } setExp(false); } },
    { l: "Download HTML", i: "📄", fn: () => { dl(genReport(ov, cp, lm, ind, live), `${ind.replace(/\s+/g, "_")}_Report.html`, "text/html"); setExp(false); } },
  ];

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "-apple-system, sans-serif", paddingBottom: 80 }}>
      <style>{`@keyframes fu{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}@keyframes sp{to{transform:rotate(360deg)}}@keyframes pu{0%,100%{opacity:1}50%{opacity:.5}}`}</style>

      {/* HEADER */}
      <div style={{ background: "linear-gradient(135deg, #060b18 0%, #0a1a0f 40%, #0f1a2e 70%, #060b18 100%)", borderBottom: `1px solid ${C.border}`, padding: "40px 32px 36px" }}>
        <div style={{ maxWidth: 1200, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 6 }}>
            <div style={{ width: 10, height: 10, borderRadius: "50%", background: C.green, boxShadow: `0 0 14px ${C.green}` }} />
            <span style={{ fontSize: 11, fontFamily: "monospace", color: C.green, letterSpacing: "0.15em", textTransform: "uppercase" }}>Live Data · Industry Intelligence Engine</span>
          </div>
          <h1 style={{ fontSize: 42, fontWeight: 800, margin: 0, lineHeight: 1.1, background: "linear-gradient(135deg, #f1f5f9 0%, #22c55e 50%, #06b6d4 100%)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Industry Dashboard</h1>
          <p style={{ color: C.muted, fontSize: 15, marginTop: 10, maxWidth: 700 }}>
            AI adoption, competitive landscape, KPIs, and labor market — enriched with <span style={{ color: C.green, fontWeight: 700 }}>live BLS & FRED data</span>.
          </p>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 14, paddingTop: 14, borderTop: `1px solid ${C.border}`, flexWrap: "wrap" }}>
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: C.green }} />
            <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace" }}>Built by <span style={{ color: C.text, fontWeight: 700 }}>Avion Bryant</span> · <span style={{ color: C.gold }}>CTO of Stronghold Data</span></span>
            <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
              <SourceTag text="BLS" /><SourceTag text="FRED" /><SourceTag text="Claude AI" />
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>
        {/* INPUT */}
        <Card style={{ marginBottom: 24 }}>
          <SLabel color={C.green}>① Select or Enter an Industry</SLabel>
          <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
            {PRESETS.map(p => <button key={p} onClick={() => setInd(p)} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600, cursor: "pointer", border: ind === p ? `1px solid ${C.green}` : `1px solid ${C.border}`, background: ind === p ? `${C.green}15` : "transparent", color: ind === p ? C.green : C.muted }}>{p}</button>)}
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <input value={ind} onChange={e => setInd(e.target.value)} placeholder="Or type any industry..." onKeyDown={e => e.key === "Enter" && !loading && run()}
              style={{ flex: 1, padding: "14px 18px", borderRadius: 12, border: `1px solid ${C.border}`, background: "#0a1020", color: C.text, fontSize: 15, outline: "none" }} />
            <button onClick={run} disabled={loading || !ind.trim()} style={{
              padding: "14px 32px", borderRadius: 12, border: "none", fontSize: 15, fontWeight: 700,
              cursor: loading ? "wait" : "pointer",
              background: loading ? C.border : `linear-gradient(135deg, ${C.green}, ${C.teal})`,
              color: loading ? C.dim : "#fff",
            }}>{loading ? "Analyzing..." : "📡 Analyze with Live Data"}</button>
          </div>

          {loading && <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ width: 16, height: 16, border: `2px solid ${C.green}`, borderTopColor: "transparent", borderRadius: "50%", animation: "sp 0.8s linear infinite" }} />
              <span style={{ fontSize: 13, color: C.green, fontFamily: "monospace", animation: "pu 1.5s ease-in-out infinite" }}>{phase}</span>
              <span style={{ fontSize: 12, color: C.dim, fontFamily: "monospace", marginLeft: "auto" }}>{fmt(elapsed)}</span>
            </div>
          </div>}
          {err && <div style={{ marginTop: 14, padding: "12px 16px", borderRadius: 10, background: `${C.orange}12`, border: `1px solid ${C.orange}33`, color: C.orange, fontSize: 12 }}>{err}</div>}
        </Card>

        {/* RESULTS */}
        {has && <div ref={resRef} style={{ animation: "fu 0.5s ease-out" }}>
          {/* Tabs + Export */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", gap: 4, overflowX: "auto" }}>
              {TABS.map(t => <button key={t.id} onClick={() => t.need && setTab(t.id)} style={{ padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600, cursor: t.need ? "pointer" : "default", whiteSpace: "nowrap", border: tab === t.id ? `1px solid ${t.id === "livedata" ? C.green : C.cyan}` : `1px solid ${C.border}`, background: tab === t.id ? `${t.id === "livedata" ? C.green : C.cyan}15` : "transparent", color: !t.need ? C.border : tab === t.id ? (t.id === "livedata" ? C.green : C.cyan) : C.muted, opacity: t.need ? 1 : 0.4 }}>{t.icon} {t.l}</button>)}
            </div>
            <div style={{ position: "relative" }}>
              <button onClick={() => setExp(!exp)} style={{ padding: "8px 20px", borderRadius: 10, border: "none", background: `linear-gradient(135deg, ${C.gold}, #d97706)`, color: "#0a0e1a", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>↗ Export</button>
              {exp && <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, padding: 6, zIndex: 100, minWidth: 200, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                {exportActions.map(o => <button key={o.l} onClick={o.fn} style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "10px 14px", borderRadius: 8, border: "none", background: "transparent", color: C.text, cursor: "pointer", fontSize: 13 }} onMouseEnter={e => (e.currentTarget.style.background = "#1a2744")} onMouseLeave={e => (e.currentTarget.style.background = "transparent")}><span>{o.i}</span><span style={{ fontWeight: 600 }}>{o.l}</span></button>)}
              </div>}
            </div>
          </div>

          {/* ═══ OVERVIEW ═══ */}
          {tab === "overview" && ov && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Metric label="Market Size" value={ov.marketSize} color={C.blue} />
              <Metric label="AI Adoption" value={`${ov.aiAdoptionRate}%`} color={C.cyan} />
              <Metric label="Growth" value={ov.growthRate} color={C.green} />
              <Metric label="AI Readiness" value={`${ov.aiReadinessScore}/100`} color={C.purple} />
              <Metric label="Disruption" value={ov.disruptionRisk} color={ov.disruptionRisk === "Critical" ? C.red : ov.disruptionRisk === "High" ? C.orange : C.accent} />
            </div>
            {live?.dataAvailable && <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {live.employment && <Metric label="Employment" value={live.employment.countFormatted} sub={`as of ${live.employment.asOf}`} color={C.green} source="BLS" />}
              {live.wages && <Metric label="Avg Wage" value={`$${live.wages.avgHourly}/hr`} sub={live.wages.avgAnnualFormatted + "/yr"} color={C.teal} source="BLS" />}
              {live.employmentGrowthPct !== null && <Metric label="Job Growth YoY" value={`${live.employmentGrowthPct > 0 ? '+' : ''}${live.employmentGrowthPct}%`} color={live.employmentGrowthPct >= 0 ? C.green : C.red} source="BLS" />}
              {live.macro?.unemploymentPct && <Metric label="Unemployment" value={`${live.macro.unemploymentPct}%`} color={C.orange} source="FRED" />}
            </div>}
            <Card><SLabel>Executive Summary</SLabel><p style={{ fontSize: 15, lineHeight: 1.7, color: C.muted, margin: 0 }}>{ov.summary}</p>{cp?.competitiveInsight && <p style={{ fontSize: 14, lineHeight: 1.7, color: C.dim, margin: "12px 0 0", paddingTop: 12, borderTop: `1px solid ${C.border}` }}>{cp.competitiveInsight}</p>}</Card>
            <Card><SLabel>Market Trends</SLabel><div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {(ov.marketTrends || []).map((t: any, i: number) => <div key={i} style={{ display: "flex", gap: 14, padding: "14px 16px", borderRadius: 12, background: "#0a1020", border: `1px solid ${C.border}`, alignItems: "flex-start" }}><Badge level={t.impact} /><div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600 }}>{t.trend}</div><div style={{ fontSize: 12, color: C.dim, marginTop: 4 }}>{t.description}</div></div><span style={{ fontSize: 11, color: C.dim, fontFamily: "monospace", whiteSpace: "nowrap" }}>{t.timeframe}</span></div>)}
            </div></Card>
          </div>}

          {/* ═══ LIVE DATA TAB ═══ */}
          {tab === "livedata" && live?.dataAvailable && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 18px", borderRadius: 12, background: `${C.green}08`, border: `1px solid ${C.green}22` }}>
              <span style={{ fontSize: 18 }}>📡</span>
              <span style={{ fontSize: 13, color: C.muted }}>Real-time data from <span style={{ color: C.green, fontWeight: 700 }}>Bureau of Labor Statistics</span> and <span style={{ color: C.green, fontWeight: 700 }}>Federal Reserve (FRED)</span></span>
            </div>

            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {live.employment && <Metric label="Total Employment" value={live.employment.countFormatted} sub={`Series: ${live.employment.seriesId}`} color={C.green} source="BLS" />}
              {live.wages && <Metric label="Avg Hourly Wage" value={`$${live.wages.avgHourly}`} sub={`${live.wages.avgAnnualFormatted}/yr`} color={C.teal} source="BLS" />}
              {live.employmentGrowthPct !== null && <Metric label="Employment Growth" value={`${live.employmentGrowthPct > 0 ? '+' : ''}${live.employmentGrowthPct}%`} sub="Year-over-year" color={live.employmentGrowthPct >= 0 ? C.green : C.red} source="BLS" />}
            </div>

            {(live.macro && Object.keys(live.macro).length > 0) && <>
              <SLabel color={C.cyan}>Macroeconomic Indicators (FRED)</SLabel>
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                {live.macro.gdpGrowthPct !== undefined && <Metric label="GDP Growth" value={`${live.macro.gdpGrowthPct}%`} color={C.blue} source="FRED" />}
                {live.macro.unemploymentPct !== undefined && <Metric label="Unemployment" value={`${live.macro.unemploymentPct}%`} color={C.orange} source="FRED" />}
                {live.macro.inflationPct !== undefined && <Metric label="Inflation (CPI)" value={`${live.macro.inflationPct}%`} color={C.red} source="FRED" />}
                {live.macro.laborProductivityGrowth !== undefined && <Metric label="Labor Productivity" value={`${live.macro.laborProductivityGrowth}%`} color={C.purple} source="FRED" />}
              </div>
            </>}

            <Card>
              <SLabel>Data Sources & Methodology</SLabel>
              <div style={{ fontSize: 13, color: C.muted, lineHeight: 1.8 }}>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ color: C.green }}>Bureau of Labor Statistics (BLS)</strong> — Current Employment Statistics (CES) program. Employment and wage data are sourced from the monthly establishment survey covering ~144,000 businesses and government agencies.
                </div>
                <div style={{ marginBottom: 10 }}>
                  <strong style={{ color: C.green }}>Federal Reserve Economic Data (FRED)</strong> — Maintained by the Federal Reserve Bank of St. Louis. Macroeconomic indicators including GDP, unemployment, CPI, and labor productivity.
                </div>
                <div style={{ padding: "10px 14px", borderRadius: 8, background: "#0a1020", border: `1px solid ${C.border}`, fontSize: 11, color: C.dim, fontFamily: "monospace" }}>
                  APIs: api.bls.gov/publicAPI/v2 · api.stlouisfed.org/fred<br />
                  Fetched: {live.timestamp?.split("T")[0] || "latest"} · Industry: {live.industry}
                </div>
              </div>
            </Card>
          </div>}

          {/* ═══ AI ADOPTION ═══ */}
          {tab === "adoption" && ov && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Card style={{ flex: "2 1 400px" }}><SLabel>AI Adoption by Segment</SLabel>
                <ResponsiveContainer width="100%" height={300}><BarChart data={segD} layout="vertical" margin={{ left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} /><YAxis type="category" dataKey="segment" width={130} tick={{ fill: C.muted, fontSize: 11 }} /><Tooltip contentStyle={{ background: "#1a2744", border: `1px solid ${C.border}`, borderRadius: 10 }} />
                  <Bar dataKey="adoptionRate" name="Adoption %" radius={[0, 6, 6, 0]} barSize={22}>{segD.map((s: any, i: number) => <Cell key={i} fill={s.fill} />)}</Bar>
                </BarChart></ResponsiveContainer>
              </Card>
              <Card style={{ flex: "1 1 260px" }}><SLabel>Maturity Distribution</SLabel>
                <ResponsiveContainer width="100%" height={300}><PieChart><Pie data={matD} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="value" label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}>{matD.map((_: any, i: number) => <Cell key={i} fill={PCOL[i]} />)}</Pie><Tooltip /></PieChart></ResponsiveContainer>
              </Card>
            </div>
            <Card><SLabel>Top AI Use Cases</SLabel>
              <div style={{ display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center" }}>
                <div style={{ flex: "1 1 340px" }}>
                  <ResponsiveContainer width="100%" height={280}><RadarChart data={(ov.topAIUseCases || []).map((u: any) => ({ uc: u.useCase.length > 16 ? u.useCase.slice(0, 14) + "…" : u.useCase, impact: u.impactScore }))}>
                    <PolarGrid stroke={C.border} /><PolarAngleAxis dataKey="uc" tick={{ fill: C.dim, fontSize: 10 }} /><PolarRadiusAxis domain={[0, 10]} tick={{ fill: C.dim, fontSize: 9 }} />
                    <Radar name="Impact" dataKey="impact" stroke={C.green} fill={C.green} fillOpacity={0.2} />
                  </RadarChart></ResponsiveContainer>
                </div>
                <div style={{ flex: "1 1 280px" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}><thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Use Case","Impact","Adoption"].map(h => <th key={h} style={{ textAlign: "left", padding: 8, color: C.dim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: "monospace" }}>{h}</th>)}</tr></thead><tbody>{(ov.topAIUseCases || []).map((u: any, i: number) => <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}><td style={{ padding: "10px 8px", fontWeight: 500, maxWidth: 200 }}>{u.useCase}</td><td style={{ padding: "10px 8px" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 48, height: 6, borderRadius: 3, background: "#1a2744", overflow: "hidden" }}><div style={{ width: `${u.impactScore * 10}%`, height: "100%", borderRadius: 3, background: C.green }} /></div><span style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{u.impactScore}/10</span></div></td><td style={{ padding: "10px 8px" }}><Badge level={u.adoptionLevel} /></td></tr>)}</tbody></table>
                </div>
              </div>
            </Card>
          </div>}

          {/* ═══ COMPETITIVE ═══ */}
          {tab === "competitive" && cp && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <Card><SLabel>Market Share vs AI Investment</SLabel>
              <ResponsiveContainer width="100%" height={360}><ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke={C.border} /><XAxis type="number" dataKey="x" tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} /><YAxis type="number" dataKey="y" domain={[0, 10]} tick={{ fill: C.dim, fontSize: 11 }} />
                <Tooltip content={({ active, payload }: any) => { if (!active || !payload?.length) return null; const d = payload[0]?.payload; return <div style={{ background: "#1a2744", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12 }}><div style={{ fontWeight: 700, color: C.text }}>{d.name}</div><div style={{ color: C.muted }}>Share: {d.marketSharePct}% · AI: {d.aiInvestmentScore}/10</div></div>; }} />
                <Scatter data={scatD} shape={({ cx, cy, payload }: any) => <g><circle cx={cx} cy={cy} r={Math.max(8, payload.marketSharePct * 1.2)} fill={payload.fill} fillOpacity={0.3} stroke={payload.fill} strokeWidth={2} /><text x={cx} y={cy - Math.max(10, payload.marketSharePct * 1.2) - 6} textAnchor="middle" fill={C.muted} fontSize={10}>{payload.name}</text></g>} />
              </ScatterChart></ResponsiveContainer>
            </Card>
            <Card style={{ overflowX: "auto" }}><SLabel>Competitor Profiles</SLabel>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13, minWidth: 700 }}><thead><tr style={{ borderBottom: `1px solid ${C.border}` }}>{["Company","Share","AI","Strengths","Weakness","Strategy"].map(h => <th key={h} style={{ textAlign: "left", padding: "10px 8px", color: C.dim, fontWeight: 600, fontSize: 10, textTransform: "uppercase", fontFamily: "monospace" }}>{h}</th>)}</tr></thead><tbody>{(cp.competitors || []).map((c: any, i: number) => <tr key={i} style={{ borderBottom: `1px solid ${C.border}22` }}><td style={{ padding: "12px 8px" }}><div style={{ fontWeight: 600 }}>{c.name}</div>{c.hq && <div style={{ fontSize: 11, color: C.dim }}>{c.hq}</div>}</td><td style={{ padding: "12px 8px", fontFamily: "monospace", color: C.cyan }}>{c.marketSharePct}%</td><td style={{ padding: "12px 8px" }}><div style={{ display: "flex", alignItems: "center", gap: 6 }}><div style={{ width: 48, height: 6, borderRadius: 3, background: "#1a2744", overflow: "hidden" }}><div style={{ width: `${c.aiInvestmentScore * 10}%`, height: "100%", borderRadius: 3, background: C.gold }} /></div><span style={{ color: C.muted, fontFamily: "monospace", fontSize: 11 }}>{c.aiInvestmentScore}/10</span></div></td><td style={{ padding: "12px 8px", fontSize: 12, color: C.green, maxWidth: 160 }}>{(c.strengths || []).join(", ")}</td><td style={{ padding: "12px 8px", fontSize: 12, color: C.red, maxWidth: 130 }}>{(c.weaknesses || []).join(", ")}</td><td style={{ padding: "12px 8px", fontSize: 12, color: C.dim, maxWidth: 180 }}>{c.aiStrategy}</td></tr>)}</tbody></table>
            </Card>
          </div>}

          {/* ═══ KPIs ═══ */}
          {tab === "kpis" && cp && <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 14 }}>
            {(cp.kpis || []).map((k: any, i: number) => <Card key={i} style={{ padding: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}><div style={{ fontSize: 14, fontWeight: 700, maxWidth: "80%" }}>{k.name}</div><span style={{ color: k.trend === "up" ? C.green : k.trend === "down" ? C.red : C.accent, fontWeight: 700, fontFamily: "monospace" }}>{k.trend === "up" ? "↑" : k.trend === "down" ? "↓" : "→"}</span></div>
              <div style={{ display: "flex", gap: 16, marginBottom: 10 }}><div><div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>Avg</div><div style={{ fontSize: 22, fontWeight: 800, color: C.muted, fontFamily: "monospace" }}>{k.industryAvg}</div></div><div style={{ width: 1, background: C.border }} /><div><div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>Top</div><div style={{ fontSize: 22, fontWeight: 800, color: C.green, fontFamily: "monospace" }}>{k.topQuartile}</div></div></div>
              <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5 }}>{k.description}</div>
            </Card>)}
          </div>}

          {/* ═══ LABOR MARKET ═══ */}
          {tab === "labor" && lm && <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 18px", borderRadius: 12, background: `${C.green}08`, border: `1px solid ${C.green}22` }}>
              <span style={{ fontSize: 16 }}>📡</span>
              <span style={{ fontSize: 12, color: C.muted }}>Labor analysis enriched with <span style={{ color: C.green, fontWeight: 700 }}>BLS employment & wage data</span>{live?.wages ? ` (avg $${live.wages.avgHourly}/hr in ${ind})` : ""}</span>
            </div>
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              <Metric label="Automation Risk" value={lm.riskAssessment?.automationRiskLevel || "—"} color={lm.riskAssessment?.automationRiskLevel === "Critical" ? C.red : lm.riskAssessment?.automationRiskLevel === "High" ? C.orange : C.accent} />
              <Metric label="Timeline" value={lm.riskAssessment?.timelineToImpact || "—"} color={C.purple} />
              <Metric label="Young Worker Δ" value={`${lm.hiringTrends?.youngWorkerImpactPct || 0}%`} sub="Job finding rate" color={C.red} />
              <Metric label="Growth 2034" value={lm.hiringTrends?.projectedGrowth2034 || "—"} sub="BLS projection" color={C.green} source="BLS" />
            </div>
            <Card><SLabel>Top Exposed Occupations</SLabel>
              <ResponsiveContainer width="100%" height={Math.max(260, occD.length * 42)}>
                <BarChart data={occD} layout="vertical" margin={{ left: 30, right: 30 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={C.border} horizontal={false} /><XAxis type="number" domain={[0, 100]} tick={{ fill: C.dim, fontSize: 11 }} tickFormatter={(v: number) => `${v}%`} /><YAxis type="category" dataKey="nm" width={155} tick={{ fill: C.muted, fontSize: 11 }} />
                  <Tooltip content={({ active, payload }: any) => { if (!active || !payload?.length) return null; const d = payload[0]?.payload; return <div style={{ background: "#1a2744", border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px", fontSize: 12, maxWidth: 300 }}><div style={{ fontWeight: 700, color: C.text, marginBottom: 6 }}>{d.occupation}</div><div style={{ color: C.pink }}>Observed: {d.observedExposure}%</div><div style={{ color: C.blue }}>Theoretical: {d.theoreticalExposure}%</div><div style={{ color: C.dim, fontSize: 11, marginTop: 4 }}>{d.leadingTask}</div></div>; }} />
                  <Bar dataKey="theoreticalExposure" name="Theoretical" fill={C.blue} fillOpacity={0.3} radius={[0, 6, 6, 0]} barSize={14} />
                  <Bar dataKey="observedExposure" name="Observed" fill={C.pink} radius={[0, 6, 6, 0]} barSize={14} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap" }}>
              <Card style={{ flex: "1 1 400px" }}><SLabel>Exposure by Category</SLabel>
                <ResponsiveContainer width="100%" height={300}><RadarChart data={lmRad}><PolarGrid stroke={C.border} /><PolarAngleAxis dataKey="cat" tick={{ fill: C.dim, fontSize: 9 }} /><PolarRadiusAxis domain={[0, 100]} tick={{ fill: C.dim, fontSize: 9 }} /><Radar name="Theoretical" dataKey="theoretical" stroke={C.blue} fill={C.blue} fillOpacity={0.15} /><Radar name="Observed" dataKey="observed" stroke={C.pink} fill={C.pink} fillOpacity={0.25} /></RadarChart></ResponsiveContainer>
              </Card>
              {hi && lo && <Card style={{ flex: "1 1 320px" }}><SLabel>Demographics: High vs Low Exposure</SLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                  <div style={{ padding: 16, borderRadius: 12, background: `${C.pink}08`, border: `1px solid ${C.pink}22` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.pink, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>🔴 High Exposure</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{[{ l: "Age", v: hi.avgAge }, { l: "Female", v: `${hi.femalePct}%` }, { l: "BA+", v: `${hi.bachelorsPlusPct}%` }, { l: "$/hr", v: `$${hi.avgHourlyWage}` }].map(s => <div key={s.l} style={{ textAlign: "center", flex: "1 1 60px" }}><div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>{s.l}</div><div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "monospace", marginTop: 2 }}>{s.v}</div></div>)}</div>
                  </div>
                  <div style={{ padding: 16, borderRadius: 12, background: `${C.cyan}08`, border: `1px solid ${C.cyan}22` }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.cyan, textTransform: "uppercase", fontFamily: "monospace", marginBottom: 10 }}>🟢 Low Exposure</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{[{ l: "Age", v: lo.avgAge }, { l: "Female", v: `${lo.femalePct}%` }, { l: "BA+", v: `${lo.bachelorsPlusPct}%` }, { l: "$/hr", v: `$${lo.avgHourlyWage}` }].map(s => <div key={s.l} style={{ textAlign: "center", flex: "1 1 60px" }}><div style={{ fontSize: 10, color: C.dim, textTransform: "uppercase", fontFamily: "monospace" }}>{s.l}</div><div style={{ fontSize: 18, fontWeight: 800, color: C.text, fontFamily: "monospace", marginTop: 2 }}>{s.v}</div></div>)}</div>
                  </div>
                </div>
              </Card>}
            </div>
            <Card><SLabel>Key Insights</SLabel>{(lm.keyInsights || []).map((ins: string, i: number) => <div key={i} style={{ display: "flex", gap: 12, padding: "12px 14px", borderRadius: 10, background: "#0a1020", border: `1px solid ${C.border}`, marginBottom: 10 }}><span style={{ fontSize: 18, flexShrink: 0 }}>{["💡","⚡","🔮"][i % 3]}</span><span style={{ fontSize: 13, color: C.muted, lineHeight: 1.6 }}>{ins}</span></div>)}</Card>
          </div>}
        </div>}

        {/* Empty */}
        {!has && !loading && <div style={{ textAlign: "center", padding: "80px 20px" }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>📡</div>
          <div style={{ fontSize: 20, fontWeight: 700, color: C.muted }}>Select an industry to begin</div>
          <div style={{ fontSize: 14, color: C.dim, marginTop: 8 }}>Live BLS & FRED data · AI analysis · Competitive intel · Labor market</div>
        </div>}
      </div>
    </div>
  );
}
