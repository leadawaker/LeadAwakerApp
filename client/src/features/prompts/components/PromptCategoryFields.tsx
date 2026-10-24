// Create / edit form row: the prompt's area (which library tab it lives on)
// and whether it serves a demo.
import { useTranslation } from "react-i18next";
import { Switch } from "@/components/ui/switch";
import { PROMPT_CATEGORIES, type PromptCategory } from "../promptCategories";

export function PromptCategoryFields({
  category,
  onCategoryChange,
  isDemo,
  onIsDemoChange,
  selectClassName,
}: {
  category: PromptCategory;
  onCategoryChange: (c: PromptCategory) => void;
  isDemo: boolean;
  onIsDemoChange: (v: boolean) => void;
  selectClassName: string;
}) {
  const { t } = useTranslation("prompts");
  return (
    <div className="grid grid-cols-2 gap-4">
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground" htmlFor="prompt-category">
          {t("category.label")}
        </label>
        <select
          id="prompt-category"
          className={selectClassName}
          value={category}
          onChange={(e) => onCategoryChange(e.target.value as PromptCategory)}
          data-testid="select-prompt-category"
        >
          {PROMPT_CATEGORIES.map((c) => <option key={c} value={c}>{t(`category.${c}`)}</option>)}
        </select>
      </div>
      <div className="space-y-1">
        <label className="text-sm font-medium text-foreground" htmlFor="prompt-is-demo">
          {t("demo.tag")}
        </label>
        <div className="flex items-center gap-2 h-9">
          <Switch id="prompt-is-demo" checked={isDemo} onCheckedChange={onIsDemoChange} />
          <span className="text-xs text-muted-foreground">{t("demo.fieldHint")}</span>
        </div>
      </div>
    </div>
  );
}
