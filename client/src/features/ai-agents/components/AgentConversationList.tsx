import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { Plus, MessageSquare, Zap, Bot, Loader2, ChevronLeft } from "lucide-react";

interface AgentConversation {
  id: number;
  sessionId: string;
  agentId: number;
  title: string | null;
  model: string;
  status: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  lastMessage: { content: string; role: string; createdAt: string } | null;
}

interface AgentConversationListProps {
  agentId: number;
  agentName: string;
  agentType: string;
  agentPhotoUrl: string | null;
  currentSessionId: string | null;
  onSelectConversation: (sessionId: string) => void;
  onNewConversation: () => void;
  onBack?: () => void;
  className?: string;
}

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return new Date(dateStr).toLocaleDateString();
}

export function AgentConversationList({
  agentId,
  agentName,
  agentType,
  agentPhotoUrl,
  currentSessionId,
  onSelectConversation,
  onNewConversation,
  onBack,
  className,
}: AgentConversationListProps) {
  const [conversations, setConversations] = useState<AgentConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    apiFetch(`/api/agents/${agentId}/conversations`)
      .then(async (res) => {
        if (cancelled) return;
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [agentId]);

  // Refresh list when currentSessionId changes (e.g. after new session created)
  useEffect(() => {
    if (!currentSessionId) return;
    apiFetch(`/api/agents/${agentId}/conversations`)
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json();
          setConversations(data);
        }
      })
      .catch(() => {});
  }, [agentId, currentSessionId]);

  const AgentIcon = () => {
    if (agentPhotoUrl) {
      return <img src={agentPhotoUrl} alt={agentName} className="h-9 w-9 rounded-full object-cover" />;
    }
    if (agentType === "code_runner") {
      return (
        <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center">
          <Zap className="h-4 w-4 text-green-600" />
        </div>
      );
    }
    return (
      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
        <Bot className="h-4 w-4 text-muted-foreground" />
      </div>
    );
  };

  return (
    <div className={cn("flex flex-col", className)}>
      {/* Agent header */}
      <div className="flex items-center gap-2.5 px-3 py-3 border-b border-border/30">
        {onBack && (
          <button
            onClick={onBack}
            className="h-7 w-7 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 hover:bg-muted transition-colors"
            title="Back to inbox"
            data-testid="agent-conversations-back"
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </button>
        )}
        <AgentIcon />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold truncate">{agentName}</p>
          <p className="text-[11px] text-muted-foreground">
            {conversations.length} conversation{conversations.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={onNewConversation}
          className="h-8 px-3 rounded-full bg-brand-indigo text-white text-xs font-medium flex items-center gap-1.5 hover:bg-brand-indigo/90 transition-colors shrink-0"
          data-testid="agent-new-conversation-btn"
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-[3px]">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
            <MessageSquare className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">No conversations yet</p>
            <p className="text-xs text-muted-foreground/70 mt-1">Start a new conversation with {agentName}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-[3px]">
            {conversations.map((conv) => {
              const isActive = currentSessionId === conv.sessionId;
              return (
                <div
                  key={conv.sessionId}
                  role="button"
                  tabIndex={0}
                  onClick={() => onSelectConversation(conv.sessionId)}
                  onKeyDown={(e) => e.key === "Enter" && onSelectConversation(conv.sessionId)}
                  className={cn(
                    "rounded-xl cursor-pointer transition-colors px-2.5 py-2",
                    isActive ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
                  )}
                  data-testid={`agent-conversation-${conv.sessionId}`}
                >
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-[14px] font-semibold leading-tight truncate text-foreground">
                          {conv.title || "New Conversation"}
                        </p>
                        <span className="text-[10px] text-muted-foreground/70 shrink-0 tabular-nums">
                          {formatRelativeTime(conv.updatedAt || conv.createdAt)}
                        </span>
                      </div>
                      {conv.lastMessage && (
                        <p className="text-[12px] text-muted-foreground truncate leading-snug mt-0.5">
                          {conv.lastMessage.role === "user" ? "You: " : ""}
                          {conv.lastMessage.content}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-muted-foreground/60">
                          {conv.messageCount} message{conv.messageCount !== 1 ? "s" : ""}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40">
                          {conv.model?.includes("opus") ? "Opus" : conv.model?.includes("haiku") ? "Haiku" : "Sonnet"}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
