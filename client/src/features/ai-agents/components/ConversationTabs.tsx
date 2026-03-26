import { X, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";

// ─── Conversation Tabs (shown when 2+ conversations are open) ────────────────

export interface ConversationMeta {
  agent: AiAgent;
  session: AiSession | null;
  streaming: boolean;
  /** Number of messages when user last viewed this conversation */
  lastSeenMessageCount: number;
  /** Total message count (user + assistant) */
  totalMessageCount: number;
  /** Whether page context is sent with messages (per-session override) */
  pageAwarenessEnabled: boolean;
}

/** Per-agent color palette (cycles by agent ID) */
export const AGENT_COLORS = [
  { bg: "bg-blue-500/10", text: "text-blue-500", dot: "bg-blue-500" },
  { bg: "bg-purple-500/10", text: "text-purple-500", dot: "bg-purple-500" },
  { bg: "bg-amber-500/10", text: "text-amber-500", dot: "bg-amber-500" },
  { bg: "bg-emerald-500/10", text: "text-emerald-500", dot: "bg-emerald-500" },
  { bg: "bg-rose-500/10", text: "text-rose-500", dot: "bg-rose-500" },
];

export function getAgentColor(agentId: number) {
  return AGENT_COLORS[agentId % AGENT_COLORS.length];
}

/** Get icon for agent type — always Bot (robot head) with per-agent color */
export function AgentIcon({ agent, className }: { agent: AiAgent; className?: string }) {
  return <Bot className={cn(className, getAgentColor(agent.id).text)} />;
}

export function ConversationTabs({
  conversations,
  activeAgentId,
  onSelect,
  onClose,
}: {
  conversations: Map<number, ConversationMeta>;
  activeAgentId: number;
  onSelect: (agentId: number) => void;
  onClose: (agentId: number) => void;
}) {
  if (conversations.size < 2) return null;

  return (
    <div
      className="flex items-center gap-1 px-2 py-1.5 border-b border-border/30 bg-muted/20 overflow-x-auto shrink-0"
      data-testid="conversation-tabs"
    >
      {Array.from(conversations.entries()).map(([agentId, meta]) => {
        const isActive = agentId === activeAgentId;
        const isStreaming = meta.streaming;
        const unreadCount = Math.max(0, meta.totalMessageCount - meta.lastSeenMessageCount);
        const hasUnread = !isActive && unreadCount > 0;

        return (
          <button
            key={agentId}
            onClick={() => onSelect(agentId)}
            className={cn(
              "group relative flex items-center gap-1.5 px-2 py-1.5 max-md:px-3 max-md:py-2.5 max-md:min-h-[44px] rounded-lg transition-all shrink-0",
              isActive
                ? "bg-brand-indigo/10 text-brand-indigo ring-1 ring-brand-indigo/20"
                : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
            data-testid={`conversation-tab-${agentId}`}
            title={meta.agent.name}
          >
            {/* Agent icon */}
            <div className="relative">
              {meta.agent.photoUrl ? (
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarImage src={meta.agent.photoUrl} alt={meta.agent.name} />
                  <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo text-[9px] font-bold">
                    <AgentIcon agent={meta.agent} className="h-3 w-3" />
                  </AvatarFallback>
                </Avatar>
              ) : (
                <div
                  className={cn(
                    "h-6 w-6 rounded-full flex items-center justify-center shrink-0",
                    isActive
                      ? "bg-brand-indigo/20 text-brand-indigo"
                      : "bg-muted text-muted-foreground",
                  )}
                >
                  <AgentIcon agent={meta.agent} className="h-3 w-3" />
                </div>
              )}

              {/* Streaming indicator dot */}
              {isStreaming && !isActive && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-green-500 animate-pulse ring-1 ring-background" />
              )}

              {/* Unread notification badge */}
              {hasUnread && (
                <span
                  className="absolute -top-1 -right-1 min-w-[14px] h-[14px] rounded-full bg-red-500 text-white text-[8px] font-bold flex items-center justify-center px-0.5 ring-1 ring-background"
                  data-testid={`tab-unread-${agentId}`}
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </div>

            {/* Agent name (compact) */}
            <span className="text-[11px] font-medium truncate max-w-[70px]">
              {meta.agent.name}
            </span>

            {/* Close tab button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                onClose(agentId);
              }}
              className="h-4 w-4 max-md:h-7 max-md:w-7 rounded-full flex items-center justify-center text-muted-foreground/60 hover:text-foreground hover:bg-muted transition-colors shrink-0 opacity-0 group-hover:opacity-100 max-md:opacity-100"
              title="Close conversation"
              data-testid={`close-tab-${agentId}`}
            >
              <X className="h-2.5 w-2.5 max-md:h-3.5 max-md:w-3.5" />
            </button>
          </button>
        );
      })}
    </div>
  );
}
