// ConversationWidget extracted from LeadsCardView.tsx

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import {
  Maximize2,
  MessageSquare,
  Mic,
  Paperclip,
  Send,
  Smile,
  Square,
  X,
} from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useSession, type SessionUser } from "@/hooks/useSession";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useInteractions } from "@/hooks/useApiData";
import { apiFetch } from "@/lib/apiUtils";
import { sendMessage } from "@/features/conversations/api/conversationsApi";
import { updateLead } from "../../api/leadsApi";
import { getLeadStatusAvatarColor } from "@/lib/avatarUtils";
import type { Interaction } from "@/types/models";

import type { MiniSenderKey, MiniMsgMeta, MiniThreadGroup } from "./types";
import { getDateKey, formatDateLabel } from "./formatUtils";
import { getLeadId } from "./leadUtils";
import {
  MiniDateSeparator,
  MiniThreadDivider,
  MiniAgentRunWrapper,
  MiniBotRunWrapper,
  MiniLeadRunWrapper,
  isAiMsg,
  groupMiniMessagesByThread,
  computeMiniMsgMeta,
} from "./MiniChat";

// ── Conversation widget (ChatPanel-style with run wrappers + separators) ─────
export function ConversationWidget({ lead, showHeader = false, readOnly = false }: { lead: Record<string, any>; showHeader?: boolean; readOnly?: boolean }) {
  const { t } = useTranslation("leads");
  const leadId = getLeadId(lead);
  const { interactions, loading, refresh } = useInteractions(undefined, leadId);
  const { isAgencyView } = useWorkspace();
  const [, setLocation] = useLocation();
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [showBypassConfirm, setShowBypassConfirm] = useState(false);
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const session = useSession();
  const currentUser: SessionUser | null = session.status === "authenticated" ? session.user : null;
  const { toast } = useToast();

  // ── Fresh manual_takeover state (prop may be stale if lead list wasn't re-fetched) ──
  const [isHumanTakeover, setIsHumanTakeover] = useState(() =>
    Boolean(lead.manual_takeover || lead.manualTakeover)
  );
  useEffect(() => {
    // Re-sync from prop whenever lead changes
    setIsHumanTakeover(Boolean(lead.manual_takeover || lead.manualTakeover));
    // Also fetch a single fresh lead to get the latest manual_takeover
    if (!leadId) return;
    let cancelled = false;
    apiFetch(`/api/leads/${leadId}`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setIsHumanTakeover(Boolean(data.manual_takeover ?? data.manualTakeover));
      })
      .catch(() => {/* ignore */});
    return () => { cancelled = true; };
  }, [leadId, lead.manual_takeover, lead.manualTakeover]);

  // ── Voice recording ────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingCancelledRef = useRef(false);

  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (!leadId) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm",
      });
      recordingCancelledRef.current = false;
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingCancelledRef.current) return;
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          setSending(true);
          try {
            const accountsId = Number(lead.account_id || lead.accounts_id || lead.Accounts_id || 0);
            await sendMessage({
              leadsId: leadId,
              accountsId,
              content: dataUrl,
              type: "audio",
              direction: "Outbound",
              status: "sent",
              who: "Agent",
            });
            await refresh();
          } catch {
            toast({ title: "Failed to send voice message", variant: "destructive" });
          } finally {
            setSending(false);
          }
        };
        reader.readAsDataURL(blob);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      setIsRecording(true);
      setRecordingSeconds(0);
      recordingTimerRef.current = setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
    } catch {
      toast({ title: t("chat.microphoneAccessDenied", "Microphone access denied"), description: t("chat.microphoneAccessDescription", "Allow microphone access to record."), variant: "destructive" });
    }
  }, [leadId, lead, refresh, toast, t]);

  const stopRecording = useCallback(() => {
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const cancelRecording = useCallback(() => {
    recordingCancelledRef.current = true;
    if (recordingTimerRef.current) { clearInterval(recordingTimerRef.current); recordingTimerRef.current = null; }
    mediaRecorderRef.current?.stop();
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const sorted = useMemo(
    () => [...interactions].sort((a, b) => (a.created_at || "").localeCompare(b.created_at || "")),
    [interactions]
  );

  const leadName = lead.full_name || `${lead.first_name ?? ""} ${lead.last_name ?? ""}`.trim() || t("detailView.newLead");
  const leadAvatarColors = useMemo(() => {
    const status = lead.Conversion_Status || lead.conversion_status || "";
    const colors = getLeadStatusAvatarColor(status);
    return { bgColor: colors.bg, textColor: colors.text };
  }, [lead.Conversion_Status, lead.conversion_status]);

  // Scroll to bottom whenever messages change or a new lead is selected
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [sorted.length, leadId]);

  const handleSend = useCallback(async () => {
    const content = draft.trim();
    if (!content || sending) return;
    setDraft("");
    setSending(true);
    try {
      const accountsId = Number(lead.account_id || lead.accounts_id || lead.Accounts_id || 0);
      await sendMessage({
        leadsId: leadId,
        accountsId,
        content,
        type: "WhatsApp",
        direction: "Outbound",
        status: "sent",
        who: "Agent",
      });
      await refresh();
    } catch (err) {
      console.error("Failed to send message", err);
    } finally {
      setSending(false);
    }
  }, [draft, sending, leadId, lead, refresh]);

  const handleAiResume = useCallback(async () => {
    setShowAiResumeConfirm(false);
    try {
      await updateLead(leadId, { manual_takeover: false });
      setIsHumanTakeover(false);
      await refresh();
    } catch (err) {
      console.error("Failed to resume AI", err);
    }
  }, [leadId, refresh]);

  // Build structured render list: date separators + thread dividers + sender-run wrappers
  const chatItems = useMemo(() => {
    if (sorted.length === 0) return null;

    const threadGroups = groupMiniMessagesByThread(sorted);
    const globalMetas = computeMiniMsgMeta(sorted);

    type Token =
      | { kind: "msg"; msgIdx: number }
      | { kind: "date"; label: string; key: string }
      | { kind: "thread"; group: MiniThreadGroup; total: number; key: string };

    const tokens: Token[] = [];
    let lastDateKey = "";
    let flatIdx = 0;

    for (let gi = 0; gi < threadGroups.length; gi++) {
      const group = threadGroups[gi];
      const isMeaningfulThread = group.threadId.startsWith("bump-") || group.threadId.startsWith("thread-");

      for (let mi = 0; mi < group.msgs.length; mi++) {
        const m = group.msgs[mi];
        const ts = m.created_at ?? m.createdAt;
        const dk = getDateKey(ts);

        if (dk && dk !== lastDateKey) {
          if (mi === 0 && isMeaningfulThread) {
            tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
          }
          if (ts) tokens.push({ kind: "date", label: formatDateLabel(ts, t), key: `date-${gi}-${mi}` });
          lastDateKey = dk;
        } else if (mi === 0 && isMeaningfulThread) {
          tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
        }

        tokens.push({ kind: "msg", msgIdx: flatIdx });
        flatIdx++;
      }
    }

    const mergedTokens: Token[] = tokens;

    // Second pass: collect same-sender runs and wrap them
    const items: React.ReactNode[] = [];
    let ti = 0;

    while (ti < mergedTokens.length) {
      const tok = mergedTokens[ti];

      if (tok.kind === "date") {
        items.push(<MiniDateSeparator key={tok.key} label={tok.label} />);
        ti++;
        continue;
      }
      if (tok.kind === "thread") {
        items.push(<MiniThreadDivider key={tok.key} group={tok.group} total={tok.total} />);
        ti++;
        continue;
      }
      const firstMsg = sorted[tok.msgIdx];
      const senderType: MiniSenderKey = String(firstMsg.direction || "").toLowerCase() !== "outbound"
        ? "inbound"
        : isAiMsg(firstMsg) ? "ai" : "human";

      const runMsgs: Interaction[] = [];
      const runMetas: MiniMsgMeta[] = [];
      const runStartIdx = tok.msgIdx;
      const pendingSeparators: { node: React.ReactNode }[] = [];

      let lookahead = ti;
      while (lookahead < mergedTokens.length) {
        const lt = mergedTokens[lookahead];
        if (lt.kind === "date" || lt.kind === "thread") {
          pendingSeparators.push({
            node: lt.kind === "date"
              ? <MiniDateSeparator key={lt.key} label={lt.label} />
              : <MiniThreadDivider key={lt.key} group={lt.group} total={lt.total} />,
          });
          lookahead++;
          continue;
        }
        const m = sorted[lt.msgIdx];
        const sk: MiniSenderKey = String(m.direction || "").toLowerCase() !== "outbound"
          ? "inbound"
          : isAiMsg(m) ? "ai" : "human";
        if (sk !== senderType) break;
        runMsgs.push(m);
        runMetas.push(globalMetas[lt.msgIdx]);
        pendingSeparators.length = 0;
        lookahead++;
      }
      ti = lookahead;

      const trailingSeparators = pendingSeparators.map(p => p.node);

      if (senderType === "human") {
        items.push(
          <MiniAgentRunWrapper
            key={`run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            isAgency={isAgencyView}
          />
        );
      } else if (senderType === "inbound") {
        items.push(
          <MiniLeadRunWrapper
            key={`lead-run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            isAgency={isAgencyView}
          />
        );
      } else {
        items.push(
          <MiniBotRunWrapper
            key={`bot-run-${runMsgs[0]?.id ?? runStartIdx}`}
            msgs={runMsgs}
            metas={runMetas}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            isAgency={isAgencyView}
          />
        );
      }

      items.push(...trailingSeparators);
    }

    return items;
  }, [sorted, leadName, leadAvatarColors, currentUser, isAgencyView]);

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Header with refresh + open-in-chats */}
      {showHeader && (
        <div className="px-[21px] pt-[21px] pb-2 flex items-center justify-between shrink-0 relative z-10">
          <p className="text-[18px] font-semibold font-heading text-foreground">{t("chat.title")}</p>
          <div className="flex items-center gap-1">
            {/* Let AI continue — only when human has taken over */}
            {isHumanTakeover && <Popover open={showAiResumeConfirm} onOpenChange={setShowAiResumeConfirm}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="group relative inline-flex items-center justify-center h-[34px] w-[34px] rounded-full border border-black/[0.125] hover:border-brand-indigo shrink-0 overflow-hidden transition-[width,border-color] duration-200 hover:w-[130px]"
                  aria-label={t("chat.letAiContinue")}
                >
                  <img src="/6. Favicon.svg" alt="AI" className="h-5 w-5 shrink-0 absolute left-[6px]" />
                  <span className="whitespace-nowrap pl-7 pr-2 text-[11px] font-medium text-brand-indigo opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                    {t("chat.letAiContinue")}
                  </span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                sideOffset={6}
                className="w-auto p-3 shadow-md border border-black/[0.08] bg-white dark:bg-popover rounded-xl"
              >
                <p className="text-[12px] text-foreground/70 mb-2.5 max-w-[200px]">
                  AI will resume this conversation. You can take over again anytime.
                </p>
                <div className="flex items-center gap-2 justify-end">
                  <button
                    type="button"
                    onClick={() => setShowAiResumeConfirm(false)}
                    className="text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleAiResume}
                    className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors"
                  >
                    Confirm
                  </button>
                </div>
              </PopoverContent>
            </Popover>}
            <button
              onClick={() => {
                localStorage.setItem("selected-conversation-lead-id", String(leadId));
                setLocation(`${isAgencyView ? "/agency" : "/subaccount"}/conversations`);
              }}
              className="h-[34px] w-[34px] rounded-full border border-black/[0.125] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
              title={t("chat.openInChats")}
            >
              <Maximize2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Messages scroll area */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-3 pb-2 min-h-0 -mt-[12px] pt-[15px]"
        data-testid="list-interactions"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 15px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 15px)",
        }}
      >
        {loading ? (
          <div className="flex flex-col gap-2 py-4">
            {[70, 50, 80, 55].map((w, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "flex-row-reverse" : "flex-row")}>
                <div
                  className="h-8 rounded-sm bg-muted/60 animate-pulse"
                  style={{ width: `${w}%`, animationDelay: `${i * 80}ms` }}
                />
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">{t("chat.noMessages")}</p>
            <p className="text-[11px] text-muted-foreground/60">{t("chat.noMessagesHint")}</p>
          </div>
        ) : chatItems}
      </div>

      {/* Compose area — ChatPanel style: white bar with border + shadow */}
      {!readOnly && isRecording ? (
        <div className="shrink-0 px-3 pb-3 pt-1">
          <div className="flex items-center gap-3 bg-white dark:bg-card rounded-lg border border-red-200 shadow-sm px-3 py-2 h-[48px]">
            <span className="relative flex h-3 w-3 shrink-0">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
            </span>
            <span className="text-[13px] text-red-500 font-medium flex-1">
              {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
            </span>
            <button
              type="button"
              onClick={cancelRecording}
              className="h-8 w-8 rounded-full border border-black/10 bg-muted/50 text-muted-foreground hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors"
              title="Cancel"
            >
              <X className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={stopRecording}
              className="h-8 w-8 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
              title="Stop and send"
            >
              <Square className="h-3.5 w-3.5 fill-white" />
            </button>
          </div>
        </div>
      ) : !readOnly && <div className="shrink-0 px-3 pb-3 pt-1">
        <div className="flex items-end gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm px-2.5 py-1.5">
          <button
            type="button"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
            title="Emoji"
            onClick={() => textareaRef.current?.focus()}
          >
            <Smile className="h-5 w-5" />
          </button>

          <textarea
            ref={textareaRef}
            value={draft}
            onChange={(e) => {
              setDraft(e.target.value);
              e.target.style.height = "auto";
              e.target.style.height = Math.min(e.target.scrollHeight, 80) + "px";
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (draft.trim()) setShowBypassConfirm(true);
              }
            }}
            placeholder={t("chat.typePlaceholder")}
            rows={1}
            className="flex-1 text-[13px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 leading-5"
            style={{ minHeight: "28px", maxHeight: "80px" }}
            data-testid="input-message-compose"
          />

          <button
            type="button"
            className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
            title="Attach file"
          >
            <Paperclip className="h-5 w-5" />
          </button>

          <div className="relative">
            {draft.trim() ? (
              <button
                type="button"
                onClick={() => { if (draft.trim()) setShowBypassConfirm(true); }}
                disabled={sending}
                className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                title="Send message"
                data-testid="btn-send-message"
              >
                {sending
                  ? <div className="h-3.5 w-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  : <Send className="h-3.5 w-3.5 text-white" />}
              </button>
            ) : (
              <button
                type="button"
                onClick={startRecording}
                className="h-8 w-8 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                title="Record voice message"
              >
                <Mic className="h-4 w-4 text-white" />
              </button>
            )}

            {showBypassConfirm && (
              <div className="absolute bottom-10 right-0 z-50 w-52 bg-white dark:bg-popover rounded-xl shadow-lg border border-border/40 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-foreground">Bypass AI for this message?</p>
                <p className="text-[10px] text-muted-foreground/70 leading-snug">This will send as a human takeover and pause the AI agent.</p>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={() => { setShowBypassConfirm(false); handleSend(); }}
                    className="flex-1 px-2 py-1.5 rounded-lg bg-brand-indigo text-white text-[11px] font-semibold hover:bg-brand-indigo/90 transition-colors"
                  >
                    Yes, send
                  </button>
                  <button
                    onClick={() => setShowBypassConfirm(false)}
                    className="flex-1 px-2 py-1.5 rounded-lg border border-border/50 text-[11px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>}
    </div>
  );
}
