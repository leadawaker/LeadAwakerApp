// Detail panel widgets extracted from LeadsCardView.tsx

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { cn, relativeTime } from "@/lib/utils";
import {
  Plus,
  BookUser,
  Mic,
  Square,
  Loader2,
  Activity,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { apiFetch } from "@/lib/apiUtils";
import { useToast } from "@/hooks/use-toast";
import { updateLead } from "../../api/leadsApi";
import { useInteractionsPaginated } from "@/hooks/useApiData";
import { renderRichText } from "@/lib/richTextUtils";
import type { Interaction } from "@/types/models";
import { getLeadId, getStatus } from "./leadUtils";
import { formatMsgTime } from "./formatUtils";
import { TIMELINE_ICON, AI_TRIGGERED_BY } from "./constants";
import type { TimelineEvent } from "./types";

// ── Local helper: detect AI-generated messages ────────────────────────────────
function isAiMsg(item: Interaction): boolean {
  if ((item.ai_generated ?? item.aiGenerated) === true) return true;
  if ((item.is_bump ?? item.isBump) === true) return true;
  const triggeredBy = (item.triggered_by ?? item.triggeredBy ?? "").toLowerCase();
  if (AI_TRIGGERED_BY.has(triggeredBy)) return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

// ── Team widget — users managing this lead's account ─────────────────────────
export function TeamWidget({ lead, onRefresh, inline }: { lead: Record<string, any>; onRefresh?: () => void; inline?: boolean }) {
  const { t } = useTranslation("leads");
  const accountId = lead.Accounts_id || lead.account_id || lead.accounts_id;
  const leadId = lead.Id ?? lead.id ?? 0;
  const [users, setUsers] = useState<any[]>([]);
  const [allUsers, setAllUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const teamMemberIds: number[] = useMemo(() => {
    const raw = lead.team_members || lead.teamMembers;
    if (!raw) return [];
    try {
      const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
      return Array.isArray(parsed) ? parsed.map(Number) : [];
    } catch { return []; }
  }, [lead.team_members, lead.teamMembers]);

  useEffect(() => {
    if (!accountId) { setUsers([]); setAllUsers([]); setLoading(false); return; }
    setLoading(true);
    apiFetch("/api/users")
      .then(async (r) => {
        const data = r.ok ? await r.json() : [];
        const list = Array.isArray(data) ? data : data?.list || [];
        setAllUsers(list);
        const relevant = list.filter((u: any) => {
          const role = u.role || u.Role || "";
          const uAccountId = u.Accounts_id || u.accounts_id || u.account_id;
          const uid = u.id || u.Id;
          if (teamMemberIds.includes(Number(uid))) return true;
          if (role === "Admin" || role === "Operator") return true;
          if (role === "Manager" && Number(uAccountId) === Number(accountId)) return true;
          return false;
        });
        setUsers(relevant);
      })
      .catch(() => { setUsers([]); setAllUsers([]); })
      .finally(() => setLoading(false));
  }, [accountId, teamMemberIds]);

  const handleAddMember = useCallback(async (userId: number) => {
    const newIds = Array.from(new Set([...teamMemberIds, userId]));
    try {
      await updateLead(leadId, { team_members: JSON.stringify(newIds) });
      onRefresh?.();
    } catch { /* noop */ }
    setAddOpen(false);
  }, [teamMemberIds, leadId, onRefresh]);

  const handleRemoveMember = useCallback(async (userId: number) => {
    const newIds = teamMemberIds.filter((id) => id !== userId);
    try {
      await updateLead(leadId, { team_members: JSON.stringify(newIds) });
      onRefresh?.();
    } catch { /* noop */ }
  }, [teamMemberIds, leadId, onRefresh]);

  const availableToAdd = allUsers.filter((u: any) => {
    const uid = u.id || u.Id;
    // Only users of this account (or agency-wide Admin/Operator) can be added
    const uAccountId = u.Accounts_id || u.accounts_id || u.account_id;
    const uRole = u.role || u.Role || "";
    const isAccountMatch = Number(uAccountId) === Number(accountId) || uRole === "Admin" || uRole === "Operator";
    if (!isAccountMatch) return false;
    return !users.some((existing: any) => (existing.id || existing.Id) === uid);
  });

  const roleColors: Record<string, { bg: string; text: string }> = {
    Admin:    { bg: "#EDE9FE", text: "#6D28D9" },
    Operator: { bg: "#DBEAFE", text: "#2563EB" },
    Manager:  { bg: "#D1FAE5", text: "#065F46" },
  };

  const teamContent = (
    <>
      <div className="flex items-center justify-between mb-3">
        <p className={cn(inline ? "text-[10px] font-medium uppercase tracking-wider text-foreground/40" : "text-[18px] font-semibold font-heading text-foreground")}>{t("team.title")}</p>
        <Popover open={addOpen} onOpenChange={setAddOpen}>
          <PopoverTrigger asChild>
            <button className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors">
              <Plus className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-56 p-2" sideOffset={4}>
            <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50 px-2 py-1">{t("team.addTeamMember")}</p>
            {availableToAdd.length === 0 ? (
              <p className="text-[11px] text-muted-foreground/50 px-2 py-2">{t("team.noMoreUsers")}</p>
            ) : (
              <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                {availableToAdd.map((u: any) => {
                  const uName = u.full_name_1 || u.fullName1 || u.fullName || u.full_name || u.name || u.email || u.Email || "Unknown";
                  const uRole = u.role || u.Role || "";
                  return (
                    <button
                      key={u.id || u.Id}
                      onClick={() => handleAddMember(u.id || u.Id)}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/60 text-left transition-colors"
                    >
                      <span className="text-[12px] font-medium text-foreground truncate">{uName}</span>
                      <span className="text-[9px] text-muted-foreground/60 uppercase">{uRole}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>
      {loading ? (
        <div className="flex flex-col gap-3 py-2">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-center gap-2.5 animate-pulse">
              <div className="h-9 w-9 rounded-full bg-foreground/10" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 bg-foreground/10 rounded w-2/3" />
                <div className="h-2.5 bg-foreground/8 rounded w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : users.length === 0 ? (
        <p className="text-[12px] text-muted-foreground/50 italic mt-1">No team members assigned</p>
      ) : (
        <div className="flex flex-col gap-3">
          {users.map((u: any) => {
            const name = u.full_name_1 || u.fullName1 || u.fullName || u.full_name || u.name || u.email || u.Email || "Unknown";
            const role = u.role || u.Role || "";
            const email = u.email || u.Email || "";
            const avatarUrl = u.avatar_url || u.avatarUrl || "";
            const initials = name.split(" ").map((w: string) => w[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
            const rc = roleColors[role] || { bg: "#F4F4F5", text: "#52525B" };
            return (
              <div key={u.id || u.Id || name} className="flex items-center gap-2.5">
                <div
                  className="h-9 w-9 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 overflow-hidden"
                  style={{ backgroundColor: rc.bg, color: rc.text }}
                >
                  {avatarUrl ? (
                    <img src={avatarUrl} alt={name} className="h-full w-full object-cover" />
                  ) : (
                    initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground leading-tight truncate">{name}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span
                      className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
                      style={{ backgroundColor: rc.bg, color: rc.text }}
                    >
                      {role}
                    </span>
                    {email && (
                      <span className="text-[10px] text-muted-foreground/60 truncate">{email}</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );

  if (inline) return teamContent;

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col h-full overflow-y-auto">
      {teamContent}
    </div>
  );
}

// ── Notes widget (click-to-edit + voice memo + AI notes) ─────────────────────
export function NotesWidget({ lead, onRefresh }: { lead: Record<string, any>; onRefresh?: () => void }) {
  const { t } = useTranslation("leads");
  const leadId = lead.Id ?? lead.id ?? 0;
  const currentNotes = lead.notes || lead.Notes || "";
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentNotes);
  const [saving, setSaving] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Voice recording state
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [transcribing, setTranscribing] = useState(false);

  const { toast } = useToast();

  useEffect(() => { setDraft(currentNotes); }, [currentNotes]);
  useEffect(() => {
    if (editing && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.selectionStart = textareaRef.current.value.length;
    }
  }, [editing]);
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  const save = useCallback(async () => {
    if (draft === currentNotes) { setEditing(false); return; }
    setSaving(true);
    try {
      await updateLead(leadId, { notes: draft });
      onRefresh?.();
    } catch { setDraft(currentNotes); } finally {
      setSaving(false);
      setEditing(false);
    }
  }, [draft, currentNotes, leadId, onRefresh]);

  const startVoiceRecording = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setTranscribing(true);
          try {
            console.log("[voice] Sending audio:", dataUrl.length, "chars, mime:", mr.mimeType);
            const httpRes = await apiFetch(`/api/leads/${leadId}/transcribe-voice`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ audio_data: dataUrl, mime_type: mr.mimeType }),
            });
            const res = await httpRes.json() as any;
            if (!httpRes.ok || res.error) {
              const desc = res.error === "NO_GROQ_API_KEY"
                ? "Groq API key not configured."
                : res.detail || res.error || "Could not transcribe audio. Try again.";
              console.error("[voice] Transcription error:", res);
              toast({ title: "Transcription failed", description: String(desc).slice(0, 200), variant: "destructive" });
              return;
            }
            if (res.transcription) {
              setDraft((prev: string) => {
                const sep = prev.trim() ? "\n\n" : "";
                return prev + sep + res.transcription;
              });
              setEditing(true);
            }
          } catch {
            toast({ title: "Transcription failed", description: "Network error. Try again.", variant: "destructive" });
          } finally {
            setTranscribing(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecordingVoice(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: "Microphone access denied", description: "Allow microphone access to record voice memos.", variant: "destructive" });
    }
  }, [leadId, toast]);

  const stopVoiceRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecordingVoice(false);
    setRecordingSeconds(0);
  }, []);

  return (
    <div className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-[21px] flex flex-col gap-3 min-h-full">
      {/* Header row: title + voice memo button */}
      <div className="flex items-center justify-between">
        <p className="text-[18px] font-semibold font-heading text-foreground">{t("detail.sections.notes")}</p>
        <div className="flex items-center gap-1.5">
          {transcribing ? (
            <div className="flex items-center gap-1.5 text-[10px] text-brand-indigo">
              <Loader2 className="h-3 w-3 animate-spin" />
              {t("chat.transcribing")}
            </div>
          ) : isRecordingVoice ? (
            <button
              onClick={stopVoiceRecording}
              className="flex items-center gap-1.5 h-9 px-3 rounded-full bg-red-500/15 text-red-600 text-[12px] font-medium border border-red-300/60 hover:bg-red-500/25 transition-colors"
              title={t("notes.stopRecording")}
            >
              <Square className="h-3 w-3 fill-current" />
              {recordingSeconds}s
            </button>
          ) : (
            <button
              onClick={startVoiceRecording}
              disabled={saving || transcribing}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full border border-black/[0.125] text-muted-foreground hover:text-foreground hover:border-black/[0.175] transition-colors disabled:opacity-50"
              title="Record voice memo (transcribe to text)"
            >
              <Mic className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      {/* Manual notes: click-to-edit */}
      {editing ? (
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setDraft(currentNotes); setEditing(false); }
          }}
          rows={8}
          className="text-[12px] bg-white/70 dark:bg-white/[0.07] border border-brand-indigo/30 rounded-lg px-2 py-1.5 w-full resize-none focus:outline-none focus:ring-1 focus:ring-brand-indigo/40 flex-1"
        />
      ) : currentNotes ? (
        <p
          className="text-[12px] text-foreground/80 leading-relaxed cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          {renderRichText(currentNotes)}
        </p>
      ) : (
        <p
          className="text-[12px] text-muted-foreground/50 italic mt-1 cursor-text hover:bg-muted/30 rounded-lg px-1 py-0.5 -mx-1 transition-colors"
          onClick={() => setEditing(true)}
        >
          {t("activity.clickToAddNotes")}
        </p>
      )}

    </div>
  );
}

// ── Activity timeline widget ──────────────────────────────────────────────────
export function ActivityTimeline({ lead, tagEvents }: {
  lead: Record<string, any>;
  tagEvents: { name: string; color?: string; appliedAt?: string }[];
}) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { interactions, total, totalPages, page, loading, error, nextPage, prevPage } =
    useInteractionsPaginated(leadId, 15);
  const status = getStatus(lead);

  // Build a unified timeline from interactions + tags + status events
  const timeline = useMemo(() => {
    const events: TimelineEvent[] = [];

    // Tag/status events only on page 1 (avoid repeating on every page)
    if (page === 1) {
      tagEvents.forEach((evt) => {
        events.push({
          ts: evt.appliedAt || "",
          styleKey: "tag",
          label: t("activity.tagApplied", { name: evt.name }),
        });
      });

      if (status === "Booked") {
        const bookedDate = lead.booked_call_date || lead.bookedCallDate || "";
        events.push({
          ts: bookedDate || lead.updated_at || "",
          styleKey: "booked",
          label: t("activity.callBooked"),
          detail: bookedDate ? t("activity.scheduledFor", { date: formatMsgTime(bookedDate) }) : undefined,
        });
      }

      if (status === "DND") {
        events.push({
          ts: lead.updated_at || "",
          styleKey: "dnd",
          label: t("activity.doNotDisturb"),
          detail: lead.dnc_reason || t("activity.leadRequestedNoContact"),
        });
      }

      if (lead.opted_out) {
        events.push({
          ts: lead.updated_at || "",
          styleKey: "optout",
          label: t("activity.optedOut"),
          detail: lead.dnc_reason || undefined,
        });
      }
    }

    // Interaction events (already paginated & sorted by server)
    interactions.forEach((item) => {
      const isAi = isAiMsg(item);
      const outbound = String(item.direction || "").toLowerCase() === "outbound";
      const raw = item.content || item.Content || "";
      const content = raw.substring(0, 120);
      const ellipsis = raw.length > 120 ? "…" : "";

      if (item.is_bump) {
        events.push({
          ts: item.created_at || "",
          styleKey: "bump",
          label: `AI Follow-up #${item.bump_stage || ""}`,
          detail: content ? `"${content}${ellipsis}"` : undefined,
        });
      } else {
        events.push({
          ts: item.created_at || "",
          styleKey: outbound ? (isAi ? "outbound_ai" : "outbound_agent") : "inbound",
          label: outbound ? (isAi ? "AI Message Sent" : "Agent Message Sent") : "Lead Replied",
          detail: content ? `"${content}${ellipsis}"` : undefined,
        });
      }
    });

    events.sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
    return events;
  }, [interactions, tagEvents, status, lead, page]);

  return (
    <div data-testid="activity-timeline" className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-4 md:p-8 flex flex-col h-full overflow-y-auto gap-6">
      <span className="text-[18px] font-semibold font-heading leading-tight text-foreground shrink-0">{t("activity.title")}</span>

      {loading ? (
        <div className="space-y-1">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5">
              <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
                <div className="h-3.5 w-3/5 bg-muted animate-pulse rounded" />
                <div className="h-3 w-4/5 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-8 bg-muted animate-pulse rounded shrink-0 mt-1" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="flex items-center justify-center py-8 px-4 flex-1">
          <p className="text-xs text-muted-foreground">{t("activity.loadError")}</p>
        </div>
      ) : timeline.length === 0 ? (
        <div data-testid="activity-timeline-empty" className="flex flex-col items-center justify-center text-center py-8 px-4 flex-1">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted mb-2">
            <Activity className="h-4 w-4 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">{t("activity.noRecentActivity")}</p>
          <p className="text-xs text-muted-foreground max-w-[240px] mt-1">
            {t("activity.emptyHint")}
          </p>
        </div>
      ) : (
        <div data-testid="activity-timeline-list" className="overflow-y-auto space-y-1 flex-1 min-h-0">
          {timeline.map((evt, i) => {
            const cfg = TIMELINE_ICON[evt.styleKey] ?? TIMELINE_ICON.inbound;
            const Icon = cfg.icon;
            return (
              <div
                key={`${evt.styleKey}-${i}`}
                data-testid={`activity-timeline-item`}
                data-activity-type={evt.styleKey}
                className="w-full flex items-start gap-2.5 bg-white/90 dark:bg-card/90 rounded-xl px-2 py-1.5 transition-colors hover:bg-white dark:hover:bg-card"
              >
                <div className={cn("shrink-0 flex items-center justify-center rounded-lg h-7 w-7", cfg.bg)}>
                  <Icon className={cn("h-4 w-4", cfg.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-medium text-foreground leading-snug truncate">{evt.label}</p>
                  {evt.detail && (
                    <p className="text-[11px] text-muted-foreground truncate mt-0.5">{evt.detail}</p>
                  )}
                </div>
                {evt.ts && (
                  <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
                    {relativeTime(evt.ts)}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {total > 15 && (
        <div className="shrink-0 flex items-center justify-between pt-2 border-t border-border/20 mt-1">
          <button
            type="button"
            onClick={prevPage}
            disabled={page <= 1}
            className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("detailView.previousPage")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-[11px] font-medium text-muted-foreground tabular-nums select-none">
            {page} / {totalPages}
            <span className="text-muted-foreground/50 ml-1.5">({total})</span>
          </span>
          <button
            type="button"
            onClick={nextPage}
            disabled={page >= totalPages}
            className="icon-circle-lg icon-circle-base disabled:opacity-30 disabled:pointer-events-none"
            aria-label={t("detailView.nextPage")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
export function EmptyDetailState({ leadsCount }: { leadsCount: number }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/50 dark:to-orange-950/50 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-800/30">
          <BookUser className="h-10 w-10 text-amber-400 dark:text-amber-500" />
        </div>
        <div className="absolute -top-2 -right-2 h-10 w-10 rounded-full bg-amber-500 flex items-center justify-center shadow-md ring-2 ring-background">
          <span className="text-[10px] font-bold text-white">{leadsCount > 99 ? "99+" : leadsCount}</span>
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground">Select a lead</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any lead in the list to see their profile, score, and messages.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-amber-500 dark:text-amber-400 font-medium">
        <span>← Choose from the list</span>
      </div>
    </div>
  );
}
