import { useState } from "react";
import type { Overview, FeedbackData, RepSummary, AutoRule } from "../types";
import { repAutoPosts, repDelayLabel, lerpHex } from "../utils";
import { REP_DATA } from "../data";
import { RIconStarF, RIconArrow, RIconClock, IconSpark, RepStars } from "./atoms";

const FUNNEL_GRAY = "#A99C8C";
const FUNNEL_GOLD = "#C49A3C";

// ── Health ring ──────────────────────────────────────────────────
function RepHealthCard({ score, of, label, delta, note }: { score: number; of: number; label: string; delta: string; note: string }) {
  const pct = score / of;
  const R = 30, C = 2 * Math.PI * R;
  return (
    <div className="neu-raised" style={{ padding: 20, borderRadius: "var(--r-card)", position: "relative", overflow: "hidden", flex: "1.4 1 230px", minWidth: 0 }}>
      <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--wine-grad)" }} />
      <div className="eyebrow eyebrow-sm">Reputation health</div>
      <div style={{ display: "flex", alignItems: "center", gap: 18, marginTop: 14 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 46, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>{score}</span>
            <span style={{ fontSize: 15, color: "var(--mute)" }}>/ {of}</span>
          </div>
          <div style={{ fontFamily: "var(--serif)", fontSize: 21, color: "var(--wine)", lineHeight: 1, marginTop: 8 }}>{label}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginTop: 9, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: "var(--good)" }}>↑ {delta}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{note}</span>
          </div>
        </div>
        <div style={{ position: "relative", width: 84, height: 84, flexShrink: 0 }}>
          <svg width="84" height="84" viewBox="0 0 84 84">
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--bg)" strokeWidth="8" />
            <circle cx="42" cy="42" r={R} fill="none" stroke="var(--wine)" strokeWidth="8" strokeLinecap="round"
              strokeDasharray={`${C * pct} ${C}`} transform="rotate(-90 42 42)" />
          </svg>
        </div>
      </div>
    </div>
  );
}

// ── KPI metric card ──────────────────────────────────────────────
function RepMetricCard({ label, value, suffix, delta, deltaTone = "good", note, accent, stars }: { label: string; value: string; suffix?: string; delta?: string; deltaTone?: "good" | "mute"; note?: string; accent?: string; stars?: number }) {
  return (
    <div className="neu-raised" style={{ padding: 20, borderRadius: "var(--r-card)", position: "relative", overflow: "hidden", flex: "1 1 160px", minWidth: 0 }}>
      {accent && <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: accent }} />}
      <div className="eyebrow eyebrow-sm" style={{ whiteSpace: "nowrap" }}>{label}</div>
      <div style={{ display: "flex", alignItems: "baseline", gap: 6, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 42, lineHeight: 1, color: "var(--ink)", letterSpacing: "-0.02em" }}>{value}</span>
        {suffix && <span style={{ fontSize: 15, color: "var(--mute)" }}>{suffix}</span>}
      </div>
      {stars != null && <div style={{ marginTop: 8 }}><RepStars rating={Math.round(stars)} size={13} /></div>}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
        {delta && <span style={{ fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, color: deltaTone === "good" ? "var(--good)" : "var(--mute)" }}>{delta}</span>}
        <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.06em", color: "var(--mute-2)", textTransform: "uppercase", whiteSpace: "nowrap" }}>{note}</span>
      </div>
    </div>
  );
}

// ── Dual-axis rating chart ───────────────────────────────────────
function RepRatingChart({ series }: { series: Overview["ratingSeries"] }) {
  const [range, setRange] = useState<"week" | "month" | "quarter">("quarter");
  const s = series[range];
  const RANGES = [{ k: "week" as const, l: "1W" }, { k: "month" as const, l: "1M" }, { k: "quarter" as const, l: "3M" }];
  const rMin = 3.5, rMax = 5.0;
  const volMax = Math.max(4, Math.ceil(Math.max(...s.volume) * 1.15 / 5) * 5);
  const padT = 8, padB = 10, plotH = 100 - padT - padB;
  const yR = (v: number) => padT + (1 - (v - rMin) / (rMax - rMin)) * plotH;
  const yVbase = 100 - padB;
  const barH = (v: number) => (v / volMax) * plotH;
  const n = s.rating.length;
  const xAt = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100);
  const line = s.rating.map((v, i) => `${i === 0 ? "M" : "L"}${xAt(i).toFixed(2)},${yR(v).toFixed(2)}`).join(" ");
  const area = line + ` L100,${yVbase} L0,${yVbase} Z`;
  const lastY = yR(s.rating[n - 1]);
  const ratingTicks = [5.0, 4.5, 4.0, 3.5];
  const negs = s.negatives ?? [];
  const negY = yR(3.6);
  const sub = 1.2, gap = 0.55;

  return (
    <div className="neu-raised" style={{ flex: "2 1 460px", minWidth: 0, borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 14 }}>
        <div className="eyebrow eyebrow-sm">Rating over time</div>
        <div className="la-seg">
          {RANGES.map((r) => <button key={r.k} onClick={() => setRange(r.k)} className={`la-seg-btn${range === r.k ? " on" : ""}`}>{r.l}</button>)}
        </div>
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}><span style={{ width: 14, height: 2, background: "var(--wine)", borderRadius: 2 }} />Avg rating</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}><span style={{ width: 9, height: 9, background: "var(--line-strong)", opacity: 0.45, borderRadius: 1 }} />Review volume</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--mute)" }}><span style={{ width: 8, height: 8, background: "var(--wine)", borderRadius: "50%" }} />Negative reviews</span>
      </div>
      <div style={{ display: "flex", alignItems: "stretch", gap: 8 }}>
        <div style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", height: 188, paddingTop: padT * 1.88 - 6, paddingBottom: padB * 1.88, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)" }}>
          <span style={{ position: "absolute", top: -5, left: -1, color: "var(--wine)", display: "flex" }}><RIconStarF size={11} /></span>
          {ratingTicks.map((t) => <span key={t}>{t.toFixed(1)}</span>)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ position: "relative", width: "100%", height: 188 }}>
            <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
              {ratingTicks.map((t) => <line key={t} x1="0" y1={yR(t)} x2="100" y2={yR(t)} stroke="var(--line)" strokeWidth="0.4" vectorEffect="non-scaling-stroke" />)}
              {s.volume.map((v, i) => {
                const cx = xAt(i);
                const h = barH(v), h2 = barH(v) * 0.72;
                const left = cx - (sub + gap / 2);
                return (
                  <g key={i}>
                    <rect x={left} y={yVbase - h} width={sub} height={h} fill="var(--line-strong)" opacity="0.42" rx="0.4" />
                    <rect x={left + sub + gap} y={yVbase - h2} width={sub} height={h2} fill="var(--line-strong)" opacity="0.3" rx="0.4" />
                  </g>
                );
              })}
              <path d={area} fill="var(--wine-tint)" />
              <path d={line} fill="none" stroke="var(--wine)" strokeWidth="1.4" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {negs.map((i) => (
              <span key={"neg" + i} style={{ position: "absolute", left: `${xAt(i)}%`, top: `${negY}%`, width: 8, height: 8, borderRadius: "50%", background: "var(--wine)", border: "1.5px solid var(--card)", transform: "translate(-50%, -50%)", boxShadow: "var(--sh-raised-crisp)" }} />
            ))}
            <div style={{ position: "absolute", top: `${lastY}%`, right: 0, transform: "translate(2px, -50%)", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--paper)", background: "var(--wine)", borderRadius: "var(--r-flush)", padding: "2px 7px", boxShadow: "var(--sh-raised-crisp)" }}>{s.now.toFixed(1)}</div>
            <div style={{ position: "absolute", bottom: 14, left: "50%", transform: "translateX(-50%)", display: "inline-flex", alignItems: "center", gap: 5, background: "var(--good-tint)", borderRadius: "var(--r-pill)", padding: "3px 10px", fontFamily: "var(--mono)", fontSize: 9.5, fontWeight: 700, color: "var(--good)", letterSpacing: "0.02em", whiteSpace: "nowrap" }}>↑ {s.annotation}</div>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", height: 188, paddingTop: padT * 1.88 - 6, paddingBottom: padB * 1.88, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", textAlign: "right" }}>
          <span>{volMax}</span><span>{Math.round(volMax * 2 / 3)}</span><span>{Math.round(volMax / 3)}</span><span>0</span>
        </div>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, marginLeft: 28, marginRight: 24, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", letterSpacing: "0.08em" }}>
        {s.axis.map((a, i) => <span key={i}>{a}</span>)}
      </div>
    </div>
  );
}

// ── Auto-handled card (auto mode audit) ──────────────────────────
function RepAutoHandledCard({ count, median, audit, threshold, delay }: { count: number; median: string; audit: { id: string; name: string; rating: number; when: string; by: string }[]; threshold: number | "never"; delay: string }) {
  return (
    <div className="neu-raised" style={{ flex: "1 1 320px", minWidth: 0, borderRadius: "var(--r-card)", background: "var(--wine-grad)", color: "var(--paper)", overflow: "hidden", padding: "22px 24px", display: "flex", flexDirection: "column" }}>
      <span style={{ display: "inline-flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}><IconSpark size={13} />Auto-handled this period</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 9 }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 58, lineHeight: 0.9, color: "var(--paper)", letterSpacing: "-0.02em" }}>{count}</span>
          <span style={{ fontFamily: "var(--serif)", fontSize: 21, color: "rgba(255,255,255,0.92)", lineHeight: 1.05 }}>replies posted</span>
        </div>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", borderRadius: "var(--r-pill)", padding: "5px 12px" }}>
          <RIconClock size={13} /><span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--paper)" }}>{median}</span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.82)" }}>median</span>
        </span>
      </div>
      <div style={{ marginTop: 8, fontSize: 12, color: "rgba(255,255,255,0.78)" }}>{threshold}★+ reviews answered automatically after {repDelayLabel(delay)}.</div>
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.16)", display: "flex", flexDirection: "column", gap: 10, flex: 1 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Audit log · recently posted</span>
        {audit.map((a) => (
          <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ display: "inline-flex", gap: 1 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ display: "flex", color: i <= a.rating ? "#E8C97A" : "rgba(255,255,255,0.25)" }}><RIconStarF size={10} /></span>)}</span>
            <span style={{ fontSize: 12.5, color: "rgba(255,255,255,0.94)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1, minWidth: 0 }}>{a.name}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: a.by === "AI" ? "#B4E8C6" : "rgba(255,255,255,0.6)" }}>{a.by === "AI" ? "AI" : a.by.split(" ")[0]}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "rgba(255,255,255,0.55)", whiteSpace: "nowrap" }}>{a.when}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Attention card (manual mode) ─────────────────────────────────
function RepAttentionCard({ S, latest, autoMode, onOpenQueue }: { S: RepSummary; latest: typeof REP_DATA.latestWaiting; autoMode: boolean; onOpenQueue: () => void }) {
  const count = autoMode ? S.negNeeds : S.needsReply;
  const heading = autoMode ? "reviews held for you" : "reviews awaiting reply";
  return (
    <div className="neu-raised" style={{ flex: "1 1 320px", minWidth: 0, borderRadius: "var(--r-card)", background: "var(--wine-grad)", color: "var(--paper)", overflow: "hidden", padding: "22px 24px", display: "flex", flexDirection: "column" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.2em", textTransform: "uppercase", color: "rgba(255,255,255,0.72)" }}>Needs your attention</span>
      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 12 }}>
        <span style={{ fontFamily: "var(--serif)", fontSize: 58, lineHeight: 0.9, color: "var(--paper)", letterSpacing: "-0.02em" }}>{count}</span>
        <span style={{ fontFamily: "var(--serif)", fontSize: 22, color: "rgba(255,255,255,0.92)", lineHeight: 1.05 }}>{heading}</span>
      </div>
      {!autoMode && (
        <div style={{ display: "flex", gap: 8, marginTop: 16, flexWrap: "wrap" }}>
          {[{ n: S.negNeeds, l: "negative", d: "#E8B4B4" }, { n: S.neuNeeds, l: "neutral", d: "#E8D7B4" }, { n: S.posNeeds, l: "positive", d: "#B4E8C6" }].map((b) => (
            <span key={b.l} style={{ display: "inline-flex", alignItems: "center", gap: 7, background: "rgba(255,255,255,0.12)", borderRadius: "var(--r-pill)", padding: "5px 12px" }}>
              <span style={{ width: 7, height: 7, borderRadius: "50%", background: b.d }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--paper)" }}>{b.n}</span>
              <span style={{ fontSize: 11, color: "rgba(255,255,255,0.82)" }}>{b.l}</span>
            </span>
          ))}
        </div>
      )}
      {autoMode && (
        <div style={{ display: "inline-flex", alignSelf: "flex-start", alignItems: "center", gap: 8, marginTop: 14, background: "rgba(255,255,255,0.12)", borderRadius: "var(--r-pill)", padding: "6px 13px" }}>
          <IconSpark size={13} /><span style={{ fontSize: 11.5, color: "rgba(255,255,255,0.9)" }}>Positives auto-replied — only negatives held</span>
        </div>
      )}
      <div style={{ marginTop: 18, paddingTop: 16, borderTop: "1px solid rgba(255,255,255,0.16)", display: "flex", flexDirection: "column", gap: 14, flex: 1 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.16em", textTransform: "uppercase", color: "rgba(255,255,255,0.6)" }}>Latest waiting</span>
        {latest.map((w) => (
          <div key={w.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 15, lineHeight: 1.4, color: "rgba(255,255,255,0.94)", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" } as React.CSSProperties}>"{w.text}"</p>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ display: "inline-flex", gap: 2 }}>{[1, 2, 3, 4, 5].map((i) => <span key={i} style={{ display: "flex", color: i <= w.rating ? "#E8C97A" : "rgba(255,255,255,0.25)" }}><RIconStarF size={11} /></span>)}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "rgba(255,255,255,0.6)" }}>{w.ago} ago</span>
            </div>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 18 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 12, color: "rgba(255,255,255,0.82)" }}><RIconClock size={14} />Oldest: <strong style={{ color: "var(--paper)" }}>{S.oldestDays}d</strong></span>
        <button onClick={onOpenQueue} style={{ marginLeft: "auto", border: "none", cursor: "pointer", background: "var(--paper)", color: "var(--wine)", padding: "11px 18px", borderRadius: "var(--r-button)", fontFamily: "var(--mono)", fontSize: 10, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 8, boxShadow: "var(--sh-raised-crisp)", whiteSpace: "nowrap" }}>Review queue <RIconArrow size={13} /></button>
      </div>
    </div>
  );
}

// ── Sentiment donut ──────────────────────────────────────────────
function RepSentimentPie({ sentiment }: { sentiment: Overview["sentiment"] }) {
  const p = sentiment.positive, nu = sentiment.neutral;
  const grad = `conic-gradient(var(--good) 0 ${p}%, var(--mute-2) ${p}% ${p + nu}%, var(--wine) ${p + nu}% 100%)`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
      <div style={{ position: "relative", width: 116, height: 116, flexShrink: 0 }}>
        <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: grad, boxShadow: "var(--sh-raised-crisp)" }} />
        <div style={{ position: "absolute", inset: 24, borderRadius: "50%", background: "var(--card)", boxShadow: "var(--sh-inset-crisp)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <span style={{ fontFamily: "var(--serif)", fontSize: 25, lineHeight: 1, color: "var(--wine)" }}>{sentiment.positive}%</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 7.5, letterSpacing: "0.1em", textTransform: "uppercase", color: "var(--mute-2)", marginTop: 2 }}>positive</span>
        </div>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 11, flex: 1, minWidth: 0 }}>
        {[{ key: "positive", label: "Positive", value: sentiment.positive, color: "var(--good)" }, { key: "neutral", label: "Neutral", value: sentiment.neutral, color: "var(--mute-2)" }, { key: "negative", label: "Negative", value: sentiment.negative, color: "var(--wine)" }].map((s) => (
          <div key={s.key} style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.color, flexShrink: 0 }} />
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)", flex: 1 }}>{s.label}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, fontWeight: 700, color: "var(--ink)" }}>{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Distribution bars ────────────────────────────────────────────
function RepDistribution({ rows }: { rows: Overview["distribution"] }) {
  const maxC = Math.max(...rows.map((r) => r.count));
  const total = rows.reduce((a, r) => a + r.count, 0);
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
      {rows.map((r) => {
        const color = r.stars >= 4 ? "var(--good)" : r.stars === 3 ? "var(--warn)" : "var(--wine)";
        return (
          <div key={r.stars} style={{ display: "flex", alignItems: "center", gap: 11 }}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, width: 30, flexShrink: 0, fontFamily: "var(--mono)", fontSize: 11, color: "var(--ink-soft)" }}>
              {r.stars}<span style={{ display: "flex", color }}><RIconStarF size={11} /></span>
            </span>
            <div style={{ flex: 1, height: 8, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
              <div style={{ width: `${(r.count / maxC) * 100}%`, height: "100%", background: color, borderRadius: "var(--r-pill)" }} />
            </div>
            <span style={{ width: 58, textAlign: "right", fontFamily: "var(--mono)", fontSize: 11, color: "var(--mute)" }}>{r.count} ({Math.round((r.count / total) * 100)}%)</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Generation funnel ────────────────────────────────────────────
function RepGenerationFunnel({ steps, referral }: { steps: FeedbackData["funnel"]; referral: FeedbackData["referralAskRate"] }) {
  const max = steps[0].value;
  const n = steps.length;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {steps.map((s, idx) => {
        const gold = lerpHex(FUNNEL_GRAY, FUNNEL_GOLD, n === 1 ? 1 : idx / (n - 1));
        const w = (s.value / max) * 100;
        const posShare = s.pos != null ? s.pos / s.value : 1;
        return (
          <div key={s.key}>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 5, gap: 10 }}>
              <span style={{ fontSize: 12, color: "var(--ink-soft)" }}>{s.label}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, fontWeight: 700, color: "var(--ink)" }}>
                {s.pos != null ? (
                  <><span style={{ color: gold }}>{s.pos}</span><span style={{ color: "var(--mute-2)" }}> + </span><span style={{ color: "var(--wine)" }}>{s.neg}</span></>
                ) : s.value}
              </span>
            </div>
            <div style={{ display: "flex", width: `${w}%`, minWidth: 44, height: 16, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
              {s.pos != null ? (
                <>
                  <div style={{ width: `${posShare * 100}%`, height: "100%", background: gold }} />
                  <div style={{ width: `${(1 - posShare) * 100}%`, height: "100%", background: "var(--wine)" }} />
                </>
              ) : (
                <div style={{ width: "100%", height: "100%", background: s.combo ? `linear-gradient(90deg, ${gold}, var(--wine))` : gold }} />
              )}
            </div>
            {s.note && <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.04em", color: "var(--mute-2)", marginTop: 4, textTransform: "uppercase" }}>{s.note}</div>}
          </div>
        );
      })}
      {referral && (
        <div style={{ marginTop: 2, paddingTop: 13, borderTop: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: "var(--ink-soft)" }}>Referral asks</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 8.5, letterSpacing: "0.04em", color: "var(--mute-2)", marginTop: 2, textTransform: "uppercase" }}>{referral.note}</div>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 3 }}>
            <span style={{ fontFamily: "var(--serif)", fontSize: 27, lineHeight: 1, color: "var(--wine)" }}>{referral.pct}</span>
            <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--mute)" }}>%</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Panel shell ──────────────────────────────────────────────────
function RepPanel({ title, right, children, flex, minWidth = 0 }: { title: string; right?: React.ReactNode; children: React.ReactNode; flex?: string; minWidth?: number }) {
  return (
    <div className="neu-raised" style={{ flex, minWidth, borderRadius: "var(--r-card)", background: "var(--card)", padding: "20px 22px", display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 16, gap: 12 }}>
        <div className="eyebrow eyebrow-sm">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

// ── Analytics tab ────────────────────────────────────────────────
export function RepAnalytics({ autoMode, auto, onOpenQueue }: { autoMode: boolean; auto: AutoRule; onOpenQueue: () => void }) {
  const O = REP_DATA.overview;
  const F = REP_DATA.feedback;
  const S = REP_DATA.summary;
  const latest = REP_DATA.latestWaiting;
  const m = O.metrics;

  const autoPostedNeeds = autoMode ? REP_DATA.reviews.filter((r) => r.status === "needs" && repAutoPosts(r, auto)) : [];
  const repliedHist = REP_DATA.reviews.filter((r) => r.status === "replied");
  const audit = [
    ...autoPostedNeeds.map((r) => ({ id: r.id, name: r.name, rating: r.rating, when: repDelayLabel(auto.delay) + " after", by: "AI" })),
    ...repliedHist.map((r) => ({ id: r.id, name: r.name, rating: r.rating, when: r.reply!.ago + " ago", by: r.reply!.by === "auto" ? "AI" : r.reply!.by })),
  ].slice(0, 6);
  const handledCount = autoPostedNeeds.length + repliedHist.length;

  const replyRate = autoMode ? { value: "100", delta: "+12%", note: "fully automated" } : m.replyRate;
  const medianReply = autoMode ? { value: "20", suffix: "min", delta: "steady", note: "auto-posted" } : m.medianReply;

  return (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 24, background: "var(--bg)" }}>
      <div style={{ maxWidth: 1240, margin: "0 auto", display: "flex", flexDirection: "column", gap: 20 }}>
        {autoMode && (
          <div style={{ display: "flex", alignItems: "center", gap: 11, background: "var(--wine-tint)", borderRadius: "var(--r-surface)", padding: "11px 16px" }}>
            <span style={{ display: "flex", color: "var(--wine)" }}><IconSpark size={16} /></span>
            <span style={{ fontSize: 12.5, color: "var(--ink-soft)" }}><strong>Oversight view</strong> — in automatic mode this dashboard is an audit report, not a to-do list. Replies post for you; reply rate and response speed reflect the hands-free service.</span>
          </div>
        )}

        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", alignItems: "stretch" }}>
          <RepMetricCard label="Avg rating" value={m.avgRating.value} delta={`↑ ${m.avgRating.delta}`} note={m.avgRating.note} stars={4.6} accent="var(--good)" />
          <RepMetricCard label="Median reply" value={medianReply.value} suffix={medianReply.suffix} delta={medianReply.delta} note={medianReply.note} accent="var(--wine)" />
          <RepMetricCard label="Reply rate" value={replyRate.value} suffix="%" delta={`↑ ${replyRate.delta}`} note={replyRate.note} accent="var(--good)" />
          <RepMetricCard label="New this month" value={m.thisMonth.value} delta={`↑ ${m.thisMonth.delta}`} note={m.thisMonth.note} accent="var(--mute-2)" />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
          {autoMode
            ? <RepAutoHandledCard count={handledCount} median={`${medianReply.value} ${medianReply.suffix ?? "min"}`} audit={audit} threshold={auto.threshold} delay={auto.delay} />
            : <RepAttentionCard S={S} latest={latest} autoMode={autoMode} onOpenQueue={onOpenQueue} />}
          <RepRatingChart series={O.ratingSeries} />
        </div>

        <div style={{ display: "flex", gap: 20, flexWrap: "wrap", alignItems: "stretch" }}>
          <RepPanel flex="1 1 320px" title="Review generation funnel"
            right={<span style={{ display: "inline-flex", alignItems: "center", gap: 10, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute)" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: "#C49A3C" }} />Positive</span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><span style={{ width: 7, height: 7, borderRadius: 2, background: "var(--wine)" }} />Negative</span>
            </span>}>
            <RepGenerationFunnel steps={F.funnel} referral={F.referralAskRate} />
          </RepPanel>

          <RepPanel flex="1 1 340px" title="Sentiment & distribution" right={<span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{S.count} total</span>}>
            <RepSentimentPie sentiment={O.sentiment} />
            <div style={{ margin: "18px 0", height: 1, background: "var(--line)" }} />
            <RepDistribution rows={O.distribution} />
          </RepPanel>
        </div>
      </div>
    </div>
  );
}
