import { useState, useEffect, useCallback } from "react";
import { Settings, Shield, Eye, Pencil, PlusCircle, Trash2, Loader2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { apiFetch } from "@/lib/apiUtils";
import type { AiAgent, AgentPermissions } from "../hooks/useAgentChat";

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
}

export function AgentSettingsSheet({
  agent,
  open,
  onOpenChange,
  onAgentUpdated,
}: AgentSettingsSheetProps) {
  const [permissions, setPermissions] = useState<AgentPermissions>(
    agent.permissions || DEFAULT_PERMISSIONS
  );
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");

  // Reset permissions when agent changes
  useEffect(() => {
    setPermissions(agent.permissions || DEFAULT_PERMISSIONS);
  }, [agent.id, agent.permissions]);

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

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-[340px] sm:max-w-[340px]" data-testid="agent-settings-sheet">
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

        {/* Info footer */}
        <div className="mt-6 p-3 rounded-lg bg-muted/50 border border-border/30">
          <p className="text-xs text-muted-foreground">
            Permissions control what actions the AI agent can perform on CRM data during conversations.
            The agent will respect these limits when executing tools.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}
