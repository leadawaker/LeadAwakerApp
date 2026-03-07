import { useMemo, useState, useCallback, useEffect, type MutableRefObject } from "react";
import { useTranslation } from "react-i18next";
import { Tag, X, Trash2 } from "lucide-react";

import { useCampaignTags } from "../hooks/useCampaignTags";
import { TagsInlineTable } from "@/features/tags/components/TagsInlineTable";
import { DeleteTagDialog } from "@/features/tags/components/DeleteTagDialog";
import type { TagTableItem, EnrichedTag, TagSortOption, TagAutoAppliedFilter } from "@/features/tags/types";
import { resolveColor, TAG_TABLE_COLUMNS } from "@/features/tags/types";
import type { TagGroupOption } from "@/features/tags/types";

/* ════════════════════════════════════════════════════════════════════════════
   CampaignTagsSection — Tags table embedded inside a Campaign detail panel
   ════════════════════════════════════════════════════════════════════════════ */

type CreateTagData = { name: string; color: string; category?: string };

interface CampaignTagsSectionProps {
  campaignId: number;
  campaignName: string;
  /* toolbar state — controlled from parent */
  searchQuery: string;
  sortBy: TagSortOption;
  groupBy: TagGroupOption;
  filterAutoApplied: TagAutoAppliedFilter;
  filterCategory: string;
  /** Ref the parent uses to call handleCreate from CampaignTagsSection's hook */
  createRef: MutableRefObject<((data: CreateTagData) => Promise<void>) | null>;
  onCategoriesChange?: (cats: string[]) => void;
}

/* ── Column config (drop account + campaign — they're implied) ──────────── */
const CAMPAIGN_TAG_COLS = TAG_TABLE_COLUMNS.filter(
  (c) => c.key !== "account" && c.key !== "campaign",
);

/* ════════════════════════════════════════════════════════════════════════ */

export function CampaignTagsSection({
  campaignId,
  campaignName,
  searchQuery,
  sortBy,
  groupBy,
  filterAutoApplied,
  filterCategory,
  createRef,
  onCategoriesChange,
}: CampaignTagsSectionProps) {
  const { t } = useTranslation("campaigns");
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
  const [selectedTagIds, setSelectedTagIds] = useState<Set<number>>(new Set());
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  /* ── Expose handleCreate to parent via ref ──────────────────────────── */
  useEffect(() => {
    createRef.current = handleCreate;
  }, [handleCreate, createRef]);

  /* ── Delete dialog state ────────────────────────────────────────────── */
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingTag, setDeletingTag] = useState<any | null>(null);
  const [deletingBulk, setDeletingBulk] = useState(false);

  /* ── Computed filter state ──────────────────────────────────────────── */
  const isFilterActive = filterAutoApplied !== "all" || !!filterCategory;

  /* ── Unique categories from tags — notify parent ────────────────────── */
  const uniqueCategories = useMemo(() => {
    const cats = new Set<string>();
    tags.forEach((t) => {
      if (t.category) cats.add(t.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b));
  }, [tags]);

  useEffect(() => {
    onCategoriesChange?.(uniqueCategories);
  }, [uniqueCategories, onCategoriesChange]);

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

  /* ── Build flat items (enrich -> filter -> search -> sort -> group) ── */
  const { flatItems, tagOnlyItems } = useMemo(() => {
    let enriched: EnrichedTag[] = tags.map((tag) => ({
      ...tag,
      leadCount: tagCounts.get(tag.name!) ?? 0,
      hexColor: resolveColor(tag.color),
    }));

    if (filterAutoApplied === "yes") {
      enriched = enriched.filter((t) => t.auto_applied === true);
    } else if (filterAutoApplied === "no") {
      enriched = enriched.filter((t) => !t.auto_applied);
    }

    if (filterCategory) {
      const fc = filterCategory.toLowerCase();
      enriched = enriched.filter((t) => (t.category ?? "").toLowerCase() === fc);
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      enriched = enriched.filter((t) => t.name.toLowerCase().includes(q));
    }

    enriched.sort((a, b) => {
      switch (sortBy) {
        case "name_asc":   return (a.name ?? "").localeCompare(b.name ?? "");
        case "name_desc":  return (b.name ?? "").localeCompare(a.name ?? "");
        case "count_desc": return b.leadCount - a.leadCount || (a.name ?? "").localeCompare(b.name ?? "");
        case "category_asc": return (
          (a.category ?? "zzz").localeCompare(b.category ?? "zzz") ||
          (a.name ?? "").localeCompare(b.name ?? "")
        );
        default: return 0;
      }
    });

    if (groupBy !== "none") {
      const groups = new Map<string, EnrichedTag[]>();
      enriched.forEach((tag) => {
        let key: string;
        if (groupBy === "category") {
          key = tag.category ? tag.category.charAt(0).toUpperCase() + tag.category.slice(1) : t("tagsPage.uncategorized");
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
        <div className="text-[12px] text-muted-foreground animate-pulse">{t("tags.loadingTags")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full flex items-center justify-center px-6">
        <div className="text-center space-y-2">
          <p className="text-[12px] text-red-500 font-medium">{t("tags.failedToLoadTags")}</p>
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
          <p className="text-[13px] font-medium text-foreground">{t("tags.noTagsYet")}</p>
          <p className="text-[12px] text-muted-foreground">{t("tags.createTagsDesc")}</p>
        </div>
      </div>
    );
  }

  /* ── Main render ────────────────────────────────────────────────────── */
  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* ── Selection actions bar ───────────────────────────────────────── */}
      {selectedTagIds.size > 0 && (
        <div className="shrink-0 px-3 py-2 flex items-center gap-1.5 border-b border-border/20">
          <span className="text-[12px] font-medium text-foreground/60 tabular-nums">
            {t("tags.selected", { count: selectedTagIds.size })}
          </span>
          <button
            className="h-7 w-7 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            onClick={() => setSelectedTagIds(new Set())}
            title={t("tags.clearSelection")}
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
            {t("toolbar.delete")}
          </button>
          <span className="ml-auto text-[11px] text-muted-foreground tabular-nums font-medium">
            {t("tags.tagCount", { count: tags.length })}
          </span>
        </div>
      )}

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
