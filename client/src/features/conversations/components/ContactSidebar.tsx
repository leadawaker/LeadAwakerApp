import { useEffect, useState } from "react";
import { X, Phone, Mail, Tag, TrendingUp, Calendar, User, ClipboardList, FileText, Plus, Loader2, Check, ChevronDown, PanelRightClose, CircleDot } from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { SkeletonContactPanel } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useToast } from "@/hooks/use-toast";
import type { Thread, Lead } from "../hooks/useConversationsData";
import { addLeadTag, removeLeadTag } from "../api/conversationsApi";
import {
  initialsFor,
  getStatusAvatarColor,
  getStatus,
  formatRelativeTime,
  PIPELINE_STATUSES,
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

function getPipelineStage(lead: Lead): { label: string; description: string; color: string } {
  const status = (lead.Conversion_Status ?? lead.conversion_status ?? lead.conversionStatus ?? "New");
  const bumpStage = Number(lead.current_bump_stage ?? 0);

  if (status === "Booked") return { label: "Booked", description: "Call booked", color: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-700/30" };
  if (status === "Qualified") return { label: "Qualified", description: "Lead qualified", color: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-700/30" };
  if (status === "Interested") return { label: "Interested", description: "Lead interested", color: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-400 dark:border-purple-700/30" };
  if (status === "Responded") return { label: "Responded", description: "Lead replied", color: "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-900/30 dark:text-teal-400 dark:border-teal-700/30" };
  if (bumpStage >= 3) return { label: `Bump ${bumpStage}`, description: "All bumps sent", color: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-700/30" };
  if (bumpStage > 0) return { label: `Bump ${bumpStage}`, description: `Bump ${bumpStage} sent`, color: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-900/30 dark:text-yellow-400 dark:border-yellow-700/30" };
  return { label: status || "New", description: "Initial contact", color: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800/60 dark:text-gray-400 dark:border-gray-700/40" };
}


function useLeadTags(leadId: number | null) {
  const [tags, setTags] = useState<TagData[]>([]);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!leadId) { setTags([]); setAllTags([]); return; }
    let cancelled = false;
    setLoading(true);
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
type SectionId = "contact" | "score" | "activity" | "notes";

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
    <button
      onClick={() => onToggle(id)}
      className="w-full flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-white/30 transition-colors group"
      data-testid={`section-toggle-${id}`}
    >
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4 text-muted-foreground group-hover:text-foreground" />
        <span className="text-[13px] font-semibold font-heading text-foreground">{label}</span>
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
    </button>
  );
}

interface ContactSidebarProps {
  selected: Thread | null;
  loading?: boolean;
  onClose?: () => void;
  onUpdateLead?: (leadId: number, patch: Record<string, unknown>) => Promise<void>;
  className?: string;
}

export function ContactSidebar({ selected, loading = false, onClose, onUpdateLead, className }: ContactSidebarProps) {
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
  const score = lead ? computeLeadScore(lead) : 0;
  const stage = lead ? getPipelineStage(lead) : null;
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
      toast({ variant: "destructive", title: "Failed to add tag" });
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
      toast({ variant: "destructive", title: "Failed to remove tag" });
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
      <div className="absolute inset-0 bg-card" />

      {/* ── Content ── */}
      <div className="relative flex flex-col h-full overflow-hidden">

      {/* ── Header: avatar + name + X — matching KanbanDetailPanel ── */}
      <div className="shrink-0 px-4 pt-4 pb-3 border-b border-border/20">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5">
            {lead && (
              <div
                className="h-10 w-10 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0"
                style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
              >
                {initialsFor(lead)}
              </div>
            )}
            <div className="min-w-0">
              <p className="text-[15px] font-semibold font-heading text-foreground leading-tight truncate max-w-[180px]">
                {lead
                  ? lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || "Unknown"
                  : "Lead Context"}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {lead ? (status || "\u2014") : "Score, stage & details"}
              </p>
            </div>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground shrink-0"
              title="Collapse panel"
              data-testid="btn-close-contact-panel"
            >
              <PanelRightClose className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Meta: Source — matching KanbanDetailPanel */}
        {lead && (
          <div className="flex items-start gap-5 flex-wrap">
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Source</div>
              <div className="text-[12px] font-bold text-foreground">{lead.Source ?? lead.source ?? "API"}</div>
            </div>
            <div>
              <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Rating</div>
              <div className="text-[12px] font-bold text-foreground">{score >= 70 ? "Hot" : score >= 40 ? "Warm" : "Cold"}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Stacked collapsible widgets ── */}
      <div className="flex-1 overflow-y-auto" data-testid="contact-widgets">
        {loading && !selected ? (
          <div className="p-4">
            <SkeletonContactPanel data-testid="skeleton-contact-panel" />
          </div>
        ) : !selected ? (
          <div className="text-sm text-muted-foreground py-8 text-center px-4">
            Select a conversation to see lead context.
          </div>
        ) : (
          <div className="flex flex-col">
            {/* ── Contact ── */}
            <SectionHeader id="contact" label="Contact" icon={User} collapsed={collapsedSections.has("contact")} onToggle={toggleSection} />
            {!collapsedSections.has("contact") && (
              <div className="px-4 pb-3">
                <div className="bg-white/60 rounded-xl p-3.5 flex flex-col gap-2.5">
                  {[
                    selected.lead.phone && { icon: <Phone className="h-4 w-4" />, label: "Phone", value: selected.lead.phone, mono: true },
                    (selected.lead.Email ?? selected.lead.email) && { icon: <Mail className="h-4 w-4" />, label: "Email", value: selected.lead.Email ?? selected.lead.email },
                    (selected.lead.booked_call_date ?? selected.lead.bookedCallDate) && {
                      icon: <Calendar className="h-4 w-4" />,
                      label: "Booked Call",
                      value: new Date(selected.lead.booked_call_date ?? selected.lead.bookedCallDate)
                        .toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
                    },
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

                {/* Pipeline Status */}
                {lead && onUpdateLead && (
                  <div className="mt-2.5" data-testid="contact-pipeline-status">
                    <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5">Pipeline Status</div>
                    <Select
                      value={localStatus}
                      onValueChange={(val) => {
                        setLocalStatus(val);
                        onUpdateLead(lead.id, { Conversion_Status: val });
                      }}
                    >
                      <SelectTrigger className="h-9 text-[12px] rounded-lg bg-white/60 border-border/30">
                        <div className="flex items-center gap-2">
                          <CircleDot
                            className="h-4 w-4 shrink-0"
                            style={{ color: PIPELINE_HEX[localStatus] ?? "#6B7280" }}
                          />
                          <SelectValue />
                        </div>
                      </SelectTrigger>
                      <SelectContent>
                        {PIPELINE_STATUSES.map((s) => (
                          <SelectItem key={s} value={s} className="text-[12px]">
                            <div className="flex items-center gap-2">
                              <CircleDot
                                className="h-4 w-4 shrink-0"
                                style={{ color: PIPELINE_HEX[s] ?? "#6B7280" }}
                              />
                              {s}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Tags */}
                <div className="mt-2.5" data-testid="contact-tags">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide">
                      <Tag className="h-4 w-4" />
                      Tags
                    </div>
                    {lead && (
                      <Popover open={showTagPopover} onOpenChange={setShowTagPopover}>
                        <PopoverTrigger asChild>
                          <button
                            onClick={(e) => e.stopPropagation()}
                            className="h-10 w-10 rounded-full border border-border/40 flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-white/60"
                            title="Add tag"
                            data-testid="btn-add-tag"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                        </PopoverTrigger>
                        <PopoverContent
                          className="w-52 p-2 bg-white/95 backdrop-blur-sm"
                          align="end"
                          sideOffset={4}
                        >
                          <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-1.5 px-1">
                            Available Tags
                          </div>
                          {availableTags.length === 0 ? (
                            <div className="text-[11px] text-muted-foreground/60 italic px-1 py-2">
                              No more tags available
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
                    )}
                  </div>
                  {tagsLoading ? (
                    <div className="flex flex-wrap gap-1.5">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-6 w-16 rounded-full bg-muted animate-pulse" />
                      ))}
                    </div>
                  ) : leadTags.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {leadTags.map((t) => (
                        <span
                          key={t.id}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold group",
                            tagColorClass(t.color),
                          )}
                          title={t.category ? `${t.category}: ${t.name}` : t.name}
                        >
                          {t.name}
                          {lead && (
                            <button
                              onClick={() => handleRemoveTag(t.id)}
                              className="ml-0.5 opacity-0 group-hover:opacity-100 hover:text-red-600 transition-opacity"
                              title={`Remove ${t.name}`}
                              data-testid={`btn-remove-tag-${t.id}`}
                            >
                              <X className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/60 italic">No tags assigned.</div>
                  )}
                </div>
              </div>
            )}

            {/* ── Score & Pipeline ── */}
            <div className="border-t border-border/15" />
            <SectionHeader
              id="score"
              label="Score & Pipeline"
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
              <div className="px-4 pb-3 space-y-2">
                <div className="bg-white/60 rounded-xl p-3.5 flex flex-col gap-2" data-testid="lead-score">
                  <div className="flex items-center justify-between">
                    <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden mr-3">
                      <div
                        className={`h-full rounded-full transition-opacity duration-300 ${scoreBarColor(score)}`}
                        style={{ width: `${score}%` }}
                      />
                    </div>
                    <span className={`text-lg font-extrabold tabular-nums ${scoreTextColor(score)}`}>
                      {score}
                      <span className="text-xs font-normal text-muted-foreground">/100</span>
                    </span>
                  </div>
                </div>

                {/* Pipeline stage */}
                {stage && (
                  <div className="bg-white/60 rounded-xl p-3.5" data-testid="pipeline-stage">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border ${stage.color}`}>
                        {stage.label}
                      </span>
                      <span className="text-[11px] text-muted-foreground">{stage.description}</span>
                    </div>
                    <div className="mt-2 flex items-center gap-1">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className={`h-1.5 flex-1 rounded-full transition-colors ${
                            Number(selected.lead.current_bump_stage ?? 0) >= n ? "bg-primary" : "bg-muted"
                          }`}
                          title={`Bump ${n}`}
                        />
                      ))}
                    </div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      Bumps sent: {Number(selected.lead.current_bump_stage ?? 0)} / 3
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── Activity ── */}
            <div className="border-t border-border/15" />
            <SectionHeader id="activity" label="Activity" icon={ClipboardList} collapsed={collapsedSections.has("activity")} onToggle={toggleSection} />
            {!collapsedSections.has("activity") && (
              <div className="px-4 pb-3">
                <div className="bg-white/60 rounded-xl p-3.5 flex flex-col gap-2">
                  {[
                    { label: "Messages sent",      value: String(selected.lead.message_count_sent ?? selected.lead.messageCountSent ?? "\u2014") },
                    { label: "Messages received",  value: String(selected.lead.message_count_received ?? selected.lead.messageCountReceived ?? "\u2014") },
                    { label: "Total interactions", value: String(selected.lead.interaction_count ?? selected.lead.interactionCount ?? "\u2014") },
                    { label: "Last active",        value: formatRelativeTime(selected.lead.last_interaction_at || selected.lead.last_message_received_at) || "\u2014" },
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
            <div className="border-t border-border/15" />
            <SectionHeader
              id="notes"
              label="Notes"
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
              <div className="px-4 pb-3">
                <div className="bg-white/60 rounded-xl p-3.5">
                  {onUpdateLead ? (
                    <textarea
                      className="w-full text-[12px] text-foreground/80 leading-relaxed bg-transparent resize-none focus:outline-none min-h-[80px] placeholder:text-muted-foreground/40"
                      placeholder="Add notes about this lead..."
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
                      <p className="text-[12px] text-muted-foreground/50 italic">No notes yet</p>
                    )
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
