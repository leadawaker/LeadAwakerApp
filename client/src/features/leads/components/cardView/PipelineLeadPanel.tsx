import { useState, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Mic, Square, Loader2, Save, CheckCircle2, Calendar, X } from "lucide-react";
import { updateLead } from "../../api/leadsApi";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useScoreBreakdown } from "@/hooks/useScoreBreakdown";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { getLeadId, getFullName, getStatus, getScore } from "./leadUtils";
import { formatBookedDate } from "./formatUtils";
import { ConversationWidget } from "./ConversationWidget";
import { LeadSummaryCard } from "./LeadSummaryCard";
import { PipelineDashBar, ScoreArcDonut } from "./atoms";
import { ScoreWidget } from "./ScoreWidgets";
import { PIPELINE_HEX } from "./constants";

const getStatusAvatarColor = getLeadStatusAvatarColor;

/** Build a Google Calendar "add event" URL for a booked call (30-min default). */
function buildGoogleCalendarUrl(dateStr: string, title: string): string | null {
  const start = new Date(dateStr);
  if (isNaN(start.getTime())) return null;
  const end = new Date(start.getTime() + 30 * 60 * 1000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    dates: `${fmt(start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function PipelineLeadPanel({
  lead,
  onRefresh,
  accountTimezone,
  onClose,
}: {
  lead: Record<string, any>;
  onRefresh?: () => void;
  accountTimezone?: string;
  /** When provided, renders an X in the card's top-right corner that deselects the lead. */
  onClose?: () => void;
}) {
  const { t } = useTranslation("leads");
  const { toast } = useToast();
  const { isAgencyUser } = useWorkspace();

  const name = getFullName(lead);
  const status = getStatus(lead);
  const score = getScore(lead);
  const leadId = getLeadId(lead);
  const avatarColor = getStatusAvatarColor(status);
  const phone = lead.phone || lead.Phone || "";
  const email = lead.email || lead.Email || "";
  const bookedDate = lead.booked_call_date || lead.bookedCallDate || lead.booked_date || lead.BookedDate || lead.booked_at || "";
  const isBooked = status === "Booked";

  const { breakdown: detailBreakdown } = useScoreBreakdown(leadId ? Number(leadId) : null);
  const tier = detailBreakdown?.tier ?? (score === 0 ? "Sleeping" : null);

  // ── Tab state (Summary, Chat for agency only, Score, Notes) ───────────────
  const [activeTab, setActiveTab] = useState<"summary" | "chat" | "score" | "notes">("summary");

  // ── Notes state ──────────────────────────────────────────────────────────
  const { toast: toastNotes } = useToast();
  const currentNotes = lead.notes || lead.Notes || "";
  const [localNotes, setLocalNotes] = useState(currentNotes);
  const [notesDirty, setNotesDirty] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);
  const [savingNotes, setSavingNotes] = useState(false);
  const notesOriginalRef = useRef("");
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [transcribing, setTranscribing] = useState(false);
  const notesMediaRecorderRef = useRef<MediaRecorder | null>(null);
  const notesChunksRef = useRef<Blob[]>([]);
  const notesTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const n = lead.notes || lead.Notes || "";
    setLocalNotes(n);
    notesOriginalRef.current = n;
    setNotesDirty(false);
    setNotesSaved(false);
  }, [lead.id, lead.Id, lead.notes]);

  useEffect(() => {
    return () => {
      if (notesTimerRef.current) clearInterval(notesTimerRef.current);
      if (notesMediaRecorderRef.current) { try { notesMediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  const handleNotesSave = useCallback(async () => {
    if (!leadId || !notesDirty || savingNotes) return;
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      await updateLead(leadId, { notes: localNotes });
      notesOriginalRef.current = localNotes;
      setNotesDirty(false);
      setNotesSaved(true);
      setTimeout(() => setNotesSaved(false), 2000);
      onRefresh?.();
    } catch { /* noop */ } finally {
      setSavingNotes(false);
    }
  }, [leadId, localNotes, notesDirty, savingNotes, onRefresh]);

  const startNotesVoice = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      notesChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) notesChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(notesChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setTranscribing(true);
          try {
            const httpRes = await apiFetch(`/api/leads/${leadId}/transcribe-voice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_data: dataUrl, mime_type: mr.mimeType }),
            });
            const res = await httpRes.json() as any;
            if (!httpRes.ok || res.error) {
              const desc = res.error === "NO_GROQ_API_KEY" ? "Groq API key not configured." : res.detail || res.error || "Could not transcribe.";
              toastNotes({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
              return;
            }
            if (res.transcription) {
              setLocalNotes((prev: string) => {
                const sep = prev.trim() ? "\n\n" : "";
                const next = prev + sep + res.transcription;
                setNotesDirty(next !== notesOriginalRef.current);
                return next;
              });
            }
          } catch {
            toastNotes({ title: "Transcription failed", description: "Network error.", variant: "destructive" });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      notesMediaRecorderRef.current = mr;
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      notesTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toastNotes({ title: "Microphone access denied", description: "Allow microphone access to record.", variant: "destructive" });
    }
  }, [leadId, toastNotes]);

  const stopNotesVoice = useCallback(() => {
    if (notesTimerRef.current) { clearInterval(notesTimerRef.current); notesTimerRef.current = null; }
    notesMediaRecorderRef.current?.stop();
    notesMediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 12, padding: "14px 0", overflow: "hidden" }}>
      {/* ── Lead Info Card (avatar, name, contact, score donut, conversion) ── */}
      <div
        className="neu-raised"
        style={{
          position: "relative",
          margin: "0 12px",
          background: "var(--card)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--sh-raised-medium)",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {onClose && (
          <button
            onClick={onClose}
            title={t("common.close", "Close")}
            aria-label={t("common.close", "Close")}
            style={{
              position: "absolute", top: 8, right: 8, zIndex: 2,
              width: 24, height: 24, borderRadius: "50%", border: "none",
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "transparent", color: "var(--mute-2)", cursor: "pointer",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.background = "var(--bg)"; e.currentTarget.style.color = "var(--ink)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--mute-2)"; }}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
        <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 12 }}>
          {/* Avatar + Name (+ score donut on the right) */}
          <div style={{ display: "flex", gap: 11, alignItems: "center", paddingRight: onClose ? 22 : 0 }}>
            <EntityAvatar
              name={name}
              bgColor={avatarColor.bg}
              textColor={avatarColor.text}
              size={40}
              className="rounded-[12px] overflow-hidden shrink-0 shadow-[var(--sh-raised-crisp)]"
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: "var(--serif)", fontSize: 19, color: "var(--ink)", lineHeight: 1.1, letterSpacing: "-0.01em", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {name}
              </div>
            </div>
          </div>

          {/* Phone + Email (+ score donut aligned with the phone line) */}
          {(phone || email || score > 0) && (
            <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 5, fontSize: 11.5, color: "var(--mute)", fontFamily: "var(--mono)", letterSpacing: "0.02em" }}>
                {phone && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{phone}</div>}
                {email && <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{email}</div>}
              </div>
              {score > 0 && <ScoreArcDonut score={score} />}
            </div>
          )}
        </div>

        {/* ── Conversion status — bottom of the card. Booked → only booked:
               a small, squarish pill holding the date, with the "Booked"
               label below it. Clickable to open the calendar. ── */}
        {isBooked ? (() => {
          const bookedHex = PIPELINE_HEX["Booked"] ?? "#C48A2F";
          const gcalUrl = bookedDate ? buildGoogleCalendarUrl(bookedDate, t("kanban.callWith", { name }) || `Call with ${name}`) : null;
          return (
            <div style={{ padding: "10px 16px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <a
                href={gcalUrl ?? undefined}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => { if (!gcalUrl) e.preventDefault(); }}
                title={gcalUrl ? t("kanban.openInCalendar", "Open in calendar") : undefined}
                style={{
                  display: "flex", width: "100%", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "9px 13px", borderRadius: "var(--r-surface)",
                  background: bookedHex, boxShadow: `0 3px 10px ${bookedHex}55`,
                  textDecoration: "none", cursor: gcalUrl ? "pointer" : "default",
                }}
              >
                <Calendar className="h-[13px] w-[13px]" style={{ color: "#fff" }} />
                {bookedDate && (
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12.5, fontWeight: 700, color: "#fff", letterSpacing: "0.01em" }}>
                    {formatBookedDate(bookedDate, accountTimezone)}
                  </span>
                )}
              </a>
              <span style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: bookedHex, fontWeight: 700 }}>
                {t("kanban.stageLabels.Booked", "Booked")}
              </span>
            </div>
          );
        })() : (
          status && <PipelineDashBar status={status} />
        )}
      </div>

      {/* ── Tabs — default segmented switcher (matches topbar / list page) ── */}
      <div style={{ margin: "0 12px" }}>
        <div className="la-seg la-seg--fill">
          <button className={`la-seg-btn${activeTab === "summary" ? " on" : ""}`} onClick={() => setActiveTab("summary")}>
            {t("kanban.panelTabs.summary", "Summary")}
          </button>
          {isAgencyUser && (
            <button className={`la-seg-btn${activeTab === "chat" ? " on" : ""}`} onClick={() => setActiveTab("chat")}>
              {t("kanban.panelTabs.chat", "Chat")}
            </button>
          )}
          <button className={`la-seg-btn${activeTab === "score" ? " on" : ""}`} onClick={() => setActiveTab("score")}>
            {t("kanban.panelTabs.score", "Score")}
          </button>
          <button className={`la-seg-btn${activeTab === "notes" ? " on" : ""}`} onClick={() => setActiveTab("notes")}>
            {t("kanban.panelTabs.notes", "Notes")}
          </button>
        </div>
      </div>

      {/* ── Tab Content — summary/chat/score all read the same tight margin ── */}
      <div style={{ flex: 1, minHeight: 0, overflow: "auto", padding: activeTab === "notes" ? "0 12px" : activeTab === "chat" ? "0 2px" : "0 6px" }}>
        {activeTab === "summary" && <LeadSummaryCard lead={lead} tier={tier} status={status} hideHeader sidePad={8} />}

        {activeTab === "chat" && isAgencyUser && (
          <ConversationWidget lead={lead} showHeader={false} onTakeoverChange={() => {}} />
        )}

        {activeTab === "score" && <ScoreWidget score={score} lead={lead} status={status} />}

        {activeTab === "notes" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%", gap: 8 }}>
            {/* Voice recording + save buttons in bottom corner */}
            <div style={{ display: "flex", gap: 6, alignItems: "center", justifyContent: "flex-end", flexShrink: 0 }}>
              {transcribing ? (
                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
              ) : isRecordingVoice ? (
                <button
                  onClick={stopNotesVoice}
                  className="flex items-center gap-1 h-6 px-2 rounded-full bg-red-500/15 text-red-600 text-[11px] font-medium border border-red-300/60 hover:bg-red-500/25 transition-colors"
                >
                  <Square className="h-2.5 w-2.5 fill-current" />
                  {recordingSeconds}s
                </button>
              ) : (
                <button
                  onClick={startNotesVoice}
                  disabled={savingNotes || transcribing}
                  className="inline-flex items-center justify-center h-7 w-7 rounded-full border border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
                  title="Record voice memo"
                >
                  <Mic className="h-3.5 w-3.5" />
                </button>
              )}
              {notesDirty && !savingNotes && (
                <button
                  onClick={handleNotesSave}
                  className="inline-flex items-center gap-1 h-6 px-2 rounded-full border border-brand-indigo/30 text-brand-indigo text-[11px] font-medium hover:bg-brand-indigo/10 transition-colors"
                >
                  <Save className="h-2.5 w-2.5" />
                  Save
                </button>
              )}
              {notesSaved && !savingNotes && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
            {/* Notes textarea */}
            <textarea
              value={localNotes}
              onChange={(e) => {
                setLocalNotes(e.target.value);
                setNotesDirty(e.target.value !== notesOriginalRef.current);
                setNotesSaved(false);
              }}
              onBlur={handleNotesSave}
              placeholder="Add notes…"
              disabled={savingNotes || transcribing}
              className="w-full flex-1 text-[12px] resize-none focus:outline-none disabled:opacity-60 placeholder:text-foreground/25 p-2"
              style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)", border: "none", lineHeight: 1.55 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
