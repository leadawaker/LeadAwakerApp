// The Prompt Library's list parts: the card, the compact icon rail and the
// group divider. The icon tile takes its area's color (promptCategories).
import { useTranslation } from "react-i18next";
import { Bot } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import { getPromptId } from "../../types";
import { CATEGORY_COLOR, categoryTint, isDemoPrompt, promptCategory } from "../../promptCategories";

type TFn = (key: string, opts?: any) => string;

export function formatRelativeTime(dateStr: string | null | undefined, t: TFn): string {
  if (!dateStr) return "";
  try {
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / 86_400_000);
    if (diffDays === 0) {
      const h = Math.floor(diffMs / 3_600_000);
      return h === 0 ? t("time.justNow") : t("time.hoursAgo", { count: h });
    }
    if (diffDays === 1) return t("time.yesterday");
    if (diffDays < 7) return t("time.daysAgo", { count: diffDays });
    if (diffDays < 30) return t("time.weeksAgo", { count: Math.floor(diffDays / 7) });
    return t("time.monthsAgo", { count: Math.floor(diffDays / 30) });
  } catch {
    return "";
  }
}

/** The small mono "Demo" tag on prompts that serve a demo. */
export function DemoChip() {
  const { t } = useTranslation("prompts");
  return (
    <span
      className="neu-inset-super-crisp"
      style={{
        fontFamily: "var(--mono)", fontSize: 8.5, fontWeight: 700, letterSpacing: "0.1em",
        textTransform: "uppercase", color: "var(--mute)", borderRadius: "var(--r-pill)",
        padding: "1px 6px", flexShrink: 0, lineHeight: "14px",
      }}
    >
      {t("demo.tag")}
    </span>
  );
}

export function PromptListCard({
  prompt,
  isActive,
  onClick,
  campaignName,
  accountName,
}: {
  prompt: any;
  isActive: boolean;
  onClick: () => void;
  campaignName?: string;
  accountName?: string;
}) {
  const { t } = useTranslation("prompts");
  const name = prompt.name || t("labels.untitled");
  const normalizedStatus = (prompt.status || "").toLowerCase().trim();
  const archived = normalizedStatus === "archived";
  const updatedAt = prompt.updatedAt || prompt.updated_at;
  const category = promptCategory(prompt);
  const accent = CATEGORY_COLOR[category];

  return (
    <div
      data-prompt-id={getPromptId(prompt)}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onClick()}
      style={{
        position: "relative",
        cursor: "pointer",
        borderRadius: "var(--r-surface)",
        padding: "9px 7px",
        display: "flex",
        gap: 9,
        alignItems: "flex-start",
        background: isActive ? "var(--card)" : "transparent",
        boxShadow: isActive ? "var(--sh-raised-crisp)" : "none",
        transition: "background-color 130ms, box-shadow 130ms",
      }}
      onMouseEnter={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = categoryTint(category);
      }}
      onMouseLeave={(e) => {
        if (!isActive) (e.currentTarget as HTMLDivElement).style.background = "transparent";
      }}
    >
      {isActive && (
        <div style={{
          position: "absolute", left: 0, top: 10, bottom: 10,
          width: 3, background: accent, borderRadius: "0 3px 3px 0",
        }} />
      )}
      <span style={{
        position: "relative", width: 34, height: 34, flexShrink: 0, borderRadius: "var(--r-surface)",
        display: "flex", alignItems: "center", justifyContent: "center",
        background: archived ? "var(--bg)" : accent,
        boxShadow: archived ? "var(--sh-inset-crisp)" : "none",
        color: archived ? "var(--mute-2)" : "var(--on-wine)",
        opacity: !isActive && !archived ? 0.7 : 1,
      }}>
        <Bot size={17} />
        {isActive && normalizedStatus === "active" && (
          <span style={{
            position: "absolute", bottom: 1, right: 1,
            width: 6, height: 6, borderRadius: "50%",
            background: "var(--good)", border: "1.5px solid var(--card)",
          }} />
        )}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: name, demo tag, date */}
        <div style={{ display: "flex", alignItems: "center", gap: 5, justifyContent: "space-between" }}>
          <span style={{
            fontSize: 13, fontWeight: 600, color: "var(--ink)",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
            flex: 1, minWidth: 0,
          }}>
            {name}
          </span>
          {isDemoPrompt(prompt) && <DemoChip />}
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", flexShrink: 0 }}>
            {formatRelativeTime(updatedAt, t)}
          </span>
        </div>
        {/* Row 2: campaign + account */}
        {(campaignName || accountName) && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 3, gap: 4 }}>
            {campaignName && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)",
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                flex: 1, minWidth: 0,
              }} title={campaignName}>
                {campaignName}
              </span>
            )}
            {accountName && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)",
                flexShrink: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                maxWidth: 110,
              }}>
                {accountName}
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** The list minimized to a column of icon tiles, full card details on hover. */
export function CompactPromptRail({
  items,
  selectedId,
  onSelect,
  getNames,
}: {
  items: any[];
  selectedId: number | null;
  onSelect: (prompt: any) => void;
  getNames: (p: any) => { campaignName?: string; accountName?: string };
}) {
  const { t } = useTranslation("prompts");
  return (
    <div style={{
      width: 52, flexShrink: 0, borderRight: "1px solid var(--line)",
      background: "var(--bg)", overflow: "hidden", display: "flex", flexDirection: "column",
    }}>
      <div style={{
        flex: 1, minHeight: 0, overflowY: "auto", padding: "8px 0", display: "flex",
        flexDirection: "column", gap: 6, alignItems: "center",
      }}>
        {items.map((p) => {
          const id = getPromptId(p);
          const isActive = selectedId === id;
          const pStatus = (p.status || "").toLowerCase().trim();
          const category = promptCategory(p);
          const accent = CATEGORY_COLOR[category];
          const tint = categoryTint(category);
          const { campaignName, accountName } = getNames(p);
          return (
            <Tooltip key={id}>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  onClick={() => onSelect(p)}
                  style={{
                    width: 34, height: 34, flexShrink: 0, borderRadius: "var(--r-surface)",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    cursor: "pointer", border: "none",
                    background: isActive ? tint : "var(--bg)",
                    boxShadow: isActive ? `0 0 0 2px ${accent}` : "var(--sh-inset-crisp)",
                    color: pStatus === "archived" && !isActive ? "var(--mute-2)" : accent,
                    opacity: !isActive && pStatus === "active" ? 0.55 : 1,
                    transition: "background-color 130ms, box-shadow 130ms",
                  }}
                  onMouseEnter={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = tint;
                  }}
                  onMouseLeave={(e) => {
                    if (!isActive) (e.currentTarget as HTMLButtonElement).style.background = "var(--bg)";
                  }}
                >
                  <Bot size={17} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-xs">
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold">{p.name || t("labels.untitled")}</div>
                  {isDemoPrompt(p) && <div className="text-muted-foreground">{t("demo.tag")}</div>}
                  {p.model && <div className="text-muted-foreground">{p.model}</div>}
                  {campaignName && <div className="text-muted-foreground">{campaignName}</div>}
                  {accountName && <div className="text-muted-foreground">{accountName}</div>}
                </div>
              </TooltipContent>
            </Tooltip>
          );
        })}
      </div>
    </div>
  );
}

/** Sticky-style divider between groups (label + count). */
export function PromptGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div data-group-header="true" style={{ display: "flex", alignItems: "center", gap: 9, padding: "14px 6px 7px" }}>
      <span style={{
        fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em",
        textTransform: "uppercase", color: "var(--mute-2)", fontWeight: 700,
      }}>
        {label}
      </span>
      <div style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)" }}>{count}</span>
    </div>
  );
}
