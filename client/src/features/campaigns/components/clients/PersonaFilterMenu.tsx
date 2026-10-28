import { useTranslation } from "react-i18next";
import {
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { TOUCH_ROW } from "@/features/demos/touchTargets";
import { LANGS } from "./clientDisplay";
import type { LangFilter, PersonaFilters, SourceFilter } from "./personaFilters";

const LANG_OPTIONS: LangFilter[] = ["all", ...LANGS];
const SOURCE_OPTIONS: SourceFilter[] = ["all", "website", "manual"];

const ITEM = `text-[12px] ${TOUCH_ROW}`;
const LABEL = "text-[10px] uppercase tracking-widest text-muted-foreground";

// A pick must not close the menu: filters are usually combined.
const keepOpen = (e: Event) => e.preventDefault();

// Radix radio items cannot carry value="", so "any category" travels as a sentinel.
const ANY_CATEGORY = "__any__";

/**
 * The Filter menu of the Demos topbar for the persona list: language, source and
 * category, as a dropdown menu. The trigger is the caller's.
 */
export function PersonaFilterMenu({ filters, onChange, categories, counts }: {
  filters: PersonaFilters;
  onChange: (next: PersonaFilters) => void;
  categories: string[];
  /** How many personas each language filter keeps. */
  counts: Record<LangFilter, number>;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const sourceLabel = (s: SourceFilter) =>
    s === "all" ? td("personas.sourceAll") : s === "website" ? td("personas.sourceWebsite") : td("personas.sourceManual");

  return (
    <DropdownMenuContent align="end" className="w-60" data-testid="personas-filter-menu">
      <DropdownMenuLabel className={LABEL}>{td("personaList.filter.language")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={filters.lang} onValueChange={(lang) => onChange({ ...filters, lang: lang as LangFilter })}>
        {LANG_OPTIONS.map((l) => (
          <DropdownMenuRadioItem key={l} value={l} className={ITEM} onSelect={keepOpen} data-testid={`personas-filter-${l}`}>
            <span className="flex-1">{l === "all" ? t("clients.filterAll") : t(`clients.langName.${l}`)}</span>
            <span className="ml-3 text-muted-foreground tabular-nums">{counts[l]}</span>
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />
      <DropdownMenuLabel className={LABEL}>{td("personas.sourceLabel")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={filters.source} onValueChange={(source) => onChange({ ...filters, source: source as SourceFilter })}>
        {SOURCE_OPTIONS.map((s) => (
          <DropdownMenuRadioItem key={s} value={s} className={ITEM} onSelect={keepOpen} data-testid={`personas-source-${s}`}>
            {sourceLabel(s)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>

      <DropdownMenuSeparator />
      <DropdownMenuLabel className={LABEL}>{t("clients.categoryLabel", "Category")}</DropdownMenuLabel>
      <div className="max-h-48 overflow-y-auto">
        <DropdownMenuRadioGroup
          value={filters.category || ANY_CATEGORY}
          onValueChange={(v) => onChange({ ...filters, category: v === ANY_CATEGORY ? "" : v })}
        >
          <DropdownMenuRadioItem value={ANY_CATEGORY} className={ITEM} onSelect={keepOpen} data-testid="personas-filter-category">
            {td("personas.allNiches")}
          </DropdownMenuRadioItem>
          {categories.map((c) => (
            <DropdownMenuRadioItem key={c} value={c} className={ITEM} onSelect={keepOpen}>
              <span className="truncate">{c}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </div>
    </DropdownMenuContent>
  );
}
