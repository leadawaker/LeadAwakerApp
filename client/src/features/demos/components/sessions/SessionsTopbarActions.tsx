import { useTranslation } from "react-i18next";
import { ArrowUpDown, Filter, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ExpandingSearch, TopbarIconButton } from "@/components/crm/primitives";
import {
  DEFAULT_SORT,
  MENU_SORT_KEYS,
  isFilterActive,
  withSortKey,
  type SortDir,
  type SortKey,
} from "../../sessionsView";
import { TOUCH_ROW, TOUCH_TOPBAR } from "../../touchTargets";
import { SessionsFilterMenu } from "./SessionsFilterMenu";
import type { SessionsState } from "./useSessionsState";

const DIRS: SortDir[] = ["asc", "desc"];

/**
 * The Sessions tab's part of the PageTopbar `right` slot, in order: the labelled wine + New Demo,
 * search, filter and sort. The Sort menu and the table's column headers drive the same sort, so
 * the cards view (which has no headers) can be sorted too. The Table | Cards switch sits in the
 * left group (SessionsViewSwitch).
 */
export function SessionsTopbarActions({ state, clients }: {
  state: SessionsState;
  clients: { niche: string; label: string }[];
}) {
  const { t } = useTranslation("demos");
  const { sort, setSort } = state;

  return (
    <>
      <button
        type="button"
        className={`la-btn la-btn--wine h-8 shrink-0 ${TOUCH_ROW}`}
        onClick={() => state.setPanel({ kind: "create" })}
        data-testid="sessions-new-demo"
      >
        <Plus size={14} />
        {t("sessions.newDemo")}
      </button>

      <ExpandingSearch value={state.search} onChange={state.setSearch} placeholder={t("sessions.searchPlaceholder")} />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton label={t("sessions.filter")} active={isFilterActive(state.filters)} className={TOUCH_TOPBAR}>
            <Filter className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <SessionsFilterMenu filters={state.filters} onChange={state.setFilters} clients={clients} />
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <TopbarIconButton
            label={t("sessions.sort")}
            active={sort.key !== DEFAULT_SORT.key || sort.dir !== DEFAULT_SORT.dir}
            className={TOUCH_TOPBAR}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("sessions.sort")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sort.key} onValueChange={(k) => setSort(withSortKey(sort, k as SortKey))}>
            {MENU_SORT_KEYS.map((k) => (
              <DropdownMenuRadioItem key={k} value={k} className={`text-[12px] ${TOUCH_ROW}`}>
                {t(`table.${k}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={sort.dir} onValueChange={(d) => setSort({ ...sort, dir: d as SortDir })}>
            {DIRS.map((d) => (
              <DropdownMenuRadioItem key={d} value={d} className={`text-[12px] ${TOUCH_ROW}`}>
                {t(`listView.direction.${d}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}
