import { useMemo, useState, useEffect, useCallback } from "react";
import { List, LayoutGrid } from "lucide-react";

import { CrmShell } from "@/components/crm/CrmShell";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";

import { useTagsData } from "../hooks/useTagsData";
import { TagsToolbar } from "../components/TagsToolbar";
import { TagsInlineTable } from "../components/TagsInlineTable";
import { TagsCardView } from "../components/TagsCardView";
import { DeleteTagDialog } from "../components/DeleteTagDialog";

import type {
  TagSortOption,
  TagGroupOption,
  TagViewMode,
  TagAutoAppliedFilter,
  TagTableItem,
  EnrichedTag,
} from "../types";
import {
  resolveColor,
  VIEW_MODE_KEY,
  VISIBLE_COLS_KEY,
  DEFAULT_VISIBLE_COLS,
  TAG_TABLE_COLUMNS,
} from "../types";

/* ── Tab definitions ──────────────────────────────────────────────────────── */
const VIEW_TABS: TabDef[] = [
  { id: "list", label: "List", icon: List },
  { id: "cards", label: "Cards", icon: LayoutGrid },
];

/* ── Filter persistence key ───────────────────────────────────────────────── */
const FILTERS_KEY = "tags-filters-v1";

interface PersistedFilters {
  sortBy: TagSortOption;
  groupBy: TagGroupOption;
  filterCategories: string[];
  filterAutoApplied: TagAutoAppliedFilter;
  selectedAccountId: string;
  campaignId: string;
}

function readPersistedFilters(): Partial<PersistedFilters> {
  try {
    return JSON.parse(localStorage.getItem(FILTERS_KEY) ?? "{}");
  } catch {
    return {};
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   TagsPage — slim orchestrator
   ════════════════════════════════════════════════════════════════════════════ */

export default function TagsPage() {
  /* ── Data ───────────────────────────────────────────────────────────────── */
  const {
    tags,
    leads,
    campaigns,
    accounts,
    tagCounts,
    categoryOptions,
    accountNameMap,
    campaignNameMap,
    loading,
    error,
    fetchData,
    handleCreate,
    handleUpdate,
    handleBulkUpdate,
    handleDelete,
    handleBulkDelete,
    handleDuplicate,
  } = useTagsData();

  /* ── Clear topbar actions (tabs are inline) ─────────────────────────────── */
  const { clearTopbarActions } = useTopbarActions();
  useEffect(() => {
    clearTopbarActions();
  }, [clearTopbarActions]);

  /* ── View mode (persisted) ──────────────────────────────────────────────── */
  const [viewMode, setViewMode] = useState<TagViewMode>(() => {
    try {
      const stored = localStorage.getItem(VIEW_MODE_KEY);
      if (stored && (stored === "list" || stored === "cards")) return stored;
    } catch {
      /* ignore */
    }
    return "list";
  });

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_MODE_KEY, viewMode);
    } catch {
      /* ignore */
    }
  }, [viewMode]);

  /* ── Selection ──────────────────────────────────────────────────────────── */
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());

  /* ── Search (always visible, no toggle state) ───────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");

  /* ── Sort / Group / Filter / Account / Campaign (persisted) ─────────────── */
  const [sortBy, setSortBy] = useState<TagSortOption>(() => {
    const f = readPersistedFilters();
    return f.sortBy ?? "name_asc";
  });
  const [groupBy, setGroupBy] = useState<TagGroupOption>(() => {
    const f = readPersistedFilters();
    return f.groupBy ?? "category";
  });
  const [filterCategories, setFilterCategories] = useState<string[]>(() => {
    const f = readPersistedFilters();
    return Array.isArray(f.filterCategories) ? f.filterCategories : [];
  });
  const [filterAutoApplied, setFilterAutoApplied] = useState<TagAutoAppliedFilter>(() => {
    const f = readPersistedFilters();
    return f.filterAutoApplied ?? "all";
  });
  const [selectedAccountId, setSelectedAccountId] = useState<string>(() => {
    const f = readPersistedFilters();
    return f.selectedAccountId ?? "all";
  });
  const [campaignId, setCampaignId] = useState<string>(() => {
    const f = readPersistedFilters();
    return f.campaignId ?? "all";
  });

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /* ── Persist filters on change ──────────────────────────────────────────── */
  useEffect(() => {
    try {
      localStorage.setItem(
        FILTERS_KEY,
        JSON.stringify({
          sortBy,
          groupBy,
          filterCategories,
          filterAutoApplied,
          selectedAccountId,
          campaignId,
        }),
      );
    } catch {
      /* ignore */
    }
  }, [sortBy, groupBy, filterCategories, filterAutoApplied, selectedAccountId, campaignId]);

  /* ── Column visibility (persisted) ──────────────────────────────────────── */
  const [visibleCols, setVisibleCols] = useState<Set<string>>(() => {
    try {
      const stored = localStorage.getItem(VISIBLE_COLS_KEY);
      if (stored) {
        const arr = JSON.parse(stored);
        if (Array.isArray(arr) && arr.length > 0) return new Set(arr);
      }
    } catch {
      /* ignore */
    }
    return new Set(DEFAULT_VISIBLE_COLS);
  });

  useEffect(() => {
    try {
      localStorage.setItem(VISIBLE_COLS_KEY, JSON.stringify(Array.from(visibleCols)));
    } catch {
      /* ignore */
    }
  }, [visibleCols]);

  /* ── Dialog booleans ────────────────────────────────────────────────────── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<(typeof tags)[number] | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);

  /* ════════════════════════════════════════════════════════════════════════
     Computed / derived values
     ════════════════════════════════════════════════════════════════════════ */

  /* ── Leads scoped by account + campaign ─────────────────────────────────── */
  const filteredLeads = useMemo(() => {
    return leads
      .filter((l: any) => {
        if (selectedAccountId === "all") return true;
        const a = l.account_id ?? l.accounts_id ?? l.Accounts_id;
        return String(a) === selectedAccountId;
      })
      .filter((l: any) => {
        if (campaignId === "all") return true;
        const c = l.campaign_id ?? l.campaigns_id ?? l.Campaigns_id;
        return String(c) === campaignId;
      });
  }, [leads, selectedAccountId, campaignId]);

  /* ── Campaigns scoped by account ────────────────────────────────────────── */
  const campaignOptions = useMemo(() => {
    return campaigns.filter((c: any) => {
      if (selectedAccountId === "all") return true;
      const a = c.account_id ?? c.accounts_id ?? c.Accounts_id;
      return String(a) === selectedAccountId;
    });
  }, [campaigns, selectedAccountId]);

  /* ── Scoped tag counts (respects account/campaign filter on leads) ──────── */
  const scopedTagCounts = useMemo(() => {
    const map = new Map<string, number>();
    filteredLeads.forEach((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      if (Array.isArray(rawTags)) {
        rawTags.forEach((t: string) => {
          if (t) map.set(t, (map.get(t) ?? 0) + 1);
        });
      }
    });
    return map;
  }, [filteredLeads]);

  /* ── Table flat items (filter -> sort -> group) ─────────────────────────── */
  const tableFlatItems = useMemo((): TagTableItem[] => {
    let enriched: EnrichedTag[] = tags.map((tag) => ({
      ...tag,
      leadCount: scopedTagCounts.get(tag.name!) ?? 0,
      hexColor: resolveColor(tag.color),
    }));

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      enriched = enriched.filter((t) => t.name.toLowerCase().includes(q));
    }
    // Category filter
    if (filterCategories.length > 0) {
      enriched = enriched.filter((t) => {
        const cat = t.category
          ? t.category.charAt(0).toUpperCase() + t.category.slice(1)
          : "Uncategorized";
        return filterCategories.includes(cat);
      });
    }
    // Auto-applied filter
    if (filterAutoApplied === "yes") enriched = enriched.filter((t) => t.auto_applied);
    if (filterAutoApplied === "no") enriched = enriched.filter((t) => !t.auto_applied);
    // Account filter
    if (selectedAccountId !== "all") {
      enriched = enriched.filter((t) => {
        const a = t.account_id ?? t.Accounts_id;
        return a == null || String(a) === selectedAccountId;
      });
    }

    // Sort
    enriched.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":
          return (a.name ?? "").localeCompare(b.name ?? "");
        case "name_desc":
          return (b.name ?? "").localeCompare(a.name ?? "");
        case "count_desc":
          return b.leadCount - a.leadCount || (a.name ?? "").localeCompare(b.name ?? "");
        case "category_asc":
          return (
            (a.category ?? "zzz").localeCompare(b.category ?? "zzz") ||
            (a.name ?? "").localeCompare(b.name ?? "")
          );
        default:
          return 0;
      }
    });

    // No grouping
    if (groupBy === "none") return enriched.map((tag) => ({ kind: "tag" as const, tag }));

    // Group
    const grouped = new Map<string, EnrichedTag[]>();
    enriched.forEach((tag) => {
      const key =
        groupBy === "category"
          ? tag.category
            ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1)
            : "Uncategorized"
          : tag.color
            ? tag.color.charAt(0).toUpperCase() + tag.color.slice(1)
            : "No Color";
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tag);
    });

    const items: TagTableItem[] = [];
    Array.from(grouped.keys())
      .sort()
      .forEach((key) => {
        const g = grouped.get(key)!;
        items.push({ kind: "header", label: key, count: g.length });
        if (!collapsedGroups.has(key)) {
          g.forEach((tag) => items.push({ kind: "tag", tag }));
        }
      });
    return items;
  }, [
    tags,
    scopedTagCounts,
    searchQuery,
    filterCategories,
    filterAutoApplied,
    selectedAccountId,
    sortBy,
    groupBy,
    collapsedGroups,
  ]);

  /* ── Tag-only items (no headers) ────────────────────────────────────────── */
  const tagOnlyItems = useMemo(
    () =>
      tableFlatItems.filter(
        (i): i is Extract<TagTableItem, { kind: "tag" }> => i.kind === "tag",
      ),
    [tableFlatItems],
  );

  /* ── Category counts ────────────────────────────────────────────────────── */
  const categoryCounts = useMemo(() => {
    const m = new Map<string, number>();
    tagOnlyItems.forEach((i) => {
      const cat = i.tag.category
        ? i.tag.category.charAt(0).toUpperCase() + i.tag.category.slice(1)
        : "Uncategorized";
      m.set(cat, (m.get(cat) ?? 0) + 1);
    });
    return m;
  }, [tagOnlyItems]);

  /* ── Top-used tags (by lead count, top 5) ───────────────────────────────── */
  const topUsedTags = useMemo(
    () =>
      [...tagOnlyItems]
        .sort((a, b) => b.tag.leadCount - a.tag.leadCount)
        .slice(0, 5)
        .map((i) => i.tag),
    [tagOnlyItems],
  );

  /* ── Orphaned tag count (tags with 0 leads) ─────────────────────────────── */
  const orphanedTagCount = useMemo(
    () => tagOnlyItems.filter((i) => i.tag.leadCount === 0).length,
    [tagOnlyItems],
  );

  /* ── Selected tags as objects ────────────────────────────────────────────── */
  const selectedTags = useMemo(
    () => tags.filter((t) => selectedTagIds.has(t.id)),
    [tags, selectedTagIds],
  );

  /* ── Leads matching any selected tag ────────────────────────────────────── */
  const selectedLeads = useMemo(() => {
    if (selectedTagIds.size === 0) return [];
    const selectedTagNames = new Set(selectedTags.map((t) => t.name));
    return filteredLeads.filter((l: any) => {
      const rawTags = l.tags ?? l.Tags ?? [];
      return Array.isArray(rawTags) && rawTags.some((t: string) => selectedTagNames.has(t));
    });
  }, [selectedTagIds, selectedTags, filteredLeads]);

  /* ── Visible columns (computed) ─────────────────────────────────────────── */
  const visCols = useMemo(
    () => TAG_TABLE_COLUMNS.filter((c) => c.alwaysVisible || visibleCols.has(c.key)),
    [visibleCols],
  );

  /* ════════════════════════════════════════════════════════════════════════
     Handlers
     ════════════════════════════════════════════════════════════════════════ */

  const handleViewSwitch = useCallback((id: string) => {
    setViewMode(id as TagViewMode);
    setSelectedTagIds(new Set());
  }, []);

  const handleAccountChange = useCallback((id: string) => {
    setSelectedAccountId(id);
    setCampaignId("all");
  }, []);

  const toggleGroupCollapse = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  const toggleFilterCategory = useCallback((cat: string) => {
    setFilterCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  }, []);

  const handleRenameCategory = useCallback(
    async (oldName: string, newName: string) => {
      const tagsInCat = tags.filter((t) => {
        const cat = t.category
          ? t.category.charAt(0).toUpperCase() + t.category.slice(1)
          : "Uncategorized";
        return cat === oldName;
      });
      if (tagsInCat.length === 0) return;
      await handleBulkUpdate(
        tagsInCat.map((t) => t.id),
        "category",
        newName,
      );
    },
    [tags, handleBulkUpdate],
  );

  const handleOpenDeleteSingle = useCallback(
    (tag: (typeof tags)[number]) => {
      setDeletingTag(tag);
      setDeletingBulk(false);
      setDeleteDialogOpen(true);
    },
    [],
  );

  const handleOpenDeleteBulk = useCallback(() => {
    setDeletingTag(null);
    setDeletingBulk(true);
    setDeleteDialogOpen(true);
  }, []);

  const handleConfirmDelete = useCallback(async () => {
    if (deletingBulk) {
      await handleBulkDelete(Array.from(selectedTagIds));
      setSelectedTagIds(new Set());
    } else if (deletingTag) {
      await handleDelete(deletingTag.id);
      setSelectedTagIds((prev) => {
        const next = new Set(prev);
        next.delete(deletingTag.id);
        return next;
      });
    }
    setDeleteDialogOpen(false);
    setDeletingTag(null);
    setDeletingBulk(false);
  }, [deletingBulk, deletingTag, selectedTagIds, handleBulkDelete, handleDelete]);

  const handleDuplicateSelected = useCallback(async () => {
    const newIds = await handleDuplicate(Array.from(selectedTagIds));
    if (newIds.length > 0) setSelectedTagIds(new Set(newIds));
  }, [selectedTagIds, handleDuplicate]);

  /* ════════════════════════════════════════════════════════════════════════
     Early returns: error / loading
     ════════════════════════════════════════════════════════════════════════ */

  if (error && tags.length === 0 && !loading) {
    return (
      <CrmShell>
        <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />
      </CrmShell>
    );
  }

  if (loading) {
    return (
      <CrmShell>
        <div className="flex flex-col h-full" data-testid="tags-page">
          <div className="flex-1 min-h-0 flex flex-col bg-muted rounded-lg overflow-hidden">
            <div className="px-3.5 pt-5 pb-1 shrink-0">
              <div className="h-7 w-16 bg-card/70 rounded animate-pulse" />
            </div>
            <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-7 w-16 bg-card/70 rounded-full animate-pulse" />
              ))}
            </div>
            <div className="flex-1 px-3 pb-3 space-y-1.5">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="h-9 bg-card/70 rounded-xl animate-pulse" />
              ))}
            </div>
          </div>
        </div>
      </CrmShell>
    );
  }

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */

  const isFilterActive = filterCategories.length > 0 || filterAutoApplied !== "all";
  const filterCount = filterCategories.length + (filterAutoApplied !== "all" ? 1 : 0);

  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="tags-page">
        <div className="flex-1 min-h-0 flex flex-col bg-muted rounded-lg overflow-hidden">
          {/* ── Title ──────────────────────────────────────────────────────── */}
          <div className="px-3.5 pt-5 pb-1 shrink-0">
            <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
              Tags
            </h2>
          </div>

          {/* ── Toolbar row ────────────────────────────────────────────────── */}
          <div className="px-3 pt-1.5 pb-3 shrink-0 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
            <ViewTabBar
              tabs={VIEW_TABS}
              activeId={viewMode}
              onTabChange={handleViewSwitch}
            />

            <TagsToolbar
              searchQuery={searchQuery}
              onSearchQueryChange={setSearchQuery}
              sortBy={sortBy}
              onSortByChange={setSortBy}
              groupBy={groupBy}
              onGroupByChange={setGroupBy}
              filterCategories={filterCategories}
              filterAutoApplied={filterAutoApplied}
              onToggleFilterCategory={toggleFilterCategory}
              onFilterAutoAppliedChange={setFilterAutoApplied}
              isFilterActive={isFilterActive}
              filterCount={filterCount}
              categoryOptions={categoryOptions}
              visibleCols={visibleCols}
              onVisibleColsChange={setVisibleCols}
              selectedTagIds={selectedTagIds}
              tagOnlyCount={tagOnlyItems.length}
              onCreate={handleCreate}
              onDuplicate={handleDuplicateSelected}
              onOpenDeleteBulk={handleOpenDeleteBulk}
              onClearSelection={() => setSelectedTagIds(new Set())}
              accounts={accounts}
              campaigns={campaignOptions}
              selectedAccountId={selectedAccountId}
              onAccountChange={handleAccountChange}
              campaignId={campaignId}
              onCampaignChange={setCampaignId}
              accountNameMap={accountNameMap}
            />
          </div>

          {/* ── Content ────────────────────────────────────────────────────── */}
          <div className="flex-1 min-h-0 overflow-hidden">
            {viewMode === "list" ? (
              <TagsInlineTable
                flatItems={tableFlatItems}
                tagOnlyItems={tagOnlyItems}
                visCols={visCols}
                selectedTagIds={selectedTagIds}
                onSelectedTagIdsChange={setSelectedTagIds}
                collapsedGroups={collapsedGroups}
                onToggleGroupCollapse={toggleGroupCollapse}
                accounts={accounts}
                campaigns={campaigns}
                accountNameMap={accountNameMap}
                campaignNameMap={campaignNameMap}
                onUpdate={handleUpdate}
                onBulkUpdate={handleBulkUpdate}
                onOpenDeleteSingle={handleOpenDeleteSingle}
                searchQuery={searchQuery}
                isFilterActive={isFilterActive}
              />
            ) : (
              <TagsCardView
                tagOnlyItems={tagOnlyItems}
                selectedTagIds={selectedTagIds}
                onSelectedTagIdsChange={setSelectedTagIds}
                accountNameMap={accountNameMap}
                campaignNameMap={campaignNameMap}
                searchQuery={searchQuery}
                isFilterActive={isFilterActive}
              />
            )}
          </div>
        </div>

        {/* ── Dialogs ───────────────────────────────────────────────────────── */}
        <DeleteTagDialog
          open={deleteDialogOpen}
          onOpenChange={(open) => {
            setDeleteDialogOpen(open);
            if (!open) {
              setDeletingTag(null);
              setDeletingBulk(false);
            }
          }}
          deletingTag={deletingTag}
          deletingBulk={deletingBulk}
          selectedCount={selectedTagIds.size}
          onConfirm={handleConfirmDelete}
        />
      </div>
    </CrmShell>
  );
}
