// UI atom components extracted from LeadsCardView.tsx
import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { cn } from "@/lib/utils";
import {
  Copy,
  Check,
  Send,
  MessageSquare,
  Users,
  Star,
  Calendar,
  CircleDot,
  Lock,
  Ban,
  AlertTriangle,
  Pencil,
} from "lucide-react";
import { updateLead } from "../../api/leadsApi";
import {
  PIPELINE_HEX,
  PIPELINE_STAGES,
  LOST_STAGES,
  STATUS_COLORS,
  STAGE_ICON,
  TERMINAL_DEFAULT_ANCHOR,
  STATUS_TO_STAGE,
  TAG_COLOR_MAP,
  CLIENT_FUNNEL_WEIGHTS,
  LIST_RING_SIZE,
} from "./constants";

export { LIST_RING_SIZE };

// ── Score Arc — half-circle gauge (9 o'clock → top → 3 o'clock) ─────────────
export function ScoreArc({ score, status }: { score: number; status?: string }) {
  const cx = 100, cy = 95, r = 72, sw = 18;
  const fillColor = (status && PIPELINE_HEX[status]) || "#4F46E5";

  // Background track: semicircle from left to right, arcing upward through the top
  const bgPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Score fill: arc from left to score position (sweep-flag=1 → clockwise = upward)
  let fillPath = "";
  if (score > 0) {
    if (score >= 100) {
      fillPath = bgPath;
    } else {
      const angleRad = ((score / 100) * 180 * Math.PI) / 180;
      const endX = (cx - r * Math.cos(angleRad)).toFixed(2);
      const endY = (cy - r * Math.sin(angleRad)).toFixed(2);
      fillPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${endX} ${endY}`;
    }
  }

  return (
    <svg viewBox="0 0 200 115" className="w-full max-w-[200px] mx-auto">
      {/* Track */}
      <path d={bgPath} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="round" />
      {/* Fill */}
      {fillPath && (
        <path d={fillPath} fill="none" stroke={fillColor} strokeWidth={sw} strokeLinecap="round" />
      )}
      {/* Score number — baseline aligned with arc base */}
      <text x={cx} y={cy + 6} textAnchor="middle"
        fontSize="38" fontWeight="900" fontFamily="inherit" fill="#111827" letterSpacing="-2">
        {score}
      </text>
    </svg>
  );
}

// ── Copy button ────────────────────────────────────────────────────────────────
export function CopyContactBtn({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value).then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        });
      }}
      className="opacity-0 group-hover/row:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Status badge (light, for header) ─────────────────────────────────────────
export function StatusBadge({ label }: { label: string }) {
  const c = STATUS_COLORS[label] ?? { badge: "bg-muted text-muted-foreground border-border" };
  const hex = PIPELINE_HEX[label];
  return (
    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold", c.badge)}>
      <span
        className="w-1.5 h-1.5 rounded-full shrink-0"
        style={hex ? { backgroundColor: hex } : {}}
      />
      {label}
    </span>
  );
}

// ── Pipeline progress — monochrome tube, icons+labels at left of each segment ─
export function PipelineProgress({ status, skipBooked = false }: { status: string; skipBooked?: boolean }) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
  // Map variant statuses to canonical stage key
  let canonicalStatus = STATUS_TO_STAGE[status] ?? status;
  // Direct-booking campaigns: "Closed" is really "Booked" (final stage)
  if (skipBooked && canonicalStatus === "Closed") canonicalStatus = "Booked";
  const isTerminal = LOST_STAGES.includes(status);
  const tubeHeight = 46;

  // For direct-call campaigns, "Booked" is the final stage (no "Closed" after it)
  const stages = skipBooked ? PIPELINE_STAGES.filter((s) => s.key !== "Closed") : PIPELINE_STAGES;
  const stageCount = stages.length;

  const currentIndex = stages.findIndex((s) => s.key === canonicalStatus);

  // For terminal statuses (DND/Lost), anchor = the last normal stage before the exit.
  // The terminal icon replaces the stage right after the anchor (same slot, same position).
  const anchorIndex = isTerminal
    ? Math.min(TERMINAL_DEFAULT_ANCHOR[status] ?? 3, stageCount - 1)
    : currentIndex;
  // effectiveIndex = the slot whose icon gets the "current" treatment
  const effectiveIndex = isTerminal ? anchorIndex + 1 : Math.max(0, anchorIndex);

  // Sizes — current stage is slightly bigger
  const iconSizeBase = 30;
  const iconSizeCurrent = 36;
  const innerIconBase = 16;
  const innerIconCurrent = 20;

  // Monochrome: entire filled bar uses the status color (canonical for direct-booking remap)
  const activeHex = PIPELINE_HEX[canonicalStatus] || PIPELINE_HEX[status] || "#6B7280";
  const barHex = activeHex;

  // Animated fill — grows from 0 on mount, transitions smoothly between leads
  // New: no fill. Closed (last stage): full bar.
  // Others: bar extends 7% past the next icon so the fade trails smoothly into it.
  const isClosed = effectiveIndex === stageCount - 1;
  const isNew = effectiveIndex === 0 && !isTerminal;
  const nextIconPct = ((effectiveIndex + 1) / stageCount) * 100;
  const rawFillPct = isNew ? 0 : isClosed ? 100 : Math.min(100, nextIconPct + 7);
  const [displayFillPct, setDisplayFillPct] = useState(0);
  useEffect(() => {
    const id = setTimeout(() => setDisplayFillPct(rawFillPct), 20);
    return () => clearTimeout(id);
  }, [rawFillPct]);

  // Gradient: solid from start through the current icon, then smooth fade to transparent at end.
  // Current icon position within the fill bar.
  const iconPct = isNew ? 0 : isClosed ? 100 : Math.round((effectiveIndex / (effectiveIndex + 1)) * 100);
  const fillBackground = isNew
    ? "transparent"
    : isClosed
      ? barHex
      : `linear-gradient(to right, ${barHex} ${iconPct}%, transparent 100%)`;

  return (
    <div className="w-full">
      <div className="relative" style={{ height: tubeHeight + 14 }}>
        {/* Gray track underneath (full width) */}
        <div
          className="absolute rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight - 6, backgroundColor: isDark ? "rgba(255,255,255,0.10)" : "rgba(55,55,55,0.16)" }}
        />

        {/* Animated fill bar — single bar with width transition for smooth per-lead transitions */}
        <div
          className="absolute overflow-hidden rounded-full"
          style={{ left: 0, right: 0, top: "50%", transform: "translateY(-50%)", height: tubeHeight }}
        >
          <div
            className="h-full transition-[width] duration-[500ms] ease-out"
            style={{
              width: `${displayFillPct}%`,
              background: fillBackground,
            }}
          />
        </div>

        {/* Stage icons + labels — at LEFT edge of each segment */}
        {stages.map((stage, i) => {
          const isPast = i < effectiveIndex;
          const isCurrent = i === effectiveIndex;
          const isFuture = i > effectiveIndex;

          // For the terminal slot, show DND/Lost icon instead of the normal stage icon
          const isTerminalSlot = isTerminal && i === effectiveIndex;

          const IconComponent = isTerminalSlot
            ? (status === "DND" ? Ban : AlertTriangle)
            : (isPast || isCurrent)
              ? (STAGE_ICON[stage.key] || CircleDot)
              : Lock;

          const pct = (i / stageCount) * 100;
          const sz = isCurrent ? iconSizeCurrent : iconSizeBase;
          const innerSz = isCurrent ? innerIconCurrent : innerIconBase;

          // Terminal slot label shows "DND" or "Lost" instead of the stage name
          const label = isTerminalSlot
            ? t(`kanban.stageLabels.${status}`, status)
            : t(`kanban.stageLabels.${stage.key.replace(/ /g, "")}`, stage.short);

          return (
            <div
              key={`icon-${stage.key}`}
              className={cn("absolute z-10 items-center", isCurrent ? "flex" : "hidden lg:flex")}
              style={{
                left: `${pct}%`,
                top: "50%",
                transform: i === 0 ? "translate(15px, -50%)" : `translate(calc(15px - ${sz / 2}px), -50%)`,
              }}
            >
              {/* Icon circle */}
              <div
                className="flex items-center justify-center rounded-full shrink-0"
                style={{
                  width: sz,
                  height: sz,
                  backgroundColor: isDark ? "#243249" : "#fff",
                  border: isFuture
                    ? `1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`
                    : `2.5px solid ${activeHex}`,
                  boxShadow: isCurrent ? `0 0 0 3px ${activeHex}40` : "none",
                }}
              >
                <IconComponent
                  className="shrink-0"
                  style={{
                    width: innerSz,
                    height: innerSz,
                    color: isTerminalSlot ? activeHex : (isPast || isCurrent) ? (isDark ? "rgba(255,255,255,0.85)" : "#1F1F1F") : (isDark ? "rgba(255,255,255,0.25)" : "rgba(0,0,0,0.20)"),
                  }}
                />
              </div>
              {/* Label next to icon */}
              <span
                className="ml-2 font-bold tracking-wide leading-none whitespace-nowrap select-none capitalize"
                style={{
                  color: isCurrent ? "#FFFFFF" : isFuture ? (isDark ? "rgba(255,255,255,0.40)" : "#000000") : (isDark ? "rgba(255,255,255,0.80)" : "#1F1F1F"),
                  fontSize: isCurrent ? "11px" : "8px",
                }}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Pipeline progress — compact version for mobile ─────────────────────────
export function PipelineProgressCompact({ status }: { status: string }) {
  const { t } = useTranslation("leads");
  const { isDark } = useTheme();
  const currentIndex = PIPELINE_STAGES.findIndex((s) => s.key === status);
  const isTerminal = LOST_STAGES.includes(status);
  const anchorIndex = isTerminal ? (TERMINAL_DEFAULT_ANCHOR[status] ?? 3) : currentIndex;
  const effectiveIndex = isTerminal ? anchorIndex + 1 : anchorIndex;
  const futureCount = Math.max(0, PIPELINE_STAGES.length - 1 - effectiveIndex);
  const locksToShow = Math.min(futureCount, 2);
  const activeHex = PIPELINE_HEX[status] || "#6B7280";
  const barHex = activeHex;
  const currentStageKey = isTerminal ? status : (PIPELINE_STAGES[effectiveIndex]?.key ?? status);
  const currentStage = t(`kanban.stageLabels.${currentStageKey.replace(/ /g, "")}`, currentStageKey);
  const CurrentIcon = isTerminal
    ? (status === "DND" ? Ban : AlertTriangle)
    : (STAGE_ICON[PIPELINE_STAGES[effectiveIndex]?.key] || CircleDot);
  const filledPct = effectiveIndex > 0
    ? `${(effectiveIndex / (PIPELINE_STAGES.length - 1)) * 100}%`
    : "0%";

  return (
    <div className="flex items-center gap-2 w-full">
      {effectiveIndex > 0 && (
        <div
          className="h-[8px] rounded-full shrink-0"
          style={{ width: filledPct, maxWidth: "30%", background: barHex }}
        />
      )}
      <div
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full shrink-0"
        style={{ border: `2px solid ${activeHex}`, boxShadow: `0 0 0 3px ${activeHex}30`, background: isDark ? "#243249" : "#fff" }}
      >
        <CurrentIcon style={{ width: 14, height: 14, color: activeHex }} />
        <span className="text-[11px] font-bold" style={{ color: activeHex }}>{currentStage}</span>
      </div>
      {Array.from({ length: locksToShow }).map((_, i) => (
        <div
          key={i}
          className="h-[28px] w-[28px] rounded-full flex items-center justify-center shrink-0"
          style={{ border: `1.5px solid ${isDark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.12)"}`, background: isDark ? "#243249" : "#fff" }}
        >
          <Lock style={{ width: 12, height: 12, color: isDark ? "rgba(255,255,255,0.30)" : "rgba(0,0,0,0.20)" }} />
        </div>
      ))}
      <div className="flex-1 h-[8px] rounded-full" style={{ background: isDark ? "rgba(255,255,255,0.10)" : "rgba(55,55,55,0.10)" }} />
    </div>
  );
}

// ── Tag pill ──────────────────────────────────────────────────────────────────
export function TagPill({ tag }: { tag: { name: string; color: string } }) {
  const cls = TAG_COLOR_MAP[tag.color] ?? TAG_COLOR_MAP.gray;
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold", cls)}>
      {tag.name}
    </span>
  );
}

// ── Inline edit field ──────────────────────────────────────────────────────────
export function InlineEditField({ value, field, leadId, onSaved, type = "text" }: {
  value: string;
  field: string;
  leadId: number;
  onSaved?: () => void;
  type?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (editing && inputRef.current) inputRef.current.focus(); }, [editing]);
  useEffect(() => { setDraft(value); }, [value]);

  const save = useCallback(async () => {
    if (draft === value) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateLead(leadId, { [field]: draft });
      onSaved?.();
    } catch { setDraft(value); } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, value, field, leadId, onSaved]);

  if (editing) {
    return (
      <input
        ref={inputRef}
        type={type}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") { setDraft(value); setEditing(false); } }}
        className="w-full text-[12px] font-semibold bg-white/80 dark:bg-white/[0.08] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 text-foreground"
      />
    );
  }

  return (
    <div className="group/edit flex items-center gap-1 min-w-0 cursor-text" onClick={() => setEditing(true)}>
      <span className={cn("text-[12px] font-semibold text-foreground leading-snug truncate", type === "tel" && "font-mono")}>
        {value || <span className="text-foreground/25 font-normal italic">{"2014"}</span>}
      </span>
      {value && (
        <button
          onClick={(e) => { e.stopPropagation(); setEditing(true); }}
          className="opacity-0 group-hover/edit:opacity-100 p-0.5 rounded hover:bg-muted transition-opacity text-muted-foreground hover:text-foreground shrink-0"
          title="Edit"
        >
          <Pencil className="h-2.5 w-2.5" />
        </button>
      )}
    </div>
  );
}

// ── Score breakdown tube for list cards ────────────────────────────────────────
// Stacked pill bar: Engagement (blue) under Activity (green) under Funnel (orange)
// Score number displayed to the left
export function ListScoreRing({ score, status, lead }: { score: number; status: string; isActive?: boolean; lead?: Record<string, any> }) {
  const engScore = Number(lead?.engagement_score ?? lead?.engagementScore ?? 0);
  const actScore = Number(lead?.activity_score ?? lead?.activityScore ?? 0);
  const funnelScore = CLIENT_FUNNEL_WEIGHTS[status] ?? 0;

  // Sub-scores are already weighted (eng max 30, act max 20, funnel max 50 = 100)
  // But the raw engagement/activity from scorer are 0-100, need to scale
  const eng = Math.min(30, Math.round((engScore / 100) * 30));
  const act = Math.min(20, Math.round((actScore / 100) * 20));
  const funnel = funnelScore;

  const segments = [
    { label: "Engagement", value: eng },
    { label: "Activity",   value: act },
    { label: "Funnel",     value: funnel },
  ];
  const shades = ["#3B82F6", "#10B981", "#F59E0B"];

  // Cumulative widths for stacked pill effect
  const cumulativeWidths: number[] = [];
  let cumSum = 0;
  for (const seg of segments) {
    cumSum += seg.value;
    cumulativeWidths.push(cumSum);
  }
  const renderOrder = [2, 1, 0]; // bottom layer first

  return (
    <div className="flex items-center gap-1.5 shrink-0">
      <span className="text-[10px] font-bold tabular-nums text-foreground/70 w-[18px] text-right">{score}</span>
      <div className="relative w-[60px] h-[8px] rounded-full bg-muted">
        {renderOrder.map((i) => {
          if (cumulativeWidths[i] === 0) return null;
          return (
            <div
              key={segments[i].label}
              className="absolute top-0 left-0 h-full transition-all duration-500"
              style={{
                width: `${cumulativeWidths[i]}%`,
                backgroundColor: shades[i],
                borderRadius: "9999px",
                zIndex: segments.length - i,
              }}
            />
          );
        })}
      </div>
    </div>
  );
}

// ── Group header ───────────────────────────────────────────────────────────────
export function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" className="sticky top-0 z-30 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{label}</span>
        <span className="text-foreground/20 shrink-0">{"\u2013"}</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
export function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-lg bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
            <div className="h-2 bg-foreground/6 rounded-full w-1/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
