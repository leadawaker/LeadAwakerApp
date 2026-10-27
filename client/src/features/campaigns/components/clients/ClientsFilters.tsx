import { useState } from "react";
import { useTranslation } from "react-i18next";
import { SearchPill } from "@/components/ui/search-pill";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { LANGS } from "./clientDisplay";
import type { LangFilter, PersonaFilters, SourceFilter } from "./personaFilters";

const LANG_OPTIONS: LangFilter[] = ["all", ...LANGS];
const SOURCE_OPTIONS: SourceFilter[] = ["all", "website", "manual"];
// Radix SelectItem cannot carry value="", so "any niche" travels as this sentinel.
const ANY_CATEGORY = "__any__";

/**
 * The persona list's filter row: language, niche (category), source and search.
 * Controlled by the tab, which owns the state and applies `personaMatches`.
 */
export function ClientsFilters({ filters, onChange, categories, counts }: {
  filters: PersonaFilters;
  onChange: (next: PersonaFilters) => void;
  categories: string[];
  /** How many personas each language filter keeps. */
  counts: Record<LangFilter, number>;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const [searchOpen, setSearchOpen] = useState(false);
  const set = (patch: Partial<PersonaFilters>) => onChange({ ...filters, ...patch });
  const sourceLabel = (s: SourceFilter) =>
    s === "all" ? td("personas.sourceAll") : s === "website" ? td("personas.sourceWebsite") : td("personas.sourceManual");

  return (
    <div className="dp-filters">
      <div className="la-seg la-seg--pill" role="tablist" aria-label={t("clients.filterLabel")}>
        {LANG_OPTIONS.map((f) => (
          <button
            key={f}
            type="button"
            role="tab"
            aria-selected={filters.lang === f}
            className={cn("la-seg-btn", filters.lang === f && "on")}
            onClick={() => set({ lang: f })}
            data-testid={`personas-filter-${f}`}
          >
            {f === "all" ? t("clients.filterAll") : f.toUpperCase()}{" "}
            <span className="dp-seg-count" style={{ opacity: 0.7 }}>{counts[f]}</span>
          </button>
        ))}
      </div>

      <Select
        value={filters.category || ANY_CATEGORY}
        onValueChange={(v) => set({ category: v === ANY_CATEGORY ? "" : v })}
      >
        <SelectTrigger
          className="la-input dp-input dp-cat-filter h-auto"
          aria-label={t("clients.categoryLabel", "Category")}
          data-testid="personas-filter-category"
        >
          <span>{filters.category || td("personas.allNiches")}</span>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ANY_CATEGORY}>{td("personas.allNiches")}</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c} value={c}>{c}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="la-seg la-seg--pill" role="tablist" aria-label={td("personas.sourceLabel")}>
        {SOURCE_OPTIONS.map((s) => (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={filters.source === s}
            className={cn("la-seg-btn", filters.source === s && "on")}
            onClick={() => set({ source: s })}
            data-testid={`personas-source-${s}`}
          >
            {sourceLabel(s)}
          </button>
        ))}
      </div>

      <div className="dp-search">
        <SearchPill
          value={filters.search}
          onChange={(search) => set({ search })}
          open={searchOpen || !!filters.search}
          onOpenChange={setSearchOpen}
          placeholder={t("clients.searchPlaceholder", "Search personas...")}
        />
      </div>
    </div>
  );
}
