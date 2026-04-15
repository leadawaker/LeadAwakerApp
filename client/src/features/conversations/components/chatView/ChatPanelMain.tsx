import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronLeft,
  Send,
  Calendar,
  Paperclip,
  Smile,
  Mic,
  Square,
  X,
} from "lucide-react";
import { STAGE_ICON } from "../ContactSidebar";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SkeletonChatThread } from "@/components/ui/skeleton";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Thread, Interaction } from "../../hooks/useConversationsData";
import { formatRelativeTime, getStatus, PIPELINE_HEX } from "../../utils/conversationHelpers";
import {
  GradientTester,
  GradientControlPoints,
  DEFAULT_LAYERS,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { useTheme } from "@/hooks/useTheme";
import { useBgSlotLayers, saveSlotLayers } from "@/hooks/useBgSlots";
import { getDoodleStyle } from "@/components/ui/doodle-patterns";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getLeadStatusAvatarColor, getInitials } from "@/lib/avatarUtils";
import { useToast } from "@/hooks/use-toast";
import { useSession, type SessionUser } from "@/hooks/useSession";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { ChatPanelProps, ThreadGroup, SenderKey, MsgMeta } from "./types";
import { BubbleWidthContext, HideAvatarsContext, TimezoneContext } from "./types";
import { BUBBLE_WIDTH_KEY, DEFAULT_BUBBLE_WIDTH } from "./constants";
import {
  getDateKey,
  formatDateLabel,
  computeMsgMeta,
  groupMessagesByThread,
  isAiMessage,
  canonicalStatus,
} from "./utils";
import { DateSeparator, TagEventChip, StatusEventChip, HandoffEventChip, ThreadDivider } from "./atoms";
import { AgentRunWrapper, LeadRunWrapper, BotRunWrapper } from "./runWrappers";
import { ChatBubble } from "./ChatBubble";
import { getUtcOffsetLabel } from "@/features/leads/components/cardView/formatUtils";

export function ChatPanel({
  selected,
  loading = false,
  sending,
  onSend,
  onToggleTakeover,
  onRetry,
  showContactPanel,
  onShowContactPanel,
  onNavigateToLead,
  className,
  headerActions,
}: ChatPanelProps) {
  const isHuman = selected?.lead.manual_takeover === true;
  const { accounts } = useWorkspace();
  const accountTimezone = useMemo(() => {
    if (!selected) return undefined;
    const lead = selected.lead as any;
    const aid = lead.Accounts_id ?? lead.accounts_id ?? lead.account_id;
    const acct = accounts.find((a) => a.id === aid);
    return (acct?.timezone as string) || undefined;
  }, [selected, accounts]);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLeadId = useRef<number | null>(null);
  const prevMsgCount = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);

  // ── Mobile keyboard handling via visualViewport API ──────────────────────────
  // When the on-screen keyboard opens on mobile, visualViewport.height shrinks.
  // We apply the visual height as an explicit height on the section so the flex
  // layout keeps the compose area above the keyboard and the message list shrinks.
  const [visualHeight, setVisualHeight] = useState<number | null>(null);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      if (window.innerWidth < 768) {
        // offsetTop accounts for viewport scroll (pinch-zoom offset)
        setVisualHeight(Math.round(vv.height + vv.offsetTop));
      } else {
        setVisualHeight(null);
      }
    };
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    const handleWindowResize = () => {
      if (window.innerWidth >= 768) setVisualHeight(null);
      else update();
    };
    window.addEventListener("resize", handleWindowResize);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
      window.removeEventListener("resize", handleWindowResize);
    };
  }, []);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { t } = useTranslation("conversations");
  const { toast } = useToast();
  const session = useSession();
  const currentUser: SessionUser | null = session.status === "authenticated" ? session.user : null;

  // ── Voice recording ─────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const recordingCancelledRef = useRef(false);

  const startRecording = useCallback(async () => {
    if (!selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      recordingCancelledRef.current = false;
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (recordingCancelledRef.current) return; // cancelled, discard audio
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        const reader = new FileReader();
        reader.onloadend = async () => {
          const dataUrl = reader.result as string;
          if (selected) {
            await onSend(selected.lead.id, dataUrl, "audio");
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
      toast({ title: t("chat.microphoneAccessDenied"), description: t("chat.microphoneAccessDescription"), variant: "destructive" });
    }
  }, [selected, onSend, toast]);

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

  // Cleanup recording on unmount
  useEffect(() => {
    return () => {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (mediaRecorderRef.current) { try { mediaRecorderRef.current.stop(); } catch {} }
    };
  }, []);

  // Track whether we just switched conversations (for bubble entrance animation)
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const initialLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Takeover flow state
  const [hasConfirmedTakeover, setHasConfirmedTakeover] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState("");

  // AI resume flow state
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);

  // ── Tag events for chat timeline ───────────────────────────────────────────
  const [tagEvents, setTagEvents] = useState<any[]>([]);
  useEffect(() => {
    const leadId = selected?.lead?.id;
    if (!leadId) { setTagEvents([]); return; }
    let cancelled = false;
    apiFetch(`/api/leads/${leadId}/tag-events`)
      .then(r => r.ok ? r.json() : [])
      .then(data => { if (!cancelled) setTagEvents(data); })
      .catch(() => { if (!cancelled) setTagEvents([]); });
    return () => { cancelled = true; };
  }, [selected?.lead?.id, selected?.msgs?.length]);

  // ── Theme + Doodle overlay ──────────────────────────────────────────────────
  const { isDark } = useTheme();
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();

  // ── Bubble width (persisted in localStorage, synced via custom event) ────────
  const [bubbleWidth, setBubbleWidthState] = useState<number>(() => {
    const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
    const parsed = stored !== null ? parseInt(stored, 10) : NaN;
    return isNaN(parsed) ? DEFAULT_BUBBLE_WIDTH : Math.min(90, Math.max(40, parsed));
  });

  useEffect(() => {
    const readBubbleWidth = () => {
      const stored = localStorage.getItem(BUBBLE_WIDTH_KEY);
      const parsed = stored !== null ? parseInt(stored, 10) : NaN;
      if (!isNaN(parsed)) setBubbleWidthState(Math.min(90, Math.max(40, parsed)));
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === BUBBLE_WIDTH_KEY) readBubbleWidth();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener("bubble-width-change", readBubbleWidth);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bubble-width-change", readBubbleWidth);
    };
  }, []);

  // ── Active slot layers (re-renders when saved) ───────────────────────────────
  const activeSlotLayers = useBgSlotLayers(doodleConfig.bgStyle !== "crm" ? doodleConfig.bgStyle : "social1", isDark);

  // ── Gradient tester state (dev tool) ────────────────────────────────────────
  const GRADIENT_KEY = "la:gradient:chat";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) {
      setGradientLayers(prev => [...prev, patch as GradientLayer]);
      return;
    }
    if ((patch as any).id === -999) {
      setGradientLayers(prev => prev.filter(l => l.id !== id));
      return;
    }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const resetGradientLayers = useCallback(() => {
    setGradientLayers(DEFAULT_LAYERS);
    setGradientDragMode(false);
  }, []);

  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

  // Listen for gradient tester toggle from external components (e.g. ContactSidebar)
  useEffect(() => {
    const handler = () => toggleGradientTester();
    window.addEventListener("toggle-gradient-tester", handler);
    return () => window.removeEventListener("toggle-gradient-tester", handler);
  }, [toggleGradientTester]);

  // Compute lead avatar colors
  const leadAvatarColors = useMemo(() => {
    if (!selected) return { bgColor: "#C9C9C9", textColor: "#374151", statusColor: "#6B7280" };
    const status = getStatus(selected.lead);
    const colors = getLeadStatusAvatarColor(status);
    return { bgColor: colors.bg, textColor: colors.text, statusColor: PIPELINE_HEX[status] ?? "#6B7280" };
  }, [selected]);

  /** Scroll the chat area to the very bottom. */
  const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
    const el = scrollRef.current;
    if (el) {
      el.scrollTo({ top: el.scrollHeight, behavior });
    }
  }, []);

  /** When a new conversation is selected, jump immediately to the bottom. */
  useEffect(() => {
    const leadId = selected?.lead.id ?? null;
    if (leadId !== prevLeadId.current) {
      prevLeadId.current = leadId;
      prevMsgCount.current = selected?.msgs.length ?? 0;
      scrollToBottom("instant");
      setShowScrollButton(false);

      // Trigger bubble entrance animation for 600ms after switching
      setIsInitialLoad(true);
      if (initialLoadTimer.current) clearTimeout(initialLoadTimer.current);
      initialLoadTimer.current = setTimeout(() => setIsInitialLoad(false), 600);
    }
  }, [selected?.lead.id, scrollToBottom]);

  /** When new messages arrive, smooth-scroll if near bottom. */
  useEffect(() => {
    const count = selected?.msgs.length ?? 0;
    if (count !== prevMsgCount.current) {
      prevMsgCount.current = count;
      const el = scrollRef.current;
      if (el) {
        const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
        if (distanceFromBottom < 200) {
          scrollToBottom("smooth");
        } else {
          setShowScrollButton(true);
        }
      }
    }
  }, [selected?.msgs.length, scrollToBottom]);

  /** When the mobile keyboard opens (visualHeight changes), scroll to the latest messages. */
  useEffect(() => {
    if (visualHeight !== null) {
      const timer = setTimeout(() => scrollToBottom("smooth"), 80);
      return () => clearTimeout(timer);
    }
  }, [visualHeight, scrollToBottom]);

  /** Track scroll position to show/hide the scroll-to-bottom button. */
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollButton(distanceFromBottom > 80);
  }, []);

  const handleSubmit = async () => {
    if (!selected || !draft.trim() || sending) return;

    // If AI is still active and the user hasn't confirmed takeover this session,
    // intercept and show confirmation first
    if (!isHuman && !hasConfirmedTakeover) {
      setPendingDraft(draft);
      setDraft("");
      setShowTakeoverConfirm(true);
      return;
    }

    const text = draft;
    setDraft("");
    await onSend(selected.lead.id, text);
  };

  const handleTakeoverConfirm = async () => {
    if (!selected) return;
    setHasConfirmedTakeover(true);
    setShowTakeoverConfirm(false);
    if (onToggleTakeover) {
      try {
        await onToggleTakeover(selected.lead.id, true);
      } catch {
        // Takeover API failed — restore draft so user doesn't lose it
        setDraft(pendingDraft);
        setPendingDraft("");
        setHasConfirmedTakeover(false);
        return;
      }
    }
    await onSend(selected.lead.id, pendingDraft);
    setPendingDraft("");
  };

  const handleTakeoverCancel = () => {
    setDraft(pendingDraft);
    setPendingDraft("");
    setShowTakeoverConfirm(false);
  };

  const handleAiResumeConfirm = async () => {
    if (!selected || !onToggleTakeover) return;
    setShowAiResumeConfirm(false);
    await onToggleTakeover(selected.lead.id, false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const leadName = selected
    ? selected.lead.full_name ||
      `${selected.lead.first_name ?? ""} ${selected.lead.last_name ?? ""}`.trim()
    : "";

  return (
    <BubbleWidthContext.Provider value={bubbleWidth}>
    <HideAvatarsContext.Provider value={doodleConfig.hideAvatars}>
    <TimezoneContext.Provider value={accountTimezone}>
    <>
      <section
        className={cn(
          "flex flex-col rounded-lg overflow-hidden h-full relative",
          className,
        )}
        style={visualHeight !== null ? { height: `${visualHeight}px` } : undefined}
        data-testid="panel-chat"
      >
        {/* ── Gradient background ── */}
        {gradientTesterOpen ? (
          <>
            {gradientLayers.map(layer => {
              const style = layerToStyle(layer);
              if (!style) return null;
              return <div key={layer.id} className="absolute inset-0" style={style} />;
            })}
            {gradientDragMode && (
              <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
            )}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, isDark ? 100 : 0, isDark ? "screen" : "multiply")}
              />
            )}
          </>
        ) : savedGradient ? (
          <>
            {savedGradient.map((layer: GradientLayer) => {
              const style = layerToStyle(layer);
              return style ? <div key={layer.id} className="absolute inset-0" style={style} /> : null;
            })}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, isDark ? 100 : 0, isDark ? "screen" : "multiply")}
              />
            )}
          </>
        ) : (
          <>
            {doodleConfig.bgStyle === "crm" && (
              <div className="absolute inset-0 bg-card" />
            )}
            {doodleConfig.bgStyle !== "crm" && activeSlotLayers.map(layer => {
              const style = layerToStyle(layer);
              if (!style) return null;
              return <div key={layer.id} className="absolute inset-0" style={style} />;
            })}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, isDark ? 100 : 0, isDark ? "screen" : "multiply")}
              />
            )}
          </>
        )}

        {/* ── Content above gradient ── */}
        <div className="relative flex flex-col h-full overflow-hidden">

          {/* Header — white panel matching leads detail panel */}
          <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06] relative" data-testid="panel-chat-head">
            <div className="px-4 pt-4 pb-3">
            {/* Single row: avatar + name + spacer + buttons */}
            <div className="flex items-center gap-3">
              {/* Avatar */}
              {selected && (
                <button
                  type="button"
                  onClick={() => onNavigateToLead?.(selected.lead.id)}
                  className="shrink-0 rounded-full focus:outline-none"
                  aria-label="Open lead detail"
                >
                  <EntityAvatar
                    name={leadName || "?"}
                    bgColor={getLeadStatusAvatarColor(selected.lead.Conversion_Status ?? selected.lead.conversion_status ?? "").bg}
                    textColor={getLeadStatusAvatarColor(selected.lead.Conversion_Status ?? selected.lead.conversion_status ?? "").text}
                    size={45}
                  />
                </button>
              )}
              {/* Lead name + id pill */}
              {selected && (
                <button
                  type="button"
                  onClick={() => onNavigateToLead?.(selected.lead.id)}
                  className="flex flex-col min-w-0 text-left focus:outline-none"
                >
                  <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate min-w-0">
                    {leadName}
                  </h2>
                  <span className="text-[11px] text-muted-foreground font-mono">Lead #{selected.lead.id}</span>
                </button>
              )}

              {/* Buttons — left cluster (injected actions) */}
              <div className="ml-2 md:ml-6 flex items-center gap-1.5">
              {headerActions}
              </div>{/* end left buttons cluster */}

              {/* Right cluster: booked-call pill + AI resume + unfold contact panel */}
              <div className="ml-auto flex items-center gap-2 shrink-0">

                {/* Booked call pill — only when contact panel is hidden */}
                {!showContactPanel && selected && (() => {
                  const rawDate = (selected.lead as any).booked_call_date ?? (selected.lead as any).bookedCallDate ?? null;
                  if (!rawDate) return null;
                  const callDate = new Date(rawDate as string);
                  const formatted = callDate.toLocaleString(undefined, {
                    month: "short", day: "numeric", year: "numeric",
                    hour: "2-digit", minute: "2-digit",
                    ...(accountTimezone ? { timeZone: accountTimezone } : {}),
                  });
                  const tzLabel = accountTimezone ? getUtcOffsetLabel(accountTimezone) : "";
                  return (
                    <span className="inline-flex items-center gap-1.5 px-2.5 h-[34px] rounded-full text-[11px] font-medium bg-amber-400/10 text-amber-600 dark:text-amber-400 border border-amber-400/30 shrink-0 whitespace-nowrap">
                      <Calendar className="h-3 w-3 shrink-0" />
                      Booked call: {formatted}{tzLabel ? ` ${tzLabel}` : ""}
                    </span>
                  );
                })()}

                {/* Let AI continue */}
                {selected && isHuman && onToggleTakeover && (
                  <Popover open={showAiResumeConfirm} onOpenChange={setShowAiResumeConfirm}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        data-testid="btn-ai-resume"
                        className="group relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-black/[0.125] hover:border-brand-indigo hover:bg-transparent shrink-0 transition-[width,border-color,background-color] duration-200 hover:w-[142px]"
                        aria-label={t("chat.aiResume.label")}
                      >
                        <img src="/6. Favicon.svg" alt="AI" className="h-6.5 w-6.5 shrink-0 absolute left-[5px] -top-[-2px]" />
                        <span className="whitespace-nowrap pl-10 pr-2.5 text-[12px] font-medium text-brand-indigo opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                          {t("chat.aiResume.label")}
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
                        {t("chat.aiResume.description")}
                      </p>
                      <div className="flex items-center gap-2 justify-end">
                        <button
                          type="button"
                          onClick={() => setShowAiResumeConfirm(false)}
                          className="text-[12px] text-muted-foreground hover:text-foreground px-2 py-1 rounded-md hover:bg-muted/60 transition-colors"
                        >
                          {t("chat.aiResume.cancel")}
                        </button>
                        <button
                          type="button"
                          onClick={handleAiResumeConfirm}
                          className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors"
                        >
                          {t("chat.aiResume.confirm")}
                        </button>
                      </div>
                    </PopoverContent>
                  </Popover>
                )}

                {/* Unfold contact panel — right edge */}
                {!showContactPanel && onShowContactPanel && (
                  <button
                    type="button"
                    onClick={onShowContactPanel}
                    className="h-9 w-9 rounded-full border border-black/[0.125] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                    title={t("chat.showContactPanel")}
                    data-testid="btn-show-contact-panel"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                )}

              </div>{/* end right cluster */}

            </div>{/* end single row */}
            </div>{/* end px-4 pt-5 pb-4 */}
          </div>{/* end header panel */}

          {/* Scroll container wrapper */}
          <div className="flex-1 overflow-hidden relative">
            <div
              className="h-full overflow-y-auto px-4 pt-4 pb-4"
              ref={scrollRef}
              onScroll={handleScroll}
              data-testid="chat-scroll"
            >
              {loading && !selected ? (
                <SkeletonChatThread data-testid="skeleton-chat-thread" />
              ) : !selected ? (
                <div className="flex items-center justify-center h-full">
                  <DataEmptyState
                    variant="conversations"
                    title={t("chat.emptyState.title")}
                    description={t("chat.emptyState.description")}
                    compact
                  />
                </div>
              ) : selected.msgs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <DataEmptyState
                    variant="conversations"
                    title={t("chat.noMessages.title")}
                    description={t("chat.noMessages.description")}
                    compact
                  />
                </div>
              ) : (
                (() => {
                  const threadGroups = groupMessagesByThread(selected.msgs);
                  const allMsgs = selected.msgs; // already sorted
                  const globalMetas = computeMsgMeta(allMsgs);

                  // Build a flat ordered list of render tokens: message indices + separators
                  type Token =
                    | { kind: "msg"; msgIdx: number }
                    | { kind: "date"; label: string; key: string }
                    | { kind: "thread"; group: ThreadGroup; total: number; key: string }
                    | { kind: "tag-event"; tagName: string; tagColor: string; time: string; key: string; eventType?: "added" | "removed" }
                    | { kind: "status-event"; statusName: string; time: string; key: string };

                  const existingTagNames = new Set(tagEvents.map((te: any) => te.tag_name?.toLowerCase()));
                  const tokens: Token[] = [];
                  let lastDateKey = "";
                  let flatIdx = 0;
                  let inboundN = 0;

                  for (let gi = 0; gi < threadGroups.length; gi++) {
                    const group = threadGroups[gi];
                    const isMeaningfulThread =
                      group.threadId.startsWith("bump-") ||
                      group.threadId.startsWith("thread-") ||
                      group.threadId.startsWith("session-");

                    for (let mi = 0; mi < group.msgs.length; mi++) {
                      const m = group.msgs[mi];
                      const ts = m.created_at ?? m.createdAt;
                      const dk = getDateKey(ts, accountTimezone);

                      // Date separator before this message (once per day)
                      if (dk && dk !== lastDateKey) {
                        if (ts) tokens.push({ kind: "date", label: formatDateLabel(ts, t, accountTimezone), key: `date-${gi}-${mi}` });
                        lastDateKey = dk;
                      }

                      if (mi === 0 && isMeaningfulThread && (m.direction || "").toLowerCase() === "outbound") {
                        // Skip synthetic "Contacted" thread divider if a real Contacted tag exists in DB
                        const isBumpThread = group.threadId.startsWith("bump-");
                        if (isBumpThread || !existingTagNames.has("contacted")) {
                          tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
                        }
                      }
                      tokens.push({ kind: "msg", msgIdx: flatIdx });

                      // Inline synthetic status events after inbound messages
                      const dir = (m.direction || "").toLowerCase();
                      if (dir !== "outbound") {
                        inboundN++;
                        const rawTs = m.created_at ?? m.createdAt ?? "";
                        const timeStr = rawTs ? new Date(rawTs).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(accountTimezone ? { timeZone: accountTimezone } : {}) }) : "";
                        if (inboundN === 1 && !existingTagNames.has("responded")) {
                          tokens.push({ kind: "status-event", statusName: "Responded", time: timeStr, key: "synth-responded" });
                        }
                        if (inboundN === 2 && !existingTagNames.has("multiple responses") && !existingTagNames.has("multiple messages")) {
                          tokens.push({ kind: "status-event", statusName: "Multiple Responses", time: timeStr, key: "synth-multiple" });
                        }
                      }

                      flatIdx++;
                    }
                  }

                  // Merge real tag events (DB) into tokens by timestamp — skip "removed" events,
                  // bump-sequence tags (Bump 1/2/3/…) since ThreadDivider already labels those,
                  // and non-status tags that predate the first message (stale from a demo-reset).
                  // Status tags (Qualified, Booked, Lost, DND, etc.) always show regardless of timing.
                  const firstMsgTs = allMsgs.length > 0
                    ? new Date(allMsgs[0].created_at ?? allMsgs[0].createdAt ?? 0).getTime()
                    : 0;
                  const allTagEvents = [...tagEvents]
                    .filter((te: any) => te.event_type !== "removed")
                    .filter((te: any) => !/^bump\s*\d/i.test(te.tag_name ?? ""))
                    .filter((te: any) => canonicalStatus(te.tag_name ?? "") || !te.created_at || !firstMsgTs || new Date(te.created_at).getTime() >= firstMsgTs)
                    .sort((a: any, b: any) => {
                      if (!a.created_at && !b.created_at) return 0;
                      if (!a.created_at) return 1;
                      if (!b.created_at) return -1;
                      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
                    });

                  // Merge tag events into tokens by timestamp
                  if (allTagEvents.length > 0) {
                    const mergedTokens: Token[] = [];
                    let tei = 0;
                    for (const tok of tokens) {
                      // Insert any tag events that come before this token's timestamp
                      if (tok.kind === "msg") {
                        const msg = allMsgs[tok.msgIdx];
                        const msgTs = new Date(msg.created_at ?? msg.createdAt ?? 0).getTime();
                        while (tei < allTagEvents.length && allTagEvents[tei].created_at && new Date(allTagEvents[tei].created_at).getTime() <= msgTs) {
                          const te = allTagEvents[tei];
                          const teTime = new Date(te.created_at);
                          const timeStr = teTime.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(accountTimezone ? { timeZone: accountTimezone } : {}) });
                          const canonical = canonicalStatus(te.tag_name);
                          if (canonical && te.event_type !== "removed") {
                            mergedTokens.push({ kind: "status-event", statusName: canonical, time: timeStr, key: `status-event-${te.id}` });
                          } else {
                            mergedTokens.push({
                              kind: "tag-event",
                              tagName: te.tag_name,
                              tagColor: te.tag_color,
                              time: timeStr,
                              key: `tag-event-${te.id}`,
                              eventType: te.event_type as "added" | "removed" | undefined,
                            });
                          }
                          tei++;
                        }
                      }
                      mergedTokens.push(tok);
                    }
                    // Append remaining tag events after all messages (includes legacy rows with no timestamp)
                    while (tei < allTagEvents.length) {
                      const te = allTagEvents[tei];
                      const timeStr = te.created_at
                        ? new Date(te.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", ...(accountTimezone ? { timeZone: accountTimezone } : {}) })
                        : "";
                      const canonical = canonicalStatus(te.tag_name);
                      if (canonical && te.event_type !== "removed") {
                        mergedTokens.push({ kind: "status-event", statusName: canonical, time: timeStr, key: `status-event-${te.id}` });
                      } else {
                        mergedTokens.push({
                          kind: "tag-event",
                          tagName: te.tag_name,
                          tagColor: te.tag_color,
                          time: timeStr,
                          key: `tag-event-${te.id}`,
                          eventType: te.event_type as "added" | "removed" | undefined,
                        });
                      }
                      tei++;
                    }
                    tokens.length = 0;
                    tokens.push(...mergedTokens);
                  }

                  // Second pass: collect consecutive same-sender runs, emitting wrappers
                  const items: React.ReactNode[] = [];
                  let ti = 0;

                  while (ti < tokens.length) {
                    const tok = tokens[ti];

                    if (tok.kind === "date") {
                      items.push(<DateSeparator key={tok.key} label={tok.label} />);
                      ti++;
                      continue;
                    }
                    if (tok.kind === "thread") {
                      items.push(<ThreadDivider key={tok.key} group={tok.group} total={tok.total} />);
                      ti++;
                      continue;
                    }
                    if (tok.kind === "tag-event") {
                      items.push(<TagEventChip key={tok.key} tagName={tok.tagName} tagColor={tok.tagColor} time={tok.time} eventType={tok.eventType} />);
                      ti++;
                      continue;
                    }
                    if (tok.kind === "status-event") {
                      items.push(<StatusEventChip key={tok.key} statusName={tok.statusName} time={tok.time} />);
                      ti++;
                      continue;
                    }

                    // tok.kind === "msg" — collect a run of consecutive same-sender messages,
                    // skipping over non-msg tokens between them (date/thread separators don't break a run)
                    const firstMsg = allMsgs[tok.msgIdx];
                    const senderType: SenderKey = firstMsg.direction?.toLowerCase() !== "outbound"
                      ? "inbound"
                      : isAiMessage(firstMsg) ? "ai" : "human";

                    const runMsgs: Interaction[] = [];
                    const runMetas: MsgMeta[] = [];
                    const separatorsBetween: React.ReactNode[] = [];
                    const runStartIdx = tok.msgIdx;
                    const who = (firstMsg.Who ?? firstMsg.who ?? "").trim();

                    // Look ahead: collect all msgs of same sender type, accumulating any
                    // date/thread separators encountered between them to emit after the wrapper
                    let lookahead = ti;
                    const pendingSeparators: { node: React.ReactNode; insertAfterRunIdx: number }[] = [];

                    while (lookahead < tokens.length) {
                      const lt = tokens[lookahead];
                      if (lt.kind === "date") {
                        // Date separators — peek past to see if same sender continues
                        pendingSeparators.push({ node: <DateSeparator key={lt.key} label={lt.label} />, insertAfterRunIdx: runMsgs.length });
                        lookahead++;
                        continue;
                      }
                      if (lt.kind === "tag-event" || lt.kind === "status-event" || lt.kind === "thread") {
                        // These always break a run so they render inline between messages
                        break;
                      }
                      // It's a msg token
                      const m = allMsgs[lt.msgIdx];
                      const sk: SenderKey = m.direction?.toLowerCase() !== "outbound"
                        ? "inbound"
                        : isAiMessage(m) ? "ai" : "human";
                      if (sk !== senderType) break; // different sender → end of run

                      // Same sender — absorb pending separators as "interior" dividers and add msg
                      runMsgs.push(m);
                      runMetas.push(globalMetas[lt.msgIdx]);
                      pendingSeparators.length = 0; // consumed
                      lookahead++;
                    }

                    ti = lookahead;

                    // Emit any separators that weren't absorbed (trailing separators before a different sender)
                    // These go BEFORE the wrapper in items (they were before the run started or between runs)
                    // Actually pendingSeparators here are ones after the last same-sender msg — emit after wrapper
                    const trailingSeparators = pendingSeparators.map(p => p.node);

                    if (senderType === "human") {
                      items.push(
                        <AgentRunWrapper
                          key={`run-${runMsgs[0]?.id ?? runStartIdx}`}
                          msgs={runMsgs}
                          metas={runMetas}
                          who={who}
                          onRetry={onRetry}
                          leadName={leadName}
                          leadAvatarColors={leadAvatarColors}
                          currentUser={currentUser}
                          isInitialLoad={isInitialLoad}
                          startIdx={runStartIdx}
                          totalMsgCount={allMsgs.length}
                        />
                      );
                    } else if (senderType === "inbound") {
                      items.push(
                        <LeadRunWrapper
                          key={`lead-run-${runMsgs[0]?.id ?? runStartIdx}`}
                          msgs={runMsgs}
                          metas={runMetas}
                          onRetry={onRetry}
                          leadName={leadName}
                          leadAvatarColors={leadAvatarColors}
                          currentUser={currentUser}
                          isInitialLoad={isInitialLoad}
                          startIdx={runStartIdx}
                          totalMsgCount={allMsgs.length}
                          onNavigateToLead={selected ? () => onNavigateToLead?.(selected.lead.id) : undefined}
                        />
                      );
                    } else {
                      items.push(
                        <BotRunWrapper
                          key={`bot-run-${runMsgs[0]?.id ?? runStartIdx}`}
                          msgs={runMsgs}
                          metas={runMetas}
                          onRetry={onRetry}
                          leadName={leadName}
                          leadAvatarColors={leadAvatarColors}
                          currentUser={currentUser}
                          isInitialLoad={isInitialLoad}
                          startIdx={runStartIdx}
                          totalMsgCount={allMsgs.length}
                        />
                      );
                    }

                    // Emit trailing separators (date/thread labels that come after the run)
                    items.push(...trailingSeparators);
                  }

                  return items;
                })()
              )}
            </div>

            {/* Handoff reason banner — shown when AI handed off to human */}
            {isHuman && selected?.lead.handoff_reason && (
              <HandoffEventChip
                reason={selected.lead.handoff_reason}
                timestamp={selected.lead.last_message_sent_at}
                onResume={() => setShowAiResumeConfirm(true)}
              />
            )}

            {/* Scroll-to-bottom floating button — standard 34px circle */}
            {showScrollButton && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 h-10 w-10 rounded-full border border-black/[0.125] bg-card flex items-center justify-center text-foreground shadow-sm hover:bg-muted active:scale-[0.92] transition-[background-color,transform] duration-150"
                data-testid="button-scroll-to-bottom"
                title={t("chat.scrollToLatest")}
                aria-label={t("chat.scrollToLatest")}
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}

          </div>

          {/* Compose area */}
          <div className="px-3 pb-3 shrink-0 relative" data-testid="chat-compose">
            {isRecording ? (
              /* ── Recording indicator bar ── */
              <div className="flex items-center gap-3 bg-white dark:bg-card rounded-lg border border-red-200 shadow-sm px-3 py-2 h-[52px]">
                {/* Pulsing red dot */}
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-[13px] text-red-500 font-medium flex-1">
                  {t("chat.recording.label")} {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                {/* Cancel */}
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="h-9 w-9 rounded-full border border-black/10 bg-muted/50 text-muted-foreground hover:bg-red-50 hover:text-red-500 hover:border-red-200 flex items-center justify-center shrink-0 transition-colors"
                  title={t("chat.recording.cancel")}
                  data-testid="button-cancel-recording"
                >
                  <X className="h-4 w-4" />
                </button>
                {/* Stop = send */}
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
                  title={t("chat.recording.stopAndSend")}
                  data-testid="button-stop-recording"
                >
                  <Square className="h-3.5 w-3.5 fill-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm pl-3 pr-4 py-[3px] min-h-[62px]">

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 text-[17px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 leading-5 pl-1 pr-2"
                  style={{ maxHeight: "120px" }}
                  placeholder={!selected ? t("chat.compose.placeholderNoContact") : isHuman ? t("chat.compose.placeholderHuman") : t("chat.compose.placeholderDefault")}
                  disabled={!selected || sending}
                  value={draft}
                  onChange={(e) => {
                    setDraft(e.target.value);
                    const el = e.target;
                    el.style.height = "auto";
                    el.style.height = Math.min(el.scrollHeight, 120) + "px";
                  }}
                  onKeyDown={handleKeyDown}
                  rows={1}
                  data-testid="input-compose"
                />

                {/* Image attachment (manual takeover only) */}
                {isHuman && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file || !selected) return;

                        try {
                          // Upload or convert to data URL (small images)
                          if (file.size < 5 * 1024 * 1024) {
                            const reader = new FileReader();
                            reader.onload = async (evt) => {
                              const dataUrl = evt.target?.result as string;
                              // Send as interaction with attachment metadata
                              await apiFetch("/api/interactions", {
                                method: "POST",
                                body: JSON.stringify({
                                  type: "text",
                                  direction: "outbound",
                                  content: "",
                                  leads_id: selected.lead.id,
                                  attachment: {
                                    imageUrl: dataUrl,
                                    caption: ""
                                  }
                                }),
                              });
                              toast({ title: t("chat.compose.imageSent") || "Image sent" });
                            };
                            reader.readAsDataURL(file);
                          } else {
                            toast({ title: "Image too large", description: "Max 5MB", variant: "destructive" });
                          }
                        } catch (err) {
                          toast({ title: "Failed to send image", variant: "destructive" });
                        }

                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                      title={t("chat.compose.attachImage") || "Send image"}
                    >
                      <Paperclip className="h-6 w-6" />
                    </button>
                  </>
                )}

                {/* Mic / Send toggle (with takeover tooltip) */}
                <div className="shrink-0">
                  {draft.trim() ? (
                    /* Send button — shown when there's text */
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors"
                      disabled={!selected || sending}
                      onClick={handleSubmit}
                      data-testid="button-compose-send"
                      title={t("chat.compose.sendMessage")}
                    >
                      {sending ? (
                        <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Send className="h-4 w-4 text-white" />
                      )}
                    </button>
                  ) : (
                    /* Mic button — shown when input is empty */
                    <button
                      type="button"
                      className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors"
                      disabled={!selected || sending}
                      onClick={startRecording}
                      data-testid="button-compose-mic"
                      title={t("chat.compose.recordVoice")}
                    >
                      <Mic className="h-5 w-5 text-white" />
                    </button>
                  )}
                  {/* Takeover confirmation tooltip */}
                  {showTakeoverConfirm && (
                    <div className="absolute bottom-full right-3 mb-2 z-50 w-52 bg-white dark:bg-popover rounded-xl shadow-lg border border-border/40 p-3 space-y-2">
                      <p className="text-[11px] font-semibold text-foreground">{t("chat.takeover.title")}</p>
                      <p className="text-[10px] text-muted-foreground/70 leading-snug">{t("chat.takeover.description")}</p>
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={handleTakeoverConfirm}
                          className="flex-1 px-2 py-1.5 rounded-lg bg-brand-indigo text-white text-[11px] font-semibold hover:bg-brand-indigo/90 transition-colors"
                        >
                          {t("chat.takeover.confirmSend")}
                        </button>
                        <button
                          onClick={handleTakeoverCancel}
                          className="flex-1 px-2 py-1.5 rounded-lg border border-border/50 text-[11px] font-medium text-foreground hover:bg-muted/50 transition-colors"
                        >
                          {t("chat.takeover.cancel")}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Gradient Tester (dev tool) ── */}
        <GradientTester
          open={gradientTesterOpen}
          onClose={() => setGradientTesterOpen(false)}
          layers={gradientLayers}
          onUpdateLayer={updateGradientLayer}
          onResetLayers={resetGradientLayers}
          dragMode={gradientDragMode}
          onToggleDragMode={() => setGradientDragMode(prev => !prev)}
          onSaveToSlot={(slot) => {
            saveSlotLayers(slot, gradientLayers);
            setDoodleConfig({ bgStyle: slot as ChatBgStyle });
          }}
          onApply={handleApplyGradient}
        />
      </section>


    </>
    </TimezoneContext.Provider>
    </HideAvatarsContext.Provider>
    </BubbleWidthContext.Provider>
  );
}
