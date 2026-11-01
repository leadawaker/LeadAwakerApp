// The selected prompt's header bar: icon, editable name, status and note on the
// first line; area, Demo toggle, id and "used by" on the second. On the right the
// panel toggles, with the size estimate and the edit actions under them.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Check, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { promptNote } from "../../types";
import type { CampaignForPreview } from "../../utils/resolveVariables";
import { CATEGORY_COLOR, PROMPT_CATEGORIES, isDemoPrompt, promptCategory, type PromptCategory } from "../../promptCategories";
import { UsedByChip } from "./UsedByChip";
import { PromptNoteButton } from "./PromptNoteButton";

const metaText = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)" } as const;

/** One panel switch. Every switch reads the same: open is a wine tint with an open eye, closed a muted crossed eye. */
function PanelToggle({ on, marked, label, title, onClick, hideLabelWhenNarrow }: {
  on: boolean;
  /** A small wine dot: the closed panel has content. */
  marked?: boolean;
  label: string;
  title: string;
  onClick: () => void;
  /** Below 1440px only the icon stays, so the prompt name keeps its room. */
  hideLabelWhenNarrow?: boolean;
}) {
  const Icon = on ? Eye : EyeOff;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        height: 24, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        fontSize: 12, fontWeight: on ? 600 : 500, border: "none", cursor: "pointer",
        borderRadius: "var(--r-pill)",
        background: on ? "var(--wine-tint)" : "transparent",
        color: on ? "var(--wine)" : "var(--mute-2)",
        transition: "background-color 130ms, color 130ms",
      }}
      title={title}
      aria-label={title}
      aria-pressed={on}
    >
      <Icon size={13} />
      <span className={hideLabelWhenNarrow ? "max-[1439px]:hidden" : undefined}>{label}</span>
      {marked && !on && <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--wine)" }} />}
    </button>
  );
}

export function PromptDetailHeader({
  prompt,
  promptId,
  nameField,
  usedBy,
  accountNames,
  campaigns,
  tokenEstimate,
  onStatusChange,
  onCampaignChange,
  onNoteChange,
  onPatch,
  showSystemMessage,
  onToggleSystemMessage,
  showSidebar,
  onToggleSidebar,
  previewOpen,
  onTogglePreview,
  actions,
}: {
  prompt: any;
  promptId: number | null;
  /** The inline-editable name (useInlineEditing). */
  nameField: ReactNode;
  /** Campaigns that run this prompt. */
  usedBy: CampaignForPreview[];
  accountNames: Map<number, string>;
  campaigns: CampaignForPreview[];
  tokenEstimate: number;
  onStatusChange: (status: "active" | "archived") => void;
  onCampaignChange: (campaignId: string) => void;
  /** The note goes through the editor's autosave. */
  onNoteChange: (note: string) => void;
  /** Saves fields straight to the row (category, isDemo). */
  onPatch: (fields: { category?: PromptCategory; isDemo?: boolean }) => void;
  showSystemMessage: boolean;
  onToggleSystemMessage: () => void;
  showSidebar: boolean;
  onToggleSidebar: () => void;
  previewOpen: boolean;
  onTogglePreview: () => void;
  /** Model, font, save and version controls. */
  actions?: ReactNode;
}) {
  const { t } = useTranslation("prompts");
  const archived = (prompt.status || "").toLowerCase() === "archived";
  const category = promptCategory(prompt);
  const demo = isDemoPrompt(prompt);
  const campaignId = String(prompt.campaignsId || prompt.Campaigns_id || "");
  const chars = (prompt.promptText || prompt.prompt_text || "").length;

  return (
    <div style={{
      flexShrink: 0, padding: "10px 16px",
      borderRadius: "var(--r-surface)", boxShadow: "var(--sh-raised-crisp)",
      display: "flex", alignItems: "center", gap: 14, background: "var(--paper)",
    }}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span style={{
          width: 38, height: 38, flexShrink: 0, borderRadius: "var(--r-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: CATEGORY_COLOR[category], color: "var(--on-wine)",
        }}>
          <Bot size={18} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {nameField}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" style={{
                  fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, border: "none",
                  background: archived ? "var(--bg)" : "var(--good-tint)",
                  color: archived ? "var(--mute-2)" : "var(--good)",
                  borderRadius: "var(--r-pill)", padding: "2px 8px", flexShrink: 0, cursor: "pointer",
                }}>
                  {archived ? t("status.archived") : t("status.active")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-36">
                {(["active", "archived"] as const).map((s) => (
                  <DropdownMenuItem key={s} onClick={() => onStatusChange(s)} className="text-[12px]">
                    {t(`status.${s}`)}
                    {(s === "archived") === archived && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <PromptNoteButton note={promptNote(prompt)} onChange={onNoteChange} />
          </div>

          <div className="flex items-center gap-2 min-w-0" style={{ marginTop: 3 }}>
            {/* Area (category): which tab the prompt lives on */}
            <select
              className="neu-inset-super-crisp shrink-0 outline-none cursor-pointer"
              style={{ ...metaText, color: "var(--ink-soft)", borderRadius: "var(--r-pill)", padding: "1px 6px", border: "none" }}
              value={category}
              onChange={(e) => onPatch({ category: e.target.value as PromptCategory })}
              aria-label={t("category.label")}
              title={t("category.label")}
            >
              {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
            </select>

            {/* Demo toggle */}
            <button
              type="button"
              onClick={() => onPatch({ isDemo: !demo })}
              className={demo ? "neu-inset-super-crisp" : undefined}
              style={{
                ...metaText, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
                borderRadius: "var(--r-pill)", padding: "1px 7px", cursor: "pointer", flexShrink: 0,
                border: demo ? "none" : "1px dashed var(--line-strong)",
                background: demo ? undefined : "transparent",
                color: demo ? "var(--ink-soft)" : "var(--mute-2)",
              }}
              aria-pressed={demo}
              title={demo ? t("demo.unmark") : t("demo.mark")}
            >
              {t("demo.tag")}
            </button>

            <UsedByChip
              usedBy={usedBy}
              accountNames={accountNames}
              footer={(
                <label className="flex flex-col gap-1">
                  <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("usedBy.linked")}</span>
                  <select
                    className="neu-inset-super-crisp outline-none cursor-pointer"
                    style={{ fontSize: 12, color: "var(--ink)", borderRadius: "var(--r-flush)", padding: "4px 6px", border: "none" }}
                    value={campaignId}
                    onChange={(e) => onCampaignChange(e.target.value)}
                  >
                    <option value="">{t("labels.noCampaign")}</option>
                    {campaigns.map((c) => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
                  </select>
                  <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("usedBy.linkedHint")}</span>
                </label>
              )}
            />

            <span style={metaText}>#{promptId}</span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-1.5 shrink-0">
        {/* One track, so the three switches read as one control. */}
        <div className="flex items-center neu-inset-super-crisp" style={{ borderRadius: "var(--r-pill)", padding: 2, gap: 1 }}>
          <PanelToggle on={showSystemMessage} marked={!!(prompt.systemMessage || prompt.system_message)} label={t("detail.systemMsg")} title={t("detail.toggleSystemMessage")} onClick={onToggleSystemMessage} hideLabelWhenNarrow />
          <PanelToggle on={showSidebar} label={t("detail.sidebar")} title={t("detail.toggleSidebar")} onClick={onToggleSidebar} hideLabelWhenNarrow />
          <PanelToggle on={previewOpen} label={t("detail.preview")} title={t("detail.togglePreview")} onClick={onTogglePreview} />
        </div>
        <div className="flex items-center gap-2.5">
          {/* Below 1440px the size estimate hides, so the prompt name keeps its room. */}
          <span className="max-[1439px]:hidden" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", whiteSpace: "nowrap" }}>
            {t("detail.sizeEstimate", { tokens: tokenEstimate, chars: (chars / 1000).toFixed(1) })}
          </span>
          {actions}
        </div>
      </div>
    </div>
  );
}
