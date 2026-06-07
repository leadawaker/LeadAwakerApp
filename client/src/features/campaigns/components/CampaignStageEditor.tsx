/**
 * CampaignStageEditor — thin wrapper around CampaignSettingsLayout.
 */
import type { Campaign } from "@/types/models";
import type { ContractFinancials } from "./useCampaignDetail";
import { CampaignSettingsLayout } from "./settings/CampaignSettingsLayout";

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

export function CampaignStageEditor({
  campaign, isEditing, draft, setDraft,
  linkedContract,
  focusField, onStartEditField,
}: CampaignStageEditorProps) {
  return (
    <CampaignSettingsLayout
      campaign={campaign}
      isEditing={isEditing}
      draft={draft}
      setDraft={setDraft}
      focusField={focusField}
      onStartEditField={onStartEditField}
    />
  );
}
