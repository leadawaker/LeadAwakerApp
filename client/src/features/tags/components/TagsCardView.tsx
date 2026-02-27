/* ════════════════════════════════════════════════════════════════════════════
   TagsCardView — grid of tag cards with stagger animation
   ════════════════════════════════════════════════════════════════════════════ */

import { useCallback } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { EnrichedTag } from "../types";

/* ── Props ──────────────────────────────────────────────────────────────── */

interface TagsCardViewProps {
  tagOnlyItems: { kind: "tag"; tag: EnrichedTag }[];
  selectedTagIds: Set<number>;
  onSelectedTagIdsChange: (ids: Set<number>) => void;
  accountNameMap: Map<string, string>;
  campaignNameMap: Map<string, string>;
  searchQuery: string;
  isFilterActive: boolean;
}

/* ── Stagger animation variants (matches LeadsCardView) ─────────────────── */

const staggerContainerVariants = {
  hidden: {},
  visible: (count: number) => ({
    transition: {
      staggerChildren: Math.min(1 / Math.max(count, 1), 0.08),
    },
  }),
};

const staggerItemVariants = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.25, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

/* ════════════════════════════════════════════════════════════════════════════
   Component
   ════════════════════════════════════════════════════════════════════════════ */

export function TagsCardView({
  tagOnlyItems,
  selectedTagIds,
  onSelectedTagIdsChange,
  accountNameMap,
  campaignNameMap,
  searchQuery,
  isFilterActive,
}: TagsCardViewProps) {
  /* ── Selection handler ────────────────────────────────────────────────── */
  const handleCardClick = useCallback(
    (tagId: number, e: React.MouseEvent) => {
      if (e.ctrlKey || e.metaKey) {
        // Toggle individual card in multi-select
        const next = new Set(selectedTagIds);
        if (next.has(tagId)) next.delete(tagId);
        else next.add(tagId);
        onSelectedTagIdsChange(next);
      } else {
        // Single select / deselect
        if (selectedTagIds.size === 1 && selectedTagIds.has(tagId)) {
          onSelectedTagIdsChange(new Set());
        } else {
          onSelectedTagIdsChange(new Set([tagId]));
        }
      }
    },
    [selectedTagIds, onSelectedTagIdsChange],
  );

  /* ── Empty state ──────────────────────────────────────────────────────── */
  if (tagOnlyItems.length === 0) {
    if (searchQuery) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <DataEmptyState
            variant="search"
            title="No tags match your search"
            description={`No tags found matching "${searchQuery}". Try a different search term.`}
          />
        </div>
      );
    }
    if (isFilterActive) {
      return (
        <div className="flex-1 flex items-center justify-center p-6">
          <DataEmptyState
            variant="tags"
            title="No tags match the current filters"
            description="Try adjusting or clearing your filters to see more tags."
          />
        </div>
      );
    }
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <DataEmptyState
          variant="tags"
          title="No tags available"
          description="No tags available. Create one to get started."
        />
      </div>
    );
  }

  /* ── Grid ──────────────────────────────────────────────────────────────── */
  return (
    <div className="h-full overflow-y-auto">
      <motion.div
        className="grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 p-4"
        variants={staggerContainerVariants}
        initial="hidden"
        animate="visible"
        custom={tagOnlyItems.length}
      >
        {tagOnlyItems.map(({ tag }) => {
          const isSelected = selectedTagIds.has(tag.id);

          return (
            <motion.div
              key={tag.id}
              variants={staggerItemVariants}
              className={cn(
                "rounded-2xl p-3.5 cursor-pointer transition-colors",
                isSelected
                  ? "bg-highlight-selected"
                  : "bg-card hover:bg-popover",
              )}
              onClick={(e) => handleCardClick(tag.id, e)}
            >
              {/* Top: color dot + name */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="h-3 w-3 rounded-full shrink-0 ring-1 ring-black/10"
                  style={{ backgroundColor: tag.hexColor }}
                />
                <span className="text-[13px] font-semibold text-foreground truncate">
                  {tag.name}
                </span>
              </div>

              {/* Category badge */}
              {tag.category && (
                <span className="inline-block text-[10px] font-medium text-muted-foreground bg-background/60 rounded-full px-2 py-0.5 capitalize mb-2">
                  {tag.category}
                </span>
              )}

              {/* Bottom: lead count + auto badge */}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[11px] font-medium tabular-nums text-foreground/50">
                  {tag.leadCount} lead{tag.leadCount !== 1 ? "s" : ""}
                </span>
                {tag.auto_applied && (
                  <span className="text-[9px] font-bold uppercase tracking-wide bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 px-1.5 py-0.5 rounded-full">
                    Auto
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
