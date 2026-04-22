import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Bot, ChevronDown, Loader2, Plus, Settings, Zap } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import type { AgentRecentChat, AgentRowProps } from "./types";

export function AgentInboxRow({
  agent,
  isSelected,
  isExpanded,
  onToggleExpand,
  onSelectChat,
  activeSessionId,
  onSettingsClick,
}: AgentRowProps) {
  const typeChip: Record<string, string> = {
    code_runner: "Code Runner",
    custom: "Custom",
  };
  const chipLabel = typeChip[agent.type] ?? agent.type;
  const isEnabled = agent.enabled !== false;

  const [recentChats, setRecentChats] = useState<AgentRecentChat[]>([]);
  const [loadingChats, setLoadingChats] = useState(false);
  const fetchedRef = useRef(false);

  // Fetch recent chats when expanded
  useEffect(() => {
    if (!isExpanded) return;
    // Re-fetch each time expanded (in case new chats were created)
    setLoadingChats(true);
    let cancelled = false;
    apiFetch(`/api/agents/${agent.id}/conversations`)
      .then(async (res) => {
        if (cancelled || !res.ok) return;
        const data = await res.json();
        // Take only the 5 most recent
        setRecentChats(data.slice(0, 5));
        fetchedRef.current = true;
      })
      .catch((err) => console.error("[InboxPanel] Failed to fetch agent conversations:", err))
      .finally(() => { if (!cancelled) setLoadingChats(false); });
    return () => { cancelled = true; };
  }, [isExpanded, agent.id, activeSessionId]);

  const AgentIcon = () => {
    if (agent.photoUrl) {
      return (
        <div className="relative">
          <img
            src={agent.photoUrl}
            alt={agent.name}
            className="h-9 w-9 rounded-full object-cover"
          />
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
              isSelected ? "border-highlight-selected" : "border-card",
              isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        </div>
      );
    }
    if (agent.type === "code_runner") {
      return (
        <div className="relative">
          <div className="h-9 w-9 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
            <Zap className="h-4 w-4 text-green-600" />
          </div>
          <span
            className={cn(
              "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
              isSelected ? "border-highlight-selected" : "border-card",
              isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
            )}
          />
        </div>
      );
    }
    return (
      <div className="relative">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center shrink-0">
          <Bot className="h-4 w-4 text-muted-foreground" />
        </div>
        <span
          className={cn(
            "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2",
            isSelected ? "border-highlight-selected" : "border-card",
            isEnabled ? "bg-green-500" : "bg-muted-foreground/40"
          )}
        />
      </div>
    );
  };

  const formatTime = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "now";
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d`;
    return new Date(dateStr).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  };

  return (
    <div data-testid={`agent-expandable-${agent.id}`}>
      {/* Agent header row */}
      <div
        role="button"
        tabIndex={0}
        onClick={onToggleExpand}
        onKeyDown={(e) => e.key === "Enter" && onToggleExpand()}
        className={cn(
          "flex items-center gap-2 px-2.5 py-2 rounded-xl cursor-pointer transition-colors group",
          isSelected ? "bg-highlight-selected" : "bg-card hover:bg-card-hover"
        )}
        data-testid={`button-agent-${agent.id}`}
      >
        <div className="shrink-0">
          <AgentIcon />
        </div>
        <div className="flex-1 min-w-0 pt-0.5">
          <p className="text-[15px] font-semibold font-heading leading-tight truncate text-foreground">
            {agent.name}
          </p>
          <p className="text-[11px] text-muted-foreground leading-tight truncate mt-0.5">
            {chipLabel}
          </p>
        </div>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 text-muted-foreground/60 transition-transform shrink-0",
            isExpanded && "rotate-180"
          )}
        />
        {onSettingsClick && (
          <button
            onClick={(e) => { e.stopPropagation(); onSettingsClick(agent.id); }}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground/50 hover:text-foreground hover:bg-muted opacity-0 group-hover:opacity-100 transition-all shrink-0"
            title="Agent settings"
            data-testid={`agent-settings-${agent.id}`}
          >
            <Settings className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Expanded: recent chats + new chat button */}
      {isExpanded && (
        <div className="ml-5 mt-0.5 mb-1 border-l-2 border-border/40 pl-2.5 space-y-0.5">
          {/* New chat button */}
          <button
            onClick={() => onSelectChat(agent.id)}
            className="flex items-center gap-2 w-full px-2.5 py-1.5 rounded-lg text-xs font-medium text-brand-indigo hover:bg-brand-indigo/5 transition-colors"
            data-testid={`agent-new-chat-${agent.id}`}
          >
            <Plus className="h-3 w-3" />
            New conversation
          </button>

          {loadingChats ? (
            <div className="flex items-center justify-center py-3">
              <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
            </div>
          ) : recentChats.length === 0 ? (
            <p className="text-[11px] text-muted-foreground/60 px-2.5 py-2">No conversations yet</p>
          ) : (
            recentChats.map((chat) => (
              <button
                key={chat.sessionId}
                onClick={() => onSelectChat(agent.id, chat.sessionId)}
                className={cn(
                  "flex flex-col w-full px-2.5 py-1.5 rounded-lg text-left transition-colors",
                  activeSessionId === chat.sessionId
                    ? "bg-highlight-selected"
                    : "hover:bg-card-hover"
                )}
                data-testid={`agent-chat-${chat.sessionId}`}
              >
                <div className="flex items-center gap-1.5 w-full min-w-0">
                  <span className="text-[12px] font-medium text-foreground truncate flex-1 min-w-0">
                    {chat.title || "Untitled"}
                  </span>
                  <span className="text-[10px] text-muted-foreground/60 shrink-0">
                    {formatTime(chat.updatedAt)}
                  </span>
                </div>
                {chat.lastMessage && (
                  <p className="text-[11px] text-muted-foreground truncate mt-0.5 w-full">
                    {chat.lastMessage.content.slice(0, 60)}
                  </p>
                )}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
