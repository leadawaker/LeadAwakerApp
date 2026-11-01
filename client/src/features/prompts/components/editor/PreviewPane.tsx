// The preview column for chat prompts: a slim bar with the "Preview as" pick,
// the conditions and the fold and Variables switches, then the resolved text
// with the Variables panel as its own section beside it.
import { forwardRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ChevronsUpDown } from "lucide-react";
import type { CampaignForPreview } from "../../utils/resolveVariables";
import type { PromptCondition } from "../../utils/promptVariables";
import type { PreviewContextKey } from "../../utils/previewContext";
import type { PreviewContextState } from "./usePreviewContext";
import { PreviewAsPicker } from "./PreviewAsPicker";
import { PreviewConditions } from "./PreviewConditions";
import { VariablesPanel } from "./VariablesPanel";
import { VariablesToggle, useVariablesLayout } from "./variablesLayout";

const NICHE_VARS = /^(niche_(question_bank|bad_examples|objection_examples|scenario_examples)|(project|proposal|decision|advisor|visit)_term(_list)?)$/;

export const PreviewPane = forwardRef<HTMLDivElement, {
  contextKey: PreviewContextKey;
  onContextChange: (key: PreviewContextKey) => void;
  ctx: PreviewContextState;
  campaigns: CampaignForPreview[];
  servingIds: number[];
  accountNames: Map<number, string>;
  variableNames: string[];
  conditions: PromptCondition[];
  /** Values for the picked context, before any condition pick. */
  actualValues: Record<string, string | null | undefined>;
  overrides: Record<string, string>;
  onOverride: (name: string, value: string | null) => void;
  nicheOverride: string;
  onNicheChange: (niche: string) => void;
  canFold: boolean;
  anyFolded: boolean;
  onToggleFoldAll: () => void;
  variablesOpen: boolean;
  onToggleVariables: () => void;
  onCampaignUpdated?: (row: any) => void;
  onInsertVariable: (name: string) => void;
  children: ReactNode;
}>(function PreviewPane({
  contextKey, onContextChange, ctx, campaigns, servingIds, accountNames, variableNames, conditions, actualValues,
  overrides, onOverride, nicheOverride, onNicheChange, canFold, anyFolded, onToggleFoldAll,
  variablesOpen, onToggleVariables, onCampaignUpdated, onInsertVariable, children,
}, scrollRef) {
  const { t } = useTranslation("prompts");
  const foldTitle = t(anyFolded ? "preview.unfoldAll" : "preview.foldAll");

  const { rootRef, narrow, panelShown, textShown, toggle } = useVariablesLayout(variablesOpen, onToggleVariables);
  const [editRequest, setEditRequest] = useState<{ name: string; n: number } | null>(null);

  // A value clicked in the preview opens its editor in the Variables panel.
  const onPreviewClick = (e: React.MouseEvent) => {
    const name = ((e.target as HTMLElement).closest("mark[data-var]") as HTMLElement | null)?.dataset.var;
    if (!name) return;
    if (!panelShown) toggle();
    setEditRequest((r) => ({ name, n: (r?.n ?? 0) + 1 }));
  };

  return (
    <div ref={rootRef} className="flex flex-col min-h-0 min-w-0" style={{ flex: variablesOpen ? 2 : 1, overflow: "hidden" }}>
      <div className="flex items-center gap-2 shrink-0" style={{ height: 34, padding: "0 4px 6px" }}>
        <PreviewAsPicker
          value={contextKey}
          onChange={onContextChange}
          campaigns={campaigns}
          servingIds={servingIds}
          accountNames={accountNames}
          demoClients={ctx.demoClients}
        />
        <span className="flex-1" style={{ minWidth: 0 }} />
        <PreviewConditions
          conditions={conditions}
          actual={actualValues}
          overrides={overrides}
          onOverride={onOverride}
          showNiche={ctx.kind === "campaign" && variableNames.some((v) => NICHE_VARS.test(v))}
          campaignNiche={(ctx.campaign?.niche || "").trim()}
          nicheOverride={nicheOverride}
          niches={ctx.availableNiches}
          onNicheChange={onNicheChange}
          iconOnly={narrow}
        />
        {canFold && (
          <button type="button" className="la-btn la-btn--soft la-btn--icon shrink-0" style={{ height: 26, width: 26 }} onClick={onToggleFoldAll} title={foldTitle} aria-label={foldTitle}>
            <ChevronsUpDown size={13} />
          </button>
        )}
        <VariablesToggle shown={panelShown} narrow={narrow} count={variableNames.length} onClick={toggle} />
      </div>
      <div className="flex flex-1 min-h-0">
        {textShown && (
          <div ref={scrollRef} onClick={onPreviewClick} className="flex-1 min-w-0 overflow-y-auto px-5 py-3 [scrollbar-width:thin] la-prompt-clickable">
            {children}
          </div>
        )}
        {panelShown && (
          <VariablesPanel
            kind={ctx.kind}
            contextId={contextKey}
            names={variableNames}
            values={actualValues}
            target={ctx.target}
            campaignName={ctx.campaign?.name}
            accountName={ctx.accountName}
            needsContext={!ctx.campaign}
            fullWidth={narrow}
            onSaved={(r) => {
              ctx.applyWrite(r);
              if (r.ok && r.campaignRow) onCampaignUpdated?.(r.campaignRow);
            }}
            onInsert={onInsertVariable}
            editRequest={editRequest}
          />
        )}
      </div>
    </div>
  );
});
