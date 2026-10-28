import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Filter } from "lucide-react";
import { DropdownMenu, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ExpandingSearch, TopbarIconButton } from "@/components/crm/primitives";
import { TOUCH_TOPBAR } from "@/features/demos/touchTargets";
import { useDemoClients } from "../../api/demoClientsApi";
import { GroupBySwitch } from "./GroupBySwitch";
import { PersonaFilterMenu } from "./PersonaFilterMenu";
import { hasMenuFilters, languageCounts, personaCategories } from "./personaFilters";
import type { PersonaView } from "./usePersonaView";

/**
 * The Demo personas tab's part of the Demos PageTopbar `right` slot, in the order the
 * Sessions tab uses: search, the Filter menu, then the Category | Date switch.
 * `view` is the page's one usePersonaView() call, shared with the list.
 */
export function ClientsTopbarActions({ view }: { view: PersonaView }) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { data: clients } = useDemoClients();
  const counts = useMemo(() => languageCounts(clients ?? []), [clients]);
  const categories = useMemo(() => personaCategories(clients ?? []), [clients]);
  const { filters, setFilters } = view;

  return (
    <>
      <ExpandingSearch
        value={filters.search}
        onChange={(search) => setFilters((f) => ({ ...f, search }))}
        placeholder={t("clients.searchPlaceholder", "Search personas...")}
        testId="personas-search"
      />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={td("personaList.filter.button")} active={hasMenuFilters(filters)} className={TOUCH_TOPBAR} data-testid="personas-filter-button">
            <Filter className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <PersonaFilterMenu filters={filters} onChange={setFilters} categories={categories} counts={counts} />
      </DropdownMenu>

      <GroupBySwitch value={view.groupBy} onChange={view.setGroupBy} />
    </>
  );
}
