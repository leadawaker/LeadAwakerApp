import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { GroupByOption, SortByOption } from "./LeadsCardView";
import type { VirtualListItem } from "./LeadsCardView";

// ── Re-export so callers don't need two imports ──
export type { GroupByOption, SortByOption };

// ── Helpers duplicated here to avoid circular deps ──
function getLeadIdLocal(lead: Record<string, any>): number {
  return lead.Id ?? lead.id ?? 0;
}
function getFullNameLocal(lead: Record<string, any>): string {
  return lead.full_name || [lead.first_name, lead.last_name].filter(Boolean).join(" ") || "Unknown";
}
function getScoreLocal(lead: Record<string, any>): number {
  return Number(lead.lead_score ?? lead.leadScore ?? lead.Lead_Score ?? 0);
}
function getStatusLocal(lead: Record<string, any>): string {
  return lead.conversion_status || lead.Conversion_Status || "";
}

function getDateGroupLabel(dateStr: string | null | undefined, t: (key: string) => string): string {
  if (!dateStr) return t("time.noActivity");
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return t("time.today");
    if (diff === 1) return t("time.yesterday");
    if (diff < 7)   return t("time.thisWeek");
    if (diff < 30)  return t("time.thisMonth");
    if (diff < 90)  return t("time.last3Months");
    return t("time.older");
  } catch { return t("time.noActivity"); }
}

const STATUS_GROUP_ORDER = ["New", "Contacted", "Responded", "Multiple Responses", "Qualified", "Booked", "Lost", "DND"];

export interface UseLeadsFiltersOptions {
  leads: Record<string, any>[];
  listSearch: string;
  groupBy: GroupByOption;
  sortBy: SortByOption;
  filterStatus: string[];
  filterTags: string[];
  leadTagsInfo: Map<number, { name: string; color: string }[]>;
  campaignsById?: Map<number, { name: string; accountId: number | null; bookingMode?: string | null }>;
  accountsById?: Map<number, string>;
  onSortByChange: (v: SortByOption) => void;
  onToggleFilterStatus: (s: string) => void;
  onToggleFilterTag: (t: string) => void;
}

export interface UseLeadsFiltersReturn {
  // Local filter state (not lifted to parent)
  filterAccount: string;
  filterCampaign: string;
  tagSearchInput: string;
  upcomingCallsOnly: boolean;
  setFilterAccount: (v: string) => void;
  setFilterCampaign: (v: string) => void;
  setTagSearchInput: (v: string) => void;
  setUpcomingCallsOnly: (v: boolean) => void;

  // Derived data
  flatItems: VirtualListItem[];
  availableAccounts: { id: string; name: string }[];
  availableCampaigns: { id: string; name: string }[];
  isFilterActive: boolean;

  // Reset handler
  handleFilterReset: () => void;
}

export function useLeadsFilters({
  leads,
  listSearch,
  groupBy,
  sortBy,
  filterStatus,
  filterTags,
  leadTagsInfo,
  campaignsById,
  accountsById,
  onSortByChange,
  onToggleFilterStatus,
  onToggleFilterTag,
}: UseLeadsFiltersOptions): UseLeadsFiltersReturn {
  const { t } = useTranslation("leads");

  const [filterAccount, setFilterAccount] = useState<string>("");
  const [filterCampaign, setFilterCampaign] = useState<string>("");
  const [tagSearchInput, setTagSearchInput] = useState<string>("");
  const [upcomingCallsOnly, setUpcomingCallsOnly] = useState<boolean>(() => {
    try { return localStorage.getItem("leads_upcoming_calls_only") === "true"; } catch {} return false;
  });

  const handleSetUpcomingCallsOnly = useCallback((v: boolean) => {
    setUpcomingCallsOnly(v);
    try { localStorage.setItem("leads_upcoming_calls_only", String(v)); } catch {}
  }, []);

  const availableAccounts = useMemo(() => {
    if (!accountsById || accountsById.size === 0) return [];
    const seen = new Set<string>();
    const result: { id: string; name: string }[] = [];
    leads.forEach((l) => {
      const id = String(l.Accounts_id || l.account_id || l.accounts_id || "");
      if (id && !seen.has(id)) {
        seen.add(id);
        const name = accountsById.get(Number(id)) || `Account ${id}`;
        result.push({ id, name });
      }
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, accountsById]);

  const availableCampaigns = useMemo(() => {
    const campaignIds = new Set<number>();
    leads.forEach((l) => {
      if (filterAccount && String(l.Accounts_id || l.account_id || l.accounts_id || "") !== filterAccount) return;
      const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
      if (cId) campaignIds.add(cId);
    });
    const result: { id: string; name: string }[] = [];
    campaignIds.forEach((cId) => {
      const info = campaignsById?.get(cId);
      result.push({ id: String(cId), name: info?.name || `Campaign ${cId}` });
    });
    return result.sort((a, b) => a.name.localeCompare(b.name));
  }, [leads, campaignsById, filterAccount]);

  const flatItems = useMemo((): VirtualListItem[] => {
    const dateGroupOrder = [
      t("time.today"), t("time.yesterday"), t("time.thisWeek"),
      t("time.thisMonth"), t("time.last3Months"), t("time.older"), t("time.noActivity"),
    ];
    // 1. Text search
    let filtered = leads;
    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      filtered = filtered.filter((l) =>
        String(l.full_name || "").toLowerCase().includes(q) ||
        String(l.first_name || "").toLowerCase().includes(q) ||
        String(l.last_name || "").toLowerCase().includes(q) ||
        String(l.email || "").toLowerCase().includes(q) ||
        String(l.phone || "").toLowerCase().includes(q)
      );
    }

    // 2. Status filter
    if (filterStatus.length > 0) {
      filtered = filtered.filter((l) => filterStatus.includes(getStatusLocal(l)));
    }

    // 3. Tag filter
    if (filterTags.length > 0) {
      filtered = filtered.filter((l) => {
        const tags = leadTagsInfo.get(getLeadIdLocal(l)) || [];
        return filterTags.some((ft) => tags.some((tg) => tg.name === ft));
      });
    }

    // 3b. Account filter
    if (filterAccount) {
      filtered = filtered.filter((l) =>
        String(l.Accounts_id || l.account_id || l.accounts_id || "") === filterAccount
      );
    }

    // 3c. Campaign filter
    if (filterCampaign) {
      filtered = filtered.filter((l) =>
        String(l.Campaigns_id || l.campaigns_id || l.campaignsId || "") === filterCampaign
      );
    }

    // 3d. Upcoming calls only
    if (upcomingCallsOnly) {
      const now = new Date();
      filtered = filtered.filter((l) => {
        if (getStatusLocal(l) !== "Booked") return true;
        const d = l.booked_call_date || l.bookedCallDate;
        if (!d) return true;
        return new Date(d) >= now;
      });
    }

    // 4. Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "name_asc":   return getFullNameLocal(a).localeCompare(getFullNameLocal(b));
        case "name_desc":  return getFullNameLocal(b).localeCompare(getFullNameLocal(a));
        case "score_desc": return getScoreLocal(b) - getScoreLocal(a);
        case "score_asc":  return getScoreLocal(a) - getScoreLocal(b);
        default: {
          const da = a.last_interaction_at || a.last_message_received_at || a.created_at || "";
          const db = b.last_interaction_at || b.last_message_received_at || b.created_at || "";
          return db.localeCompare(da);
        }
      }
    });

    // 5. Group and flatten
    if (groupBy === "none") {
      return filtered.map((l) => ({ kind: "lead", lead: l, tags: leadTagsInfo.get(getLeadIdLocal(l)) || [] }));
    }

    const buckets = new Map<string, Record<string, any>[]>();

    filtered.forEach((l) => {
      let key: string;
      if (groupBy === "date") {
        const d = l.last_interaction_at || l.last_message_received_at || l.last_message_sent_at || null;
        key = getDateGroupLabel(d, t);
      } else if (groupBy === "status") {
        key = getStatusLocal(l) || "Unknown";
      } else if (groupBy === "campaign") {
        const cId = Number(l.Campaigns_id || l.campaigns_id || l.campaignsId || 0);
        key = (cId && campaignsById?.get(cId)?.name) || l.Campaign || l.campaign || l.campaign_name || t("group.noCampaign");
      } else {
        const tags = leadTagsInfo.get(getLeadIdLocal(l)) || [];
        key = tags[0]?.name || t("group.untagged");
      }
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(l);
    });

    const allBucketKeys = Array.from(buckets.keys());
    const orderedKeys = groupBy === "status"
      ? STATUS_GROUP_ORDER.filter((k) => buckets.has(k)).concat(allBucketKeys.filter((k) => !STATUS_GROUP_ORDER.includes(k)))
      : groupBy === "date"
      ? dateGroupOrder.filter((k) => buckets.has(k))
      : allBucketKeys.sort();

    const result: VirtualListItem[] = [];
    orderedKeys.forEach((key) => {
      const group = buckets.get(key);
      if (!group || group.length === 0) return;
      const headerLabel = groupBy === "status"
        ? t(`kanban.stageLabels.${key.replace(/ /g, "")}`, key)
        : key;
      result.push({ kind: "header", label: headerLabel, count: group.length });
      group.forEach((l) => result.push({ kind: "lead", lead: l, tags: leadTagsInfo.get(getLeadIdLocal(l)) || [] }));
    });

    return result;
  }, [leads, listSearch, groupBy, sortBy, filterStatus, filterTags, filterAccount, filterCampaign, leadTagsInfo, campaignsById, upcomingCallsOnly, t]);

  const isFilterActive = filterStatus.length > 0 || filterTags.length > 0 || !!filterAccount || !!filterCampaign || upcomingCallsOnly;

  const handleFilterReset = useCallback(() => {
    filterStatus.forEach((s) => onToggleFilterStatus(s));
    filterTags.forEach((tag) => onToggleFilterTag(tag));
    setFilterAccount("");
    setFilterCampaign("");
    if (sortBy !== "recent") onSortByChange("recent");
  }, [filterStatus, filterTags, onToggleFilterStatus, onToggleFilterTag, sortBy, onSortByChange]);

  return {
    filterAccount,
    filterCampaign,
    tagSearchInput,
    upcomingCallsOnly,
    setFilterAccount,
    setFilterCampaign,
    setTagSearchInput,
    setUpcomingCallsOnly: handleSetUpcomingCallsOnly,
    flatItems,
    availableAccounts,
    availableCampaigns,
    isFilterActive,
    handleFilterReset,
  };
}
