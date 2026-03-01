import { useMemo, useState, useCallback } from "react";
import { Plus, Search, Tag, X, ArrowUpDown, Filter, Layers, Trash2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

import { useCampaignTags } from "../hooks/useCampaignTags";
import { TagsInlineTable } from "@/features/tags/components/TagsInlineTable";
import { DeleteTagDialog } from "@/features/tags/components/DeleteTagDialog";
import { ColorPicker } from "@/features/tags/components/ColorPicker";
import type { TagTableItem, EnrichedTag, TagSortOption, TagAutoAppliedFilter } from "@/features/tags/types";
import { resolveColor, TAG_TABLE_COLUMNS, TAG_SORT_LABELS, TAG_GROUP_LABELS } from "@/features/tags/types";
import type { TagGroupOption } from "@/features/tags/types";

/* ════════════════════════════════════════════════════════════════════════════
   CampaignTagsSection — Tags table embedded inside a Campaign detail panel
   ════════════════════════════════════════════════════════════════════════════ */

interface CampaignTagsSectionProps {
  campaignId: number;
  campaignName: string;
}

/* ── Column config (drop account + campaign — they're implied) ──────────── */
const CAMPAIGN_TAG_COLS = TAG_TABLE_COLUMNS.filter(
  (c) => c.key !== "account" && c.key !== "campaign",
);

/* ── Toolbar pill styles ────────────────────────────────────────────────── */
const pill =
  "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors";
const pillActive =
  "inline-flex items-center gap-1.5 h-9 px-3 rounded-full text-[12px] font-medium border border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo transition-colors";

/* ── Sort options ───────────────────────────────────────────────────────── */
const sortOptions: { value: TagSortOption; label: string }[] = [
  { value: "name_asc", label: "Name A \u2192 Z" },
  { value: "name_desc", label: "Name Z \u2192 A" },
  { value: "count_desc", label: "Lead Count \u2193" },
  { value: "category_asc", label: "Category A \u2192 Z" },
];

/* ── Group options ──────────────────────────────────────────────────────── */
const groupOptions: { value: TagGroupOption; label: string }[] = [
  { value: "category", label: "Category" },
  { value: "color", label: "Color" },
  { value: "none", label: "None" },
];

/* ════════════════════════════════════════════════════════════════════════ */

export function CampaignTagsSection({ campaignId, campaignName }: CampaignTagsSectionProps) {
  const {
    tags,
    tagCounts,
    loading,
    error,
    handleCreate,
    handleUpdate,
    handleBulkUpdate,
    handleDelete,
    handleBulkDelete,
  } = useCampaignTags(campaignId, campaignName);

  /* ── Local UI state ─────────────────────────────────────────────────── */
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<TagSortOption>("name_asc");
  const [groupBy, setGroupBy] = useState<TagGroupOption>("category");
  const [filterAutoApplied, setFilterAutoApplied] = useState<TagAutoAppliedFilter>("all");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /* ── Delete dialog state ────────────────────────────────────────────── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<any | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);

  /* ── Create popover state ───────────────────────────────────────────── */
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState("blue");
  const [newCategory, setNewCategory] = useState("");

  /* ── Computed filter state ──────────────────────────────────────────── */
  const isFilterActive = filterAutoApplied !== "all" || !!filterCategory;
  const filterCount = (filterAutoApplied !== "all" ? 1 : 0) + (filterCategory ? 1 : 0);
  const isSortNonDefault = sortBy !== "name_asc";

  /* ── Unique categories from tags ────────────────────────────────────── */
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    tags.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [tags]);

  /* ── Clear all filters ──────────────────────────────────────────────── */
  const clearFilters = useCallback(() => {
    setFilterAutoApplied("all");
    setFilterCategory("");
  }, []);

  /* ── Group collapse toggle ──────────────────────────────────────────── */
  const handleToggleGroupCollapse = useCallback((label: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      return next;
    });
  }, []);

  /* ── Delete single (opens dialog) ───────────────────────────────────── */
  const openDeleteSingle = useCallback((tag: any) => {
    setDeletingTag(tag);
    setDeletingBulk(false);
    setDeleteDialogOpen(true);
  }, []);

  /* ── Confirm delete ─────────────────────────────────────────────────── */
  const confirmDelete = useCallback(async () => {
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
  }, [deletingBulk, deletingTag, selectedTagIds, handleBulkDelete, handleDelete]);

  /* ── Create tag ─────────────────────────────────────────────────────── */
  const submitCreate = useCallback(async () => {
    if (!newName.trim()) return;
    try {
      await handleCreate({
        name: newName.trim(),
        color: newColor,
        category: newCategory.trim() || undefined,
      });
      setNewName("");
      setNewColor("blue");
      setNewCategory("");
      setCreateOpen(false);
    } catch {
      /* error toast handled by hook */
    }
  }, [newName, newColor, newCategory, handleCreate]);

  /* ── Build flat items (enrich -> filter -> search -> sort -> group) ── */
  const { flatItems, tagOnlyItems } = useMemo(() => {
    let enriched: EnrichedTag[] = tags.map((tag) => ({
      ...tag,
      leadCount: tagCounts.get(tag.name!) ?? 0,
      hexColor: resolveColor(tag.color),
    }));

    // Auto-applied filter
    if (filterAutoApplied === "yes") {
      enriched = enriched.filter((t) => t.auto_applied === true);
    } else if (filterAutoApplied === "no") {
      enriched = enriched.filter((t) => !t.auto_applied);
    }

    // Category filter
    if (filterCategory) {
      const fc = filterCategory.toLowerCase();
      enriched = enriched.filter((t) => (t.category ?? "").toLowerCase() === fc);
    }

    // Search filter
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      enriched = enriched.filter((t) => t.name.toLowerCase().includes(q));
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

    // Build grouped flat list
    if (groupBy !== "none") {
      const groups = new Map<string, EnrichedTag[]>();
      enriched.forEach((tag) => {
        let key: string;
        if (groupBy === "category") {
          key = tag.category ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1) : "Uncategorized";
        } else {
          key = tag.color || "gray";
        }
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key)!.push(tag);
      });

      const flat: TagTableItem[] = [];
      const sortedKeys = Array.from(groups.keys()).sort();
      for (const key of sortedKeys) {
        const items = groups.get(key)!;
        flat.push({ kind: "header", label: key, count: items.length });
        items.forEach((tag) => flat.push({ kind: "tag", tag }));
      }
      return { flatItems: flat, tagOnlyItems: flat.filter((i): i is { kind: "tag"; tag: EnrichedTag } => i.kind === "tag") };
    }

    const flat: TagTableItem[] = enriched.map((tag) => ({ kind: "tag" as const, tag }));
    const tagOnly = flat.filter((i): i is { kind: "tag"; tag: EnrichedTag } => i.kind === "tag");

    return { flatItems: flat, tagOnlyItems: tagOnly };
  }, [tags, tagCounts, searchQuery, sortBy, groupBy, filterAutoApplied, filterCategory]);

  /* ── Loading / error states ─────────────────────────────────────────── */
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-[12px] text-muted-foreground animate-pulse">Loading tags...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center space-y-2">
          <p className="text-[12px] text-red-500 font-medium">Failed to load tags</p>
          <p className="text-[11px] text-muted-foreground">{error.message}</p>
        </div>
      </div>
    );
  }

  /* ── Empty state ────────────────────────────────────────────────────── */
  if (tags.length === 0 && !searchQuery) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 px-6">
        <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
          <Tag className="h-5 w-5 text-muted-foreground" />
        </div>
        <div className="text-center space-y-1">
          <p className="text-[13px] font-medium text-foreground">No tags yet</p>
          <p className="text-[12px] text-muted-foreground">
            Create tags to organize leads in this campaign.
          </p>
        </div>
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <button className={pill}>
              <Plus className="h-4 w-4" />
              Create Tag
            </button>
          </PopoverTrigger>
          <PopoverContent align="center" className="w-72 p-4 space-y-3">
            <p className="text-[12px] font-semibold text-foreground">New Tag</p>
            <input
              type="text"
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }}
              className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              autoFocus
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <input
              type="text"
              placeholder="Category (optional)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitCreate} disabled={!newName.trim()}>
                Create
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Compact toolbar ────────────────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2 flex items-center gap-1.5 border-b border-border/20">
        {/* Search — always visible */}
        <div className="relative flex items-center">
          <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-9 w-[200px] pl-8 pr-3 text-[12px] rounded-full border border-black/[0.125] bg-transparent outline-none focus:border-brand-indigo/50 transition-colors"
          />
        </div>

        {/* Add tag */}
        <Popover open={createOpen} onOpenChange={setCreateOpen}>
          <PopoverTrigger asChild>
            <button className={pill}>
              <Plus className="h-4 w-4" />
            </button>
          </PopoverTrigger>
          <PopoverContent align="start" className="w-72 p-4 space-y-3">
            <p className="text-[12px] font-semibold text-foreground">New Tag</p>
            <input
              type="text"
              placeholder="Tag name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") submitCreate(); }}
              className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
              autoFocus
            />
            <ColorPicker value={newColor} onChange={setNewColor} />
            <input
              type="text"
              placeholder="Category (optional)"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            />
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button size="sm" onClick={submitCreate} disabled={!newName.trim()}>
                Create
              </Button>
            </div>
          </PopoverContent>
        </Popover>

        {/* Sorting dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={isSortNonDefault ? pillActive : pill}>
              <ArrowUpDown className="h-4 w-4" />
              Sorting
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-44">
            {sortOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setSortBy(opt.value)}
                className="text-[12px] flex items-center justify-between"
              >
                {opt.label}
                {sortBy === opt.value && <Check className="h-4 w-4 text-brand-indigo" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Filter dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={isFilterActive ? pillActive : pill}>
              <Filter className="h-4 w-4" />
              Filter
              {isFilterActive && ` \u00b7 ${filterCount}`}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52">
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Auto-Applied</div>
            {(["all", "yes", "no"] as const).map((val) => (
              <DropdownMenuItem
                key={val}
                onClick={() => setFilterAutoApplied(val)}
                className="text-[12px] flex items-center justify-between"
              >
                {val === "all" ? "All" : val === "yes" ? "Yes" : "No"}
                {filterAutoApplied === val && <Check className="h-4 w-4 text-brand-indigo" />}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category</div>
            <DropdownMenuItem
              onClick={() => setFilterCategory("")}
              className="text-[12px] flex items-center justify-between"
            >
              All Categories
              {!filterCategory && <Check className="h-4 w-4 text-brand-indigo" />}
            </DropdownMenuItem>
            {uniqueCategories.map((cat) => (
              <DropdownMenuItem
                key={cat}
                onClick={() => setFilterCategory(cat)}
                className="text-[12px] flex items-center justify-between"
              >
                {cat}
                {filterCategory.toLowerCase() === cat.toLowerCase() && <Check className="h-4 w-4 text-brand-indigo" />}
              </DropdownMenuItem>
            ))}
            {isFilterActive && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={clearFilters} className="text-[12px] text-destructive">
                  Clear all filters
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Group dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={groupBy !== "none" ? pillActive : pill}>
              <Layers className="h-4 w-4" />
              Group
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            {groupOptions.map((opt) => (
              <DropdownMenuItem
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className="text-[12px] flex items-center justify-between"
              >
                {opt.label}
                {groupBy === opt.value && <Check className="h-4 w-4 text-brand-indigo" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Tag count - show when nothing selected */}
        {selectedTagIds.size === 0 && (
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums font-medium">
            {tags.length} tag{tags.length !== 1 ? "s" : ""}
          </span>
        )}

        {/* Selection actions */}
        {selectedTagIds.size > 0 && (
          <div className="ml-auto inline-flex items-center gap-1.5">
            <span className="text-[12px] font-medium text-foreground/60 tabular-nums">
              {selectedTagIds.size} selected
            </span>
            <button
              className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setSelectedTagIds(new Set())}
              title="Clear selection"
            >
              <X className="h-3.5 w-3.5" />
            </button>
            <button
              className="h-9 px-3 rounded-full border border-red-200 text-red-600 hover:bg-red-50 inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors"
              onClick={() => {
                setDeletingBulk(true);
                setDeletingTag(null);
                setDeleteDialogOpen(true);
              }}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </button>
          </div>
        )}
      </div>

      {/* ── Table ──────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <TagsInlineTable
          flatItems={flatItems}
          tagOnlyItems={tagOnlyItems}
          visCols={CAMPAIGN_TAG_COLS}
          selectedTagIds={selectedTagIds}
          onSelectedTagIdsChange={setSelectedTagIds}
          collapsedGroups={collapsedGroups}
          onToggleGroupCollapse={handleToggleGroupCollapse}
          accounts={[]}
          campaigns={[]}
          accountNameMap={new Map()}
          campaignNameMap={new Map()}
          onUpdate={handleUpdate}
          onBulkUpdate={handleBulkUpdate}
          onOpenDeleteSingle={openDeleteSingle}
          searchQuery={searchQuery}
          isFilterActive={isFilterActive || !!searchQuery}
        />
      </div>

      {/* ── Delete dialog ──────────────────────────────────────────────── */}
      <DeleteTagDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        deletingTag={deletingTag}
        deletingBulk={deletingBulk}
        selectedCount={selectedTagIds.size}
        onConfirm={confirmDelete}
      />
    </div>
  );
}
