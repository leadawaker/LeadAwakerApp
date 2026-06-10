// Pipeline panel — traditional donut + stage bars + Lead Heat strip.
// Ported from the Claude design (PipelineDonut / PipelineBars / HeatStrip).
// Flat surface (no card chrome), real data from the campaign's leads.
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { PanelShell, SectionHead } from "../panelPrimitives";
import { pipelineFromLeads, heatFromLeads, type PipeStage } from "./utils";

// ── Donut ──────────────────────────────────────────────────────────────────────
function Donut({ total, stages, size = 150, thickness = 20, hovered, onHover }: {
  total: number; stages: PipeStage[]; size?: number; thickness?: number;
  hovered: string | null; onHover: (k: string | null) => void;
}) {
  const { t } = useTranslation("campaigns");
  const r = (size - thickness) / 2;
  const cx = size / 2, cy = size / 2;
  const c = 2 * Math.PI * r;
  const visible = stages.filter((s) => s.pct > 0);
  const hv = hovered ? stages.find((s) => s.key === hovered) : null;
  let offset = 0;
  const overlapAmount = 3; // pixels of overlap to eliminate gaps

  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0, margin: "0 auto" }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", cursor: "pointer" }}>
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg)" strokeWidth={thickness} />
        {visible.map((s, idx) => {
          const len = (s.pct / 100) * c;
          const active = hovered === s.key;
          const dimmed = hovered && !active;
          // Extend segments slightly to eliminate gaps between them
          const extendedLen = len + overlapAmount;
          const seg = (
            <circle key={s.key} cx={cx} cy={cy} r={r} fill="none"
              stroke={s.color} strokeWidth={thickness}
              strokeDasharray={`${extendedLen} ${c - extendedLen}`} strokeDashoffset={-offset}
              opacity={dimmed ? 0.35 : 1} style={{ transition: "opacity 140ms" }}
              onMouseEnter={() => onHover(s.key)} onMouseLeave={() => onHover(null)} />
          );
          offset += len;
          return seg;
        })}
      </svg>
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", transform: "translateY(6px)" }}>
        {hv ? (
          <>
            <div className="eyebrow eyebrow-sm" style={{ color: hv.color }}>{hv.label}</div>
            <div className="serif" style={{ fontSize: 40, color: "var(--ink)", lineHeight: 1, marginTop: 4 }}>{hv.count}</div>
            <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute)", marginTop: 3 }}>{hv.pct}%</div>
          </>
        ) : (
          <>
            <div className="eyebrow eyebrow-sm">{t("summary.totalLeads")}</div>
            <div className="serif" style={{ fontSize: 44, color: "var(--ink)", lineHeight: 1, marginTop: 4 }}>{total}</div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Bars ───────────────────────────────────────────────────────────────────────
function Bars({ stages, hovered, onHover }: { stages: PipeStage[]; hovered: string | null; onHover: (k: string | null) => void }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      {stages.map((s) => {
        const active = hovered === s.key;
        const dimmed = hovered && !active;
        return (
          <div key={s.key}
            onMouseEnter={() => onHover(s.key)} onMouseLeave={() => onHover(null)}
            style={{
              borderRadius: "var(--r-surface)", opacity: dimmed ? 0.25 : 1, transition: "opacity 140ms, box-shadow 140ms, background 140ms",
              ...(s.star
                ? { background: "var(--warn-tint)", padding: "7px 10px", boxShadow: active ? `inset 0 0 0 1.5px ${s.color}` : "inset 0 0 0 1px rgba(196,138,47,0.28)" }
                : { padding: "3px 6px", boxShadow: active ? `inset 0 0 0 1.5px ${s.color}55` : "none", background: active ? `${s.color}0f` : "transparent" }),
            }}>
            <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
              <span className="row" style={{ gap: 8, fontSize: 12, color: s.star ? "var(--ink)" : "var(--ink-soft)", fontWeight: s.star ? 700 : 400 }}>
                <span style={{ width: 7, height: 7, borderRadius: "50%", background: s.color, flexShrink: 0 }} />{s.label}
                {s.star && <span style={{ fontFamily: "var(--mono)", fontSize: 8, letterSpacing: "0.14em", color: s.color, border: `1px solid ${s.color}`, borderRadius: 4, padding: "1px 5px" }}>★</span>}
              </span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: s.star ? "var(--ink)" : "var(--mute)", fontWeight: s.star ? 700 : 400 }}>{s.count}</span>
            </div>
            <div style={{ height: s.star ? 10 : 8, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-pill)", overflow: "hidden" }}>
              <div style={{ width: `${s.pct}%`, height: "100%", background: s.color, borderRadius: "var(--r-pill)", transition: "width 400ms" }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Heat strip ───────────────────────────────────────────────────────────────
function HeatStrip({ leads }: { leads: Record<string, any>[] }) {
  const { t } = useTranslation("campaigns");
  const heat = useMemo(() => heatFromLeads(leads), [leads]);
  const active = heat.bands.filter((b) => b.count > 0);
  return (
    <div>
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 12 }}>
        <span className="eyebrow eyebrow-sm">{t("summary.leadHeat")}</span>
        <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", letterSpacing: "0.12em" }}>
          {t("summary.inDatabase", { count: heat.total })}
        </span>
      </div>
      <div className="row" style={{ gap: 3, height: 12, marginBottom: 14 }}>
        {(active.length ? active : heat.bands).map((b) => (
          <div key={b.key} style={{ flex: Math.max(b.count, active.length ? 0 : 1), background: b.color, borderRadius: 3, minWidth: 4 }} />
        ))}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {heat.bands.map((b) => (
          <div key={b.key} className="row" style={{ gap: 10, alignItems: "flex-start" }}>
            <span style={{ width: 9, height: 9, borderRadius: 3, background: b.color, marginTop: 4, flexShrink: 0 }} />
            <div style={{ minWidth: 0 }}>
              <div className="row" style={{ gap: 7, alignItems: "baseline" }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{t(`summary.heatBands.${b.key}`, b.label)}</span>
                <span className="serif" style={{ fontSize: 17, color: "var(--ink)" }}>{b.count}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── PipelinePanel ──────────────────────────────────────────────────────────────
export function PipelinePanel({ leads }: { leads: Record<string, any>[] }) {
  const { t } = useTranslation("campaigns");
  const [hovered, setHovered] = useState<string | null>(null);
  const pipe = useMemo(() => pipelineFromLeads(leads), [leads]);

  return (
    <PanelShell variant="flat" testId="campaign-detail-view-funnel" style={{ height: "100%", overflowY: "auto", minHeight: 0 }}>
      <SectionHead eyebrow={t("summary.eyebrows.conversion")} title={t("summary.pipeline")} titleSize={32} />
      <div className="pipeline-layout" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <Donut total={pipe.total} stages={pipe.stages} hovered={hovered} onHover={setHovered} />
        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <Bars stages={pipe.stages} hovered={hovered} onHover={setHovered} />
        </div>
      </div>
      <hr className="rule" style={{ margin: "22px 0 18px" }} />
      <HeatStrip leads={leads} />
    </PanelShell>
  );
}
