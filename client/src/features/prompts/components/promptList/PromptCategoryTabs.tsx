// The Prompt Library's area tabs (Chat, Voice, CRM, Social, Test, Reputation)
// plus Niche Words, and the Demo show/hide switch above the list.
import { useTranslation } from "react-i18next";
import { useScrollFadeX } from "@/hooks/useScrollFadeX";
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
  // Seven tabs do not fit beside the editor actions at laptop widths: the track scrolls
  // sideways with an edge fade instead of the actions overlapping it.
  const scrollRef = useScrollFadeX<HTMLDivElement>(value);
  return (
    <div ref={scrollRef} className="la-seg la-seg--main la-fade-x" role="tablist" aria-label={t("category.label")} style={{ minWidth: 0, maxWidth: "100%" }}>
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
              <span className="la-seg-count">{counts[id] ?? 0}</span>
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
      style={{ minHeight: 48, padding: "4px 8px 4px 14px", borderBottom: "1px solid var(--line)" }}
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
