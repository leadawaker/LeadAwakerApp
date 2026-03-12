import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Plus, Cpu, Zap, Settings } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { useAgentChat } from "../hooks/useAgentChat";
import { AgentChatView } from "../components/AgentChatView";
import { AgentSettingsSheet } from "../components/AgentSettingsSheet";
import { ModelSwitcher } from "../components/ModelSwitcher";

export function AgentChatPage() {
  const params = useParams<{ agentId: string }>();
  const [, setLocation] = useLocation();
  const agentId = parseInt(params.agentId || "0", 10);
  const [settingsOpen, setSettingsOpen] = useState(false);

  const {
    agent,
    setAgent,
    session,
    messages,
    streaming,
    streamingText,
    loading,
    initialize,
    sendMessage,
    newSession,
    updateSessionModel,
  } = useAgentChat();

  useEffect(() => {
    if (agentId) initialize(agentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const isCodeRunner = agent?.type === "code_runner";

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/50 bg-background shrink-0">
        <button
          onClick={() => setLocation("/agency/ai-agents")}
          className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>

        <Avatar className="h-9 w-9 shrink-0">
          {agent?.photoUrl ? (
            <AvatarImage src={agent.photoUrl} alt={agent.name} />
          ) : null}
          <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-sm">
            {isCodeRunner ? <Zap className="h-4 w-4" /> : <Cpu className="h-4 w-4" />}
          </AvatarFallback>
        </Avatar>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{agent?.name ?? "Agent"}</div>
          {isCodeRunner && (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">Pi connected · live reload on</span>
            </div>
          )}
        </div>

        {session && (
          <ModelSwitcher
            currentModel={session.model}
            onModelChange={updateSessionModel}
            disabled={streaming}
          />
        )}

        <button
          onClick={() => setSettingsOpen(true)}
          className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          title="Agent settings"
          data-testid="agent-settings-btn"
        >
          <Settings className="h-4 w-4" />
        </button>

        {session && (
          <button
            onClick={newSession}
            className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            title="New conversation"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Chat area */}
      {agent && (
        <>
          <AgentChatView
            agent={agent}
            messages={messages}
            streaming={streaming}
            streamingText={streamingText}
            loading={loading}
            onSend={sendMessage}
            onNewSession={newSession}
          />
          <AgentSettingsSheet
            agent={agent}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onAgentUpdated={(updated) => setAgent(updated)}
          />
        </>
      )}
    </div>
  );
}
