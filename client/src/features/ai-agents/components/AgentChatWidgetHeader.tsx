import { type PointerEvent as ReactPointerEvent } from "react";
import { Bot, X, ChevronLeft, Plus, MapPin, MapPinOff, MousePointerClick, Check, MoreVertical, PanelRight, PanelRightClose } from "lucide-react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";
import { MODEL_OPTIONS } from "./ModelSwitcher";
import { THINKING_OPTIONS } from "./ThinkingToggle";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { AiAgent, AiSession } from "../hooks/useAgentChat";
import { getAgentColor, AgentIcon } from "./ConversationTabs";
import { useElementPicker } from "../hooks/useElementPicker";

// ─── Widget Header ────────────────────────────────────────────────────────────

export interface AgentChatWidgetHeaderProps {
  isMobile: boolean;
  activeAgentId: number | null | undefined;
  activeAgent: AiAgent | null;
  activeSession: AiSession | null;
  activeStreaming: boolean;
  activePageAwareness: boolean;
  isCodeRunner: boolean;
  elementPicker: ReturnType<typeof useElementPicker>;
  closeWidget: () => void;
  handleBack: () => void;
  togglePageAwareness: () => void;
  onDragPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
  onDragPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
  dockMode: boolean;
  onToggleDock: () => void;
}

export function AgentChatWidgetHeader({
  isMobile,
  activeAgentId,
  activeAgent,
  activeSession,
  activeStreaming,
  activePageAwareness,
  isCodeRunner,
  elementPicker,
  closeWidget,
  handleBack,
  togglePageAwareness,
  onDragPointerDown,
  onDragPointerMove,
  onDragPointerUp,
  dockMode,
  onToggleDock,
}: AgentChatWidgetHeaderProps) {
  const { t } = useTranslation("crm");
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-white dark:bg-card shrink-0",
        !isMobile && "cursor-grab active:cursor-grabbing select-none",
      )}
      onPointerDown={!isMobile ? onDragPointerDown : undefined}
      onPointerMove={!isMobile ? onDragPointerMove : undefined}
      onPointerUp={!isMobile ? onDragPointerUp : undefined}
    >
      {activeAgentId && activeAgent ? (
        <>
          <button
            onClick={handleBack}
            className="h-8 w-8 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
            data-testid="widget-back-btn"
          >
            <ChevronLeft className="h-4 w-4 max-md:h-5 max-md:w-5" />
          </button>
          {/* Per-agent colored robot icon */}
          <div className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", getAgentColor(activeAgent.id).bg)}>
            <AgentIcon agent={activeAgent} className="h-3.5 w-3.5" />
          </div>
          <div className="flex-1 min-w-0 cursor-default" title={activeSession?.title ? `${activeAgent.name} \u2014 ${activeSession.title}` : activeAgent.name}>
            <div className="font-semibold text-xs truncate">
              {activeSession?.title || activeAgent.name}
            </div>
            {activeSession?.title ? (
              <div className="text-[9px] text-muted-foreground truncate">
                {activeAgent.name}
              </div>
            ) : isCodeRunner ? (
              <div className="flex items-center gap-1">
                <span className="w-1 h-1 rounded-full bg-green-500" />
                <span className="text-[9px] text-muted-foreground">Connected</span>
              </div>
            ) : null}
          </div>
          {/* Context usage % indicator in header */}
          {activeSession && ((activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0)) > 0 && (() => {
            const total = (activeSession.totalInputTokens || 0) + (activeSession.totalOutputTokens || 0);
            const maxTokens = 200_000;
            const pct = Math.min(100, Math.round((total / maxTokens) * 100));
            const color = pct > 80 ? "text-red-500" : pct > 50 ? "text-amber-500" : "text-muted-foreground";
            return (
              <div
                className={cn("flex items-center gap-1 shrink-0 cursor-default", color)}
                title={`Context: ${total.toLocaleString()} / ${maxTokens.toLocaleString()} tokens (${pct}%)`}
              >
                <div className="w-8 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all",
                      pct > 80 ? "bg-red-500" : pct > 50 ? "bg-amber-500" : "bg-brand-indigo",
                    )}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[9px] font-mono font-medium">{pct}%</span>
              </div>
            );
          })()}
          {/* Element picker toggle (desktop only) */}
          <div className="hidden md:flex items-center gap-0.5 shrink-0">
            <button
              onClick={() => elementPicker.pickerActive ? elementPicker.deactivate() : elementPicker.activate()}
              className={cn(
                "h-7 w-7 rounded-full flex items-center justify-center transition-colors shrink-0",
                elementPicker.pickerActive
                  ? "bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400"
                  : elementPicker.confirmedInfo
                    ? "text-violet-500 hover:bg-muted"
                    : "text-muted-foreground hover:bg-muted",
              )}
              title={elementPicker.pickerActive ? "Cancel element picker" : elementPicker.confirmedInfo ? "Re-select element" : "Select a page element"}
            >
              <MousePointerClick className="h-3.5 w-3.5" />
            </button>
            {elementPicker.pickerActive && elementPicker.selectedInfo && (
              <button
                onClick={() => elementPicker.confirm()}
                className="h-7 w-7 rounded-full flex items-center justify-center text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors shrink-0"
                title="Confirm selection"
              >
                <Check className="h-3.5 w-3.5" />
              </button>
            )}
            {elementPicker.pickerActive && (
              <button
                onClick={() => elementPicker.deactivate()}
                className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                title="Cancel"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          {/* "..." overflow menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="h-7 w-7 max-md:h-11 max-md:w-11 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
                data-testid="widget-overflow-menu"
              >
                <MoreVertical className="h-4 w-4 max-md:h-5 max-md:w-5" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl z-[10000] p-1.5 min-w-0 w-auto">
              {activeSession && (() => {
                const modelOpts = MODEL_OPTIONS;
                const thinkingOpts = THINKING_OPTIONS;
                const curModel = modelOpts.find((m) => m.id === activeSession.model) || modelOpts[0];
                const curThinking = thinkingOpts.find((t) => t.id === activeSession.thinkingLevel) || thinkingOpts[2];
                const ModelIcon = curModel.icon;
                const ThinkingIcon = curThinking.icon;
                const nextModel = modelOpts[(modelOpts.indexOf(curModel) + 1) % modelOpts.length];
                const nextThinking = thinkingOpts[(thinkingOpts.indexOf(curThinking) + 1) % thinkingOpts.length];
                return (
                  <div className="flex items-center gap-1">
                    {/* Model cycle */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent("agent-model-change", {
                            detail: { agentId: activeAgentId, model: nextModel.id },
                          }),
                        );
                      }}
                      disabled={activeStreaming}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-2 max-md:py-2.5 text-[10px] font-medium transition-colors",
                        "hover:bg-muted/50 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                      title={`Model: ${curModel.label} — tap to switch to ${nextModel.label}`}
                    >
                      <ModelIcon className={cn("h-3.5 w-3.5 shrink-0", curModel.color)} />
                      <span>{curModel.shortLabel}</span>
                    </button>
                    {/* Thinking cycle */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent("agent-thinking-change", {
                            detail: { agentId: activeAgentId, thinkingLevel: nextThinking.id },
                          }),
                        );
                      }}
                      disabled={activeStreaming}
                      className={cn(
                        "flex items-center gap-1.5 rounded-lg border border-border/50 px-2.5 py-2 max-md:py-2.5 text-[10px] font-medium transition-colors",
                        "hover:bg-muted/50 hover:border-border disabled:opacity-50 disabled:cursor-not-allowed",
                      )}
                      title={`Thinking: ${curThinking.label} — tap to switch to ${nextThinking.label}`}
                    >
                      <ThinkingIcon className={cn("h-3.5 w-3.5 shrink-0", curThinking.color)} />
                      <span>{curThinking.label}</span>
                    </button>
                    {/* Page awareness toggle */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        togglePageAwareness();
                      }}
                      className={cn(
                        "flex items-center justify-center rounded-lg border px-2 py-2 max-md:py-2.5 transition-colors",
                        activePageAwareness
                          ? "border-brand-indigo/30 bg-brand-indigo/5 text-brand-indigo"
                          : "border-border/50 text-muted-foreground hover:bg-muted/50",
                      )}
                      title={activePageAwareness ? "Page awareness ON — tap to disable" : "Page awareness OFF — tap to enable"}
                    >
                      {activePageAwareness ? (
                        <MapPin className="h-3.5 w-3.5" />
                      ) : (
                        <MapPinOff className="h-3.5 w-3.5" />
                      )}
                    </button>
                    {/* New conversation */}
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        window.dispatchEvent(
                          new CustomEvent("agent-new-session", { detail: { agentId: activeAgentId } }),
                        );
                      }}
                      className="flex items-center justify-center rounded-lg border border-border/50 px-2 py-2 max-md:py-2.5 text-muted-foreground hover:bg-muted/50 hover:border-border transition-colors"
                      title="New conversation"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })()}
            </DropdownMenuContent>
          </DropdownMenu>
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
      {!isMobile && (
        <button
          onClick={onToggleDock}
          className="inline-flex h-9 w-9 rounded-full items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
          title={dockMode ? t("agentWidget.undock") : t("agentWidget.dockToSide")}
          aria-label={dockMode ? t("agentWidget.undock") : t("agentWidget.dockToSide")}
          data-testid="agent-widget-dock-toggle"
        >
          {dockMode ? <PanelRightClose className="h-5 w-5" /> : <PanelRight className="h-5 w-5" />}
        </button>
      )}
      <button
        onClick={closeWidget}
        className="h-9 w-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors shrink-0"
        title="Close"
        data-testid="agent-widget-minimize"
        aria-label="Close AI Agent chat"
      >
        <X className="h-5 w-5" />
      </button>
    </div>
  );
}
