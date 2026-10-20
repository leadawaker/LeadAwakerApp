import { useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GroupByOption, SortByOption, VirtualListItem } from "./LeadsCardView";
import type { ConversationType } from "./conversationType";
import type { LeadsFacets } from "../hooks/usePagedLeads";
import { buildServerRows } from "../lib/serverRows";

export type { GroupByOption, SortByOption };

// List-view rows for the card list. Filtering, sorting and grouping run on the
// server (GET /api/leads/page); this only turns the loaded page into rows and
// exposes the filter options (from the server facets, so they cover every lead).

export interface ListFilterState {
  filterAccount: string;
  filterCampaign: string;
  filterType: ConversationType[];
  setFilterAccount: (v: string) => void;
  setFilterCampaign: (v: string) => void;
  toggleFilterType: (v: ConversationType) => void;
  clearFilterType: () => void;
}

export interface UseLeadsFiltersOptions extends ListFilterState {
  leads: Record<string, any>[];
  groupBy: GroupByOption;
  groups: { key: string; count: number }[];
  sortBy: SortByOption;
  filterStatus: string[];
  filterTags: string[];
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  facets?: LeadsFacets | null;
  onSortByChange: (v: SortByOption) => void;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
}

export function useLeadsFilters(o: UseLeadsFiltersOptions) {
  const { t } = useTranslation("leads");

  const flatItems = useMemo(
    (): VirtualListItem[] => buildServerRows(o.leads, o.groupBy, o.groups, o.leadTagsInfo, t),
    [o.leads, o.groupBy, o.groups, o.leadTagsInfo, t],
  );

  const availableAccounts = useMemo(
    () => (o.facets?.accounts ?? []).map((a) => ({ id: String(a.id), name: a.name })),
    [o.facets],
  );
  const availableCampaigns = useMemo(
    () => (o.facets?.campaigns ?? [])
      .filter((c) => !o.filterAccount || String(c.accountId ?? "") === o.filterAccount)
      .map((c) => ({ id: String(c.id), name: c.name })),
    [o.facets, o.filterAccount],
  );

  const isFilterActive = o.filterStatus.length > 0 || o.filterTags.length > 0 || !!o.filterAccount
    || !!o.filterCampaign || o.filterType.length > 0;

  const { filterStatus, filterTags, onToggleFilterStatus, onToggleFilterTag, setFilterAccount, setFilterCampaign, clearFilterType, sortBy, onSortByChange } = o;
  const handleFilterReset = useCallback(() => {
    filterStatus.forEach((s) => onToggleFilterStatus(s));
    filterTags.forEach((tag) => onToggleFilterTag(tag));
    setFilterAccount("");
    setFilterCampaign("");
    clearFilterType();
    if (sortBy !== "recent") onSortByChange("recent");
  }, [filterStatus, filterTags, onToggleFilterStatus, onToggleFilterTag, setFilterAccount, setFilterCampaign, clearFilterType, sortBy, onSortByChange]);

  return {
    filterAccount: o.filterAccount,
    filterCampaign: o.filterCampaign,
    filterType: o.filterType,
    toggleFilterType: o.toggleFilterType,
    setFilterAccount: o.setFilterAccount,
    setFilterCampaign: o.setFilterCampaign,
    flatItems,
    availableAccounts,
    availableCampaigns,
    isFilterActive,
    handleFilterReset,
  };
}
