// Mobile Leads views — restyled to match the migration reference design
// (client/src/migration/extracted/mobile-leads.jsx). Routes entirely through
// design-system.css tokens (wine / neumorphic / serif / mono). Real CRM data
// hooks/props are preserved; only the presentation matches the reference.

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";
import {
  Plus,
  Loader2,
  FileText,
  Calendar,
  Star,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead } from "../../api/leadsApi";
import { PIPELINE_HEX, getInitials } from "@/lib/avatarUtils";

import type { ParsedNote } from "./types";
import { ALL_MOBILE_KANBAN_STAGES, PIPELINE_STAGES } from "./constants";
import { getLeadId, getFullName, getStatus, getScore } from "./leadUtils";
import { ContactWidget } from "./ContactWidget";
import { ConversationWidget } from "./ConversationWidget";
import { ScoreWidget } from "./ScoreWidgets";
import { LeadSummaryCard } from "./LeadSummaryCard";

// Re-export extracted components so existing imports from "./MobileViews" continue to work
export { LeadFilterBottomSheet } from "./FilterSheet";
export { MobileAddLeadForm } from "./MobileAddLeadForm";

// ── Stage helpers ──────────────────────────────────────────────────────────────
const STAGE_HEX = (status: string): string => PIPELINE_HEX[status] || "#6B7280";

/** Index of the lead's status within the linear pipeline (clamped to 0). */
function stageIndex(status: string): number {
  const idx = PIPELINE_STAGES.findIndex((s) => s.key === status);
  return idx < 0 ? 0 : idx;
}

// ── Temperature (derived from score, mirrors reference thresholds) ──────────────
type Temp = "Hot" | "Warm" | "Cold";
function scoreTemp(score: number): Temp {
  if (score >= 55) return "Hot";
  if (score >= 40) return "Warm";
  return "Cold";
}
const TEMP_STYLE: Record<Temp, { bg: string; fg: string; br: string }> = {
  Hot:  { bg: "rgba(162,75,63,0.10)",  fg: "#A24B3F", br: "rgba(162,75,63,0.22)" },
  Warm: { bg: "rgba(185,130,31,0.10)", fg: "#B9821F", br: "rgba(185,130,31,0.22)" },
  Cold: { bg: "rgba(84,123,176,0.10)", fg: "#547BB0", br: "rgba(84,123,176,0.22)" },
};

function MLTempBadge({ temp, label }: { temp: Temp; label: string }) {
  const c = TEMP_STYLE[temp];
  return (
    <span style={{
      fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.16em", textTransform: "uppercase",
      padding: "3px 9px", borderRadius: "var(--r-pill)", background: c.bg, color: c.fg, border: `1px solid ${c.br}`,
    }}>{label}</span>
  );
}

// ── Square, stage-tinted avatar ─────────────────────────────────────────────────
function MLAvatar({ name, status, size = 38, radius }: { name: string; status: string; size?: number; radius?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: radius != null ? radius : Math.round(size * 0.28),
      flexShrink: 0, background: STAGE_HEX(status),
      display: "flex", alignItems: "center", justifyContent: "center",
      color: "#fff", fontFamily: "var(--mono)", fontWeight: 600,
      fontSize: Math.round(size * 0.34), letterSpacing: "0.01em",
      boxShadow: "var(--sh-raised-crisp)",
    }}>{getInitials(name)}</div>
  );
}

// ── Mini score donut 0–100 ───────────────────────────────────────────────────────
function MLScoreArc({ score, size = 30, sw = 2.5 }: { score: number; size?: number; sw?: number }) {
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  const fill = (score / 100) * c;
  const color = score >= 55 ? "var(--good)" : score >= 40 ? "var(--warn)" : "var(--stage-contacted)";
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)", display: "block" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={sw} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={sw}
          strokeDasharray={`${fill} ${c - fill}`} strokeLinecap="round" />
      </svg>
      <div style={{
        position: "absolute", inset: 0, display: "flex", alignItems: "center",
        justifyContent: "center", fontFamily: "var(--mono)", fontSize: size < 34 ? 8.5 : 11,
        fontWeight: 700, color: "var(--ink)",
      }}>{score}</div>
    </div>
  );
}

// ── Segmented pipeline bar (hero) ────────────────────────────────────────────────
function MLPipelineBar({ stageIdx, t }: { stageIdx: number; t: (k: string, opts?: any) => string }) {
  const stages = PIPELINE_STAGES;
  const cur = stages[stageIdx] || stages[0];
  const curHex = STAGE_HEX(cur.key);
  return (
    <div>
      <div style={{ display: "flex", gap: 5, alignItems: "center" }}>
        {stages.map((s, i) => {
          const reached = i <= stageIdx, current = i === stageIdx;
          return (
            <div key={s.key} style={{
              flex: 1, height: current ? 10 : 6, borderRadius: "var(--r-pill)",
              background: reached ? STAGE_HEX(s.key) : "var(--line)",
              boxShadow: current ? "0 2px 7px rgba(0,0,0,0.16)"
                : reached ? "inset 0 1px 0 rgba(255,255,255,0.3)" : "none",
              transition: "background 260ms, height 260ms",
            }} />
          );
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 10 }}>
        <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
          {t("mobileDetail.stageOf", { current: stageIdx + 1, total: stages.length })}
        </span>
        <span style={{
          display: "inline-flex", alignItems: "center", gap: 7,
          background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)",
          borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px",
        }}>
          <span style={{ width: 8, height: 8, borderRadius: "50%", background: curHex }} />
          <span style={{ fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", color: curHex, fontWeight: 700 }}>
            {t(`kanban.stageLabels.${cur.key.replace(/ /g, "")}`, cur.key)}
          </span>
        </span>
      </div>
    </div>
  );
}

// ── parseLegacyNotes (internal helper) ─────────────────────────────────────────
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
    <div style={{ padding: "16px 16px 24px", display: "flex", flexDirection: "column", gap: 12 }} data-testid="mobile-notes-tab">
      {/* Header row: title + Add Note button */}
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="serif" style={{ fontSize: 19, color: "var(--ink)", letterSpacing: "-0.01em" }}>
          {t("mobileDetail.tabs.notes")}
        </span>
        {!adding && (
          <button
            onClick={() => setAdding(true)}
            className="la-btn la-btn--wine la-btn--pill"
            style={{ display: "flex", alignItems: "center", gap: 6 }}
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
          className="neu-inset"
          style={{ borderRadius: "var(--r-card)", padding: 12, display: "flex", flexDirection: "column", gap: 8 }}
          data-testid="mobile-add-note-form"
        >
          <textarea
            ref={textareaRef}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={t("notes.placeholder")}
            rows={4}
            className="neu-input"
            style={{ width: "100%", resize: "none", fontSize: 13, lineHeight: 1.55, padding: "10px 12px" }}
            data-testid="mobile-add-note-input"
          />
          <div className="row" style={{ justifyContent: "flex-end", gap: 8 }}>
            <button
              onClick={handleCancel}
              disabled={saving}
              className="la-btn la-btn--soft la-btn--pill"
              data-testid="mobile-add-note-cancel"
            >
              {t("common.cancel", "Cancel")}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || !noteText.trim()}
              className="la-btn la-btn--wine la-btn--pill"
              style={{ display: "flex", alignItems: "center", gap: 6, opacity: saving || !noteText.trim() ? 0.5 : 1 }}
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
          style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8, padding: "48px 0", textAlign: "center" }}
          data-testid="mobile-notes-empty"
        >
          <FileText className="h-8 w-8" style={{ color: "var(--mute-2)" }} />
          <p style={{ margin: 0, fontSize: 14, fontWeight: 500, color: "var(--mute)" }}>
            {t("mobileDetail.notes.emptyTitle", "No notes yet")}
          </p>
          <p style={{ margin: 0, fontSize: 12, color: "var(--mute-2)", maxWidth: 200 }}>
            {t("mobileDetail.notes.emptyHint", "Tap «Add Note» to add the first note for this lead.")}
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }} data-testid="mobile-notes-list">
          {notes.map((note, idx) => (
            <div
              key={idx}
              className="neu-raised"
              style={{ borderRadius: "var(--r-card)", padding: 12, display: "flex", flexDirection: "column", gap: 6 }}
              data-testid="mobile-note-card"
            >
              <div className="row" style={{ justifyContent: "space-between", gap: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--wine)" }} data-testid="mobile-note-author">
                  {currentUser}
                </span>
                {note.date && (
                  <span style={{ fontSize: 11, color: "var(--mute-2)", flexShrink: 0 }} data-testid="mobile-note-date">
                    {note.date}
                  </span>
                )}
              </div>
              <p style={{ margin: 0, fontSize: 13, lineHeight: 1.6, color: "var(--ink-soft)", whiteSpace: "pre-wrap" }} data-testid="mobile-note-content">
                {note.content}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Mobile full-screen lead detail panel ──────────────────────────────────────
type MLTabKey = "chat" | "summary" | "score" | "info";

export function MobileLeadDetailPanel({
  open,
  lead,
  onBack,
  onRefresh,
}: {
  open: boolean;
  lead: Record<string, any> | null;
  onBack: () => void;
  onRefresh?: () => void;
}) {
  const { t } = useTranslation("leads");
  const name   = lead ? getFullName(lead) : "";
  const status = lead ? getStatus(lead) : "";
  const leadId = lead ? getLeadId(lead) : null;
  const score  = lead ? getScore(lead) : 0;
  const temp   = scoreTemp(score);
  const stageIdx = stageIndex(status);
  const isBooked = status === "Booked";
  const hasSummary = Boolean(lead?.ai_summary || lead?.aiSummary || lead?.ai_memory || lead?.aiMemory);

  const [tab, setTab] = useState<MLTabKey>(hasSummary ? "summary" : "chat");
  useEffect(() => { setTab(hasSummary ? "summary" : "chat"); /* eslint-disable-next-line */ }, [leadId]);

  // ── Tag events (used by the Info tab via ContactWidget) ─────────────────────
  const [tagEvents, setTagEvents] = useState<{ name: string; color?: string; appliedAt?: string }[]>([]);
  useEffect(() => {
    if (!leadId) { setTagEvents([]); return; }
    Promise.all([
      apiFetch(`/api/leads/${leadId}/tags`).then((r) => r.ok ? r.json() : []),
      apiFetch(`/api/tags`).then((r) => r.ok ? r.json() : []),
    ]).then(([junctionRows, allTagsData]: [any[], any[]]) => {
      const tagById = new Map<number, any>(
        (Array.isArray(allTagsData) ? allTagsData : []).map((tg: any) => [tg.id ?? tg.Id, tg])
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

  const tabs: { key: MLTabKey; label: string }[] = [
    { key: "chat",    label: t("mobileDetail.tabs.chat") },
    { key: "summary", label: t("mobileDetail.tabs.summary", "Summary") },
    { key: "score",   label: t("mobileDetail.tabs.score", "Score") },
    { key: "info",    label: t("mobileDetail.tabs.info") },
  ];

  const lastActivity = lead
    ? lead.last_message_at || lead.lastMessageAt || lead.updated_at || lead.UpdatedAt || lead.created_at || lead.CreatedAt || null
    : null;
  const activityLabel = lastActivity
    ? new Date(lastActivity).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "—";

  return (
    <MobileSheet open={open && !!lead} onClose={onBack} data-testid="mobile-lead-detail-panel">
      {lead && (
      <>
      {/* ── Hero ── */}
      <div
        style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)", padding: "0 16px",
          paddingTop: 8 }}
      >
        <div className="row" style={{ gap: 12, alignItems: "center" }}>
          <MLAvatar name={name} status={status} size={46} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="row" style={{ gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <span className="serif" style={{ fontSize: 22, color: "var(--ink)", lineHeight: 1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{name}</span>
              <MLTempBadge temp={temp} label={t(`detailView.${temp.toLowerCase()}`, temp)} />
            </div>
            <div className="row" style={{ gap: 9, fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute)", letterSpacing: "0.1em", textTransform: "uppercase", flexWrap: "wrap" }}>
              <span>{t("mobileDetail.leadLabel", "Lead")} {leadId}</span>
              <span style={{ color: "var(--line-strong)" }}>·</span>
              <span>{t("mobileDetail.activityLabel", "Activity")} {activityLabel}</span>
            </div>
          </div>
        </div>

        {isBooked && (
          <div className="row" style={{ gap: 7, marginTop: 12 }}>
            <span style={{
              display: "inline-flex", alignItems: "center", gap: 6,
              background: "var(--warn-tint)", border: "1px solid rgba(196,138,47,0.4)",
              borderRadius: "var(--r-pill)", padding: "4px 11px 4px 9px",
              color: "var(--stage-booked)", fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700,
            }}>
              <Calendar className="h-3 w-3" />{t("detailView.booked", "Booked")}
            </span>
          </div>
        )}

        <div style={{ padding: "16px 0 14px" }}>
          <MLPipelineBar stageIdx={stageIdx} t={t} />
        </div>

        {/* tab switcher */}
        <div className="la-seg la-seg--fill" style={{ marginBottom: 12 }}>
          {tabs.map((tb) => (
            <button
              key={tb.key}
              onClick={() => setTab(tb.key)}
              className={`la-seg-btn${tb.key === tab ? " on" : ""}`}
              style={{ padding: "9px 0" }}
              data-testid={`lead-tab-${tb.key}`}
            >{tb.label}</button>
          ))}
        </div>
      </div>

      {/* ── Body ── */}
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {tab === "chat" && (
          <div data-testid="mobile-lead-chat" className="flex flex-col h-full" style={{ flex: 1, minHeight: 0 }}>
            <ConversationWidget lead={lead} showHeader={false} />
          </div>
        )}
        {tab === "summary" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            {hasSummary
              ? <div style={{ padding: 16 }}><LeadSummaryCard lead={lead} status={status} hideHeader /></div>
              : <div style={{ padding: "50px 20px", textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>{t("mobileDetail.noSummary", "No summary yet")}</div>}
          </div>
        )}
        {tab === "score" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: 16 }}>
            <ScoreWidget score={score} lead={lead} status={status} />
          </div>
        )}
        {tab === "info" && (
          <div style={{ flex: 1, minHeight: 0, overflowY: "auto" }}>
            <ContactWidget lead={lead} onRefresh={onRefresh} tags={tagEvents.map((te) => ({ name: te.name, color: te.color ?? "gray" }))} />
          </div>
        )}
      </div>

      </>
      )}
    </MobileSheet>
  );
}

// ── Mobile simplified kanban (pipeline board) ──────────────────────────────────
export function MobileSimpleKanban({
  leads,
  leadTagsInfo: _leadTagsInfo,
  onSelectLead,
  onMobileViewChange,
}: {
  leads: Record<string, any>[];
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  onSelectLead: (lead: Record<string, any>) => void;
  onMobileViewChange?: (v: "list" | "detail") => void;
}) {
  const { t } = useTranslation("leads");

  const grouped = useMemo(() => {
    const groups: Record<string, Record<string, any>[]> = {};
    for (const stage of ALL_MOBILE_KANBAN_STAGES) groups[stage.key] = [];
    for (const lead of leads) {
      const status = getStatus(lead);
      if (groups[status] !== undefined) groups[status].push(lead);
      else groups["New"].push(lead);
    }
    return groups;
  }, [leads]);

  return (
    <div
      className="flex-1 min-h-0"
      style={{ display: "flex", gap: 13, overflowX: "auto", overscrollBehaviorX: "contain", padding: "14px 14px 90px", scrollbarWidth: "none" } as React.CSSProperties}
      data-testid="mobile-simple-kanban"
    >
      {ALL_MOBILE_KANBAN_STAGES.map((stage) => {
        const stageLeads = grouped[stage.key] || [];
        const hex = STAGE_HEX(stage.key);
        const isStar = stage.key === "Booked";
        return (
          <div key={stage.key} style={{ flex: "0 0 248px", display: "flex", flexDirection: "column" }} data-testid={`mobile-kanban-col-${stage.key}`}>
            {/* Column header */}
            <div className="row" style={{ gap: 9, padding: "0 4px 11px" }}>
              <span style={{ width: 9, height: 9, borderRadius: 3, background: hex }} />
              <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }} data-testid={`mobile-kanban-stage-label-${stage.key}`}>
                {t(`kanban.stageLabels.${stage.key.replace(/ /g, "")}`, stage.key)}
              </span>
              {isStar && (
                <span style={{ display: "inline-flex", color: hex, border: `1px solid ${hex}`, borderRadius: 4, padding: "1px 4px" }}>
                  <Star className="h-2.5 w-2.5" fill={hex} />
                </span>
              )}
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-pill)", padding: "1px 8px", marginLeft: "auto" }} data-testid={`mobile-kanban-count-${stage.key}`}>
                {stageLeads.length}
              </span>
            </div>

            {/* Column well */}
            <div
              className="neu-inset"
              style={{
                flex: 1, borderRadius: "var(--r-card)", padding: 10, display: "flex", flexDirection: "column", gap: 9, minHeight: 120,
                background: isStar ? "var(--warn-tint)" : "var(--bg-2)",
                boxShadow: isStar ? "var(--sh-inset-crisp), inset 0 0 0 1.5px rgba(196,138,47,0.35)" : "var(--sh-inset-crisp)",
                overflowY: "auto",
              }}
            >
              {stageLeads.length === 0 ? (
                <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 70, fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--mute-2)" }}>
                  {t("mobileDetail.empty", "Empty")}
                </div>
              ) : (
                stageLeads.map((lead) => {
                  const name   = getFullName(lead);
                  const leadId = getLeadId(lead);
                  const score  = getScore(lead);
                  return (
                    <button
                      key={leadId}
                      onClick={() => { onSelectLead(lead); onMobileViewChange?.("detail"); }}
                      data-testid={`mobile-kanban-card-${leadId}`}
                      style={{
                        width: "100%", textAlign: "left", border: "none", cursor: "pointer",
                        background: "var(--card)", borderRadius: "var(--r-surface)", padding: "11px 12px",
                        boxShadow: "var(--sh-raised-crisp)", display: "flex", alignItems: "center", gap: 10,
                      }}
                    >
                      <MLAvatar name={name} status={getStatus(lead)} size={32} radius={9} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</div>
                      </div>
                      {score > 0 && <MLScoreArc score={score} size={26} />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
