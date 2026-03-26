// Mobile views extracted from LeadsCardView.tsx

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import {
  Plus,
  Loader2,
  FileText,
  ChevronLeft,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead } from "../../api/leadsApi";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";

import type {
  MobileDetailTab,
  ParsedNote,
} from "./types";
import {
  ALL_MOBILE_KANBAN_STAGES,
  STATUS_COLORS,
  PIPELINE_HEX,
} from "./constants";
import { getLeadId, getFullName, getStatus } from "./leadUtils";
import { ContactWidget } from "./ContactWidget";
import { ConversationWidget } from "./ConversationWidget";

// Re-export extracted components so existing imports from "./MobileViews" continue to work
export { LeadFilterBottomSheet } from "./FilterSheet";
export { MobileAddLeadForm } from "./MobileAddLeadForm";

// ── parseLegacyNotes (internal helper) ────────────────────────────────────────
function parseLegacyNotes(raw: string): ParsedNote[] {
  if (!raw || !raw.trim()) return [];
  // Split on blank lines to get individual note segments
  const segments = raw.split(/\n\n+/);
  return segments
    .map((seg): ParsedNote => {
      const trimmed = seg.trim();
      if (!trimmed) return null as any;
      // Match leading [date] prefix like [3/9/2024]
      const match = trimmed.match(/^\[([^\]]+)\]\s*/);
      if (match) {
        const dateStr = match[1];
        const content = trimmed.slice(match[0].length).trim();
        // Try to parse as a date
        const ts = new Date(dateStr);
        const isValidDate = !isNaN(ts.getTime());
        return {
          date: isValidDate
            ? ts.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
            : dateStr,
          content: content || trimmed,
          rawTs: isValidDate ? ts.toISOString() : dateStr,
        };
      }
      return { date: null, content: trimmed, rawTs: null };
    })
    .filter(Boolean)
    .reverse(); // most-recent first
}

// ── Mobile Notes Tab (Feature #38) ────────────────────────────────────────────
export function MobileNotesTab({
  lead,
  onRefresh,
}: {
  lead: Record<string, any>;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const leadId = lead.Id ?? lead.id ?? 0;
  const rawNotes = lead.notes || lead.Notes || "";

  const [adding, setAdding] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentUser = localStorage.getItem("leadawaker_user_name") || "Agent";

  useEffect(() => {
    if (adding && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [adding]);

  const notes = useMemo(() => parseLegacyNotes(rawNotes), [rawNotes]);

  const handleSave = useCallback(async () => {
    const trimmed = noteText.trim();
    if (!trimmed) return;
    setSaving(true);
    try {
      const dateStamp = new Date().toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
      });
      const entry = `[${dateStamp}] ${trimmed}`;
      const updated = rawNotes.trim() ? `${rawNotes.trim()}\n\n${entry}` : entry;
      await updateLead(leadId, { notes: updated });
      setNoteText("");
      setAdding(false);
      onRefresh?.();
      toast({ title: t("notes.saved") });
    } catch {
      toast({ title: t("notes.save"), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [noteText, rawNotes, leadId, onRefresh, toast, t]);

  const handleCancel = useCallback(() => {
    setNoteText("");
    setAdding(false);
  }, []);

  return (
    <div className="px-4 pt-4 pb-6 flex flex-col gap-3" data-testid="mobile-notes-tab">
      {/* Header row: title + Add Note button */}
      <div className="flex items-center justify-between">
        <p className="text-[17px] font-semibold font-heading text-foreground">
          {t("mobileDetail.tabs.notes")}
        </p>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="flex items-center gap-1.5 h-8 px-3 rounded-full bg-brand-indigo text-white text-[12px] font-medium active:scale-95 transition-transform"
            data-testid="mobile-add-note-btn"
          >
            <Plus className="h-3.5 w-3.5" />
            {t("mobileDetail.notes.addNote", "Add Note")}
          </button>
        )}
      </div>

      {/* Inline Add Note form */}
      {adding && (
        <div
          className="rounded-xl border border-brand-indigo/40 bg-card p-3 flex flex-col gap-2"
          data-testid="mobile-add-note-form"
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t("notes.placeholder")}
            rows={4}
            className="w-full resize-none rounded-lg bg-transparent text-[14px] text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            data-testid="mobile-add-note-input"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="h-8 px-3 rounded-full border border-border text-[12px] text-muted-foreground active:scale-95 transition-transform"
              data-testid="mobile-add-note-cancel"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
              className="h-8 px-3 rounded-full bg-brand-indigo text-white text-[12px] font-medium disabled:opacity-50 active:scale-95 transition-transform flex items-center gap-1"
              data-testid="mobile-add-note-save"
            >
              {saving && <Loader2 className="h-3 w-3 animate-spin" />}
              {t("notes.save")}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {notes.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center gap-2 py-12 text-center"
          data-testid="mobile-notes-empty"
        >
          <FileText className="h-8 w-8 text-muted-foreground/40" />
          <p className="text-[14px] font-medium text-muted-foreground">
            {t("mobileDetail.notes.emptyTitle", "No notes yet")}
          </p>
          <p className="text-[12px] text-muted-foreground/60 max-w-[200px]">
            {t("mobileDetail.notes.emptyHint", "Tap «Add Note» to add the first note for this lead.")}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3" data-testid="mobile-notes-list">
          {notes.map((note, idx) => (
            <div
              key={idx}
              className="rounded-xl bg-card border border-border/50 p-3 flex flex-col gap-1.5"
              data-testid="mobile-note-card"
            >
              {/* Author + Date row */}
              <div className="flex items-center justify-between gap-2">
                <span
                  className="text-[12px] font-semibold text-brand-indigo"
                  data-testid="mobile-note-author"
                >
                  {currentUser}
                </span>
                {note.date && (
                  <span
                    className="text-[11px] text-muted-foreground shrink-0"
                    data-testid="mobile-note-date"
                  >
                    {note.date}
                  </span>
                )}
              </div>
              {/* Content */}
              <p
                className="text-[13px] text-foreground leading-relaxed whitespace-pre-wrap"
                data-testid="mobile-note-content"
              >
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile full-screen lead detail panel (Feature #34) ────────────────────────
export function MobileLeadDetailPanel({
  lead,
  onBack,
  onRefresh,
}: {
  lead: Record<string, any>;
  onBack: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("leads");
  const [activeTab, setActiveTab] = useState<MobileDetailTab>("info");
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const name   = getFullName(lead);
  const status = getStatus(lead);
  const leadId = getLeadId(lead);
  const statusColors = STATUS_COLORS[status] ?? { bg: "bg-muted", text: "text-muted-foreground", dot: "bg-zinc-400", badge: "bg-zinc-100 text-zinc-600 border-zinc-200" };

  // ── Tag events (needed for ActivityTimeline) ────────────────────────────────
  const [tagEvents, setTagEvents] = useState<{ name: string; color?: string; appliedAt?: string }[]>([]);

  useEffect(() => {
    if (!leadId) { setTagEvents([]); return; }
    Promise.all([
      apiFetch(`/api/leads/${leadId}/tags`).then((r) => r.ok ? r.json() : []),
      apiFetch(`/api/tags`).then((r) => r.ok ? r.json() : []),
    ]).then(([junctionRows, allTagsData]: [any[], any[]]) => {
      const tagById = new Map<number, any>(
        (Array.isArray(allTagsData) ? allTagsData : []).map((t: any) => [t.id ?? t.Id, t])
      );
      const arr = Array.isArray(junctionRows) ? junctionRows : [];
      setTagEvents(arr.map((e: any) => {
        const tid = e.tagsId ?? e.Tags_id;
        const tag = tagById.get(Number(tid));
        return {
          name:      tag?.name  || tag?.Name  || `Tag #${tid ?? "?"}`,
          color:     tag?.color || tag?.Color || "gray",
          appliedAt: e.created_at ?? e.CreatedAt ?? null,
        };
      }));
    }).catch(() => setTagEvents([]));
  }, [leadId]);

  // Glassmorphism blur: activate when content is scrolled
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 2);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  const MOBILE_TABS: { id: MobileDetailTab; label: string }[] = [
    { id: "info", label: t("mobileDetail.tabs.info") },
    { id: "chat", label: t("mobileDetail.tabs.chat") },
  ];

  // Shared glassmorphism style for sticky headers (blur(12px) saturate(1.2) per spec)
  const glassmorphismStyle: React.CSSProperties = {
    backgroundColor: isScrolled ? "hsl(var(--background) / 0.75)" : "hsl(var(--background))",
    backdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
    WebkitBackdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
    transition: "backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background-color 200ms ease",
  };

  return createPortal(
    <motion.div
      variants={{
        initial: { x: "100%" },
        animate: { x: 0, transition: { type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] } },
        exit:    { x: "100%", transition: { type: "tween", duration: 0.3, ease: [0.4, 0.0, 1, 1] } },
      }}
      initial="initial"
      animate="animate"
      exit="exit"
      className="lg:hidden fixed inset-0 z-[200] flex flex-col bg-background"
      style={{ height: "100dvh" }}
    >
      {/* ── Sticky header: back + name + status badge ── */}
      <div
        className="shrink-0 flex items-center gap-3 px-4 py-3 border-b border-border/20"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)", ...glassmorphismStyle }}
      >
        <button
          onClick={onBack}
          className="h-9 w-9 rounded-full border border-border/50 bg-card grid place-items-center shrink-0 active:scale-95 transition-transform touch-target"
          aria-label="Back to leads list"
        >
          <ChevronLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-[17px] font-semibold font-heading truncate">{name}</h2>
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold border shrink-0",
              statusColors.badge
            )}>
              {t(`kanban.stageLabels.${status.replace(/ /g, "")}`, status)}
            </span>
          </div>
          {(lead.campaign_name || lead.account_name) && (
            <div className="flex items-center gap-2 mt-0.5">
              {lead.campaign_name && (
                <span className="text-[10px] text-muted-foreground/60 truncate">{lead.campaign_name}</span>
              )}
              {lead.campaign_name && lead.account_name && (
                <span className="text-muted-foreground/30 text-[10px]">·</span>
              )}
              {lead.account_name && (
                <span className="text-[10px] text-muted-foreground/60 truncate">{lead.account_name}</span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* ── Tab bar — also gets glassmorphism blur on scroll ── */}
      <div
        className="shrink-0 flex border-b border-border/20 relative"
        style={glassmorphismStyle}
      >
        {MOBILE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            data-testid={`lead-tab-${tab.id}`}
            className={cn(
              "flex-1 py-3 min-h-[44px] text-[13px] font-medium transition-colors",
              activeTab === tab.id
                ? "text-brand-indigo"
                : "text-muted-foreground"
            )}
          >
            {tab.label}
          </button>
        ))}
        {/* Animated sliding indicator — uses transform, no transition-all */}
        <span
          className="absolute bottom-0 h-0.5 bg-brand-indigo rounded-full pointer-events-none"
          style={{
            width: `${100 / MOBILE_TABS.length}%`,
            transform: `translateX(${MOBILE_TABS.findIndex((t) => t.id === activeTab) * 100}%)`,
            transition: "transform 150ms ease",
          }}
        />
      </div>

      {/* ── Tab content (scrollable) ── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      >
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className={activeTab === "chat" ? "flex flex-col h-full" : undefined}
          >
            {activeTab === "info" && (
              <ContactWidget lead={lead} onRefresh={onRefresh} tags={tagEvents?.map(te => ({ name: te.name, color: te.color ?? "gray" }))} />
            )}
            {activeTab === "chat" && (
              <div data-testid="mobile-lead-chat" className="flex flex-col h-full">
                <ConversationWidget lead={lead} showHeader={false} readOnly />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>,
    document.body
  );
}

// ── Mobile simplified kanban (Feature #39) ─────────────────────────────────────
export function MobileSimpleKanban({
  leads,
  leadTagsInfo,
  onSelectLead,
  onMobileViewChange,
}: {
  leads: Record<string, any>[];
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  onSelectLead: (lead: Record<string, any>) => void;
  onMobileViewChange?: (v: "list" | "detail") => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    for (const stage of ALL_MOBILE_KANBAN_STAGES) groups[stage.key] = [];
    for (const lead of leads) {
      const status = getStatus(lead);
      if (groups[status] !== undefined) {
        groups[status].push(lead);
      } else {
        // Unknown status falls into "New"
        groups["New"].push(lead);
      }
    }
    return groups;
  }, [leads]);

  return (
    <div
      className="flex-1 min-h-0 overflow-x-auto"
      style={{ overscrollBehaviorX: "contain" } as React.CSSProperties}
      data-testid="mobile-simple-kanban"
    >
      <div
        className="flex h-full gap-[3px] px-[3px] pb-[3px]"
        style={{ minWidth: `${ALL_MOBILE_KANBAN_STAGES.length * 152}px` }}
      >
        {ALL_MOBILE_KANBAN_STAGES.map((stage) => {
          const stageLeads = grouped[stage.key] || [];
          const hex = PIPELINE_HEX[stage.key] || "#6B7280";

          return (
            <div
              key={stage.key}
              className="flex flex-col rounded-lg overflow-hidden flex-shrink-0 bg-card"
              style={{ width: "148px", minWidth: "148px" }}
              data-testid={`mobile-kanban-col-${stage.key}`}
            >
              {/* Column header */}
              <div
                className="px-2 py-1.5 flex items-center gap-1.5 shrink-0"
                style={{ borderBottom: `1px solid ${hex}25` }}
              >
                <span
                  className="h-2 w-2 rounded-full shrink-0 flex-shrink-0"
                  style={{ backgroundColor: hex }}
                />
                <span
                  className="text-[11px] font-semibold flex-1 truncate"
                  style={{ color: hex }}
                  data-testid={`mobile-kanban-stage-label-${stage.key}`}
                >
                  {stage.short}
                </span>
                <span
                  className="text-[11px] font-bold tabular-nums shrink-0 text-muted-foreground/70"
                  data-testid={`mobile-kanban-count-${stage.key}`}
                >
                  {stageLeads.length}
                </span>
              </div>

              {/* Lead cards */}
              <div className="flex-1 overflow-y-auto py-0.5 px-[3px] space-y-[2px]">
                {stageLeads.length === 0 ? (
                  <div className="py-3 flex items-center justify-center">
                    <span className="text-[9px] text-muted-foreground/30 select-none">Empty</span>
                  </div>
                ) : (
                  stageLeads.map((lead) => {
                    const name     = getFullName(lead);
                    const leadId   = getLeadId(lead);
                    const avatarCl = getLeadStatusAvatarColor(getStatus(lead));
                    const shortNm  = name.length > 11 ? name.slice(0, 10) + "…" : name;
                    return (
                      <button
                        key={leadId}
                        className="w-full text-left flex items-center gap-1.5 rounded-lg bg-background/60 px-1.5 py-1 min-h-[44px] active:bg-brand-indigo/10 transition-colors"
                        data-testid={`mobile-kanban-card-${leadId}`}
                        onClick={() => {
                          onSelectLead(lead);
                          onMobileViewChange?.("detail");
                        }}
                      >
                        <EntityAvatar
                          name={name}
                          bgColor={avatarCl.bg}
                          textColor={avatarCl.text}
                          size={28}
                          className="shrink-0"
                        />
                        <span className="text-[10px] font-medium truncate text-foreground leading-tight">
                          {shortNm}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

