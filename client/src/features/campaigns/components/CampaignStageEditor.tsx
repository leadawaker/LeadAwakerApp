/**
 * CampaignStageEditor — grid shell + collapse state only.
 * Each column lives in ./columns/
 */
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { Campaign } from "@/types/models";
import type { ContractFinancials } from "./useCampaignDetail";
import { CampaignBusinessColumn } from "./columns/CampaignBusinessColumn";
import { CampaignAIColumn } from "./columns/CampaignAIColumn";
import { CampaignBehaviorColumn } from "./columns/CampaignBehaviorColumn";

export interface CampaignStageEditorProps {
  campaign: Campaign;
  isEditing: boolean;
  draft: Record<string, unknown>;
  setDraft: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  linkedPrompt: any | null;
  conversationPrompts: any[];
  linkedContract: ContractFinancials | null;
  compact?: boolean;
  focusField?: string | null;
  onStartEditField?: (field: string) => void;
  onTogglePromptPanel?: () => void;
}

function usePersistedCollapse(key: string) {
  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(key) === "true"; } catch { return false; }
  });
  const toggle = () => setCollapsed(v => {
    const next = !v;
    try { localStorage.setItem(key, String(next)); } catch {}
    return next;
  });
  return [collapsed, toggle] as const;
}

export function CampaignStageEditor({
  campaign, isEditing, draft, setDraft,
  linkedPrompt, conversationPrompts, linkedContract,
  compact = false, focusField = null,
  onStartEditField, onTogglePromptPanel,
}: CampaignStageEditorProps) {
  const [businessCollapsed, toggleBusiness] = usePersistedCollapse("campaign-business-collapsed");
  const [aiCollapsed,       toggleAi]       = usePersistedCollapse("campaign-ai-settings-collapsed");
  const [behaviorCollapsed, toggleBehavior] = usePersistedCollapse("campaign-behavior-collapsed");

  const col = (c: boolean) => c ? "52px" : "1fr";
  const gridStyle = compact ? undefined : {
    gridTemplateColumns: `${col(businessCollapsed)} ${col(aiCollapsed)} ${col(behaviorCollapsed)}`,
    transition: "grid-template-columns 0.2s ease",
  };

  const shared = { campaign, isEditing, draft, setDraft, focusField, onStartEditField };

  return (
    <div className={cn(compact ? "flex flex-col gap-3" : "grid gap-[3px] flex-1 min-h-0", "w-full")} style={gridStyle}>
      <CampaignBusinessColumn {...shared} collapsed={businessCollapsed} onToggle={toggleBusiness} />
      <CampaignAIColumn      {...shared} collapsed={aiCollapsed}       onToggle={toggleAi}
        linkedPrompt={linkedPrompt} conversationPrompts={conversationPrompts} onTogglePromptPanel={onTogglePromptPanel}
      />
      <CampaignBehaviorColumn {...shared} collapsed={behaviorCollapsed} onToggle={toggleBehavior}
        linkedContract={linkedContract}
      />
    </div>
  );
}
