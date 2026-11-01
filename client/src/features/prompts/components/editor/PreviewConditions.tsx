// Preview conditions: one picker per {{#if}} variable this prompt really uses,
// offering the values found in its text. A pick changes the preview only and
// saves nothing. Niche words can be previewed from another niche too.
import { useTranslation } from "react-i18next";
import { SlidersHorizontal } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PromptCondition } from "../../utils/promptVariables";

const ACTUAL = "__actual__";
const fieldStyle = { fontSize: 12, color: "var(--ink)", borderRadius: "var(--r-flush)", padding: "4px 6px", border: "none" } as const;

export function PreviewConditions({
  conditions, actual, overrides, onOverride, showNiche, campaignNiche, nicheOverride, niches, onNicheChange, iconOnly,
}: {
  conditions: PromptCondition[];
  /** What each variable resolves to in the picked context, before any pick here. */
  actual: Record<string, string | null | undefined>;
  overrides: Record<string, string>;
  onOverride: (name: string, value: string | null) => void;
  /** The prompt uses niche words, so the niche picker applies. */
  showNiche: boolean;
  campaignNiche: string;
  nicheOverride: string;
  niches: string[];
  onNicheChange: (niche: string) => void;
  /** Tight column: the button keeps its icon and count. */
  iconOnly?: boolean;
}) {
  const { t } = useTranslation("prompts");
  if (conditions.length === 0 && !showNiche) return null;

  const valueLabel = (name: string, v: string) => {
    if (v === "") return t("preview.emptyValue");
    return name === "lead_stage" ? t(`preview.cond.stage.${v}`, { defaultValue: v }) : v;
  };
  const picked = Object.keys(overrides).length + (nicheOverride ? 1 : 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="la-btn la-btn--soft shrink-0"
          style={{ height: 26, padding: "0 9px", display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11.5 }}
          title={t("preview.conditionsTitle")}
          aria-label={t("preview.conditionsTitle")}
        >
          <SlidersHorizontal size={12} />
          {iconOnly ? (picked > 0 ? picked : null) : picked > 0 ? t("preview.conditionsCount", { count: picked }) : t("preview.conditions")}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-3">
        <p style={{ fontSize: 12.5, fontWeight: 700, color: "var(--ink)" }}>{t("preview.conditionsTitle")}</p>
        <p style={{ fontSize: 11, color: "var(--mute)", margin: "2px 0 10px" }}>{t("preview.conditionsHint")}</p>
        <div className="flex flex-col gap-2.5">
          {conditions.map(({ name, values }) => (
            <label key={name} className="flex flex-col gap-1">
              <span style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wine)" }}>{name}</span>
              <select
                className="neu-inset-super-crisp outline-none cursor-pointer"
                style={fieldStyle}
                value={name in overrides ? overrides[name] : ACTUAL}
                onChange={(e) => onOverride(name, e.target.value === ACTUAL ? null : e.target.value)}
              >
                <option value={ACTUAL}>{t("preview.actualValue", { value: valueLabel(name, String(actual[name] ?? "")) })}</option>
                {values.map((v) => <option key={v} value={v}>{valueLabel(name, v)}</option>)}
              </select>
            </label>
          ))}
          {showNiche && (
            <label className="flex flex-col gap-1">
              <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("preview.cond.niche")}</span>
              <select
                className="neu-inset-super-crisp outline-none cursor-pointer"
                style={fieldStyle}
                value={nicheOverride}
                onChange={(e) => onNicheChange(e.target.value)}
              >
                <option value="">{t("preview.actualValue", { value: campaignNiche || t("preview.cond.nicheDefault") })}</option>
                {niches.filter((n) => n !== campaignNiche).map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
