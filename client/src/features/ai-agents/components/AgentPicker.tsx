import { useEffect, useState } from "react";
import { Bot, Loader2, Plus } from "lucide-react";
import { cn, relativeTime } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent } from "../hooks/useAgentChat";
import { getAgentColor } from "./ConversationTabs";

// ─── Agent Picker ─────────────────────────────────────────────────────────────

interface ConversationPreview {
  id: number;
  sessionId: string;
  title: string | null;
  updatedAt: string | null;
  lastMessage: { content: string; role: string; createdAt: string | null } | null;
}

export function AgentPicker({
  onSelect,
  onNewConversation,
}: {
  onSelect: (agent: AiAgent, sessionId?: string) => void;
  onNewConversation: (agent: AiAgent) => void;
}) {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [allConversations, setAllConversations] = useState<(ConversationPreview & { agent: AiAgent })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await apiFetch("/api/ai-agents");
        const data = await res.json() as AiAgent[];
        const agentList = Array.isArray(data) ? data.filter((a) => a.type === "code_runner") : [];
        if (cancelled) return;
        setAgents(agentList);

        // Fetch conversations for all agents in parallel
        const allConvs: (ConversationPreview & { agent: AiAgent })[] = [];
        await Promise.all(
          agentList.map(async (agent) => {
            try {
              const cRes = await apiFetch(`/api/agents/${agent.id}/conversations`);
              const cData = await cRes.json();
              if (Array.isArray(cData)) {
                for (const c of cData.slice(0, 10) as any[]) {
                  allConvs.push({
                    id: c.id,
                    sessionId: c.sessionId,
                    title: c.title,
                    updatedAt: c.updatedAt,
                    lastMessage: c.lastMessage,
                    agent,
                  });
                }
              }
            } catch { /* skip */ }
          }),
        );

        // Sort by most recent first
        allConvs.sort((a, b) => {
          const ta = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
          const tb = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
          return tb - ta;
        });

        if (!cancelled) setAllConversations(allConvs);
      } catch (err) {
        console.error(err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1 p-3 overflow-y-auto h-full">
      {/* New conversation buttons — one per agent */}
      {agents.map((agent) => (
        <button
          key={`new-${agent.id}`}
          onClick={() => onNewConversation(agent)}
          className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left text-sm font-medium text-brand-indigo hover:bg-brand-indigo/5 transition-colors"
          data-testid={`widget-agent-${agent.id}-new`}
        >
          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAgentColor(agent.id).bg)}>
            <Bot className={cn("h-3.5 w-3.5", getAgentColor(agent.id).text)} />
          </div>
          <Plus className="h-3.5 w-3.5" />
          <span>New conversation</span>
          <span className="text-[10px] text-muted-foreground font-normal">({agent.name})</span>
        </button>
      ))}

      {allConversations.length > 0 && (
        <div className="h-px bg-border/40 mx-2 my-1" />
      )}

      {/* Flat conversation list sorted by recency */}
      {allConversations.map((conv) => {
        const color = getAgentColor(conv.agent.id);

        return (
          <button
            key={conv.sessionId}
            onClick={() => onSelect(conv.agent, conv.sessionId)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-left hover:bg-muted/50 transition-colors group"
            data-testid={`widget-conv-${conv.sessionId}`}
          >
            {/* Agent avatar with per-agent color */}
            <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", color.bg)}>
              <Bot className={cn("h-3.5 w-3.5", color.text)} />
            </div>

            {/* Title + preview */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-medium text-foreground truncate">
                  {conv.title || "Untitled"}
                </span>
              </div>
              {conv.lastMessage && (
                <div className="text-[11px] text-muted-foreground truncate">
                  {conv.lastMessage.content.slice(0, 60)}
                </div>
              )}
            </div>

            {/* Time */}
            {conv.updatedAt && (
              <span className="text-[10px] text-muted-foreground shrink-0">
                {relativeTime(conv.updatedAt)}
              </span>
            )}
          </button>
        );
      })}

      {allConversations.length === 0 && (
        <div className="text-center text-xs text-muted-foreground py-8">
          No conversations yet. Start a new one above.
        </div>
      )}
    </div>
  );
}
