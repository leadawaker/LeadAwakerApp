import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X, Phone, Mail, Tag, TrendingUp, Calendar, User, ClipboardList, FileText,
  Plus, Loader2, Check, ChevronDown, ChevronRight, ExternalLink, MessageSquare, Maximize2,
  CircleDot, Send, Users, Star, Ban, AlertTriangle, RotateCcw, Trash2, Bot, Zap,
} from "lucide-react";
import { useScoreBreakdown, TIER_COLORS, TrendIcon, type ScoreBreakdown } from "@/hooks/useScoreBreakdown";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { SkeletonContactPanel } from "@/components/ui/skeleton";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Thread, Lead, Interaction } from "../hooks/useConversationsData";
import { addLeadTag, removeLeadTag } from "../api/conversationsApi";
import {
  initialsFor,
  getStatusAvatarColor,
  getStatus,
  formatRelativeTime,
  PIPELINE_HEX,
} from "../utils/conversationHelpers";

interface TagData {
  id: number;
  name: string;
  color: string;
  category?: string;
}

interface LeadTagRow {
  id: number;
  leadsId?: number;
  tagsId?: number;
  [key: string]: any;
}

// ── Conversion status helpers ─────────────────────────────────────────────────
export const STAGE_ICON: Record<string, React.ElementType> = {
  New:                  CircleDot,
  Contacted:            Send,
  Responded:            MessageSquare,
  "Multiple Responses": Users,
  Qualified:            Star,
  Booked:               Calendar,
  "Call Booked":        Calendar,
  "Appointment Booked":   Calendar,
  "Appointment Rebooked": RotateCcw,
  "Booking Confirmed":    Check,
  "Calendar Link Sent": Calendar,
  Closed:               Check,
  Lost:                 AlertTriangle,
  DND:                  Ban,
};


function tagColorClass(color: string): string {
  const map: Record<string, string> = {
    yellow: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/30",
    blue: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/30",
    green: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/30",
    red: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-700/30",
    orange: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/30",
    purple: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/30",
    gray: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/40",
  };
  return map[color?.toLowerCase()] ?? "bg-muted text-muted-foreground border-border";
}


function computeLeadScore(lead: Lead): number {
  const stored = lead.lead_score ?? (lead as any).leadScore;
  if (typeof stored === "number") return Math.min(100, Math.max(0, stored));
  let score = 0;
  const status = (lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus ?? "New").toLowerCase();
  if (status === "booked") score += 40;
  else if (status === "qualified") score += 30;
  else if (status === "interested") score += 25;
  else if (status === "responded") score += 20;
  else if (status === "contacted") score += 10;
  else if (status === "new") score += 5;

  const received = Number(lead.message_count_received ?? 0);
  score += Math.min(20, received * 5);

  const bumpStage = Number(lead.current_bump_stage ?? 0);
  score += Math.min(20, bumpStage * 7);

  if (lead.booked_call_date ?? lead.bookedCallDate) score += 10;
  if (lead.manual_takeover ?? lead.manualTakeover) score += 5;
  if (!(lead.opted_out ?? lead.optedOut)) score += 5;

  return Math.min(100, score);
}

function scoreBarColor(score: number): string {
  if (score >= 70) return "bg-green-500";
  if (score >= 40) return "bg-yellow-500";
  return "bg-gray-400 dark:bg-gray-600";
}

function scoreTextColor(score: number): string {
  if (score >= 70) return "text-green-600 dark:text-green-400";
  if (score >= 40) return "text-yellow-600 dark:text-yellow-400";
  return "text-muted-foreground";
}


function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex justify-between items-center">
        <span className="text-[10px] text-muted-foreground">{label}</span>
        <span className="text-[10px] font-semibold tabular-nums text-foreground">{value}</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
        <div
          className="h-full rounded-full bg-indigo-500 transition-all duration-500"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

function ScoreBars({ breakdown }: { breakdown: ScoreBreakdown }) {
  return (
    <div className="flex flex-col gap-2 w-full mt-2">
      <ScoreBar label="Engagement" value={breakdown.engagement_score} />
      <ScoreBar label="Activity"   value={breakdown.activity_score} />
      <ScoreBar label="Funnel"     value={breakdown.funnel_weight} />
    </div>
  );
}

// ── Score Arc — half-circle gauge using stroke-dasharray ─────────────────────
function ScoreArc({ score, status }: { score: number; status?: string }) {
  const fillColor = (status && PIPELINE_HEX[status]) || "#4F46E5";
  const pct = Math.max(0, Math.min(100, score)) / 100;

  const cx = 100, cy = 85, r = 58, sw = 14;
  const arcLen = Math.PI * r;
  const arcPath = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  return (
    <svg viewBox="0 0 200 100" className="w-full max-w-[140px] mx-auto">
      {/* Track */}
      <path d={arcPath} fill="none" stroke="#E5E7EB" strokeWidth={sw} strokeLinecap="round" />
      {/* Fill */}
      {pct > 0 && (
        <path
          d={arcPath}
          fill="none"
          stroke={fillColor}
          strokeWidth={sw}
          strokeLinecap="round"
          strokeDasharray={`${arcLen}`}
          strokeDashoffset={`${arcLen * (1 - pct)}`}
        />
      )}
      {/* Score number */}
      <text x={cx} y={cy - 12} textAnchor="middle" dominantBaseline="central"
        style={{ fontSize: 34, fontWeight: 900, fill: "#111827", letterSpacing: -2 }}>
        {score}
      </text>
    </svg>
  );
}

function useLeadTags(leadId: number | null) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leadId) { setTags([]); setAllTags([]); setLoading(false); return; }
    setTags([]);
    setAllTags([]);
    setLoading(true);
    let cancelled = false;
    const fetchTags = async () => {
      try {
        const [junctionRes, allTagsRes] = await Promise.all([
          apiFetch(`/api/leads/${leadId}/tags`),
          apiFetch("/api/tags"),
        ]);
        if (!junctionRes.ok || !allTagsRes.ok) { if (!cancelled) { setTags([]); setAllTags([]); } return; }
        const junctionRows: LeadTagRow[] = await junctionRes.json();
        const fetchedAllTags: TagData[] = await allTagsRes.json();
        const tagMap = new Map<number, TagData>();
        for (const t of fetchedAllTags) { if (t.id) tagMap.set(t.id, t); }
        const resolved: TagData[] = [];
        for (const row of junctionRows) {
          const tagId = row.tagsId ?? row.tags_id ?? row.tagId ?? row.tag_id;
          if (tagId && tagMap.has(tagId)) { const tag = tagMap.get(tagId)!; if (tag.name) resolved.push(tag); }
        }
        if (!cancelled) {
          setTags(resolved);
          setAllTags(fetchedAllTags.filter((t) => !!t.name));
        }
      } catch {
        if (!cancelled) { setTags([]); setAllTags([]); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchTags();
    return () => { cancelled = true; };
  }, [leadId]);

  return { tags, setTags, allTags, loading };
}

// ── Collapsible section IDs ──────────────────────────────────────────────────
type SectionId = "contact" | "score" | "status" | "tags" | "activity" | "notes" | "messages" | "ai";

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
}

export function ContactSidebar({ selected, loading = false, onClose, onUpdateLead, onNavigateToLead, className, recentMessages, recentMessagesLoading, onViewConversation, headerActions, onRefresh }: ContactSidebarProps) {
  const { t } = useTranslation("conversations");
  const [collapsedSections, setCollapsedSections] = useState<Set<SectionId>>(new Set());
  const toggleSection = (id: SectionId) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const leadId = selected?.lead?.id ?? null;
  const { tags: leadTags, setTags: setLeadTags, allTags, loading: tagsLoading } = useLeadTags(leadId);
  const { toast } = useToast();

  const lead = selected?.lead ?? null;
  const { breakdown, loading: scoreLoading } = useScoreBreakdown(lead?.id ?? null);
  const score = breakdown?.lead_score ?? (lead ? computeLeadScore(lead) : 0);
  const status = lead ? getStatus(lead) || "New" : "New";
  const avatarColor = getStatusAvatarColor(status);

  // ── Local status state for pipeline dropdown ──
  const [localStatus, setLocalStatus] = useState(status);
  useEffect(() => { setLocalStatus(status); }, [status]);

  // ── Tag popover state ──
  const [showTagPopover, setShowTagPopover] = useState(false);

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
    } catch {
      // error toast already shown by onUpdateLead
    } finally {
      setNotesSaving(false);
    }
  };

  // ── Tag handlers ──
  const handleAddTag = async (tag: TagData) => {
    if (!lead || leadTags.some((t) => t.id === tag.id)) return;
    setLeadTags((prev) => [...prev, tag]);
    setShowTagPopover(false);
    try {
      await addLeadTag(lead.id, tag.id);
    } catch {
      setLeadTags((prev) => prev.filter((t) => t.id !== tag.id));
      toast({ variant: "destructive", title: t("contact.tags.failedToAdd") });
    }
  };

  const handleRemoveTag = async (tagId: number) => {
    if (!lead) return;
    const prevTags = [...leadTags];
    setLeadTags((p) => p.filter((t) => t.id !== tagId));
    try {
      await removeLeadTag(lead.id, tagId);
    } catch {
      setLeadTags(prevTags);
      toast({ variant: "destructive", title: t("contact.tags.failedToRemove") });
    }
  };

  // Available tags = allTags minus already-assigned
  const availableTags = allTags.filter((t) => !leadTags.some((lt) => lt.id === t.id));

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

          {/* Center: action buttons */}
          <div className="flex-1 flex items-center justify-center gap-1.5">
            {lead && (
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
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[140px]"
                title="Trigger Bump"
              >
                <RotateCcw className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Bump {lead.current_bump_stage ? `${lead.current_bump_stage}/3` : ""}
                </span>
              </button>
            )}

            {lead && (
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/api/leads/${lead.id}/reset-demo`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed");
                    toast({ title: "Lead reset!", description: `${lead.name || lead.Name || "Lead"} reset to zero` });
                    onRefresh?.();
                  } catch {
                    toast({ title: "Reset failed", description: "Could not reset lead", variant: "destructive" });
                  }
                }}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[110px]"
                title="Reset Lead to Zero"
              >
                <Trash2 className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Reset Lead
                </span>
              </button>
            )}

            {lead && (
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/api/leads/${lead.id}/demo-reset-and-send`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed");
                    toast({ title: "Demo started!", description: `Reset + first message sent for ${lead.name || lead.Name || "this lead"}` });
                    onRefresh?.();
                  } catch {
                    toast({ title: "Demo reset failed", description: "Automation service may be offline", variant: "destructive" });
                  }
                }}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-amber-400/60 text-amber-600 dark:text-amber-400 hover:border-amber-500 hover:text-amber-700 dark:hover:text-amber-300 text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[120px]"
                title="Demo Reset — wipe history and send first message"
              >
                <Zap className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  Demo Reset
                </span>
              </button>
            )}

            {lead && (
              <button
                onClick={async () => {
                  try {
                    const res = await apiFetch(`/api/leads/${lead.id}/ai-send`, { method: "POST" });
                    if (!res.ok) throw new Error("Failed");
                    toast({ title: "AI message sent!", description: `Sent for ${lead.name || lead.Name || "this lead"}` });
                  } catch {
                    toast({ title: "AI send failed", description: "Automation service may be offline", variant: "destructive" });
                  }
                }}
                className="group inline-flex items-center h-9 pl-[9px] rounded-full border border-black/[0.125] text-foreground/60 hover:text-foreground text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[110px]"
                title="AI Send Message"
              >
                <Bot className="h-4 w-4 shrink-0" />
                <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                  AI Send
                </span>
              </button>
            )}
          </div>

          {/* Right: details / expand */}
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
                    const formattedCall = callDate ? callDate.toLocaleString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                      hour: "2-digit", minute: "2-digit",
                    }) : null;
                    return (
                      <>
                        <Icon className="h-5 w-5 shrink-0" style={hex ? { color: hex } : { color: "#6B7280" }} />
                        <div className="flex flex-col min-w-0">
                          <span className="text-[13px] font-semibold text-foreground">{status || "—"}</span>
                          {formattedCall && (
                            <span className={cn("text-[11px] text-muted-foreground", isPastCall && "line-through")}>
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
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex flex-col items-center gap-3" data-testid="lead-score">
                  <ScoreArc score={score} status={status} />

                  {/* Tier + trend */}
                  {breakdown && (
                    <div className="flex items-center gap-2">
                      <span className={cn("text-[11px] font-bold px-2 py-0.5 rounded-full", TIER_COLORS[breakdown.tier] ?? TIER_COLORS.Sleeping)}>
                        {breakdown.tier}
                      </span>
                      <TrendIcon trend={breakdown.trend} />
                    </div>
                  )}

                  {/* Sub-score bars */}
                  {breakdown && <ScoreBars breakdown={breakdown} />}

                  {/* Signal chips */}
                  {breakdown && breakdown.signals.length > 0 && (
                    <div className="flex flex-wrap gap-1 justify-center">
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

            {/* ── AI Summary (only after lead has booked a call) ── */}
            {(lead?.booked_call_date ?? (lead as any)?.bookedCallDate) && (
              <>
                <div className="border-t border-border/20" />
                <SectionHeader id="ai" label="AI Summary" icon={Bot} collapsed={collapsedSections.has("ai")} onToggle={toggleSection} />
                {!collapsedSections.has("ai") && (
                  <div className="px-4 pb-4">
                    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5">
                      {(() => {
                        const raw = (lead as any)?.aiMemory ?? (lead as any)?.ai_memory;
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
                          <p className="text-xs text-foreground/80 leading-relaxed">{String(raw)}</p>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* ── Tags ── */}
            <div className="border-t border-border/20" />
            <SectionHeader
              id="tags"
              label={t("contact.sections.tags")}
              icon={Tag}
              collapsed={collapsedSections.has("tags")}
              onToggle={toggleSection}
              trailing={
                lead ? (
                  <Popover open={showTagPopover} onOpenChange={setShowTagPopover}>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="text-muted-foreground hover:text-foreground"
                        title={t("contact.tags.addTag")}
                        data-testid="btn-add-tag"
                      >
                        <Plus className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-52 p-2 bg-white/95 dark:bg-popover backdrop-blur-sm"
                      align="end"
                      sideOffset={4}
                    >
                      <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5 px-1">
                        {t("contact.tags.availableTags")}
                      </div>
                      {availableTags.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground/60 italic px-1 py-2">
                          {t("contact.tags.noMoreTags")}
                        </div>
                      ) : (
                        <div className="flex flex-col gap-0.5 max-h-[200px] overflow-y-auto">
                          {availableTags.map((tag) => (
                            <button
                              key={tag.id}
                              onClick={() => handleAddTag(tag)}
                              className="flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] font-medium text-foreground hover:bg-muted/60 text-left"
                              data-testid={`tag-option-${tag.id}`}
                            >
                              <span
                                className={cn(
                                  "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold",
                                  tagColorClass(tag.color),
                                )}
                              >
                                {tag.name}
                              </span>
                            </button>
                          ))}
                        </div>
                      )}
                    </PopoverContent>
                  </Popover>
                ) : undefined
              }
            />
            {!collapsedSections.has("tags") && (
            <div className="px-4 pb-4" data-testid="contact-tags">
              <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5">
                {tagsLoading ? (
                  <div className="flex flex-wrap gap-1.5">
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="h-6 w-16 rounded-full bg-muted animate-pulse" />
                    ))}
                  </div>
                ) : leadTags.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {leadTags.map((tag) => (
                      <span
                        key={tag.id}
                        className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold group",
                          tagColorClass(tag.color),
                        )}
                        title={tag.category ? `${tag.category}: ${tag.name}` : tag.name}
                      >
                        {tag.name}
                        {lead && (
                          <button
                            onClick={() => handleRemoveTag(tag.id)}
                            className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                            title={t("contact.tags.removeTag", { name: tag.name })}
                            data-testid={`btn-remove-tag-${tag.id}`}
                          >
                            <X className="h-2.5 w-2.5" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground/60 italic">{t("contact.tags.noTagsAssigned")}</div>
                )}
              </div>
            </div>
            )}

            {/* ── Activity ── */}
            <div className="border-t border-border/20" />
            <SectionHeader id="activity" label={t("contact.sections.activity")} icon={ClipboardList} collapsed={collapsedSections.has("activity")} onToggle={toggleSection} />
            {!collapsedSections.has("activity") && (
              <div className="px-4 pb-5">
                <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-3.5 flex flex-col gap-2">
                  {[
                    { label: t("contact.activity.messagesSent"),      value: String(selected.lead.message_count_sent ?? selected.lead.messageCountSent ?? "\u2014") },
                    { label: t("contact.activity.messagesReceived"),  value: String(selected.lead.message_count_received ?? selected.lead.messageCountReceived ?? "\u2014") },
                    { label: t("contact.activity.totalInteractions"), value: String(selected.lead.interaction_count ?? selected.lead.interactionCount ?? "\u2014") },
                    { label: t("contact.activity.lastActive"),        value: formatRelativeTime(selected.lead.last_interaction_at || selected.lead.last_message_received_at) || "\u2014" },
                    { label: t("contact.activity.automationStatus"),  value: String(selected.lead.automation_status ?? selected.lead.automationStatus ?? "\u2014") },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex items-center justify-between gap-2">
                      <span className="text-[11px] text-muted-foreground">{label}</span>
                      <span className="text-[12px] font-semibold text-foreground tabular-nums">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

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
                            const outbound = msg.direction === "Outbound";
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
      </div>
    </section>
  );
}
