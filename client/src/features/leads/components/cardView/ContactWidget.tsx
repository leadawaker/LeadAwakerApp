// ContactWidget extracted from LeadsCardView.tsx
import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Copy,
  Check,
  Mic,
  Square,
  Loader2,
  StickyNote,
  Save,
  CheckCircle2,
} from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { useWorkspace } from "@/hooks/useWorkspace";
import { resolveColor } from "@/features/tags/types";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { updateLead } from "../../api/leadsApi";
import { getLeadId } from "./leadUtils";
import { InlineEditField } from "./atoms";
import { formatRelativeTime } from "./formatUtils";
import { Card, CardLabel } from "./designPrimitives";

// ── Copy button ───────────────────────────────────────────────────────────────
function CopyContactBtn({ value }: { value: string }) {
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

export function ContactWidget({
  lead,
  onRefresh,
  accountLogo: accountLogoProp,
  campaignStickerUrl: campaignStickerUrlProp,
  tags,
  campaignsById,
  onPdf,
  onDelete,
  isDeleting,
  deleteConfirm,
  setDeleteConfirm,
  onToggleGradient,
  gradientTesterOpen,
  isAgencyUser,
}: {
  lead: Record<string, any>;
  onRefresh?: () => void;
  /** Pass from parent when already fetched to avoid duplicate API calls */
  accountLogo?: string | null;
  campaignStickerUrl?: string | null;
  /** Lead tags to display as pill badges in the Info tab */
  tags?: { name: string; color: string }[];
  /** Campaigns map (agency view only) for campaign assignment dropdown */
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  /** Action bar props — only rendered when onPdf is provided */
  onPdf?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  deleteConfirm?: boolean;
  setDeleteConfirm?: (v: boolean) => void;
  onToggleGradient?: () => void;
  gradientTesterOpen?: boolean;
  isAgencyUser?: boolean;
}) {
  const { t } = useTranslation("leads");
  const leadId    = getLeadId(lead);
  const phone     = lead.phone || lead.Phone || "";
  const email     = lead.email || lead.Email || "";
  const company   = lead.company || lead.Company || lead.company_name || "";
  const firstName = lead.first_name || lead.firstName || "";
  const lastName  = lead.last_name || lead.lastName || "";
  const createdAt = lead.created_at || lead.CreatedAt || lead.createdAt || "";

  // Fetch logo only when parent doesn't supply it (avoids duplicate requests).
  const [logoFetched, setLogoFetched] = useState<string | null>(null);
  useEffect(() => {
    if (accountLogoProp !== undefined) return;
    const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
    if (!accountId) { setLogoFetched(null); return; }
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => { if (!cancelled) setLogoFetched(data?.logo_url || null); })
      .catch(() => { if (!cancelled) setLogoFetched(null); });
    return () => { cancelled = true; };
  }, [accountLogoProp, lead.Accounts_id, lead.account_id, lead.accounts_id]);

  const [stickerFetched, setStickerFetched] = useState<string | null>(null);
  useEffect(() => {
    if (campaignStickerUrlProp !== undefined) return;
    const cId = lead.Campaigns_id || lead.campaigns_id || lead.campaignsId;
    if (!cId) { setStickerFetched(null); return; }
    let cancelled = false;
    apiFetch(`/api/campaigns/${cId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: any) => {
        if (cancelled) return;
        const slug = data?.campaign_sticker || data?.campaignSticker;
        const sticker = slug ? CAMPAIGN_STICKERS.find(s => s.slug === slug) : undefined;
        setStickerFetched(sticker?.url || null);
      })
      .catch(() => { if (!cancelled) setStickerFetched(null); });
    return () => { cancelled = true; };
  }, [campaignStickerUrlProp, lead.Campaigns_id, lead.campaigns_id, lead.campaignsId]);

  // ── Campaign list filtered by lead's account (agency view only) ───────────
  const { isAgencyView } = useWorkspace();
  const leadAccountId = Number(lead.Accounts_id || lead.account_id || lead.accounts_id || 0);
  const accountCampaigns = useMemo(() => {
    if (!campaignsById || !leadAccountId) return [];
    return Array.from(campaignsById.entries())
      .filter(([, info]) => info.accountId === leadAccountId)
      .map(([id, info]) => ({ id, name: info.name }));
  }, [campaignsById, leadAccountId]);

  // ── Notes state ───────────────────────────────────────────────────────────
  const { toast: toastContact } = useToast();
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
              toastContact({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
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
            toastContact({ title: "Transcription failed", description: "Network error.", variant: "destructive" });
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
      toastContact({ title: "Microphone access denied", description: "Allow microphone access to record.", variant: "destructive" });
    }
  }, [leadId, toastContact]);

  const stopNotesVoice = useCallback(() => {
    if (notesTimerRef.current) { clearInterval(notesTimerRef.current); notesTimerRef.current = null; }
    notesMediaRecorderRef.current?.stop();
    notesMediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  const editableRows: { label: string; value: string; field: string; copy?: boolean; type?: string }[] = [
    { label: t("contact.firstName"),  value: firstName, field: "first_name" },
    { label: t("contact.lastName"),   value: lastName,  field: "last_name" },
    { label: t("contact.phone"),      value: phone,     field: "phone", copy: true, type: "tel" },
    { label: t("contact.email"),      value: email,     field: "email", copy: true, type: "email" },
  ];

  return (
    <Card headLeft={<CardLabel>{t("contact.title")}</CardLabel>} variant="flat" style={{ flex: 1, minWidth: 0, width: "100%", height: "100%" }}>
      <div style={{ flex: 1, overflowY: "auto", padding: 16, display: "flex", flexDirection: "column" }}>
        <div className="flex flex-col">
          {editableRows.map((row) => (
            <div key={row.label} className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">
                {row.label}
              </span>
              <div className="min-h-[1.125rem] flex items-center gap-1">
                <div className="flex-1 min-w-0">
                  <InlineEditField
                    value={row.value}
                    field={row.field}
                    leadId={leadId}
                    onSaved={onRefresh}
                    type={row.type}
                  />
                </div>
                {row.copy && row.value && <CopyContactBtn value={row.value} />}
              </div>
            </div>
          ))}
          {/* Company (read-only) */}
          {company && (
            <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">
                {t("contact.company")}
              </span>
              <span className="text-[12px] font-semibold text-foreground leading-snug">{company}</span>
            </div>
          )}
          {/* Tags */}
          {tags && tags.length > 0 && (
            <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0" data-testid="info-tab-tags">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">
                {t("detail.sections.tags", "Tags")}
              </span>
              <div className="flex flex-wrap gap-1.5 mt-1">
                {tags.map((tag) => {
                  const hex = resolveColor(tag.color);
                  return (
                    <span
                      key={tag.name}
                      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold border"
                      style={{ backgroundColor: `${hex}22`, color: hex, borderColor: `${hex}44` }}
                    >
                      {tag.name}
                    </span>
                  );
                })}
              </div>
            </div>
          )}
          {/* Created */}
          {createdAt && (
            <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">
                {t("contact.created")}
              </span>
              <div className="min-h-[1.125rem]">
                <span className="text-[12px] font-semibold text-foreground leading-snug">
                  {formatRelativeTime(createdAt, t)}
                </span>
              </div>
            </div>
          )}
          {/* Source */}
          {(lead.source || lead.Source) && (
            <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">{t("detailView.source")}</span>
              <span className="text-[12px] font-semibold text-foreground leading-snug">{lead.source || lead.Source}</span>
            </div>
          )}
          {/* Campaign assignment dropdown (agency view only) */}
          {isAgencyView && (
            <div className="py-2.5 border-b border-border/20 last:border-0 last:pb-0">
              <span className="font-mono text-[8.5px] uppercase tracking-[0.16em] text-[var(--mute-2)] block leading-none mb-1">
                {t("detail.fields.campaign")}
              </span>
              <select
                value={String(lead.Campaigns_id ?? lead.campaigns_id ?? lead.campaignsId ?? "")}
                onChange={async (e) => {
                  const val = e.target.value;
                  try {
                    await updateLead(leadId, { campaignsId: val ? Number(val) : (null as any) });
                    onRefresh?.();
                  } catch { /* noop */ }
                }}
                className="text-[12px] bg-transparent border border-dashed border-border/60 rounded px-1.5 py-0.5 max-w-[160px] focus:outline-none focus:ring-1 focus:ring-brand-indigo/50 text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
              >
                <option value="">{"—"}</option>
                {accountCampaigns.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
              </select>
            </div>
          )}
        </div>

        {/* ── Notes ──────────────────────────────────────────────────────── */}
        <div className="mt-4 pt-4 border-t border-border/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 flex items-center gap-1.5">
              <StickyNote className="h-3 w-3" />
              {t("detail.sections.notes")}
            </span>
            <div className="flex items-center gap-1.5">
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
                  {t("notes.save", "Save")}
                </button>
              )}
              {notesSaved && !savingNotes && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
              {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
          <textarea
            value={localNotes}
            onChange={(e) => {
              setLocalNotes(e.target.value);
              setNotesDirty(e.target.value !== notesOriginalRef.current);
              setNotesSaved(false);
            }}
            onBlur={handleNotesSave}
            placeholder={t("notes.placeholder", "Add notes…")}
            rows={5}
            disabled={savingNotes || transcribing}
            className="w-full text-[12px] resize-none focus:outline-none disabled:opacity-60 placeholder:text-foreground/25"
            style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)", border: "none", padding: "9px 11px", lineHeight: 1.55 }}
          />
        </div>
      </div>
    </Card>
  );
}

// ── Notes section — standalone so it can be placed outside ContactWidget ──────
export function NotesSection({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { toast: toastContact } = useToast();

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
              toastContact({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
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
            toastContact({ title: "Transcription failed", description: "Network error.", variant: "destructive" });
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
      toastContact({ title: "Microphone access denied", description: "Allow microphone access to record.", variant: "destructive" });
    }
  }, [leadId, toastContact]);

  const stopNotesVoice = useCallback(() => {
    if (notesTimerRef.current) { clearInterval(notesTimerRef.current); notesTimerRef.current = null; }
    notesMediaRecorderRef.current?.stop();
    notesMediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  return (
    <Card headLeft={<CardLabel className="flex items-center gap-1.5"><StickyNote className="h-3 w-3" />{t("detail.sections.notes")}</CardLabel>} variant="flat" style={{ minWidth: 0, width: "100%" }}>
      <div style={{ padding: "4px 16px 16px" }}>
        <div className="flex items-center justify-end mb-2 gap-1.5">
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
              {t("notes.save", "Save")}
            </button>
          )}
          {notesSaved && !savingNotes && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
          {savingNotes && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
        </div>
        <textarea
          value={localNotes}
          onChange={(e) => {
            setLocalNotes(e.target.value);
            setNotesDirty(e.target.value !== notesOriginalRef.current);
            setNotesSaved(false);
          }}
          onBlur={handleNotesSave}
          placeholder={t("notes.placeholder", "Add notes…")}
          rows={5}
          disabled={savingNotes || transcribing}
          className="w-full text-[12px] resize-none focus:outline-none disabled:opacity-60 placeholder:text-foreground/25"
          style={{ background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", borderRadius: "var(--r-button)", border: "none", padding: "9px 11px", lineHeight: 1.55 }}
        />
      </div>
    </Card>
  );
}
