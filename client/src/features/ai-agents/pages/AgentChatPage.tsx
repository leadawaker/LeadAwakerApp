import { useEffect, useState } from "react";
import { useLocation, useParams } from "wouter";
import { ArrowLeft, Plus, Cpu, Zap, Settings } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { CrmShell } from "@/components/crm/CrmShell";
import { useAgentChat } from "../hooks/useAgentChat";
import { AgentChatView } from "../components/AgentChatView";
import { AgentSettingsSheet } from "../components/AgentSettingsSheet";
import { ModelSwitcher } from "../components/ModelSwitcher";
import { ThinkingToggle } from "../components/ThinkingToggle";

export function AgentChatPage() {
  const params = useParams<{ agentId: string }>();
  const [location, setLocation] = useLocation();
  const agentId = parseInt(params.agentId || "0", 10);
  const prefix = location.startsWith("/agency") ? "/agency" : "/subaccount";
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
    updateSessionThinking,
    pendingConfirmation,
    activity,
    confirmDestructiveActions,
    cancelDestructiveActions,
    abortStream,
  } = useAgentChat();

  useEffect(() => {
    if (agentId) initialize(agentId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  const isCodeRunner = agent?.type === "code_runner";

  return (
    <CrmShell>
    <div className="flex flex-col h-full bg-background" data-testid="agent-chat-fullpage">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-3 border-b border-border/50 bg-background shrink-0">
        <button
          onClick={() => setLocation(`${prefix}/ai-agents`)}
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
          {session?.title ? (
            <div className="text-[10px] text-muted-foreground font-medium truncate mt-0.5" data-testid="conversation-title">
              {session.title}
            </div>
          ) : isCodeRunner ? (
            <div className="flex items-center gap-1 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-[10px] text-muted-foreground font-medium">Pi connected · live reload on</span>
            </div>
          ) : null}
        </div>

        {session && (
          <>
            <ModelSwitcher
              currentModel={session.model}
              onModelChange={updateSessionModel}
              disabled={streaming}
            />
            <ThinkingToggle
              currentLevel={session.thinkingLevel}
              onLevelChange={updateSessionThinking}
              disabled={streaming}
            />
          </>
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

      {/* Chat area — full width with comfortable reading width */}
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
            sessionId={session?.sessionId}
            pendingConfirmation={pendingConfirmation}
            activity={activity}
            onConfirmDestructive={confirmDestructiveActions}
            onCancelDestructive={cancelDestructiveActions}
            onAbort={abortStream}
            fullPage
          />
          <AgentSettingsSheet
            agent={agent}
            open={settingsOpen}
            onOpenChange={setSettingsOpen}
            onAgentUpdated={(updated) => setAgent(updated)}
            onAgentDeleted={() => setLocation(`${prefix}/ai-agents`)}
          />
        </>
      )}
    </div>
    </CrmShell>
  );
}
