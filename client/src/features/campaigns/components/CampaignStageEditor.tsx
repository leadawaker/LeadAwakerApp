/**
 * CampaignStageEditor — wraps CampaignSettingsLayout with workspace-aware
 * isAgency gating and niche-template auto-fill / save-back.
 */
import { useCallback } from "react";
import type { Campaign } from "@/types/models";
import type { ContractFinancials } from "./useCampaignDetail";
import { CampaignSettingsLayout } from "./settings/CampaignSettingsLayout";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";

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
  onGenerated?: () => void;
}

export function CampaignStageEditor({
  campaign, isEditing, draft, setDraft,
  linkedContract,
  conversationPrompts,
  compact,
  focusField, onStartEditField,
  onGenerated,
}: CampaignStageEditorProps) {
  const { isOwner } = useWorkspace();

  // When operator picks a new niche, load its template and pre-fill empty
  // business fields (company_name, description, kb) from the template.
  const handleNicheChange = useCallback(async (niche: string) => {
    if (!niche) return;
    try {
      const res = await apiFetch(`/api/niche-vocabulary/${encodeURIComponent(niche)}/template`);
      if (!res.ok) return;
      const tmpl: {
        companyNameTemplate: { nl: string; en: string };
        descriptionTemplate: { nl: string; en: string };
        kbTemplate: { nl: string; en: string };
      } = await res.json();

      // Use campaign language to pick the right slot.
      const lang: "nl" | "en" = campaign.language === "nl" ? "nl" : "en";

      setDraft((prev) => {
        const patch: Record<string, unknown> = {};
        const cn = tmpl.companyNameTemplate[lang];
        const desc = tmpl.descriptionTemplate;
        const kb = tmpl.kbTemplate;
        if (cn) patch.company_name = cn;
        if (desc[lang]) patch.description = JSON.stringify(desc);
        if (kb[lang]) patch.kb = JSON.stringify(kb);
        return { ...prev, ...patch };
      });
    } catch {
      // Non-critical — template pre-fill is best-effort.
    }
  }, [campaign, setDraft]);

  return (
    <CampaignSettingsLayout
      campaign={campaign}
      isEditing={isEditing}
      draft={draft}
      setDraft={setDraft}
      focusField={focusField}
      onStartEditField={onStartEditField}
      conversationPrompts={conversationPrompts}
      compact={compact}
      isAgency={isOwner}
      onNicheChange={handleNicheChange}
      onGenerated={onGenerated}
    />
  );
}
