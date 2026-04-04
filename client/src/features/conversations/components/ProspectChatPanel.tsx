import { useProspectMessages, useMarkProspectRead } from "../hooks/useProspectConversations";
import { useEffect, useState, useRef } from "react";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { IconBtn } from "@/components/ui/icon-btn";
import { SearchPill } from "@/components/ui/search-pill";
import { getProspectAvatarColor } from "@/lib/avatarUtils";
import { Search, X, Mail, MessageCircle, ArrowUpDown, Layers, Check, Globe } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useLocation } from "wouter";

interface ProspectChatPanelProps {
  prospectId: number;
  prospectName: string;
  prospectCompany: string;
  contactEmail: string;
  outreachStatus?: string;
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
}: ProspectChatPanelProps) {
  const { data: messages = [], isLoading } = useProspectMessages(prospectId);
  const markRead = useMarkProspectRead();
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [filterChannel, setFilterChannel] = useState<ChannelFilter>("all");
  const [sortMode, setSortMode] = useState<SortMode>("newest");
  const [, navigate] = useLocation();

  // Mark as read when opening
  useEffect(() => {
    markRead.mutate(prospectId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prospectId]);

  // Reset filters on prospect change
  useEffect(() => {
    setSearch("");
    setSearchOpen(false);
    setFilterChannel("all");
  }, [prospectId]);

  const avatarColor = getProspectAvatarColor(outreachStatus);
  const displayName = prospectCompany || prospectName || "Unknown";

  // Cycle channel filter: all -> email -> whatsapp -> all
  const cycleChannel = () => {
    const idx = CHANNEL_CYCLE.indexOf(filterChannel);
    setFilterChannel(CHANNEL_CYCLE[(idx + 1) % CHANNEL_CYCLE.length]);
  };

  // Channel filter icon
  const ChannelIcon = filterChannel === "email" ? Mail
    : filterChannel === "whatsapp" ? MessageCircle
    : Globe;

  // Filter messages
  const filtered = messages.filter((msg: any) => {
    if (filterChannel !== "all" && msg.type !== filterChannel) return false;
    if (search) {
      const q = search.toLowerCase();
      const content = (msg.Content || msg.content || "").toLowerCase();
      const subject = (msg.metadata?.subject || msg.ai_prompt || "").toLowerCase();
      if (!content.includes(q) && !subject.includes(q)) return false;
    }
    return true;
  });

  // Sort
  const sorted = [...filtered].sort((a: any, b: any) => {
    const aTime = new Date(a.sent_at || a.created_at).getTime();
    const bTime = new Date(b.sent_at || b.created_at).getTime();
    return sortMode === "newest" ? bTime - aTime : aTime - bTime;
  });

  // Group by date
  const grouped = groupMessagesByDate(sorted);

  if (isLoading) {
    return (
      <div className="flex-1 flex flex-col min-h-0 bg-muted rounded-lg overflow-hidden">
        <div className="flex-1 flex items-center justify-center text-muted-foreground">
          Loading...
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-muted rounded-lg overflow-hidden">
      {/* Header */}
      <div className="shrink-0 bg-white dark:bg-card border-b border-black/[0.06] relative">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center gap-3">
            {/* Clickable avatar — navigates to prospects page */}
            <button
              type="button"
              onClick={() => navigate("/agency/prospects")}
              className="shrink-0 rounded-full focus:outline-none"
              aria-label="Open prospects page"
            >
              <EntityAvatar
                name={displayName}
                bgColor={avatarColor.bg}
                textColor={avatarColor.text}
                size={45}
              />
            </button>

            {/* Clickable name — navigates to prospects page */}
            <button
              type="button"
              onClick={() => navigate("/agency/prospects")}
              className="flex flex-col min-w-0 text-left focus:outline-none"
            >
              <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate min-w-0">
                {displayName}
              </h2>
              <span className="text-[11px] text-muted-foreground">
                {prospectName}{contactEmail ? ` · ${contactEmail}` : ""}
              </span>
            </button>

            {/* Toolbar buttons — right cluster, expandable pills like inbox */}
            <div className="ml-auto flex items-center gap-1.5 shrink-0">
              {/* Search */}
              <SearchPill
                value={search}
                onChange={setSearch}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder="Search messages..."
              />

              {/* Sort */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    className={cn(
                      "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0",
                      "transition-[max-width,color,border-color] duration-200 max-w-9 hover:max-w-[100px]",
                      sortMode !== "newest"
                        ? "border-brand-indigo text-brand-indigo"
                        : "border-black/[0.125] text-foreground/60 hover:text-foreground"
                    )}
                    title="Sort"
                  >
                    <ArrowUpDown className="h-4 w-4 shrink-0" />
                    <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">Sort</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {(["newest", "oldest"] as const).map((opt) => (
                    <DropdownMenuItem
                      key={opt}
                      onClick={() => setSortMode(opt)}
                      className={cn("text-[12px]", sortMode === opt && "font-semibold text-brand-indigo")}
                    >
                      {opt === "newest" ? "Newest first" : "Oldest first"}
                      {sortMode === opt && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Channel filter — 3-state cycle: All (globe) -> Email (mail) -> WhatsApp (message) */}
              <IconBtn
                onClick={cycleChannel}
                active={filterChannel !== "all"}
                title={filterChannel === "all" ? "All channels" : filterChannel === "email" ? "Email only" : "WhatsApp only"}
              >
                <ChannelIcon className="h-4 w-4" />
              </IconBtn>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        {sorted.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {search || filterChannel !== "all" ? "No matching messages" : "No messages yet"}
          </div>
        ) : (
          <div className="p-4 space-y-1">
            {grouped.map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <div className="py-3">
                  <div className="flex items-center gap-[10px]">
                    <div className="flex-1 h-px bg-foreground/15" />
                    <span className="text-[11px] font-bold text-muted-foreground tracking-wide">
                      {group.label}
                    </span>
                    <div className="flex-1 h-px bg-foreground/15" />
                  </div>
                </div>

                {/* Messages in group */}
                <div className="space-y-2">
                  {group.messages.map((msg: any) => {
                    const isOutbound = msg.direction?.toLowerCase() === "outbound";
                    const subject = msg.metadata?.subject || tryParseSubject(msg.ai_prompt);

                    return (
                      <div
                        key={msg.id}
                        className={cn(
                          "max-w-[80%] rounded-xl px-3.5 py-2.5 text-sm",
                          isOutbound
                            ? "ml-auto bg-indigo-50 dark:bg-indigo-950/30 text-foreground"
                            : "mr-auto bg-card text-foreground"
                        )}
                      >
                        {/* Subject header for emails */}
                        {msg.type === "email" && subject && (
                          <div className="text-[11px] font-medium text-muted-foreground mb-1.5 pb-1 border-b border-border/30 flex items-center gap-1.5">
                            <Mail className="h-3 w-3 shrink-0" />
                            {subject}
                          </div>
                        )}
                        {/* Body */}
                        <div
                          className="whitespace-pre-wrap break-words text-[13px] leading-relaxed"
                          dangerouslySetInnerHTML={{
                            __html: msg.Content || msg.content || "",
                          }}
                        />
                        {/* Timestamp + channel */}
                        <div className="flex items-center gap-1.5 mt-2 text-[10px] text-muted-foreground/60">
                          <span>
                            {new Date(msg.sent_at || msg.created_at).toLocaleTimeString([], {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          <span className="opacity-50">·</span>
                          {msg.type === "email" ? (
                            <Mail className="h-2.5 w-2.5" />
                          ) : msg.type === "whatsapp" ? (
                            <MessageCircle className="h-2.5 w-2.5" />
                          ) : (
                            <span>{msg.type}</span>
                          )}
                          {isOutbound && (
                            <>
                              <span className="opacity-50">·</span>
                              <span className="text-muted-foreground/40">
                                {msg.status === "Sent" || msg.status === "delivered" ? "Sent" : msg.status}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reply hint */}
      <div className="bg-card border-t px-4 py-2.5 shrink-0">
        <p className="text-[11px] text-muted-foreground text-center">
          Use <span className="font-mono text-[10px] bg-muted px-1.5 py-0.5 rounded">/outreach-email</span> to reply
        </p>
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function tryParseSubject(aiPrompt: string | null | undefined): string {
  if (!aiPrompt) return "";
  try {
    const parsed = JSON.parse(aiPrompt);
    return parsed.subject || "";
  } catch {
    return "";
  }
}

function groupMessagesByDate(messages: any[]): { label: string; messages: any[] }[] {
  const groups: Map<string, any[]> = new Map();

  for (const msg of messages) {
    const date = new Date(msg.sent_at || msg.created_at);
    const label = getDateLabel(date);
    if (!groups.has(label)) groups.set(label, []);
    groups.get(label)!.push(msg);
  }

  return Array.from(groups.entries()).map(([label, msgs]) => ({ label, messages: msgs }));
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
