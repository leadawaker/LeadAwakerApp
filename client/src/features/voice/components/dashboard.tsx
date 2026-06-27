import { useState } from "react";
import { PhoneMissed, CheckCircle2, TrendingUp, CalendarCheck, ArrowRight } from "lucide-react";
import { VOICE_DASH, VOICE_RECENT_RECOVERIES } from "../data";
import { VoiceAvatar, VoiceStatusPill, MonoLabel } from "./atoms";

// ── KPI metric card (serif number, corner icon, delta line) ──────────
function MetricCard({ label, value, suffix, delta, dir, note, accent, Icon }: {
  label: string; value: string; suffix?: string; delta: string; dir: "up" | "down"; note: string; accent: string; Icon: React.FC<{ size?: number }>;
}) {
  const deltaColor = dir === "up" ? "var(--good)" : "var(--wine)";
  return (
    <div className="neu-raised" style={{ padding: 20, borderRadius: "var(--r-card)", position: "relative", overflow: "hidden", flex: "1 1 180px", minWidth: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div className="eyebrow eyebrow-sm" style={{ whiteSpace: "nowrap" }}>{label}</div>
        <span style={{ width: 28, height: 28, flexShrink: 0, borderRadius: "var(--r-button)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: accent }}>
          <Icon size={14} />
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 5, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 42, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>{value}</span>
        {suffix && <span style={{ fontSize: 18, color: "var(--mute)", fontFamily: "var(--serif)" }}>{suffix}</span>}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 10, flexWrap: "wrap" }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: deltaColor }}>{dir === "up" ? "↑" : "↓"} {delta}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{note}</span>
      </div>
    </div>
  );
}

// ── Smooth path helper (Catmull-Rom → cubic bezier) ──────────────────
function smoothPath(pts: [number, number][]): string {
  if (pts.length < 2) return pts.length ? `M${pts[0][0]},${pts[0][1]}` : "";
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

// ── Calls vs Recovered area chart ────────────────────────────────────
function CallsChart() {
  const [grain, setGrain] = useState<"daily" | "weekly">("daily");
  const s = grain === "daily" ? VOICE_DASH.daily : VOICE_DASH.weekly;
  const max = Math.max(...s.missed) * 1.15;
  const padT = 6, padB = 6, plotH = 100 - padT - padB;
  const n = s.missed.length;
  const xAt = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const yAt = (v: number) => padT + (1 - v / max) * plotH;
  const base = 100 - padB;

  const mkPts = (arr: number[]) => arr.map((v, i) => [xAt(i), yAt(v)] as [number, number]);
  const missedLine = smoothPath(mkPts(s.missed));
  const recovLine = smoothPath(mkPts(s.recovered));
  const areaOf = (line: string) => `${line} L100,${base} L0,${base} Z`;

  return (
    <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div className="eyebrow eyebrow-sm">Calls vs Recovered</div>
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}><span style={{ width: 14, height: 2, background: "var(--mute-2)", borderRadius: 2 }} />Missed calls</span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}><span style={{ width: 14, height: 2, background: "var(--wine)", borderRadius: 2 }} />Recovered</span>
          </span>
          <div className="la-seg">
            {(["daily", "weekly"] as const).map((g) => (
              <button key={g} onClick={() => setGrain(g)} className={`la-seg-btn${grain === g ? " on" : ""}`} style={{ textTransform: "capitalize" }}>{g}</button>
            ))}
          </div>
        </div>
      </div>
      <div style={{ position: "relative", width: "100%", height: 196 }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
          {[0.25, 0.5, 0.75, 1].map((t) => <line key={t} x1="0" y1={padT + plotH * (1 - t)} x2="100" y2={padT + plotH * (1 - t)} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
          <path d={areaOf(missedLine)} fill="var(--line-strong)" opacity="0.16" />
          <path d={areaOf(recovLine)} fill="var(--wine-tint)" />
          <path d={missedLine} fill="none" stroke="var(--mute-2)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
          <path d={recovLine} fill="none" stroke="var(--wine)" strokeWidth="1.6" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.06em" }}>
        {s.axis.map((a, i) => <span key={i}>{a}</span>)}
      </div>
    </div>
  );
}

// ── Recovery funnel (horizontal wine bars) ───────────────────────────
function RecoveryFunnel() {
  const steps = VOICE_DASH.funnel;
  const max = steps[0].value;
  return (
    <div className="neu-raised" style={{ flex: "1 1 320px", minWidth: 0, borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 16 }}>Recovery funnel</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        {steps.map((s, idx) => {
          const w = (s.value / max) * 100;
          // Deepen the wine as the funnel narrows.
          const shade = 0.55 + (idx / (steps.length - 1)) * 0.45;
          return (
            <div key={s.key}>
              <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5, gap: 10 }}>
                <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}>{s.label}</span>
                <span style={{ fontFamily: "var(--mono)", fontSize: 11.5, fontWeight: 700, color: "var(--ink)" }}>
                  {s.value}{s.pct != null && <span style={{ color: "var(--mute-2)", fontWeight: 600 }}> · {s.pct}%</span>}
                </span>
              </div>
              <div style={{ height: 18, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
                <div style={{ width: `${w}%`, minWidth: 36, height: "100%", borderRadius: "var(--r-pill)", background: "var(--wine)", opacity: shade }} />
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--line)" }}>
        <MonoLabel>% shown = conversion from the previous step</MonoLabel>
      </div>
    </div>
  );
}

// ── Recent recoveries list ───────────────────────────────────────────
function RecentRecoveries() {
  return (
    <div className="neu-raised" style={{ flex: "1 1 320px", minWidth: 0, borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div className="eyebrow eyebrow-sm" style={{ marginBottom: 12 }}>Recent recoveries</div>
      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
        {VOICE_RECENT_RECOVERIES.map((c, i) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 0", borderTop: i === 0 ? "none" : "1px solid var(--line)" }}>
            <VoiceAvatar ini={c.ini} size={34} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 15, color: "var(--ink)", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name ?? c.phone}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)", letterSpacing: "0.04em", marginTop: 2 }}>{c.phone}</div>
            </div>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)", whiteSpace: "nowrap" }}>{c.ago}</span>
            <VoiceStatusPill status={c.status} small />
          </div>
        ))}
      </div>
      <button className="la-btn la-btn--soft" style={{ marginTop: 14, alignSelf: "flex-start" }}>
        View all recoveries <ArrowRight size={13} />
      </button>
    </div>
  );
}

// ── Dashboard tab ────────────────────────────────────────────────────
export function VoiceDashboard() {
  const k = VOICE_DASH.kpis;
  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, background: "var(--bg)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <MetricCard label="Missed calls" value={k.missed.value} delta={k.missed.delta} dir={k.missed.dir} note="vs previous 30 days" accent="var(--mute-2)" Icon={PhoneMissed} />
          <MetricCard label="Recovered" value={k.recovered.value} delta={k.recovered.delta} dir={k.recovered.dir} note="vs previous 30 days" accent="var(--good)" Icon={CheckCircle2} />
          <MetricCard label="Recovery rate" value={k.rate.value} suffix={k.rate.suffix} delta={k.rate.delta} dir={k.rate.dir} note="vs previous 30 days" accent="var(--wine)" Icon={TrendingUp} />
          <MetricCard label="Bookings" value={k.bookings.value} delta={k.bookings.delta} dir={k.bookings.dir} note="vs previous 30 days" accent="var(--good)" Icon={CalendarCheck} />
        </div>

        <CallsChart />

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
          <RecoveryFunnel />
          <RecentRecoveries />
        </div>
      </div>
    </div>
  );
}
