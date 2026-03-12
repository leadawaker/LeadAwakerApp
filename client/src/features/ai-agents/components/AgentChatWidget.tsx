import { useEffect, useState } from "react";
import { Bot, X, ChevronLeft, Cpu, Zap, MessageSquare, Loader2, Plus, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentWidget } from "@/contexts/AgentWidgetContext";
import { useAgentChat } from "../hooks/useAgentChat";
import { AgentChatView } from "./AgentChatView";
import { AgentSettingsSheet } from "./AgentSettingsSheet";
import { ModelSwitcher } from "./ModelSwitcher";
import { ThinkingToggle } from "./ThinkingToggle";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent } from "../hooks/useAgentChat";

// ─── Agent Picker (shown when no agent is selected) ──────────────────────────
function AgentPicker({ onSelect }: { onSelect: (agent: AiAgent) => void }) {
  const [agents, setAgents] = useState<AiAgent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch("/api/ai-agents")
      .then((r) => r.json())
      .then((data: unknown) => setAgents(Array.isArray(data) ? (data as AiAgent[]) : []))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 p-4">
      <div className="text-sm font-semibold text-foreground mb-1">Choose an agent</div>
      {agents.map((agent) => {
        const tagline =
          agent.type === "code_runner"
            ? "Codebase access · Live reload"
            : agent.type === "campaign_crafter"
            ? "Campaigns · Messaging"
            : "Custom AI assistant";
        return (
          <button
            key={agent.id}
            onClick={() => onSelect(agent)}
            className="flex items-center gap-3 p-3 rounded-xl bg-card border border-border/50 hover:border-brand-indigo/30 hover:shadow-sm transition-all text-left"
            data-testid={`widget-agent-${agent.id}`}
          >
            <Avatar className="h-10 w-10 shrink-0">
              {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt={agent.name} /> : null}
              <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-sm">
                {agent.type === "code_runner" ? (
                  <Zap className="h-5 w-5" />
                ) : agent.type === "campaign_crafter" ? (
                  <MessageSquare className="h-5 w-5" />
                ) : (
                  <Cpu className="h-5 w-5" />
                )}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm truncate">{agent.name}</div>
              <div className="text-[11px] text-muted-foreground">{tagline}</div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

// ─── Main Widget Component ───────────────────────────────────────────────────
export function AgentChatWidget() {
  const { isOpen, activeAgentId, closeWidget, toggleWidget, selectAgent, clearAgent } = useAgentWidget();
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
  } = useAgentChat();

  // Initialize when activeAgentId changes
  useEffect(() => {
    if (activeAgentId && activeAgentId > 0) {
      initialize(activeAgentId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeAgentId]);

  const handleSelectAgent = (selected: AiAgent) => {
    selectAgent(selected.id);
  };

  const handleBack = () => {
    clearAgent();
    // Reset chat state
    setAgent(null);
  };

  const isCodeRunner = agent?.type === "code_runner";

  // Check if user is agency user (admin)
  const role = localStorage.getItem("leadawaker_user_role") || "Viewer";
  const isAgency = role === "Admin" || role === "Operator";
  const isAuthed = Boolean(localStorage.getItem("leadawaker_auth"));

  // Don't render for non-authed or non-agency users
  if (!isAuthed || !isAgency) return null;

  return (
    <>
      {/* ── Floating toggle button (visible when closed) ── */}
      <button
        onClick={toggleWidget}
        className={cn(
          "fixed bottom-6 right-6 z-[9998] h-14 w-14 rounded-full shadow-lg flex items-center justify-center transition-all duration-300",
          "bg-brand-indigo text-white hover:bg-brand-indigo/90 hover:scale-105 active:scale-95",
          isOpen && "scale-0 opacity-0 pointer-events-none",
          !isOpen && "scale-100 opacity-100",
        )}
        data-testid="agent-widget-toggle"
        aria-label="Open AI Agent chat"
      >
        <Bot className="h-6 w-6" />
        {/* Pulse ring */}
        <span className="absolute inset-0 rounded-full animate-ping bg-brand-indigo/30 pointer-events-none" style={{ animationDuration: "3s" }} />
      </button>

      {/* ── Chat panel (visible when open) ── */}
      <div
        className={cn(
          "fixed z-[9999] flex flex-col bg-background border border-border/60 shadow-2xl rounded-2xl overflow-hidden transition-all duration-300 ease-out",
          // Desktop: bottom-right corner, fixed size
          "bottom-6 right-6 w-[400px] h-[560px]",
          // Mobile: full width with margins
          "max-md:bottom-0 max-md:right-0 max-md:left-0 max-md:top-0 max-md:w-full max-md:h-full max-md:rounded-none",
          isOpen
            ? "translate-y-0 opacity-100 scale-100 pointer-events-auto"
            : "translate-y-4 opacity-0 scale-95 pointer-events-none",
        )}
        data-testid="agent-widget-panel"
      >
        {/* ── Widget Header ── */}
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-background shrink-0">
          {activeAgentId && agent ? (
            <>
              <button
                onClick={handleBack}
                className="h-8 w-8 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                data-testid="widget-back-btn"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <Avatar className="h-8 w-8 shrink-0">
                {agent.photoUrl ? <AvatarImage src={agent.photoUrl} alt={agent.name} /> : null}
                <AvatarFallback className="bg-brand-indigo/10 text-brand-indigo font-bold text-xs">
                  {isCodeRunner ? <Zap className="h-3.5 w-3.5" /> : <Cpu className="h-3.5 w-3.5" />}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs truncate">{agent.name}</div>
                {isCodeRunner && (
                  <div className="flex items-center gap-1">
                    <span className="w-1 h-1 rounded-full bg-green-500" />
                    <span className="text-[9px] text-muted-foreground">Connected</span>
                  </div>
                )}
              </div>
              {session && (
                <>
                  <ModelSwitcher
                    currentModel={session.model}
                    onModelChange={updateSessionModel}
                    disabled={streaming}
                    compact
                  />
                  <ThinkingToggle
                    currentLevel={session.thinkingLevel}
                    onLevelChange={updateSessionThinking}
                    disabled={streaming}
                    compact
                  />
                </>
              )}
              <button
                onClick={() => setSettingsOpen(true)}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                data-testid="widget-settings-btn"
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
              {session && (
                <button
                  onClick={newSession}
                  className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                  title="New conversation"
                  data-testid="widget-new-session-btn"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              )}
            </>
          ) : (
            <>
              <Bot className="h-5 w-5 text-brand-indigo shrink-0 ml-1" />
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-xs">AI Agents</div>
                <div className="text-[9px] text-muted-foreground">Your CRM co-pilots</div>
              </div>
            </>
          )}
          <button
            onClick={closeWidget}
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            data-testid="agent-widget-close"
            aria-label="Close AI Agent chat"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Widget Body ── */}
        <div className="flex-1 min-h-0 overflow-hidden">
          {activeAgentId && agent ? (
            <AgentChatView
              agent={agent}
              messages={messages}
              streaming={streaming}
              streamingText={streamingText}
              loading={loading}
              onSend={sendMessage}
              onNewSession={newSession}
            />
          ) : (
            <AgentPicker onSelect={handleSelectAgent} />
          )}
        </div>
      </div>

      {/* ── Agent Settings Sheet ── */}
      {agent && (
        <AgentSettingsSheet
          agent={agent}
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          onAgentUpdated={(updated) => setAgent(updated)}
        />
      )}
    </>
  );
}
