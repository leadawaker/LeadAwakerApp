import { useTranslation } from "react-i18next";
import { ArrowUpDown, Filter, LayoutGrid, Plus, RefreshCw, Table2 } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { isFilterActive, type SessionSort } from "../../sessionsView";
import { TOUCH_ROW, TOUCH_TOPBAR } from "../../touchTargets";
import { SessionsFilterMenu } from "./SessionsFilterMenu";
import type { SessionsState } from "./useSessionsState";

const SORTS: SessionSort[] = ["newest", "prospect", "company", "activity"];

/**
 * The Sessions tab's part of the PageTopbar `right` slot, in order: search, filter, sort,
 * the table / folders switch, refresh, and the wine + New demo last.
 */
export function SessionsTopbarActions({ state, clients, onRefresh, refreshing }: {
  state: SessionsState;
  clients: { niche: string; label: string }[];
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const { t } = useTranslation("demos");
  const views = [
    { id: "table", label: t("sessions.viewTable"), Icon: Table2 },
    { id: "folders", label: t("sessions.viewFolders"), Icon: LayoutGrid },
  ] as const;

  return (
    <>
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
          <TopbarIconButton label={t("sessions.sort")} active={state.sort !== "newest"} className={TOUCH_TOPBAR}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
          </TopbarIconButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("sessions.sort")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup value={state.sort} onValueChange={(v) => state.setSort(v as SessionSort)}>
            {SORTS.map((s) => (
              <DropdownMenuRadioItem key={s} value={s} className={`text-[12px] ${TOUCH_ROW}`}>
                {t(`sessions.sortBy.${s}`)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>

      {views.map(({ id, label, Icon }) => (
        <TopbarIconButton
          key={id}
          label={label}
          aria-pressed={state.view === id}
          className={cn(TOUCH_TOPBAR, state.view === id && "on")}
          onClick={() => state.setView(id)}
        >
          <Icon className="h-4 w-4 shrink-0" />
        </TopbarIconButton>
      ))}

      <TopbarIconButton label={t("actions.refresh")} className={TOUCH_TOPBAR} onClick={onRefresh}>
        <RefreshCw className={cn("h-4 w-4 shrink-0", refreshing && "animate-spin")} />
      </TopbarIconButton>

      <TopbarIconButton label={t("sessions.newDemo")} primary className={TOUCH_TOPBAR} onClick={() => state.setPanel({ kind: "create" })}>
        <Plus className="h-4 w-4 shrink-0" />
      </TopbarIconButton>
    </>
  );
}
