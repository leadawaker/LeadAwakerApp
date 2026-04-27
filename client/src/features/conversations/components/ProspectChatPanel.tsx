import { useProspectMessages, useMarkProspectRead } from "../hooks/useProspectConversations";
import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { SearchPill } from "@/components/ui/search-pill";
import { getProspectAvatarColor } from "@/lib/avatarUtils";
import {
  Search, X, Mail, MessageCircle, ArrowUpDown, Layers, Check, Globe,
  Wallpaper, Send, Mic, Paperclip, AlertCircle, Smile, FileText, Phone, ChevronLeft,
} from "lucide-react";
import { PhoneDialer } from "@/features/prospects/components/PhoneDialer";
import type { ProspectRow } from "@/features/prospects/components/ProspectListView";
import { ListPanelToggleButton } from "@/components/crm/ListPanelToggleButton";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { useChatDoodle, type ChatBgStyle } from "@/hooks/useChatDoodle";
import { getDoodleStyle } from "@/components/ui/doodle-patterns";
import { useBgSlotLayers } from "@/hooks/useBgSlots";
import { useTheme } from "@/hooks/useTheme";
import { layerToStyle } from "@/components/ui/gradient-tester";
import { BubbleWidthContext, HideAvatarsContext } from "./chatView/types";
import { BUBBLE_WIDTH_KEY, DEFAULT_BUBBLE_WIDTH } from "./chatView/constants";
import { ChatBubble } from "./chatView/ChatBubble";
import { sendWhatsAppMessage, sendWhatsAppImage, sendTypingIndicator, WhatsAppWindowExpiredError } from "@/features/prospects/api/prospectsApi";
import { TemplatePicker } from "./TemplatePicker";
import type { MsgMeta } from "./chatView/types";

interface ProspectChatPanelProps {
  prospectId: number;
  prospectName: string;
  prospectCompany: string;
  contactEmail: string;
  outreachStatus?: string;
  contactPhone?: string | null;
  dialerOpen?: boolean;
  onDialerClose?: () => void;
  onToggleRightPanel?: () => void;
  rightPanelVisible?: boolean;
}

type ChannelFilter = "all" | "email" | "whatsapp";
type SortMode = "newest" | "oldest";

const CHANNEL_CYCLE: ChannelFilter[] = ["all", "email", "whatsapp"];

export function ProspectChatPanel({
  prospectId,
  prospectName,
  prospectCompany,
  contactEmail,
  outreachStatus = "new",
  contactPhone,
  dialerOpen: dialerOpenProp = false,
  onDialerClose,
  onToggleRightPanel,
  rightPanelVisible = false,
}: ProspectChatPanelProps) {
  const { t } = useTranslation("conversations");
  const { toast } = useToast();
  const { data: messages = [], isLoading } = useProspectMessages(prospectId);
  const markRead = useMarkProspectRead();
  const queryClient = useQueryClient();
  const [, navigate] = useLocation();

  // Chat customization
  const { config: doodleConfig, setConfig: setDoodleConfig } = useChatDoodle();
  const { isDark } = useTheme();
  const activeSlotLayers = useBgSlotLayers(
    doodleConfig.bgStyle !== "crm" ? doodleConfig.bgStyle : "social1",
    isDark,
  );
  const [bubbleWidth, setBubbleWidth] = useState(() => {
    const s = localStorage.getItem(BUBBLE_WIDTH_KEY);
    return s ? Number(s) : DEFAULT_BUBBLE_WIDTH;
  });
  useEffect(() => { localStorage.setItem(BUBBLE_WIDTH_KEY, String(bubbleWidth)); }, [bubbleWidth]);

  // Dialer
  const [dialerOpen, setDialerOpen] = useState(dialerOpenProp);
  useEffect(() => { if (dialerOpenProp) setDialerOpen(true); }, [dialerOpenProp]);

  // Inbox filters
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterChannel, setFilterChannel] = useState<ChannelFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("oldest");

  // Composer
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [windowExpired, setWindowExpired] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Mark as read + reset filters on prospect change
  useEffect(() => {
    markRead.mutate(prospectId);
    setSearch("");
    setSearchOpen(false);
    setFilterChannel("all");
    setDraft("");
    setWindowExpired(false);
    setShowTemplates(false);
    if (typingTimerRef.current) { clearTimeout(typingTimerRef.current); typingTimerRef.current = null; }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  // Phone validation — must have 7–15 digits after stripping non-digits
  const phoneDigits = contactPhone ? String(contactPhone).replace(/\D/g, "") : "";
  const phoneValid = phoneDigits.length >= 7 && phoneDigits.length <= 15;
  const canSend = !!contactPhone && phoneValid;

  // Scroll to bottom when messages load or new message arrives
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages.length]);

  // Close emoji picker on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const close = (e: MouseEvent) => {
      const target = e.target as Node;
      // em-emoji-picker is the custom element rendered by emoji-mart
      if (!(target as Element).closest?.("em-emoji-picker, [data-emoji-button]")) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [emojiOpen]);

  const avatarColor = getProspectAvatarColor(outreachStatus);
  const displayName = prospectCompany || prospectName || "Unknown";

  // Channel filter cycle
  const cycleChannel = () => {
    const idx = CHANNEL_CYCLE.indexOf(filterChannel);
    setFilterChannel(CHANNEL_CYCLE[(idx + 1) % CHANNEL_CYCLE.length]);
  };
  const ChannelIcon = filterChannel === "email" ? Mail : filterChannel === "whatsapp" ? MessageCircle : Globe;

  // Filter + sort messages
  const filtered = useMemo(() => {
    return messages.filter((msg: any) => {
      if (filterChannel !== "all") {
        const t = (msg.type || "").toLowerCase();
        if (filterChannel === "email" && t !== "email") return false;
        if (filterChannel === "whatsapp" && t !== "whatsapp") return false;
      }
      if (search) {
        const q = search.toLowerCase();
        const body = (msg.Content || msg.content || "").toLowerCase();
        const subj = (msg.metadata?.subject || msg.ai_prompt || "").toLowerCase();
        if (!body.includes(q) && !subj.includes(q)) return false;
      }
      return true;
    });
  }, [messages, filterChannel, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a: any, b: any) => {
      const aT = new Date(a.sent_at || a.created_at).getTime();
      const bT = new Date(b.sent_at || b.created_at).getTime();
      return sortMode === "newest" ? bT - aT : aT - bT;
    });
  }, [filtered, sortMode]);

  // Compute ChatBubble meta for each message
  const bubbleItems = useMemo(() => {
    return sorted.map((msg: any, i: number) => {
      const prev = sorted[i - 1] as any;
      const next = sorted[i + 1] as any;
      const senderKey: MsgMeta["senderKey"] =
        (msg.direction || "").toLowerCase() !== "outbound" ? "inbound" : "human";
      const prevKey = prev
        ? (prev.direction || "").toLowerCase() !== "outbound" ? "inbound" : "human"
        : null;
      const nextKey = next
        ? (next.direction || "").toLowerCase() !== "outbound" ? "inbound" : "human"
        : null;
      return {
        msg,
        meta: {
          senderKey,
          isFirstInRun: senderKey !== prevKey,
          isLastInRun: senderKey !== nextKey,
        } satisfies MsgMeta,
      };
    });
  }, [sorted]);

  // Group by date
  const grouped = useMemo(() => groupMessagesByDate(bubbleItems), [bubbleItems]);

  // Send handler
  const handleSend = useCallback(async () => {
    if (!draft.trim() || !canSend || sending) return;
    const text = draft.trim();
    setDraft("");
    if (textareaRef.current) { textareaRef.current.style.height = "auto"; }
    setSending(true);
    setWindowExpired(false);
    try {
      const result = await sendWhatsAppMessage(prospectId, text);
      // Optimistic: insert the sent message into the cache immediately
      const sent = result?.interaction;
      if (sent) {
        queryClient.setQueryData(
          ["/api/prospects", prospectId, "messages"],
          (old: any[] | undefined) => old ? [...old, sent] : [sent],
        );
      }
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/conversations"] });
      toast({ title: "Message sent" });
    } catch (err: any) {
      if (err instanceof WhatsAppWindowExpiredError) {
        setWindowExpired(true); setShowTemplates(true);
        setDraft(text); // restore draft so they can copy it for a template
      } else {
        console.error("[WA-Send] error:", err);
        toast({ title: "Failed to send", description: `${err.name}: ${err.message}`, variant: "destructive" });
        setDraft(text);
      }
    } finally {
      setSending(false);
    }
  }, [draft, canSend, sending, prospectId, queryClient, toast]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  // Debounced typing indicator — fires once per 20s while user is typing
  const handleDraftChange = useCallback((value: string) => {
    setDraft(value);
    if (!canSend) return;
    if (typingTimerRef.current) return; // already pending, don't spam
    sendTypingIndicator(prospectId);
    // Block further sends for 20s (WhatsApp shows typing for ~25s per call)
    typingTimerRef.current = setTimeout(() => {
      typingTimerRef.current = null;
    }, 20_000);
  }, [canSend, prospectId]);

  // Retry a failed message
  const handleRetry = useCallback(async (failedMsg: any) => {
    const content = failedMsg.content ?? failedMsg.Content ?? "";
    if (!content || !contactPhone) return;
    try {
      await sendWhatsAppMessage(prospectId, content);
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/conversations"] });
    } catch (err: any) {
      if (err instanceof WhatsAppWindowExpiredError) {
        setWindowExpired(true); setShowTemplates(true);
      } else {
        toast({ title: "Retry failed", description: err.message, variant: "destructive" });
      }
    }
  }, [canSend, prospectId, queryClient, toast]);

  const handleImageFile = useCallback(async (file: File) => {
    if (!canSend) return;
    setSending(true);
    setWindowExpired(false);
    try {
      const imageData = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target?.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      await sendWhatsAppImage(prospectId, imageData, file.type, draft.trim() || undefined);
      setDraft("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
      queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
      queryClient.invalidateQueries({ queryKey: ["/api/prospects/conversations"] });
    } catch (err: any) {
      if (err instanceof WhatsAppWindowExpiredError) {
        setWindowExpired(true); setShowTemplates(true);
      } else {
        toast({ title: "Failed to send image", description: err.message, variant: "destructive" });
      }
    } finally {
      setSending(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [canSend, draft, prospectId, queryClient, toast]);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-muted rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">Loading…</div>
      </div>
    );
  }

  return (
    <BubbleWidthContext.Provider value={bubbleWidth}>
    <HideAvatarsContext.Provider value={doodleConfig.hideAvatars}>
      <section className="flex flex-col rounded-lg overflow-hidden h-full relative flex-1 min-h-0">
        {/* ── Background ── */}
        {doodleConfig.bgStyle === "crm" && <div className="absolute inset-0 bg-card" />}
        {doodleConfig.bgStyle !== "crm" && activeSlotLayers.map((layer: any) => {
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

        {/* ── Content above background ── */}
        <div className="relative flex flex-col h-full overflow-hidden">

          {/* Header */}
          <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06]">
            <div className="px-4 pt-4 pb-3">
              <div className="flex items-center gap-3">
                {/* Avatar */}
                <button type="button" onClick={() => navigate("/agency/prospects")} className="shrink-0 rounded-full focus:outline-none">
                  <EntityAvatar name={displayName} bgColor={avatarColor.bg} textColor={avatarColor.text} size={45} />
                </button>
                {/* Name */}
                <button type="button" onClick={() => navigate("/agency/prospects")} className="flex flex-col min-w-0 text-left focus:outline-none">
                  <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate min-w-0">
                    {displayName}
                  </h2>
                  <span className="text-[11px] text-muted-foreground">
                    {prospectName}{contactEmail ? ` · ${contactEmail}` : ""}
                  </span>
                </button>

                {/* Toolbar */}
                <div className="ml-auto flex items-center gap-1.5 shrink-0">
                  <SearchPill value={search} onChange={setSearch} open={searchOpen} onOpenChange={setSearchOpen} placeholder="Search messages…" />

                  {/* Sort */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        className={cn(
                          "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                          "transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[80px]",
                          sortMode !== "newest" ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground",
                        )}
                      >
                        <ArrowUpDown className="h-4 w-4 shrink-0" />
                        <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Sort</span>
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-44">
                      {(["newest", "oldest"] as const).map((opt) => (
                        <DropdownMenuItem key={opt} onClick={() => setSortMode(opt)} className={cn("text-[12px]", sortMode === opt && "font-semibold text-brand-indigo")}>
                          {opt === "newest" ? "Newest first" : "Oldest first"}
                          {sortMode === opt && <Check className="h-3 w-3 ml-auto" />}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  {/* Phone dialer toggle */}
                  {contactPhone && (
                    <button
                      onClick={() => setDialerOpen((v) => !v)}
                      className={cn(
                        "h-9 w-9 rounded-full border flex items-center justify-center transition-colors",
                        dialerOpen ? "border-emerald-500 text-emerald-600 bg-emerald-50 dark:bg-emerald-950/30" : "border-black/[0.125] text-foreground/60 hover:text-emerald-600",
                      )}
                      title="Call"
                    >
                      <Phone className="h-4 w-4" />
                    </button>
                  )}

                  {/* Channel filter */}
                  <button
                    onClick={cycleChannel}
                    className={cn(
                      "h-9 w-9 rounded-full border flex items-center justify-center transition-colors",
                      filterChannel !== "all" ? "border-brand-indigo text-brand-indigo" : "border-black/[0.125] text-foreground/60 hover:text-foreground",
                    )}
                    title={filterChannel === "all" ? "All channels" : filterChannel === "email" ? "Email only" : "WhatsApp only"}
                  >
                    <ChannelIcon className="h-4 w-4" />
                  </button>

                  {/* Customize */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                        title={t("chat.background.chatBackgroundDoodle")}
                      >
                        <Wallpaper className="h-4 w-4" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent align="end" className="w-64 p-3 space-y-3">
                      <span className="text-[13px] font-semibold">{t("chat.customization.title")}</span>

                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] text-muted-foreground">{t("chat.customization.bubbleWidth")}</span>
                          <span className="text-[11px] font-semibold tabular-nums text-foreground/70">{bubbleWidth}%</span>
                        </div>
                        <Slider value={[bubbleWidth]} onValueChange={([v]) => setBubbleWidth(v)} min={40} max={90} step={1} />
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold">{t("chat.customization.hideAvatars")}</span>
                        <Switch checked={doodleConfig.hideAvatars} onCheckedChange={(hideAvatars) => setDoodleConfig({ hideAvatars })} />
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[12px] font-semibold">{t("chat.background.title")}</span>
                        <div className="grid grid-cols-5 gap-1">
                          {(["crm", "social1", "social2", "social3", "social4"] as ChatBgStyle[]).map((style) => (
                            <button
                              key={style}
                              type="button"
                              onClick={() => setDoodleConfig({ bgStyle: style })}
                              className={cn(
                                "h-8 rounded-md border text-[10px] font-medium transition-colors",
                                doodleConfig.bgStyle === style
                                  ? "border-brand-indigo text-brand-indigo bg-brand-indigo/5"
                                  : "border-black/[0.125] text-foreground/60 hover:text-foreground",
                              )}
                            >
                              {style === "crm" ? "CRM" : `#${style.replace("social", "")}`}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-semibold">{t("chat.background.doodleOverlay")}</span>
                        <Switch checked={doodleConfig.enabled} onCheckedChange={(enabled) => setDoodleConfig({ enabled })} />
                      </div>
                    </PopoverContent>
                  </Popover>

                  {onToggleRightPanel && !rightPanelVisible && (
                    <button
                      onClick={onToggleRightPanel}
                      className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors"
                      title="Show prospect panel"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                  )}
                  <ListPanelToggleButton />
                </div>
              </div>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 pt-4 pb-2" ref={scrollRef}>
            {bubbleItems.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                {search || filterChannel !== "all" ? "No matching messages" : "No messages yet"}
              </div>
            ) : (
              <div className="space-y-1">
                {grouped.map((group) => (
                  <div key={group.label}>
                    {/* Date separator */}
                    <div className="py-3 flex items-center gap-[10px]">
                      <div className="flex-1 h-px bg-foreground/15" />
                      <span className="text-[11px] font-bold text-muted-foreground tracking-wide">{group.label}</span>
                      <div className="flex-1 h-px bg-foreground/15" />
                    </div>
                    {/* Bubbles */}
                    {group.items.map(({ msg, meta }) => (
                      <ChatBubble
                        key={msg.id}
                        item={msg as any}
                        onRetry={handleRetry}
                        leadName={prospectName || displayName}
                        leadAvatarColors={{ bgColor: avatarColor.bg, textColor: avatarColor.text, statusColor: avatarColor.bg }}
                        meta={meta}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Invalid phone banner */}
          {contactPhone && !phoneValid && (
            <div className="mx-3 mb-2 shrink-0 flex items-start gap-2 rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/30 dark:border-red-700 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-red-700 dark:text-red-300">Invalid phone number</p>
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-0.5">
                  "{contactPhone}" doesn't look like a valid number. Update it in Prospects (needs 7–15 digits, no spaces).
                </p>
              </div>
            </div>
          )}

          {/* 24h window expired banner */}
          {windowExpired && (
            <div className="mx-3 mb-2 shrink-0 flex items-start gap-2 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700 px-3 py-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-amber-800 dark:text-amber-300">24-hour window expired</p>
                <p className="text-[11px] text-amber-700 dark:text-amber-400 mt-0.5">
                  This contact hasn't messaged you in over 24 hours. WhatsApp only allows free-form replies within 24h of the last inbound message. Use a pre-approved template to re-engage.
                </p>
              </div>
              <button type="button" onClick={() => setWindowExpired(false)} className="text-amber-500 hover:text-amber-700 shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Phone dialer panel (above composer) */}
          {dialerOpen && contactPhone && (
            <div className="border-t border-border/40 px-4 py-3 bg-card/50">
              <PhoneDialer
                prospectId={prospectId}
                prospect={{ contact_name: prospectName || prospectCompany, contact_phone: contactPhone, phone: contactPhone } as unknown as ProspectRow}
                onCallEnded={() => { onDialerClose?.(); }}
              />
            </div>
          )}

          {/* Template picker panel (above composer) */}
          {showTemplates && (
            <TemplatePicker
              prospectId={prospectId}
              prospectName={prospectName}
              prospectCompany={prospectCompany}
              onSent={() => {
                setWindowExpired(false);
                setShowTemplates(false);
                queryClient.invalidateQueries({ queryKey: ["/api/prospects", prospectId, "messages"] });
              }}
              onClose={windowExpired && canSend ? undefined : () => setShowTemplates(false)}
            />
          )}

          {/* Composer */}
          <div className="px-3 pb-3 shrink-0">
            <div className="relative flex items-center gap-1.5 bg-white dark:bg-card rounded-lg border border-black/[0.1] shadow-sm pl-3 pr-4 py-[3px] min-h-[62px]">
              {/* Emoji picker */}
              {emojiOpen && (
                <EmojiPickerPopup
                  isDark={isDark}
                  onSelect={(native) => {
                    const ta = textareaRef.current;
                    if (ta) {
                      const start = ta.selectionStart ?? draft.length;
                      const end = ta.selectionEnd ?? draft.length;
                      setDraft(draft.slice(0, start) + native + draft.slice(end));
                      setTimeout(() => {
                        ta.selectionStart = start + native.length;
                        ta.selectionEnd = start + native.length;
                        ta.focus();
                      }, 0);
                    } else {
                      setDraft((d) => d + native);
                    }
                    setEmojiOpen(false);
                  }}
                />
              )}

              {/* Emoji button */}
              <button
                type="button"
                data-emoji-button
                onClick={() => setEmojiOpen((o) => !o)}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground shrink-0 transition-colors"
                title="Emoji"
              >
                <Smile className="h-6 w-6" />
              </button>

              {/* Textarea */}
              <textarea
                ref={textareaRef}
                className="flex-1 text-[17px] bg-transparent resize-none focus:outline-none placeholder:text-muted-foreground/50 leading-5 pl-1 pr-2"
                style={{ maxHeight: "120px" }}
                placeholder={windowExpired && canSend ? t("templatePicker.windowExpiredPlaceholder") : !contactPhone ? "No phone number — add one in Prospects" : !phoneValid ? "Invalid phone number — fix it in Prospects" : "Type a WhatsApp message…"}
                disabled={!canSend || sending || (windowExpired && canSend)}
                value={draft}
                rows={1}
                onChange={(e) => {
                  handleDraftChange(e.target.value);
                  const el = e.target;
                  el.style.height = "auto";
                  el.style.height = Math.min(el.scrollHeight, 120) + "px";
                }}
                onKeyDown={handleKeyDown}
              />

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageFile(f); }}
              />

              {/* Templates button */}
              <button
                type="button"
                onClick={() => setShowTemplates((o) => !o)}
                className={cn(
                  "h-9 w-9 rounded-full flex items-center justify-center shrink-0 transition-colors",
                  showTemplates
                    ? "text-brand-indigo bg-brand-indigo/10"
                    : "text-muted-foreground/50 hover:text-muted-foreground"
                )}
                title={t("templatePicker.buttonTitle")}
              >
                <FileText className="h-5 w-5" />
              </button>

              {/* Attach button */}
              <button
                type="button"
                disabled={!canSend || sending}
                onClick={() => fileInputRef.current?.click()}
                className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-muted-foreground disabled:opacity-30 shrink-0 transition-colors"
                title="Send image"
              >
                <Paperclip className="h-6 w-6" />
              </button>

              {/* Send / Mic toggle */}
              {draft.trim() ? (
                <button
                  type="button"
                  className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors shrink-0"
                  disabled={!canSend || sending}
                  onClick={handleSend}
                  title={t("chat.compose.sendMessage")}
                >
                  {sending ? (
                    <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 text-white" />
                  )}
                </button>
              ) : (
                <button
                  type="button"
                  className="h-9 w-9 rounded-full bg-brand-indigo text-white flex items-center justify-center hover:bg-brand-indigo/90 disabled:opacity-40 transition-colors shrink-0"
                  disabled={!canSend || sending}
                  onClick={() => toast({ title: "Coming soon", description: "Voice memos for WhatsApp will be available soon." })}
                  title={t("chat.compose.recordVoice")}
                >
                  <Mic className="h-5 w-5 text-white" />
                </button>
              )}
            </div>
          </div>

        </div>
      </section>
    </HideAvatarsContext.Provider>
    </BubbleWidthContext.Provider>
  );
}

// ── EmojiPickerPopup ─────────────────────────────────────────────────────────
// Loads emoji-mart lazily via dynamic import to avoid Vite pre-bundling issues.

function EmojiPickerPopup({ isDark, onSelect }: { isDark: boolean; onSelect: (native: string) => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let picker: any;
    Promise.all([
      import("emoji-mart").then((m) => m.Picker),
      import("@emoji-mart/data"),
    ]).then(([PickerClass, dataModule]) => {
      if (!containerRef.current) return;
      picker = new PickerClass({
        data: dataModule.default,
        theme: isDark ? "dark" : "light",
        previewPosition: "none",
        skinTonePosition: "none",
        onEmojiSelect: (emoji: any) => {
          onSelect(emoji.native ?? "");
        },
      });
      containerRef.current.appendChild(picker);
    });
    return () => {
      if (containerRef.current) containerRef.current.innerHTML = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={containerRef}
      className="absolute bottom-full left-0 mb-2 z-50 shadow-xl rounded-xl overflow-hidden"
    />
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function groupMessagesByDate(items: { msg: any; meta: MsgMeta }[]) {
  const groups: Map<string, { msg: any; meta: MsgMeta }[]> = new Map();
  for (const item of items) {
    const date = new Date(item.msg.sent_at || item.msg.created_at);
    const label = getDateLabel(date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(item);
  }
  return Array.from(groups.entries()).map(([label, items]) => ({ label, items }));
}

function getDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const target = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  if (target.getTime() === today.getTime()) return "Today";
  if (target.getTime() === yesterday.getTime()) return "Yesterday";
  const diffDays = Math.floor((today.getTime() - target.getTime()) / 86400000);
  if (diffDays < 7) return "This Week";
  if (diffDays < 30) return "This Month";
  return date.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
