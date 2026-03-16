import { useState, useEffect, useCallback } from "react";
import { Settings, Shield, Eye, Pencil, PlusCircle, Trash2, Loader2, AlertTriangle, BookOpen, X, ChevronDown, Cpu, Brain } from "lucide-react";
import { MODEL_OPTIONS } from "./ModelSwitcher";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent, AgentPermissions } from "../hooks/useAgentChat";

const THINKING_OPTIONS = [
  { id: "none", label: "Off", description: "No thinking" },
  { id: "low", label: "Low", description: "Brief reasoning" },
  { id: "medium", label: "Medium", description: "Balanced (default)" },
  { id: "high", label: "High", description: "Deep reasoning" },
];

const DEFAULT_PERMISSIONS: AgentPermissions = {
  read: true,
  write: false,
  create: false,
  delete: false,
};

const PERMISSION_CONFIG = [
  {
    key: "read" as const,
    label: "Read CRM Data",
    description: "Access leads, campaigns, accounts, and other CRM records",
    icon: Eye,
    color: "text-blue-500",
  },
  {
    key: "write" as const,
    label: "Write CRM Data",
    description: "Update existing leads, campaigns, and CRM records",
    icon: Pencil,
    color: "text-amber-500",
  },
  {
    key: "create" as const,
    label: "Create CRM Data",
    description: "Create new leads, campaigns, tags, and other records",
    icon: PlusCircle,
    color: "text-green-500",
  },
  {
    key: "delete" as const,
    label: "Delete CRM Data",
    description: "Remove leads, campaigns, and other CRM records",
    icon: Trash2,
    color: "text-red-500",
  },
];

interface AgentSettingsSheetProps {
  agent: AiAgent;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAgentUpdated?: (agent: AiAgent) => void;
  onAgentDeleted?: (agentId: number) => void;
}

export function AgentSettingsSheet({
  agent,
  open,
  onOpenChange,
  onAgentUpdated,
  onAgentDeleted,
}: AgentSettingsSheetProps) {
  const [permissions, setPermissions] = useState<AgentPermissions>(
    agent.permissions || DEFAULT_PERMISSIONS
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [prompts, setPrompts] = useState<{ id: number; name: string | null; useCase: string | null }[]>([]);
  const [promptsLoading, setPromptsLoading] = useState(false);
  const [selectedPromptId, setSelectedPromptId] = useState<number | null>(agent.systemPromptId ?? null);
  const [promptSaving, setPromptSaving] = useState(false);
  const [promptDropdownOpen, setPromptDropdownOpen] = useState(false);
  const [defaultModel, setDefaultModel] = useState(agent.model || "claude-sonnet-4-20250514");
  const [defaultThinking, setDefaultThinking] = useState(agent.thinkingLevel || "medium");
  const [modelSaving, setModelSaving] = useState(false);
  const [thinkingSaving, setThinkingSaving] = useState(false);

  // Fetch prompts when sheet opens
  useEffect(() => {
    if (open && prompts.length === 0) {
      setPromptsLoading(true);
      apiFetch("/api/prompts")
        .then((r) => r.json())
        .then((data: unknown) => {
          if (Array.isArray(data)) {
            setPrompts(data.map((p: any) => ({ id: p.id, name: p.name, useCase: p.useCase })));
          }
        })
        .catch(console.error)
        .finally(() => setPromptsLoading(false));
    }
  }, [open]);

  // Reset permissions, prompt selection, and defaults when agent changes
  useEffect(() => {
    setPermissions(agent.permissions || DEFAULT_PERMISSIONS);
    setSelectedPromptId(agent.systemPromptId ?? null);
    setDefaultModel(agent.model || "claude-sonnet-4-20250514");
    setDefaultThinking(agent.thinkingLevel || "medium");
  }, [agent.id, agent.permissions, agent.systemPromptId, agent.model, agent.thinkingLevel]);

  const handleToggle = useCallback(
    async (key: keyof AgentPermissions, checked: boolean) => {
      const updated = { ...permissions, [key]: checked };
      setPermissions(updated);
      setSaving(true);
      setSavedMessage("");

      try {
        const res = await apiFetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ permissions: updated }),
        });

        if (!res.ok) throw new Error("Failed to save");

        const updatedAgent = await res.json();
        setSavedMessage("Saved");
        setTimeout(() => setSavedMessage(""), 2000);
        onAgentUpdated?.(updatedAgent);
      } catch (err) {
        console.error("[AgentSettings] Save error:", err);
        // Revert on failure
        setPermissions(permissions);
        setSavedMessage("Failed to save");
        setTimeout(() => setSavedMessage(""), 3000);
      } finally {
        setSaving(false);
      }
    },
    [agent.id, permissions, onAgentUpdated]
  );

  const handlePromptChange = useCallback(
    async (promptId: number | null) => {
      setSelectedPromptId(promptId);
      setPromptDropdownOpen(false);
      setPromptSaving(true);
      try {
        const res = await apiFetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ systemPromptId: promptId }),
        });
        if (!res.ok) throw new Error("Failed to update prompt");
        const updatedAgent = await res.json();
        onAgentUpdated?.(updatedAgent);
      } catch (err) {
        console.error("[AgentSettings] Prompt update error:", err);
        setSelectedPromptId(agent.systemPromptId ?? null);
      } finally {
        setPromptSaving(false);
      }
    },
    [agent.id, agent.systemPromptId, onAgentUpdated]
  );

  const handleModelChange = useCallback(
    async (model: string) => {
      setDefaultModel(model);
      setModelSaving(true);
      try {
        const res = await apiFetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model }),
        });
        if (!res.ok) throw new Error("Failed to update model");
        const updatedAgent = await res.json();
        onAgentUpdated?.(updatedAgent);
      } catch (err) {
        console.error("[AgentSettings] Model update error:", err);
        setDefaultModel(agent.model || "claude-sonnet-4-20250514");
      } finally {
        setModelSaving(false);
      }
    },
    [agent.id, agent.model, onAgentUpdated]
  );

  const handleThinkingChange = useCallback(
    async (thinkingLevel: string) => {
      setDefaultThinking(thinkingLevel);
      setThinkingSaving(true);
      try {
        const res = await apiFetch(`/api/agents/${agent.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ thinkingLevel }),
        });
        if (!res.ok) throw new Error("Failed to update thinking level");
        const updatedAgent = await res.json();
        onAgentUpdated?.(updatedAgent);
      } catch (err) {
        console.error("[AgentSettings] Thinking update error:", err);
        setDefaultThinking(agent.thinkingLevel || "medium");
      } finally {
        setThinkingSaving(false);
      }
    },
    [agent.id, agent.thinkingLevel, onAgentUpdated]
  );

  const handleDeleteAgent = useCallback(async () => {
    setDeleting(true);
    try {
      const res = await apiFetch(`/api/agents/${agent.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete agent");
      setDeleteDialogOpen(false);
      onOpenChange(false);
      onAgentDeleted?.(agent.id);
    } catch (err) {
      console.error("[AgentSettings] Delete error:", err);
      setDeleting(false);
    }
  }, [agent.id, onOpenChange, onAgentDeleted]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange} modal={false}>
      <SheetContent side="right" hideOverlay className="w-[340px] sm:max-w-[340px] overflow-y-auto" data-testid="agent-settings-sheet">
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5 text-muted-foreground" />
            Agent Settings
          </SheetTitle>
          <SheetDescription>
            Configure permissions for <span className="font-medium text-foreground">{agent.name}</span>
          </SheetDescription>
        </SheetHeader>

        {/* Permissions Section */}
        <div className="mt-4" data-testid="agent-permissions-section">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">CRM Permissions</h3>
            {saving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            {savedMessage && (
              <span className={`text-xs ${savedMessage === "Saved" ? "text-green-500" : "text-red-500"}`}>
                {savedMessage}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mb-4">
            Control what this agent can do with your CRM data. Changes are saved immediately.
          </p>

          <div className="space-y-4">
            {PERMISSION_CONFIG.map(({ key, label, description, icon: Icon, color }) => (
              <div
                key={key}
                className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-card/50"
                data-testid={`agent-permission-${key}`}
              >
                <Icon className={`h-5 w-5 mt-0.5 shrink-0 ${color}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">{description}</div>
                </div>
                <Switch
                  checked={permissions[key]}
                  onCheckedChange={(checked) => handleToggle(key, checked)}
                  disabled={saving}
                  data-testid={`agent-permission-${key}-toggle`}
                />
              </div>
            ))}
          </div>
        </div>

        {/* System Prompt Link Section */}
        <div className="mt-6 pt-4 border-t border-border/50" data-testid="agent-prompt-section">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Custom Prompt</h3>
            {promptSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Link a prompt from your Prompts library to override the default system prompt.
          </p>

          {/* Prompt dropdown */}
          <div className="relative" data-testid="prompt-selector">
            <button
              onClick={() => setPromptDropdownOpen(!promptDropdownOpen)}
              className="w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-sm border border-border/50 bg-card/50 hover:bg-card transition-colors text-left"
              disabled={promptsLoading}
            >
              <span className={selectedPromptId ? "text-foreground" : "text-muted-foreground"}>
                {promptsLoading
                  ? "Loading prompts…"
                  : selectedPromptId
                  ? prompts.find((p) => p.id === selectedPromptId)?.name || `Prompt #${selectedPromptId}`
                  : "None (use default)"}
              </span>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${promptDropdownOpen ? "rotate-180" : ""}`} />
            </button>

            {promptDropdownOpen && (
              <div className="absolute z-50 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg max-h-48 overflow-y-auto">
                {/* Unlink option */}
                <button
                  onClick={() => handlePromptChange(null)}
                  className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors flex items-center gap-2 ${
                    !selectedPromptId ? "bg-muted/50 font-medium text-foreground" : "text-muted-foreground"
                  }`}
                >
                  <X className="h-3.5 w-3.5 shrink-0" />
                  None (use default)
                </button>
                {prompts.map((prompt) => (
                  <button
                    key={prompt.id}
                    onClick={() => handlePromptChange(prompt.id)}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${
                      selectedPromptId === prompt.id ? "bg-muted/50 font-medium text-brand-indigo" : "text-foreground"
                    }`}
                  >
                    <div className="truncate">{prompt.name || `Prompt #${prompt.id}`}</div>
                    {prompt.useCase && (
                      <div className="text-[10px] text-muted-foreground truncate">{prompt.useCase}</div>
                    )}
                  </button>
                ))}
                {prompts.length === 0 && !promptsLoading && (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No prompts in library</div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Default Model & Thinking Section */}
        <div className="mt-6 pt-4 border-t border-border/50" data-testid="agent-defaults-section">
          <div className="flex items-center gap-2 mb-3">
            <Cpu className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Default Model</h3>
            {modelSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Default model for new conversations. Can be overridden per conversation.
          </p>
          <div className="grid grid-cols-3 gap-1.5" data-testid="model-default-selector">
            {MODEL_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              const isActive = defaultModel === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleModelChange(opt.id)}
                  disabled={modelSaving}
                  className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg text-xs border transition-all ${
                    isActive
                      ? `${opt.bgColor} ${opt.color} border-current font-medium`
                      : "border-border/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {opt.shortLabel}
                </button>
              );
            })}
          </div>

          <div className="flex items-center gap-2 mt-5 mb-3">
            <Brain className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">Default Thinking</h3>
            {thinkingSaving && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
          </div>
          <p className="text-xs text-muted-foreground mb-3">
            Default thinking level for new conversations.
          </p>
          <div className="grid grid-cols-4 gap-1.5" data-testid="thinking-default-selector">
            {THINKING_OPTIONS.map((opt) => {
              const isActive = defaultThinking === opt.id;
              return (
                <button
                  key={opt.id}
                  onClick={() => handleThinkingChange(opt.id)}
                  disabled={thinkingSaving}
                  className={`px-2 py-2 rounded-lg text-xs border transition-all text-center ${
                    isActive
                      ? "bg-brand-indigo/10 text-brand-indigo border-brand-indigo/30 font-medium"
                      : "border-border/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Info footer */}
        <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground">
            Permissions control what actions the AI agent can perform on CRM data during conversations.
            The agent will respect these limits when executing tools.
          </p>
        </div>

        {/* Danger Zone — Delete Agent */}
        <div className="mt-6 pt-4 border-t border-border/50" data-testid="agent-delete-section">
          <h3 className="text-sm font-semibold text-red-500 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4" />
            Danger Zone
          </h3>
          <p className="text-xs text-muted-foreground mb-3">
            Permanently delete this agent and all its conversations, messages, and files. This action cannot be undone.
          </p>
          <button
            onClick={() => setDeleteDialogOpen(true)}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-colors"
            data-testid="delete-agent-button"
          >
            <Trash2 className="h-4 w-4" />
            Delete Agent
          </button>
        </div>
      </SheetContent>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent data-testid="delete-agent-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-red-500" />
              Delete "{agent.name}"?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this agent and all of its conversations, messages, and uploaded files. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAgent}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700 text-white"
              data-testid="confirm-delete-agent"
            >
              {deleting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                "Delete Agent"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Sheet>
  );
}
