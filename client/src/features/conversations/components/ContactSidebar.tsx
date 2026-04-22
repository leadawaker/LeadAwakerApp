import { useEffect, useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Phone, Mail, TrendingUp, Calendar, User, ClipboardList, FileText,
  Loader2, Check, ChevronDown, ChevronRight, ExternalLink, MessageSquare, Maximize2,
  CircleDot, Send, Users, Star, Ban, AlertTriangle, RotateCcw, Bot, Zap,
  Megaphone,
} from "lucide-react";
import { useScoreBreakdown, TIER_COLORS, TIER_BAR_COLOR, TrendIcon, type ScoreBreakdown } from "@/hooks/useScoreBreakdown";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { SkeletonContactPanel } from "@/components/ui/skeleton";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useToast } from "@/hooks/use-toast";
import type { Thread, Lead, Interaction } from "../hooks/useConversationsData";
import {
  initialsFor,
  getStatusAvatarColor,
  getStatus,
  formatRelativeTime,
  PIPELINE_HEX,
} from "../utils/conversationHelpers";

// ── Conversion status helpers ─────────────────────────────────────────────────
export const STAGE_ICON: Record<string, React.ElementType> = {
  New:                  CircleDot,
  Contacted:            Send,
  Responded:            MessageSquare,
  "Multiple Responses": Users,
  Qualified:            Star,
  Booked:               Calendar,
  Closed:               Check,
  Lost:                 AlertTriangle,
  DND:                  Ban,
};


/** Single thick segmented bar — Engagement | Activity | Funnel as proportional segments with curvy edges */
function SegmentedScoreBar({ breakdown, tierColor }: { breakdown: ScoreBreakdown; tierColor: string }) {
  // Sub-scores are already weighted and sum directly to lead_score (max 100):
  // engagement_score (max 30) + activity_score (max 20) + funnel_weight (max 50) = lead_score
  const segments = [
    { label: "Engagement", value: breakdown.engagement_score },
    { label: "Activity",   value: breakdown.activity_score },
    { label: "Funnel",     value: breakdown.funnel_weight },
  ];
  // Each segment's width as % of 100 (the max possible lead_score)
  const widths = segments.map((seg) => seg.value);
  // Distinct colors per segment: blue (Engagement), green (Activity), orange (Funnel)
  const shades = ["#3B82F6", "#10B981", "#F59E0B"];

  // Cumulative widths: each layer spans from 0 to the sum of all segments up to and including itself.
  // The bottom layer (Funnel) is the full width, Activity sits on top covering less, Engagement on top covering least.
  // We render bottom-to-top so the topmost (Engagement) has the highest z-index.
  const cumulativeWidths: number[] = [];
  let cumSum = 0;
  for (let i = 0; i < widths.length; i++) {
    cumSum += widths[i];
    cumulativeWidths.push(cumSum);
  }

  // Render order: last segment first (bottom layer), first segment last (top layer)
  const renderOrder = segments.map((_, i) => i).reverse();

  return (
    <div className="w-full group/tube relative">
      {/* Stacked pill layers: each starts at left=0, wider layers sit underneath */}
      <div className="relative h-6 w-full rounded-full bg-muted">
        {/* Colored pill layers */}
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
        {/* Score labels rendered on top of all layers */}
        {segments.map((seg, i) => {
          if (widths[i] <= 6) return null;
          const prevCum = i > 0 ? cumulativeWidths[i - 1] : 0;
          // Center of this segment's visible slice, as % of full bar width
          const sliceCenterPct = prevCum + widths[i] / 2;
          return (
            <span
              key={seg.label + "-label"}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 text-[10px] font-bold text-white tabular-nums drop-shadow-sm"
              style={{ left: `${sliceCenterPct}%`, zIndex: 10 }}
            >
              {seg.value}
            </span>
          );
        })}
      </div>
      {/* Tooltip legend on hover */}
      <div className="absolute left-1/2 -translate-x-1/2 -bottom-9 opacity-0 group-hover/tube:opacity-100 transition-opacity duration-200 pointer-events-none z-20">
        <div className="flex items-center gap-2.5 bg-popover border border-border/60 shadow-lg rounded-lg px-2.5 py-1 whitespace-nowrap">
          {segments.map((seg, i) => (
            <div key={seg.label} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: shades[i] }} />
              <span className="text-[9px] text-muted-foreground">{seg.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Compact sub-score bar for the sidebar score section */
function ScoreBar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{label}</span>
        <span className="text-[10px] font-bold tabular-nums text-foreground/70">
          {Math.round(value)}<span className="text-foreground/30">/{max}</span>
        </span>
      </div>
      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}

// ── Collapsible section IDs ──────────────────────────────────────────────────
type SectionId = "contact" | "score" | "status" | "activity" | "notes" | "messages" | "ai";

function SectionHeader({
  id,
  label,
  icon: Icon,
  collapsed,
  onToggle,
  trailing,
}: {
  id: SectionId;
  label: string;
  icon: React.ElementType;
  collapsed: boolean;
  onToggle: (id: SectionId) => void;
  trailing?: React.ReactNode;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onToggle(id)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onToggle(id); } }}
      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors group cursor-pointer"
      data-testid={`section-toggle-${id}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        <span className="text-[16px] font-semibold font-heading text-foreground">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {trailing}
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            collapsed && "-rotate-90",
          )}
        />
      </div>
    </div>
  );
}

interface ContactSidebarProps {
  selected: Thread | null;
  loading?: boolean;
  onClose?: () => void;
  onUpdateLead?: (leadId: number, patch: Record<string, unknown>) => Promise<void>;
  onNavigateToLead?: (leadId: number) => void;
  className?: string;
  /** Optional: recent messages to display in a chat widget (used on Calendar page) */
  recentMessages?: Interaction[];
  recentMessagesLoading?: boolean;
  /** Callback when user clicks "View full conversation" in the messages widget */
  onViewConversation?: () => void;
  /** Toolbar actions rendered in the header (e.g. +, Search, Settings) */
  headerActions?: React.ReactNode;
  /** Called after a successful lead reset so the parent can refresh data */
  onRefresh?: () => void;
  /** Map of campaign ID → campaign name */
  campaignsMap?: Map<number, string>;
}

export function ContactSidebar({ selected, loading = false, onClose, onUpdateLead, onNavigateToLead, className, recentMessages, recentMessagesLoading, onViewConversation, headerActions, onRefresh, campaignsMap }: ContactSidebarProps) {
  const { t } = useTranslation("conversations");
  const COLLAPSED_STORAGE_KEY = "conversations-contact-collapsed-sections";
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(() => {
    try {
      const raw = localStorage.getItem(COLLAPSED_STORAGE_KEY);
      if (!raw) return new Set();
      const arr = JSON.parse(raw) as SectionId[];
      return new Set(Array.isArray(arr) ? arr : []);
    } catch {
      return new Set();
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSED_STORAGE_KEY, JSON.stringify(Array.from(collapsedSections)));
    } catch {}
  }, [collapsedSections]);
  const toggleSection = (id: SectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const { toast } = useToast();

  const lead = selected?.lead ?? null;
  const { accounts } = useWorkspace();
  const accountTimezone = useMemo(() => {
    if (!lead) return undefined;
    const aid = (lead as any).accounts_id ?? (lead as any).account_id ?? (lead as any).Accounts_id;
    if (!aid) return undefined;
    const acct = accounts.find((a) => a.id === Number(aid));
    return (acct?.timezone as string) || undefined;
  }, [lead, accounts]);
  const { breakdown, loading: scoreLoading, resetToZero: resetScoreToZero } = useScoreBreakdown(lead?.id ?? null);
  const score = breakdown?.lead_score ?? 0;
  const status = lead ? getStatus(lead) || "New" : "New";
  const avatarColor = getStatusAvatarColor(status);

  // ── Campaign name ──
  const campaignName = useMemo(() => {
    if (!lead) return "";
    const l = lead as any;
    const cId = Number(l.campaigns_id ?? l.campaign_id ?? l.Campaigns_id ?? 0);
    return l.Campaign ?? l.campaign_name ?? l.campaign
      ?? (cId && campaignsMap?.get(cId))
      ?? "";
  }, [lead, campaignsMap]);

  // ── Local status state for pipeline dropdown ──
  const [localStatus, setLocalStatus] = useState(status);
  useEffect(() => { setLocalStatus(status); }, [status]);

  // ── Notes state ──
  const [localNotes, setLocalNotes] = useState("");
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  useEffect(() => {
    setLocalNotes(lead?.notes || lead?.Notes || "");
    setNotesDirty(false);
  }, [lead?.id]);

  const handleNotesSave = async () => {
    if (!lead || !notesDirty || !onUpdateLead) return;
    setNotesSaving(true);
    try {
      await onUpdateLead(lead.id, { notes: localNotes });
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
    } catch (err) {
      console.error("[ContactSidebar] Notes save failed:", err);
    } finally {
      setNotesSaving(false);
    }
  };

  return (
    <section
      className={cn(
        "flex flex-col h-full overflow-hidden rounded-lg relative",
        className ?? "hidden xl:flex"
      )}
      data-testid="panel-contact"
    >
      {/* ── Flat background ── */}
      <div className="absolute inset-0 bg-muted" />

      {/* ── Content ── */}
      <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── Header ── */}
      <div className="shrink-0">
        <div className="px-4 pt-5.5 pb-4 flex items-center">
          {/* Left: fold + extra actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            {onClose && (
              <button
                onClick={onClose}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px]"
                data-testid="btn-close-contact-panel"
              >
                <ChevronRight className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("contact.fold")}</span>
              </button>
            )}
            {headerActions}
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Right: details */}
          <div className="flex items-center shrink-0">
            {onNavigateToLead && lead && (
              <button
                onClick={() => onNavigateToLead(lead.id)}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]"
              >
                <Maximize2 className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">{t("contact.details")}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Stacked collapsible widgets ── */}
      <div className="flex-1 overflow-y-auto" data-testid="contact-widgets">
        {loading && !selected ? (
          <div className="p-4">
            <SkeletonContactPanel data-testid="skeleton-contact-panel" />
          </div>
        ) : !selected ? (
          <div className="text-sm text-muted-foreground py-8 text-center px-4">
            {t("contact.selectConversation")}
          </div>
        ) : (
          <div className="flex flex-col">
            {/* ── Contact ── */}
            <SectionHeader id="contact" label={t("contact.sections.contact")} icon={User} collapsed={collapsedSections.has("contact")} onToggle={toggleSection} />
            {!collapsedSections.has("contact") && (
              <div className="px-4 pb-5">
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex flex-col gap-2.5">
                  {[
                    campaignName && { icon: <Megaphone className="h-4 w-4" />, label: t("contact.fields.campaign"), value: campaignName },
                    selected.lead.phone && { icon: <Phone className="h-4 w-4" />, label: t("contact.fields.phone"), value: selected.lead.phone, mono: true },
                    (selected.lead.Email ?? selected.lead.email) && { icon: <Mail className="h-4 w-4" />, label: t("contact.fields.email"), value: selected.lead.Email ?? selected.lead.email },
                  ].filter(Boolean).map((row: any) => (
                    <div key={row.label} className="flex items-center gap-2">
                      <span className="text-foreground/70 shrink-0">{row.icon}</span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[10px] text-muted-foreground font-medium leading-none mb-0.5">{row.label}</div>
                        <div className={cn("text-[12px] text-foreground truncate", row.mono && "font-mono")}>
                          {row.value}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>


              </div>
            )}

            {/* ── Conversion Status ── */}
            <div className="border-t border-border/20" />
            <SectionHeader
              id="status"
              label={t("contact.sections.conversionStatus")}
              icon={ClipboardList}
              collapsed={collapsedSections.has("status")}
              onToggle={toggleSection}
            />
            {!collapsedSections.has("status") && (
              <div className="px-4 pb-4">
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex items-center gap-3">
                  {(() => {
                    const Icon = STAGE_ICON[status] ?? CircleDot;
                    const hex = PIPELINE_HEX[status];
                    const rawCallDate = (selected.lead as any).booked_call_date ?? (selected.lead as any).bookedCallDate ?? null;
                    const callDate = rawCallDate ? new Date(rawCallDate as string) : null;
                    const isPastCall = callDate ? callDate < new Date() : false;
                    const callOpts: Intl.DateTimeFormatOptions = {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    };
                    if (accountTimezone) callOpts.timeZone = accountTimezone;
                    let formattedCall = callDate ? callDate.toLocaleString(undefined, callOpts) : null;
                    if (formattedCall && accountTimezone) {
                      try {
                        const parts = new Intl.DateTimeFormat("en", { timeZone: accountTimezone, timeZoneName: "shortOffset" }).formatToParts(new Date());
                        const tzPart = parts.find((p) => p.type === "timeZoneName");
                        if (tzPart) formattedCall += ` (${tzPart.value})`;
                      } catch { /* ignore */ }
                    }
                    const rawPrevCallDate = (selected.lead as any).previous_booked_call_date ?? (selected.lead as any).previousBookedCallDate ?? null;
                    const prevCallDate = rawPrevCallDate ? new Date(rawPrevCallDate as string) : null;
                    const formattedPrevCall = prevCallDate ? prevCallDate.toLocaleString(undefined, callOpts) : null;
                    const reScheduledCount = Number((selected.lead as any).re_scheduled_count ?? (selected.lead as any).reScheduledCount ?? 0);
                    return (
                      <>
                        <Icon className="h-5 w-5 shrink-0" style={hex ? { color: hex } : { color: "#6B7280" }} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-semibold text-foreground">{status || "—"}</span>
                          {formattedPrevCall && reScheduledCount > 0 && (
                            <span className="text-[10px] text-muted-foreground/50 line-through">
                              {formattedPrevCall}
                            </span>
                          )}
                          {formattedCall && (
                            <span className="text-[11px] text-muted-foreground">
                              {formattedCall}
                            </span>
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}

            {/* ── Score ── */}
            <div className="border-t border-border/20" />
            <SectionHeader
              id="score"
              label={t("contact.sections.score")}
              icon={TrendingUp}
              collapsed={collapsedSections.has("score")}
              onToggle={toggleSection}
              trailing={
                <span className={cn("text-[11px] font-bold tabular-nums", scoreTextColor(score))}>
                  {score}
                </span>
              }
            />
            {!collapsedSections.has("score") && (
              <div className="px-4 pb-4">
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex flex-col gap-3 relative" data-testid="lead-score">
                  {/* Score + tier + trend */}
                  <div className="flex items-center gap-2">
                    <span className="text-2xl font-black tabular-nums text-foreground leading-none">{score}</span>
                    {breakdown && (
                      <span className={cn("text-[9px] font-bold px-2 py-0.5 rounded-full", TIER_COLORS[breakdown.tier] ?? TIER_COLORS.Sleeping)}>
                        {breakdown.tier}
                      </span>
                    )}
                    {breakdown && <TrendIcon trend={breakdown.trend} />}
                  </div>

                  {/* Segmented bar: Engagement | Activity | Funnel */}
                  {breakdown && (
                    <SegmentedScoreBar
                      breakdown={breakdown}
                      tierColor={TIER_BAR_COLOR[breakdown.tier] ?? "#9CA3AF"}
                    />
                  )}

                  {/* Signal chips */}
                  {breakdown && breakdown.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {breakdown.signals.map((sig) => (
                        <span key={sig} className="text-[10px] bg-muted px-1.5 py-0.5 rounded-full text-muted-foreground">
                          {sig}
                        </span>
                      ))}
                    </div>
                  )}

                  {scoreLoading && (
                    <div className="text-[10px] text-muted-foreground animate-pulse">Loading score…</div>
                  )}
                </div>
              </div>
            )}

            {/* ── AI Summary (when lead status is Booked or Closed) ── */}
            {["Booked", "Closed"].includes((lead as any)?.Conversion_Status ?? (lead as any)?.conversionStatus ?? "") && (
              <>
                <div className="border-t border-border/20" />
                <SectionHeader id="ai" label="AI Summary" icon={Bot} collapsed={collapsedSections.has("ai")} onToggle={toggleSection} />
                {!collapsedSections.has("ai") && (
                  <div className="px-4 pb-4">
                    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5">
                      {(() => {
                        const raw = (lead as any)?.aiSummary ?? (lead as any)?.ai_summary ?? (lead as any)?.aiMemory ?? (lead as any)?.ai_memory;
                        if (!raw) {
                          return <p className="text-xs text-muted-foreground">No AI summary yet</p>;
                        }
                        // Skip legacy JSON exchange arrays — only show plain text summaries
                        try {
                          const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
                          if (Array.isArray(parsed)) {
                            return <p className="text-xs text-muted-foreground">No AI summary yet</p>;
                          }
                        } catch { /* not JSON — it's a plain text summary, show it */ }

                        return (
                          <p className="text-xs text-foreground/80 leading-relaxed whitespace-pre-wrap">{String(raw)}</p>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Activity ── */}
            <div className="border-t border-border/20" />
            <SectionHeader id="activity" label={t("contact.sections.activity")} icon={ClipboardList} collapsed={collapsedSections.has("activity")} onToggle={toggleSection} />
            {!collapsedSections.has("activity") && (() => {
              // Compute total AI tokens + cost from thread messages
              const totalTokens = (selected.msgs ?? []).reduce((sum, m) => {
                return sum + Number((m as any).ai_total_tokens ?? (m as any).aiTotalTokens ?? 0);
              }, 0);
              const totalCost = (selected.msgs ?? []).reduce((sum, m) => {
                return sum + Number((m as any).ai_cost ?? (m as any).aiCost ?? 0);
              }, 0);

              const rows = [
                { label: t("contact.activity.messagesSent"),      value: String(selected.lead.message_count_sent ?? selected.lead.messageCountSent ?? "\u2014") },
                { label: t("contact.activity.messagesReceived"),  value: String(selected.lead.message_count_received ?? selected.lead.messageCountReceived ?? "\u2014") },
                { label: t("contact.activity.totalInteractions"), value: String(selected.lead.interaction_count ?? selected.lead.interactionCount ?? "\u2014") },
                { label: t("contact.activity.lastActive"),        value: formatRelativeTime(selected.lead.last_interaction_at || selected.lead.last_message_received_at) || "\u2014" },
                { label: t("contact.activity.automationStatus"),  value: String(selected.lead.automation_status ?? selected.lead.automationStatus ?? "\u2014") },
                ...(totalTokens > 0 ? [
                  { label: t("contact.activity.aiTokensUsed"), value: totalTokens.toLocaleString() },
                  { label: t("contact.activity.aiCost"),       value: `$${totalCost.toFixed(4)}` },
                ] : []),
              ];

              return (
                <div className="px-4 pb-5">
                  <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex flex-col gap-2">
                    {rows.map(({ label, value }) => (
                      <div key={label} className="flex items-center justify-between gap-2">
                        <span className="text-[11px] text-muted-foreground">{label}</span>
                        <span className="text-[12px] font-semibold text-foreground tabular-nums">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            {/* ── Notes ── */}
            <div className="border-t border-border/20" />
            <SectionHeader
              id="notes"
              label={t("contact.sections.notes")}
              icon={FileText}
              collapsed={collapsedSections.has("notes")}
              onToggle={toggleSection}
              trailing={
                <>
                  {notesSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
                  {notesSaved && <Check className="h-3 w-3 text-green-500" />}
                </>
              }
            />
            {!collapsedSections.has("notes") && (
              <div className="px-4 pb-5">
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5">
                  {onUpdateLead ? (
                    <textarea
                      className="w-full text-[12px] text-foreground/80 leading-relaxed bg-transparent resize-none focus:outline-none min-h-[80px] placeholder:text-muted-foreground/40"
                      placeholder={t("contact.notes.placeholder")}
                      value={localNotes}
                      onChange={(e) => { setLocalNotes(e.target.value); setNotesDirty(true); }}
                      onBlur={handleNotesSave}
                      data-testid="textarea-notes"
                    />
                  ) : (
                    selected.lead.notes || selected.lead.Notes ? (
                      <p className="text-[12px] text-foreground/80 leading-relaxed whitespace-pre-wrap">
                        {selected.lead.notes || selected.lead.Notes}
                      </p>
                    ) : (
                      <p className="text-[12px] text-muted-foreground/50 italic">{t("contact.notes.noNotesYet")}</p>
                    )
                  )}
                </div>
              </div>
            )}

            {/* ── Recent Messages (optional — used on Calendar page) ── */}
            {recentMessages !== undefined && (
              <>
                <div className="border-t border-border/20" />
                <SectionHeader id="messages" label={t("contact.sections.recentMessages")} icon={MessageSquare} collapsed={collapsedSections.has("messages")} onToggle={toggleSection} />
                {!collapsedSections.has("messages") && (
                  <div className="px-4 pb-5">
                    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl overflow-hidden">
                      <div className="h-[300px] overflow-y-auto p-3 space-y-2">
                        {recentMessagesLoading ? (
                          <div className="space-y-2">
                            {[1, 2, 3].map((i) => <div key={i} className="h-10 rounded-lg bg-muted animate-pulse" />)}
                          </div>
                        ) : recentMessages.length === 0 ? (
                          <div className="flex items-center justify-center h-full text-[11px] text-muted-foreground/60 italic">
                            {t("contact.messages.noMessages")}
                          </div>
                        ) : (
                          recentMessages.map((msg) => {
                            const outbound = (msg.direction || "").toLowerCase() === "outbound";
                            const content = msg.content ?? msg.Content ?? "";
                            const ts = msg.created_at ?? msg.createdAt;
                            return (
                              <div key={msg.id} className={cn("flex flex-col", outbound ? "items-end" : "items-start")}>
                                <div className={cn(
                                  "max-w-[85%] rounded-2xl px-3 py-2 text-[11px] leading-relaxed",
                                  outbound
                                    ? "bg-brand-indigo text-white"
                                    : "bg-white dark:bg-card text-foreground border border-border/30"
                                )}>
                                  <div className="whitespace-pre-wrap">{content}</div>
                                  {ts && (
                                    <div className={cn("mt-1 text-[9px]", outbound ? "text-white/60" : "text-muted-foreground/60")}>
                                      {new Date(ts).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      {onViewConversation && (
                        <div className="border-t border-border/20 px-3 py-2.5">
                          <button
                            onClick={onViewConversation}
                            className="w-full h-9 rounded-full bg-brand-indigo text-white text-[11px] font-semibold hover:opacity-90 flex items-center justify-center gap-1.5"
                          >
                            <ExternalLink className="h-3.5 w-3.5" />
                            {t("contact.messages.viewFullConversation")}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ── Footer: action buttons ── */}
      {lead && (
        <div className="shrink-0 px-4 py-3 border-t border-border/20 flex items-center gap-2">
          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${lead.id}/trigger-bump`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                toast({ title: "Bump triggered!", description: `Bump sent for ${lead.name || lead.Name || "this lead"}` });
              } catch {
                toast({ title: "Bump failed", description: "Automation service may be offline", variant: "destructive" });
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-black/[0.125] text-foreground/70 hover:text-foreground hover:bg-muted/50 text-[12px] font-medium transition-colors"
            title="Trigger Bump"
          >
            <RotateCcw className="h-4 w-4 shrink-0" />
            <span>Bump {lead.current_bump_stage ? `${lead.current_bump_stage}/3` : ""}</span>
          </button>
          <button
            onClick={async () => {
              try {
                const res = await apiFetch(`/api/leads/${lead.id}/demo-reset-and-send`, { method: "POST" });
                if (!res.ok) throw new Error("Failed");
                resetScoreToZero();
                toast({ title: "Demo started!", description: `Reset + first message sent for ${lead.name || lead.Name || "this lead"}` });
                onRefresh?.();
                setTimeout(() => onRefresh?.(), 4000);
              } catch {
                toast({ title: "Demo reset failed", description: "Automation service may be offline", variant: "destructive" });
              }
            }}
            className="flex-1 inline-flex items-center justify-center gap-1.5 h-9 rounded-full border border-amber-400/60 text-amber-600 dark:text-amber-400 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-[12px] font-medium transition-colors"
            title="Demo Reset — wipe history and send first message"
          >
            <Zap className="h-4 w-4 shrink-0" />
            <span>Demo Reset</span>
          </button>
        </div>
      )}
      </div>
    </section>
  );
}
