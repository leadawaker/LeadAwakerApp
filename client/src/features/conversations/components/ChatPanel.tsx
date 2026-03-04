import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  FileText,
  Music,
  Video,
  Download,
  ExternalLink,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Send,
  Bot,
  PanelRight,
  RotateCcw,
  Paintbrush,
  Wallpaper,
  Pause,
  Play,
  Paperclip,
  Smile,
  Mic,
  Square,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SkeletonChatThread } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import type { Thread, Interaction } from "../hooks/useConversationsData";
import { formatRelativeTime, getStatus, PIPELINE_HEX } from "../utils/conversationHelpers";
import {
  GradientTester,
  GradientControlPoints,
  DEFAULT_LAYERS,
  layerToStyle,
  type GradientLayer,
} from "@/components/ui/gradient-tester";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { getDoodleStyle, BLEND_MODES, patternIdToNumber, numberToPatternId } from "@/components/ui/doodle-patterns";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getLeadStatusAvatarColor, getInitials } from "@/lib/avatarUtils";
import { useToast } from "@/hooks/use-toast";
import { useSession, type SessionUser } from "@/hooks/useSession";

interface ChatPanelProps {
  selected: Thread | null;
  loading?: boolean;
  sending: boolean;
  onSend: (leadId: number, content: string, type?: string) => Promise<void>;
  onToggleTakeover?: (leadId: number, manualTakeover: boolean) => Promise<void>;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  showContactPanel?: boolean;
  onShowContactPanel?: () => void;
  className?: string;
  /** Extra toolbar actions rendered in the header (e.g. +, Search, Settings) */
  headerActions?: React.ReactNode;
}

export function ChatPanel({
  selected,
  loading = false,
  sending,
  onSend,
  onToggleTakeover,
  onRetry,
  showContactPanel,
  onShowContactPanel,
  className,
  headerActions,
}: ChatPanelProps) {
  const isHuman = selected?.lead.manual_takeover === true;
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLeadId = useRef<number | null>(null);
  const prevMsgCount = useRef(0);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const session = useSession();
  const currentUser: SessionUser | null = session.status === "authenticated" ? session.user : null;

  // ── Voice recording ─────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startRecording = useCallback(async () => {
    if (!selected) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      recordingChunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size > 0) recordingChunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(recordingChunksRef.current, { type: mr.mimeType });
        // Convert to base64 data URL for inline playback (no upload endpoint yet)
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
      toast({ title: "Microphone access denied", description: "Allow microphone access to record voice messages.", variant: "destructive" });
    }
  }, [selected, onSend, toast]);

  const stopRecording = useCallback(() => {
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
  const [isInitialLoad, setIsInitialLoad] = useState(false);
  const initialLoadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Takeover flow state
  const [hasConfirmedTakeover, setHasConfirmedTakeover] = useState(false);
  const [showTakeoverConfirm, setShowTakeoverConfirm] = useState(false);
  const [pendingDraft, setPendingDraft] = useState("");

  // AI resume flow state
  const [showAiResumeConfirm, setShowAiResumeConfirm] = useState(false);

  // ── Doodle overlay ─────────────────────────────────────────────────────────
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();

  // ── Gradient tester state (dev tool) ────────────────────────────────────────
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

  // Compute lead avatar colors
  const leadAvatarColors = useMemo(() => {
    if (!selected) return { bgColor: "#C9C9C9", textColor: "#374151" };
    const status = getStatus(selected.lead);
    const colors = getLeadStatusAvatarColor(status);
    return { bgColor: colors.bg, textColor: colors.text };
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
      setTimeout(() => scrollToBottom("instant"), 0);
      setShowScrollButton(false);

      // Trigger bubble entrance animation for 800ms after switching
      if (leadId !== null) {
        setIsInitialLoad(true);
        if (initialLoadTimer.current) clearTimeout(initialLoadTimer.current);
        initialLoadTimer.current = setTimeout(() => setIsInitialLoad(false), 800);
      }
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
      await onToggleTakeover(selected.lead.id, true);
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
    <>
      <section
        className={cn(
          "flex flex-col rounded-lg overflow-hidden h-full relative",
          className,
        )}
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
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, doodleConfig.strokeColor, doodleConfig.blendMode)}
              />
            )}
          </>
        ) : (
          <>
            {doodleConfig.bgStyle === "crm" && (
              <div className="absolute inset-0 bg-card" />
            )}
            {(doodleConfig.bgStyle === "social1" || !doodleConfig.bgStyle) && (
              <>
                <div className="absolute inset-0 bg-popover dark:bg-background" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_67%_70%_at_1%_9%,rgba(169,255,208,0.5)_0%,transparent_64%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_137%_105%_at_0%_100%,rgba(244,231,137,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_78%_59%_at_1%_9%,rgba(199,255,235,0.89)_0%,transparent_100%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_169%_148%_at_91%_15%,rgba(244,231,137,0.38)_0%,transparent_66%)] dark:opacity-[0.08]" />
              </>
            )}
            {doodleConfig.bgStyle === "social2" && (
              <>
                <div className="absolute inset-0 bg-popover dark:bg-background" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_132%_at_96%_12%,rgba(209,255,158,0.62)_0%,transparent_64%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_151%_142%_at_0%_100%,#6ed4d8_0%,transparent_69%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_130%_126%_at_0%_0%,#a5ffcb_0%,transparent_60%)] dark:opacity-[0.08]" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_183%_155%_at_100%_100%,rgba(217,217,128,0.5)_0%,transparent_66%)] dark:opacity-[0.08]" />
              </>
            )}
            {doodleConfig.enabled && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={getDoodleStyle(doodleConfig.patternId, doodleConfig.color, doodleConfig.size, doodleConfig.strokeColor, doodleConfig.blendMode)}
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
                <EntityAvatar
                  name={leadName || "?"}
                  bgColor={getLeadStatusAvatarColor(selected.lead.Conversion_Status ?? selected.lead.conversion_status ?? "").bg}
                  textColor={getLeadStatusAvatarColor(selected.lead.Conversion_Status ?? selected.lead.conversion_status ?? "").text}
                  size={45}
                  className="shrink-0"
                />
              )}
              {/* Lead name */}
              {selected && (
                <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate min-w-0">
                  {leadName}
                </h2>
              )}

              {/* Buttons — left cluster (injected actions + tools) */}
              <div className="ml-2 md:ml-6 flex items-center gap-1.5">
              {headerActions}

              {/* Doodle overlay popover — next to filter, always gray — hidden on mobile */}
              <span className="hidden md:contents">
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                    title="Chat background doodle"
                  >
                    <Wallpaper className="h-4 w-4" />
                  </button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-64 p-3 space-y-3">
                  {/* Background style picker */}
                  <div className="space-y-1.5">
                    <span className="text-[12px] font-semibold">Background</span>
                    <div className="grid grid-cols-3 gap-1">
                      {(["crm", "social1", "social2"] as ChatBgStyle[]).map((style) => (
                        <button
                          key={style}
                          type="button"
                          onClick={() => setDoodleConfig({ bgStyle: style })}
                          className={cn(
                            "h-8 rounded-md border text-[10px] font-medium transition-colors",
                            doodleConfig.bgStyle === style || (!doodleConfig.bgStyle && style === "social1")
                              ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                              : "border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
                          )}
                        >
                          {style === "crm" ? "CRM" : style === "social1" ? "Social 1" : "Social 2"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold">Doodle Overlay</span>
                    <Switch
                      checked={doodleConfig.enabled}
                      onCheckedChange={(enabled) => setDoodleConfig({ enabled })}
                    />
                  </div>
                  {doodleConfig.enabled && (
                    <>
                      {/* Pattern picker — slider 1–42 */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Pattern</span>
                          <span className="text-[11px] font-semibold tabular-nums text-foreground/70">
                            #{patternIdToNumber(doodleConfig.patternId)}
                          </span>
                        </div>
                        <Slider
                          value={[patternIdToNumber(doodleConfig.patternId)]}
                          onValueChange={([v]) => setDoodleConfig({ patternId: numberToPatternId(v) })}
                          min={1}
                          max={42}
                          step={1}
                        />
                      </div>
                      {/* Stroke color slider (0=black → 100=white) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Color</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">
                            {doodleConfig.strokeColor === 0 ? "Black" : doodleConfig.strokeColor === 100 ? "White" : `${doodleConfig.strokeColor}%`}
                          </span>
                        </div>
                        <Slider
                          value={[doodleConfig.strokeColor ?? 0]}
                          onValueChange={([v]) => setDoodleConfig({ strokeColor: v })}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                      {/* Opacity slider (0–100 → 0–80% opacity) */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Opacity</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.color}%</span>
                        </div>
                        <Slider
                          value={[doodleConfig.color]}
                          onValueChange={([v]) => setDoodleConfig({ color: v })}
                          min={0}
                          max={100}
                          step={1}
                        />
                      </div>
                      {/* Size slider */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">Size</span>
                          <span className="text-[11px] text-muted-foreground tabular-nums">{doodleConfig.size}px</span>
                        </div>
                        <Slider
                          value={[doodleConfig.size]}
                          onValueChange={([v]) => setDoodleConfig({ size: v })}
                          min={200}
                          max={800}
                          step={25}
                        />
                      </div>
                      {/* Blend mode selector */}
                      <div className="space-y-1.5">
                        <span className="text-[11px] text-muted-foreground">Blend mode</span>
                        <select
                          value={doodleConfig.blendMode ?? "overlay"}
                          onChange={(e) => setDoodleConfig({ blendMode: e.target.value })}
                          className="w-full h-8 px-2 rounded-md border border-black/[0.125] bg-card text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-brand-indigo/40"
                        >
                          {BLEND_MODES.map((m) => (
                            <option key={m} value={m}>
                              {m.charAt(0).toUpperCase() + m.slice(1).replace(/-/g, " ")}
                            </option>
                          ))}
                        </select>
                      </div>
                    </>
                  )}
                </PopoverContent>
              </Popover>

              {/* Gradient tester — always gray */}
              <button
                type="button"
                onClick={() => setGradientTesterOpen(prev => !prev)}
                className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                title="Gradient Tester"
              >
                <Paintbrush className="h-4 w-4" />
              </button>
              </span>{/* end hidden md:contents — wallpaper + gradient tester */}

              </div>{/* end left buttons cluster */}

              {/* Let AI continue — far right, popover confirm on click */}
              {selected && isHuman && onToggleTakeover && (
                <Popover open={showAiResumeConfirm} onOpenChange={setShowAiResumeConfirm}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      data-testid="btn-ai-resume"
                      className="group relative inline-flex items-center justify-center h-9 w-9 rounded-full border border-black/[0.125] hover:border-brand-indigo hover:bg-transparent shrink-0 transition-[width,border-color,background-color] duration-200 hover:w-[142px] ml-auto"
                      aria-label="Let AI continue"
                    >
                      <img src="/6. Favicon.svg" alt="AI" className="h-6.5 w-6.5 shrink-0 absolute left-[5px] -top-[-2px]" />
                      <span className="whitespace-nowrap pl-10 pr-2.5 text-[12px] font-medium text-brand-indigo opacity-0 group-hover:opacity-100 transition-opacity duration-150">
                        Let AI continue
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
                        onClick={handleAiResumeConfirm}
                        className="text-[12px] font-medium text-white bg-brand-indigo hover:bg-brand-indigo/90 px-3 py-1 rounded-md transition-colors"
                      >
                        Confirm
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}

              {/* Unfold contact panel — right of AI button, plain sibling (not in same flex as AI to avoid expand-push loop) */}
              {!showContactPanel && onShowContactPanel && (
                <button
                  type="button"
                  onClick={onShowContactPanel}
                  className="h-9 w-9 rounded-full border border-black/[0.125] flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
                  title="Show contact panel"
                  data-testid="btn-show-contact-panel"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
              )}

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
                    title="Your conversations, one click away"
                    description="Select a lead from the inbox to view their full message history with the AI."
                    compact
                  />
                </div>
              ) : selected.msgs.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <DataEmptyState
                    variant="conversations"
                    title="No messages yet"
                    description="Start the conversation by sending a message below."
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
                    | { kind: "thread"; group: ThreadGroup; total: number; key: string };

                  const tokens: Token[] = [];
                  let lastDateKey = "";
                  let flatIdx = 0;

                  for (let gi = 0; gi < threadGroups.length; gi++) {
                    const group = threadGroups[gi];
                    const isMeaningfulThread =
                      group.threadId.startsWith("bump-") ||
                      group.threadId.startsWith("thread-");

                    for (let mi = 0; mi < group.msgs.length; mi++) {
                      const m = group.msgs[mi];
                      const ts = m.created_at ?? m.createdAt;
                      const dk = getDateKey(ts);

                      // Date separator before this message (once per day)
                      if (dk && dk !== lastDateKey) {
                        // For the very first message of a thread group, emit the thread divider first
                        if (mi === 0 && isMeaningfulThread) {
                          tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
                        }
                        if (ts) tokens.push({ kind: "date", label: formatDateLabel(ts), key: `date-${gi}-${mi}` });
                        lastDateKey = dk;
                      } else if (mi === 0 && isMeaningfulThread) {
                        tokens.push({ kind: "thread", group, total: threadGroups.length, key: group.threadId });
                      }

                      tokens.push({ kind: "msg", msgIdx: flatIdx });
                      flatIdx++;
                    }
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

                    // tok.kind === "msg" — collect a run of consecutive same-sender messages,
                    // skipping over non-msg tokens between them (date/thread separators don't break a run)
                    const firstMsg = allMsgs[tok.msgIdx];
                    const senderType: SenderKey = firstMsg.direction !== "Outbound"
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
                      if (lt.kind === "date" || lt.kind === "thread") {
                        // Separator — peek past it to see if same sender continues
                        pendingSeparators.push({ node: lt.kind === "date"
                          ? <DateSeparator key={lt.key} label={lt.label} />
                          : <ThreadDivider key={lt.key} group={lt.group} total={lt.total} />,
                          insertAfterRunIdx: runMsgs.length,
                        });
                        lookahead++;
                        continue;
                      }
                      // It's a msg token
                      const m = allMsgs[lt.msgIdx];
                      const sk: SenderKey = m.direction !== "Outbound"
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

            {/* Scroll-to-bottom floating button — standard 34px circle */}
            {showScrollButton && (
              <button
                type="button"
                onClick={() => scrollToBottom("smooth")}
                className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 h-10 w-10 rounded-full border border-black/[0.125] bg-card flex items-center justify-center text-foreground shadow-sm hover:bg-muted active:scale-[0.92] transition-[background-color,transform] duration-150"
                data-testid="button-scroll-to-bottom"
                title="Scroll to latest message"
                aria-label="Scroll to latest message"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            )}

          </div>

          {/* Compose area */}
          <div className="px-3 pb-3 shrink-0" data-testid="chat-compose">
            {isRecording ? (
              /* ── Recording indicator bar ── */
              <div className="flex items-center gap-3 bg-white dark:bg-card rounded-lg border border-red-200 shadow-sm px-3 py-2 h-[52px]">
                {/* Pulsing red dot */}
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
                </span>
                <span className="text-[13px] text-red-500 font-medium flex-1">
                  Recording… {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                </span>
                {/* Stop = send */}
                <button
                  type="button"
                  onClick={stopRecording}
                  className="h-9 w-9 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shrink-0 transition-colors"
                  title="Stop and send voice message"
                  data-testid="button-stop-recording"
                >
                  <Square className="h-3.5 w-3.5 fill-white" />
                </button>
              </div>
            ) : (
              <div className="flex items-end gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm px-3 py-2">
                {/* Emoji button */}
                <Popover open={emojiOpen} onOpenChange={setEmojiOpen}>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className="h-10 w-10 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                      title="Emoji"
                    >
                      <Smile className="h-7 w-7" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-52 p-2" align="start" side="top">
                    <div className="grid grid-cols-6 gap-0.5">
                      {["😀","😂","❤️","👍","🙏","🎉","🔥","✨","👏","💪","🤔","😊","😍","🙌","💯","🎯","✅","😄","🥰","😅","💡","🚀","🌟","💬","📱","💼","🎊","😎","🤝","❓"].map((e) => (
                        <button
                          key={e}
                          type="button"
                          onClick={() => {
                            setDraft((d) => d + e);
                            setEmojiOpen(false);
                            textareaRef.current?.focus();
                          }}
                          className="h-8 text-lg flex items-center justify-center rounded hover:bg-muted transition-colors"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>

                {/* Textarea */}
                <textarea
                  ref={textareaRef}
                  className="flex-1 text-[13px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 leading-5 pl-1"
                  style={{ minHeight: "32px", maxHeight: "120px" }}
                  placeholder={!selected ? "Select a contact first" : isHuman ? "Taking over from AI — Enter to send" : "Type a message… (Enter to send)"}
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

                {/* Clip (attachment stub) */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*,audio/*,.pdf,.doc,.docx"
                  className="hidden"
                  onChange={() => {
                    if (fileInputRef.current) fileInputRef.current.value = "";
                    toast({ title: "Attachments coming soon", description: "File upload support is being set up." });
                  }}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                  title="Attach file"
                >
                  <Paperclip className="h-6 w-6" />
                </button>

                {/* Mic / Send toggle */}
                {draft.trim() ? (
                  /* Send button — shown when there's text */
                  <button
                    type="button"
                    className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                    disabled={!selected || sending}
                    onClick={handleSubmit}
                    data-testid="button-compose-send"
                    title="Send message"
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
                    className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 shrink-0 transition-colors"
                    disabled={!selected || sending}
                    onClick={startRecording}
                    data-testid="button-compose-mic"
                    title="Record voice message"
                  >
                    <Mic className="h-5 w-5 text-white" />
                  </button>
                )}
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
        />
      </section>

      {/* Human takeover confirmation dialog */}
      <AlertDialog open={showTakeoverConfirm} onOpenChange={(open) => { if (!open) handleTakeoverCancel(); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Take over this conversation?</AlertDialogTitle>
            <AlertDialogDescription>
              Sending this message will switch the conversation to human mode. The AI will stop responding and you'll be in control. You won't be asked again this session.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleTakeoverCancel}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleTakeoverConfirm}>
              Take over &amp; Send
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function getDateKey(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toDateString();
}

function formatDateLabel(ts: string): string {
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const msgDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diff = Math.round((today.getTime() - msgDay.getTime()) / 86_400_000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString([], { month: "long", day: "numeric" });
}

function formatBubbleTime(ts: string | null | undefined): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// ─── Sender run tracking ──────────────────────────────────────────────────────

type SenderKey = "inbound" | "ai" | "human";

interface MsgMeta {
  senderKey: SenderKey;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}

function computeMsgMeta(msgs: Interaction[]): MsgMeta[] {
  const result: MsgMeta[] = [];
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i];
    const sk: SenderKey = m.direction !== "Outbound"
      ? "inbound"
      : isAiMessage(m) ? "ai" : "human";
    const prevSk: SenderKey | "" = i > 0
      ? (msgs[i - 1].direction !== "Outbound" ? "inbound" : isAiMessage(msgs[i - 1]) ? "ai" : "human")
      : "";
    const nextSk: SenderKey | "" = i < msgs.length - 1
      ? (msgs[i + 1].direction !== "Outbound" ? "inbound" : isAiMessage(msgs[i + 1]) ? "ai" : "human")
      : "";
    result.push({
      senderKey: sk,
      isFirstInRun: sk !== prevSk,
      isLastInRun: sk !== nextSk,
    });
  }
  return result;
}

// ─── Date separator ───────────────────────────────────────────────────────────

function DateSeparator({ label }: { label: string }) {
  return (
    <div className="flex justify-center py-2">
      <span className="text-[16px] font-medium text-white/95 bg-black/10 rounded-full px-4 py-1 select-none">
        {label}
      </span>
    </div>
  );
}

// ─── Agent avatar ─────────────────────────────────────────────────────────────

function AgentAvatar({ who, currentUser }: { who: string; currentUser: SessionUser | null }) {
  // Prefer the logged-in user's real name & photo over the raw `who` field
  const displayName = currentUser?.fullName || who || "You";
  const photoUrl = currentUser?.avatarUrl ?? null;
  return (
    <EntityAvatar
      name={displayName}
      photoUrl={photoUrl}
      bgColor="#4F46E5"
      textColor="#ffffff"
      size={48}
      className="shrink-0"
    />
  );
}

/** Bot avatar — Lead Awaker favicon, unclipped (no circle crop) */
function BotAvatar() {
  return (
    <div className="h-12 w-12 shrink-0">
      <img src="/6. Favicon.svg" alt="AI" className="h-full w-full object-contain" />
    </div>
  );
}

/**
 * Wraps a consecutive run of human-agent outbound messages with a single
 * sticky avatar that follows the user as they scroll through a long run —
 * Telegram-style. The avatar sticks to `top-4` (first balloon) as you scroll up.
 */
function AgentRunWrapper({
  msgs,
  metas,
  who,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  who: string;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
}) {
  return (
    <div
      className={cn(
        "flex justify-end gap-1.5",
        isInitialLoad && "animate-bubble-right",
      )}
      style={isInitialLoad ? { animationDelay: `${Math.min(startIdx, 20) * 25}ms` } : undefined}
    >
      {/* Bubbles column — full width so max-w-[78%] resolves correctly */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>

      {/* Avatar column — sticky to bottom of scroll container so it stays visible while scrolling */}
      <div className="w-12 shrink-0 self-end sticky bottom-0">
        <AgentAvatar who={who} currentUser={currentUser} />
      </div>
    </div>
  );
}

/**
 * Wraps consecutive inbound (lead) messages — sticky lead avatar on the LEFT,
 * same Telegram-style behaviour as AgentRunWrapper.
 */
function LeadRunWrapper({
  msgs,
  metas,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
}) {
  return (
    <div
      className={cn("flex justify-start gap-1.5", isInitialLoad && "animate-bubble-left")}
      style={isInitialLoad ? { animationDelay: `${Math.min(startIdx, 20) * 25}ms` } : undefined}
    >
      {/* Avatar column — sticky to bottom, left side */}
      <div className="w-12 shrink-0 self-end sticky bottom-0">
        <EntityAvatar
          name={leadName || "?"}
          bgColor={leadAvatarColors.bgColor}
          textColor={leadAvatarColors.textColor}
          size={48}
        />
      </div>
      {/* Bubbles column */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Wraps consecutive AI-generated outbound messages — sticky bot avatar on the RIGHT,
 * same Telegram-style behaviour as AgentRunWrapper.
 */
function BotRunWrapper({
  msgs,
  metas,
  onRetry,
  leadName,
  leadAvatarColors,
  currentUser,
  isInitialLoad,
  startIdx,
}: {
  msgs: Interaction[];
  metas: MsgMeta[];
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  currentUser: SessionUser | null;
  isInitialLoad: boolean;
  startIdx: number;
}) {
  return (
    <div
      className={cn("flex justify-end gap-1.5", isInitialLoad && "animate-bubble-right")}
      style={isInitialLoad ? { animationDelay: `${Math.min(startIdx, 20) * 25}ms` } : undefined}
    >
      {/* Bubbles column */}
      <div className="flex flex-col min-w-0 flex-1">
        {msgs.map((m, i) => (
          <ChatBubble
            key={m.id ?? i}
            item={m}
            meta={metas[i]}
            onRetry={onRetry}
            leadName={leadName}
            leadAvatarColors={leadAvatarColors}
            currentUser={currentUser}
            suppressAvatar
          />
        ))}
      </div>
      {/* Bot avatar column — sticky to bottom, right side */}
      <div className="w-12 shrink-0 self-end sticky bottom-0">
        <BotAvatar />
      </div>
    </div>
  );
}

/** Delivery status icon for outbound messages. */
interface MessageStatusIconProps {
  status: string;
  isSending: boolean;
  isSent: boolean;
  isDelivered: boolean;
  isRead: boolean;
  isFailed: boolean;
}

function MessageStatusIcon({ isSending, isSent, isDelivered, isRead, isFailed }: MessageStatusIconProps) {
  if (isSending) {
    return (
      <span className="inline-flex items-center gap-0.5" data-testid="status-sending" title="Sending…">
        <Clock className="w-3 h-3 animate-pulse opacity-70" />
      </span>
    );
  }
  if (isFailed) {
    return (
      <span className="inline-flex items-center gap-0.5 text-destructive" data-testid="status-failed" title="Message failed to send">
        <AlertCircle className="w-3 h-3" />
      </span>
    );
  }
  if (isRead) {
    return (
      <span className="inline-flex items-center text-sky-300" data-testid="status-read" title="Read">
        <CheckCheck className="w-3 h-3" />
      </span>
    );
  }
  if (isDelivered) {
    return (
      <span className="inline-flex items-center opacity-80" data-testid="status-delivered" title="Delivered">
        <CheckCheck className="w-3 h-3" />
      </span>
    );
  }
  if (isSent) {
    return (
      <span className="inline-flex items-center opacity-60" data-testid="status-sent" title="Sent">
        <Check className="w-3 h-3" />
      </span>
    );
  }
  return null;
}

/** Returns true if this interaction was generated/sent by the AI/automation system */
function isAiMessage(item: Interaction): boolean {
  if (item.ai_generated === true) return true;
  if (item.is_bump === true) return true;
  if ((item.triggered_by ?? item.triggeredBy) === "Automation") return true;
  const who = (item.Who ?? item.who ?? "").toLowerCase();
  if (who === "ai" || who === "bot" || who === "automation") return true;
  if (/^bump\s*\d/.test(who)) return true;
  if (who === "start") return true;
  return false;
}

/** Returns true if this interaction was sent manually by a human agent */
function isHumanAgentMessage(item: Interaction): boolean {
  if (item.direction !== "Outbound") return false;
  if (isAiMessage(item)) return false;
  return true;
}

/** Derive a readable sender label for the message */
function getSenderLabel(item: Interaction, inbound: boolean, aiMsg: boolean, leadName: string): string {
  if (inbound) return leadName || "Lead";
  if (aiMsg) {
    const who = (item.Who ?? item.who ?? "").trim();
    const genericWho = /^(ai|bot|automation|start|bump\s*\d*)$/i;
    if (who && !genericWho.test(who)) return `AI ${who}`;
    if (item.ai_model) return `AI ${item.ai_model}`;
    return "AI";
  }
  const who = (item.Who ?? item.who ?? "").trim();
  if (who && who.toLowerCase() !== "human" && who.toLowerCase() !== "agent") return who;
  return "You";
}

// ─── Thread Grouping ──────────────────────────────────────────────────────────

interface ThreadGroup {
  threadId: string;
  threadIndex: number;
  msgs: Interaction[];
}

const THREAD_GAP_MS = 2 * 60 * 60 * 1000;

function groupMessagesByThread(msgs: Interaction[]): ThreadGroup[] {
  if (msgs.length === 0) return [];

  const groups: ThreadGroup[] = [];
  let currentGroup: ThreadGroup | null = null;
  let groupIndex = 0;

  function getThreadKey(m: Interaction): string | null {
    const tid = m.conversation_thread_id ?? m.conversationThreadId;
    if (tid) return `thread-${tid}`;
    if (m.bump_number != null) return `bump-${m.bump_number}`;
    if (m.is_bump && m.Who) return `bump-who-${m.Who.toLowerCase().replace(/\s+/g, "-")}`;
    return null;
  }

  let lastTimestamp: number | null = null;

  for (const m of msgs) {
    const key = getThreadKey(m);
    const ts = m.created_at || m.createdAt;
    const currentTimestamp = ts ? new Date(ts).getTime() : null;

    let startNew = false;

    if (!currentGroup) {
      startNew = true;
    } else if (key !== null) {
      if (key !== currentGroup.threadId) startNew = true;
    } else {
      if (
        currentTimestamp !== null &&
        lastTimestamp !== null &&
        currentTimestamp - lastTimestamp > THREAD_GAP_MS
      ) {
        startNew = true;
      }
    }

    if (startNew) {
      const tid: string = key ?? `session-${groupIndex}`;
      currentGroup = { threadId: tid, threadIndex: groupIndex++, msgs: [] };
      groups.push(currentGroup);
    }

    currentGroup!.msgs.push(m);
    if (currentTimestamp !== null) lastTimestamp = currentTimestamp;
  }

  return groups;
}

function formatThreadLabel(group: ThreadGroup, total: number): string {
  const { threadId, threadIndex } = group;
  if (threadId.startsWith("bump-who-")) {
    const who = threadId.replace("bump-who-", "").replace(/-/g, " ");
    return who.charAt(0).toUpperCase() + who.slice(1);
  }
  if (threadId.startsWith("bump-")) {
    const n = threadId.replace("bump-", "");
    return `Bump ${n}`;
  }
  if (threadId.startsWith("thread-")) {
    const id = threadId.replace("thread-", "");
    return id.length > 12 ? `Thread ${threadIndex + 1}` : `Thread ${id}`;
  }
  if (total === 1) return "Conversation";
  return `Conversation ${threadIndex + 1}`;
}

function ThreadDivider({ group, total }: { group: ThreadGroup; total: number }) {
  const label = formatThreadLabel(group, total);
  const firstMsg = group.msgs[0];
  const ts = firstMsg?.created_at || firstMsg?.createdAt;
  const time = ts ? formatBubbleTime(ts) : null;
  const isBump = group.threadId.startsWith("bump-");

  return (
    <div className="flex justify-center my-4" data-testid={`thread-divider-${group.threadIndex}`}>
      <span className={cn(
        "text-[13px] font-semibold rounded-full px-4 py-1.5 select-none",
        isBump ? "bg-amber-100 text-amber-700" : "bg-indigo-50 text-brand-indigo",
      )}>
        {label}{time ? ` · ${time}` : ""}
      </span>
    </div>
  );
}

// ─── Attachment preview ───────────────────────────────────────────────────────

function getAttachmentType(url: string): "image" | "video" | "audio" | "document" {
  // Data URLs
  if (url.startsWith("data:audio/")) return "audio";
  if (url.startsWith("data:video/")) return "video";
  if (url.startsWith("data:image/")) return "image";
  const lower = url.toLowerCase().split("?")[0];
  if (/\.(jpg|jpeg|png|gif|webp|svg|bmp|avif)$/.test(lower)) return "image";
  if (/\.(mp4|mov|avi|webm|mkv|ogg)$/.test(lower)) return "video";
  if (/\.(mp3|ogg|wav|m4a|aac|opus|flac)$/.test(lower)) return "audio";
  return "document";
}

/** Telegram-style voice memo player */
function VoiceMemoPlayer({ url, color = "#0ABFA3" }: { url: string; outbound?: boolean; color?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<1 | 1.5 | 2>(1);
  const rafRef = useRef<number | null>(null);

  // rAF loop — polls audio.currentTime every frame while playing for smooth bar fill
  const startRaf = useCallback(() => {
    const tick = () => {
      const a = audioRef.current;
      if (!a) return;
      setCurrentTime(a.currentTime);
      if (!a.paused && !a.ended) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }, []);

  const stopRaf = useCallback(() => {
    if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  }, []);

  useEffect(() => () => stopRaf(), [stopRaf]);

  // Try to load duration as soon as element mounts
  useEffect(() => {
    const a = audioRef.current;
    if (!a) return;
    const onMeta = () => setDuration(isFinite(a.duration) ? a.duration : 0);
    a.addEventListener("loadedmetadata", onMeta);
    a.addEventListener("durationchange", onMeta);
    if (isFinite(a.duration) && a.duration > 0) setDuration(a.duration);
    return () => { a.removeEventListener("loadedmetadata", onMeta); a.removeEventListener("durationchange", onMeta); };
  }, [url]);

  // Real waveform via Web Audio API — decode the audio and sample RMS per bar bucket
  const BAR_COUNT = 60;
  const [bars, setBars] = useState<number[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(url);
        const arrayBuffer = await res.arrayBuffer();
        if (cancelled) return;
        const ctx = new AudioContext();
        const decoded = await ctx.decodeAudioData(arrayBuffer);
        ctx.close();
        if (cancelled) return;

        // Mix down to mono by averaging all channels
        const channelData: Float32Array[] = [];
        for (let c = 0; c < decoded.numberOfChannels; c++) {
          channelData.push(decoded.getChannelData(c));
        }
        const totalSamples = decoded.length;
        const samplesPerBar = Math.floor(totalSamples / BAR_COUNT);

        const heights = Array.from({ length: BAR_COUNT }, (_, i) => {
          const start = i * samplesPerBar;
          const end   = Math.min(start + samplesPerBar, totalSamples);
          let sum = 0, count = 0;
          for (let s = start; s < end; s++) {
            let val = 0;
            for (const ch of channelData) val += ch[s];
            val /= channelData.length;
            sum += val * val;
            count++;
          }
          return count > 0 ? Math.sqrt(sum / count) : 0;
        });

        // Normalize: map 0..max → 2..20 (px)
        const maxRms = Math.max(...heights, 0.001);
        const normalized = heights.map(v => Math.round(2 + (v / maxRms) * 18));
        if (!cancelled) setBars(normalized);
      } catch {
        // Fallback to hash-based fake waveform if decode fails
        if (!cancelled) {
          const seed = url.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
          setBars(Array.from({ length: BAR_COUNT }, (_, i) => {
            const h = Math.abs(Math.sin((seed + i * 137.5) * 0.1));
            return Math.round(2 + h * 18);
          }));
        }
      }
    })();
    return () => { cancelled = true; };
  }, [url]);

  const fmt = (s: number) => {
    if (!isFinite(s) || isNaN(s) || s <= 0) return "0:00";
    return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;
  };

  const toggle = () => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) {
      a.pause();
      setPlaying(false);
      stopRaf();
    } else {
      a.play().then(() => { setPlaying(true); startRaf(); }).catch(() => {});
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    const a = audioRef.current;
    if (!a) return;
    const dur = isFinite(a.duration) && a.duration > 0 ? a.duration : duration;
    if (!dur) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    a.currentTime = ratio * dur;
    setCurrentTime(a.currentTime);
  };

  const cycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = audioRef.current;
    const next: 1 | 1.5 | 2 = speed === 1 ? 1.5 : speed === 1.5 ? 2 : 1;
    setSpeed(next);
    if (a) a.playbackRate = next;
  };

  // Derive playedCount from live audio element (more accurate than state)
  const liveTime = audioRef.current?.currentTime ?? currentTime;
  const liveDur  = (audioRef.current && isFinite(audioRef.current.duration) && audioRef.current.duration > 0)
    ? audioRef.current.duration
    : duration;
  const progress    = liveDur > 0 ? liveTime / liveDur : 0;
  const playedCount = Math.round(progress * BAR_COUNT);

  return (
    <div className="flex items-center gap-2.5" style={{ minWidth: 220, maxWidth: 280 }}>
      <audio
        ref={audioRef}
        src={url}
        preload="auto"
        onLoadedMetadata={() => {
          const a = audioRef.current;
          if (a && isFinite(a.duration)) setDuration(a.duration);
        }}
        onEnded={() => { setPlaying(false); stopRaf(); setCurrentTime(0); }}
      />

      {/* Play/Pause circle */}
      <button
        type="button"
        onClick={toggle}
        className="h-10 w-10 rounded-full text-white flex items-center justify-center shrink-0 transition-colors shadow-sm"
        style={{ backgroundColor: color }}
        aria-label={playing ? "Pause" : "Play"}
      >
        {playing
          ? <Pause className="h-4 w-4 fill-white stroke-none" />
          : <Play  className="h-4 w-4 fill-white stroke-none ml-0.5" />}
      </button>

      {/* Waveform + time column */}
      <div className="flex flex-col gap-1 flex-1 min-w-0">
        {/* Waveform bars — color = played, transparent gray = unplayed, centered */}
        <div
          className="flex items-center gap-[1px] cursor-pointer"
          style={{ height: 24 }}
          onClick={seek}
          title="Seek"
        >
          {bars === null
            ? Array.from({ length: BAR_COUNT }, (_, i) => (
                <div key={i} className="shrink-0 animate-pulse" style={{ width: 2, height: 4, borderRadius: 1, backgroundColor: "rgba(160,160,160,0.25)" }} />
              ))
            : bars.map((h, i) => (
                <div
                  key={i}
                  className="shrink-0"
                  style={{
                    width: 2,
                    height: h,
                    borderRadius: 1,
                    backgroundColor: i < playedCount ? color : "rgba(160,160,160,0.35)",
                    transition: "background-color 60ms linear",
                  }}
                />
              ))
          }
        </div>

        {/* Time + speed row */}
        <div className="flex items-center justify-between">
          <span className="text-[10px] tabular-nums leading-none" style={{ color: "#888" }}>
            {playing || currentTime > 0 ? fmt(liveTime) : fmt(liveDur)}
          </span>
          <button
            type="button"
            onClick={cycleSpeed}
            className="text-[9px] font-bold tabular-nums leading-none"
            style={{ color: "#999" }}
            title="Playback speed"
          >
            {speed}×
          </button>
        </div>
      </div>
    </div>
  );
}

function AttachmentPreview({ url, outbound, voiceColor }: { url: string; outbound: boolean; voiceColor?: string }) {
  const [imgError, setImgError] = useState(false);
  const type = getAttachmentType(url);
  const filename = decodeURIComponent(url.split("/").pop()?.split("?")[0] ?? "attachment");

  const linkClasses = cn(
    "inline-flex items-center gap-1.5 mt-1 text-xs underline underline-offset-2 opacity-90 hover:opacity-100 break-all text-green-800",
  );

  if (type === "image" && !imgError) {
    return (
      <div className="mt-2" data-testid="attachment-image">
        <img
          src={url}
          alt="Attachment"
          className="max-w-full max-h-60 rounded-lg object-cover border border-white/20 cursor-pointer"
          onError={() => setImgError(true)}
          onClick={() => window.open(url, "_blank", "noopener,noreferrer")}
          title="Click to open full size"
        />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <ExternalLink className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "video") {
    return (
      <div className="mt-2" data-testid="attachment-video">
        <video src={url} controls className="max-w-full max-h-48 rounded-lg border border-white/20" preload="metadata" />
        <a href={url} target="_blank" rel="noopener noreferrer" className={linkClasses} data-testid="attachment-link">
          <Video className="w-3 h-3 shrink-0" />
          <span className="truncate max-w-[200px]">{filename}</span>
        </a>
      </div>
    );
  }

  if (type === "audio") {
    return (
      <div className="mt-2" data-testid="attachment-audio">
        <VoiceMemoPlayer url={url} outbound={outbound} color={voiceColor} />
      </div>
    );
  }

  return (
    <div className="mt-2" data-testid="attachment-document">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-black/[0.15] text-xs font-medium text-foreground/70 bg-transparent hover:bg-black/[0.04]"
        data-testid="attachment-link"
        download
      >
        <FileText className="w-4 h-4 shrink-0" />
        <span className="truncate max-w-[200px]">{filename}</span>
        <Download className="w-3 h-3 shrink-0 opacity-70" />
      </a>
    </div>
  );
}

// ─── Chat Bubble ──────────────────────────────────────────────────────────────

function ChatBubble({
  item,
  onRetry,
  leadName,
  leadAvatarColors,
  meta,
  animateEntrance = false,
  entranceDelay = 0,
  currentUser = null,
  suppressAvatar = false,
}: {
  item: Interaction;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  leadName: string;
  leadAvatarColors: { bgColor: string; textColor: string };
  meta: MsgMeta;
  animateEntrance?: boolean;
  entranceDelay?: number;
  currentUser?: SessionUser | null;
  /** When true, skip rendering avatar/spacer (handled by parent AgentRunWrapper) */
  suppressAvatar?: boolean;
}) {
  const outbound = item.direction === "Outbound";
  const inbound = !outbound;
  const statusNorm = (item.status ?? "").toLowerCase();
  const isFailed = statusNorm === "failed";
  const isSending = statusNorm === "sending";
  const isSent = statusNorm === "sent";
  const isDelivered = statusNorm === "delivered";
  const isRead = statusNorm === "read";
  const aiMsg = outbound && isAiMessage(item);
  const humanAgentMsg = outbound && isHumanAgentMessage(item);
  const { isFirstInRun, isLastInRun } = meta;
  const rawTs = item.created_at ?? item.createdAt ?? (item as any).Created_At ?? (item as any).CreatedAt ?? null;
  const time = formatBubbleTime(rawTs);
  const who = (item.Who ?? item.who ?? "").trim();

  // Pointy corner at the BOTTOM, facing the avatar (rounded-sm = half of rounded-md)
  const bubbleRadius = inbound
    ? isLastInRun ? "rounded-sm rounded-bl-none" : "rounded-sm"
    : isLastInRun ? "rounded-sm rounded-br-none" : "rounded-sm";

  return (
    <div
      className={cn(
        "flex items-end gap-1.5 my-0.5",
        outbound ? "justify-end" : "justify-start",
        animateEntrance && (outbound ? "animate-bubble-right" : "animate-bubble-left"),
      )}
      style={animateEntrance ? { animationDelay: `${Math.min(entranceDelay, 20) * 25}ms` } : undefined}
    >
      {/* Lead avatar — left side, last in inbound run (omitted when wrapper handles sticky avatar) */}
      {inbound && !suppressAvatar && isLastInRun && (
        <EntityAvatar
          name={leadName || "?"}
          bgColor={leadAvatarColors.bgColor}
          textColor={leadAvatarColors.textColor}
          size={48}
        />
      )}
      {inbound && !suppressAvatar && !isLastInRun && <div className="w-12 shrink-0" />}

      {/* Bubble */}
      <div
        className={cn(
          "max-w-[46%] px-3 pt-2 pb-1.5 text-[15px]",
          bubbleRadius,
          // Inbound (lead): neutral gray glow
          inbound && "bg-white dark:bg-card text-gray-900 dark:text-foreground shadow-[0_0_1.5px_rgba(0,0,0,0.3)] dark:shadow-[0_0_1.5px_rgba(255,255,255,0.1)]",
          // AI outbound: blue
          aiMsg && "bg-[#f2f5ff] dark:bg-[#1e2340] text-gray-900 dark:text-foreground shadow-[0_0_1.5px_rgba(0,0,200,0.5)] dark:shadow-[0_0_1.5px_rgba(255,255,255,0.1)]",
          // Human agent outbound: green glow
          humanAgentMsg && "bg-[#f1fff5] dark:bg-[#1a2e1f] text-gray-900 dark:text-foreground shadow-[0_0_1.5px_rgba(0,122,0,0.4)] dark:shadow-[0_0_1.5px_rgba(255,255,255,0.1)]",
          isFailed && "opacity-80",
        )}
        data-message-type={inbound ? "lead" : aiMsg ? "ai" : "agent"}
      >
        {/* Content: voice memo data URL → render player inline; otherwise plain text */}
        {(() => {
          const content = item.content ?? item.Content ?? "";
          const attachment = item.attachment ?? item.Attachment;
          const isVoiceMemo = content.startsWith("data:audio/") || item.type === "audio";
          // Voice color: green for human agent, teal for lead (inbound), warm amber for AI
          const voiceColor = humanAgentMsg ? "#22C55E" : aiMsg ? "#f59e0b" : "#0ABFA3";
          if (isVoiceMemo) {
            return <VoiceMemoPlayer url={content} outbound={outbound} color={voiceColor} />;
          }
          return (
            <>
              <div className="whitespace-pre-wrap leading-relaxed break-words">{content}</div>
              {attachment && <AttachmentPreview url={attachment as string} outbound={outbound} voiceColor={voiceColor} />}
            </>
          );
        })()}
        {/* Time + status — right-aligned, 11px */}
        <div className="flex items-center justify-end gap-1 mt-1">
          <span className="text-[11px] leading-none select-none" style={{ color: "#888" }}>
            {time || (rawTs ? rawTs.toString().slice(11, 16) : "")}
          </span>
          {outbound && (
            <MessageStatusIcon
              status={statusNorm}
              isSending={isSending}
              isSent={isSent}
              isDelivered={isDelivered}
              isRead={isRead}
              isFailed={isFailed}
            />
          )}
        </div>
        {isFailed && onRetry && (
          <button
            type="button"
            onClick={() => onRetry(item)}
            className="inline-flex items-center gap-0.5 mt-0.5 text-[10px] font-semibold text-destructive hover:text-destructive/80 underline underline-offset-2"
            data-testid="button-retry-message"
          >
            <RotateCcw className="w-3 h-3" />
            Retry
          </button>
        )}
      </div>

      {/* AI bot avatar — right side, last in run only */}
      {aiMsg && !suppressAvatar && isLastInRun && <BotAvatar />}
      {aiMsg && !suppressAvatar && !isLastInRun && <div className="w-12 shrink-0" />}
      {/* Human agent avatar — right side, last in run only */}
      {humanAgentMsg && !suppressAvatar && isLastInRun && <AgentAvatar who={who} currentUser={currentUser} />}
      {humanAgentMsg && !suppressAvatar && !isLastInRun && <div className="w-12 shrink-0" />}
    </div>
  );
}

// Suppress unused-variable warnings for kept-but-not-rendered helpers
void getSenderLabel;
void formatRelativeTime;
void PIPELINE_HEX;
void Music;
