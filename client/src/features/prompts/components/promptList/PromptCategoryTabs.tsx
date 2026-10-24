// The Prompt Library's area tabs (Chat, Voice, CRM, Social, Test, Reputation)
// plus Niche Words, and the Demo show/hide switch above the list.
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { PROMPT_CATEGORIES, type PromptListTab } from "../../promptCategories";

export function PromptCategoryTabs({
  value,
  onChange,
  counts,
}: {
  value: PromptListTab;
  onChange: (tab: PromptListTab) => void;
  counts: Record<string, number>;
}) {
  const { t } = useTranslation("prompts");
  const tabs: PromptListTab[] = [...PROMPT_CATEGORIES, "niche"];
  return (
    <div className="la-seg" role="tablist" aria-label={t("category.label")} style={{ flexShrink: 0 }}>
      {tabs.map((id) => {
        const on = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={on}
            className={`la-seg-btn${on ? " on" : ""}`}
            onClick={() => onChange(id)}
            data-testid={`prompts-tab-${id}`}
          >
            {id === "niche" ? t("vocabulary.title") : t(`category.${id}`)}
            {id !== "niche" && (
              <span style={{
                fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700,
                color: on ? "var(--wine)" : "var(--mute-2)",
                background: on ? "var(--wine-tint)" : "var(--bg)",
                borderRadius: "var(--r-pill)", padding: "1px 7px", marginLeft: 5,
              }}>
                {counts[id] ?? 0}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** The strip above the list: how many prompts the tab shows, and the Demo switch. */
export function PromptListStrip({
  shown,
  demoCount,
  showDemo,
  onShowDemoChange,
}: {
  shown: number;
  demoCount: number;
  showDemo: boolean;
  onShowDemoChange: (v: boolean) => void;
}) {
  const { t } = useTranslation("prompts");
  return (
    <div
      className="flex items-center gap-2 shrink-0"
      style={{ padding: "8px 14px 6px", borderBottom: "1px solid var(--line)" }}
    >
      <span className="eyebrow eyebrow-sm" style={{ color: "var(--mute-2)" }}>
        {t("toolbar.promptCount", { count: shown })}
      </span>
      <label className="ml-auto flex items-center gap-2 cursor-pointer" style={{ fontSize: 11, color: "var(--mute)" }}>
        {t("demo.show", { count: demoCount })}
        <Switch checked={showDemo} onCheckedChange={onShowDemoChange} aria-label={t("demo.showLabel")} />
      </label>
    </div>
  );
}
