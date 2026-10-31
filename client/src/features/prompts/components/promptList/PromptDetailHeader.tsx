// The selected prompt's header bar: icon, editable name, status, campaign,
// area (category) and the Demo toggle on the left; on the right the section / panel /
// preview toggles, with the size estimate and the edit actions under them.
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Bot, Check, Eye, EyeOff } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { CampaignForPreview } from "../../utils/resolveVariables";
import { CATEGORY_COLOR, PROMPT_CATEGORIES, isDemoPrompt, promptCategory, type PromptCategory } from "../../promptCategories";

const metaText = { fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute-2)" } as const;

function ToggleButton({ on, highlight, onClick, title, children }: {
  on: boolean;
  /** Wine text: the section has content. */
  highlight?: boolean;
  onClick: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn("la-btn", on ? "la-btn--inset" : "la-btn--soft")}
      style={{
        height: 28, padding: "0 10px", display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0, fontSize: 12,
        color: highlight ? "var(--wine)" : on ? "var(--ink)" : "var(--mute-2)",
      }}
      title={title}
      aria-label={title}
      aria-pressed={on}
    >
      {children}
    </button>
  );
}

export function PromptDetailHeader({
  prompt,
  promptId,
  nameField,
  campaignLabel,
  accountName,
  campaigns,
  tokenEstimate,
  onStatusChange,
  onCampaignChange,
  onPatch,
  showSystemMessage,
  onToggleSystemMessage,
  showNotes,
  onToggleNotes,
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
  campaignLabel: string;
  accountName?: string | null;
  campaigns: CampaignForPreview[];
  tokenEstimate: number;
  onStatusChange: (status: "active" | "archived") => void;
  onCampaignChange: (campaignId: string) => void;
  /** Saves fields straight to the row (category, isDemo). */
  onPatch: (fields: { category?: PromptCategory; isDemo?: boolean }) => void;
  showSystemMessage: boolean;
  onToggleSystemMessage: () => void;
  showNotes: boolean;
  onToggleNotes: () => void;
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
      flexShrink: 0, minHeight: 84, padding: "12px 18px",
      borderRadius: "var(--r-surface)", boxShadow: "var(--sh-raised-crisp)",
      display: "flex", alignItems: "center", gap: 14, background: "var(--paper)",
    }}>
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <span style={{
          width: 44, height: 44, flexShrink: 0, borderRadius: "var(--r-surface)",
          display: "flex", alignItems: "center", justifyContent: "center",
          background: CATEGORY_COLOR[category], color: "var(--on-wine)",
        }}>
          <Bot size={20} />
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 min-w-0">
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

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="min-w-0 truncate text-left" style={{ ...metaText, cursor: "pointer", background: "transparent", border: "none", padding: 0 }}>
                  #{promptId} · {campaignLabel}{accountName ? ` · ${accountName}` : ""}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52 max-h-60 overflow-y-auto">
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  {t("labels.campaign")}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem className="text-[12px]" onClick={() => onCampaignChange("")}>
                  {t("labels.noCampaign")}
                  {!campaignId && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {campaigns.map((c) => (
                  <DropdownMenuItem key={c.id} className="text-[12px]" onClick={() => onCampaignChange(String(c.id))}>
                    <span className="truncate flex-1">{c.name}</span>
                    {campaignId === String(c.id) && <Check className="h-3 w-3 ml-1 shrink-0" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-end gap-2 shrink-0">
        <div className="flex items-center gap-2">
        <ToggleButton
          on={showSystemMessage}
          highlight={!!(prompt.systemMessage || prompt.system_message)}
          onClick={onToggleSystemMessage}
          title={t("detail.toggleSystemMessage")}
        >
          <EyeOff size={13} /> <span className="max-[1439px]:hidden">{t("detail.systemMsg")}</span>
        </ToggleButton>
        <ToggleButton on={showNotes} highlight={!!prompt.notes} onClick={onToggleNotes} title={t("detail.toggleNotes")}>
          <EyeOff size={13} /> <span className="max-[1439px]:hidden">{t("detail.notes")}</span>
        </ToggleButton>
        <ToggleButton on={showSidebar} onClick={onToggleSidebar} title={t("detail.toggleSidebar")}>
          {showSidebar ? <Eye size={13} /> : <EyeOff size={13} />} <span className="max-[1439px]:hidden">{t("detail.sidebar")}</span>
        </ToggleButton>
        <ToggleButton on={previewOpen} onClick={onTogglePreview} title={t("detail.togglePreview")}>
          {previewOpen ? <EyeOff size={13} /> : <Eye size={13} />} <span className="max-[1439px]:hidden">{t("detail.preview")}</span>
        </ToggleButton>
        </div>
        <div className="flex items-center gap-2.5">
          {/* Below 1440px (no page zoom since 2026-10-29) the size estimate hides and the
              toggles show only their icon, so the prompt name keeps its room. */}
          <span className="max-[1439px]:hidden" style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)", whiteSpace: "nowrap" }}>
            {t("detail.sizeEstimate", { tokens: tokenEstimate, chars: (chars / 1000).toFixed(1) })}
          </span>
          {actions}
        </div>
      </div>
    </div>
  );
}
