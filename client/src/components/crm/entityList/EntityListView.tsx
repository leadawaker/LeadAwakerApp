import * as React from "react";
import { cn } from "@/lib/utils";
import { ListCard, GroupHeader } from "@/components/crm/primitives";
import type { EntityListRow } from "./useEntityList";

/**
 * EntityListView — composition shell for the card-list mode shared by Leads,
 * Prospects, Billing, Prompts and Tags.
 *
 * It owns ONLY the layout + the grouped-card rendering loop (the part every
 * feature copy-pasted): toolbar slot on top, a scrollable grouped list of
 * ListCard rows with sticky GroupHeader dividers, and a detail-panel slot.
 *
 * It does NOT own data: the feature runs useEntityList and passes `rows` in,
 * plus a `renderItem` for the card body and a `getItemId` for keys/selection.
 * Inline-table mode is rendered by the feature via DataTable, not here.
 */
export interface EntityListViewProps<T> {
  rows: EntityListRow<T>[];
  getItemId: (item: T) => string | number;
  /** Card body for a single item. `selected` lets the feature tweak emphasis. */
  renderItem: (item: T, selected: boolean) => React.ReactNode;

  selectedId?: string | number | null;
  onSelect?: (item: T) => void;

  /** Toolbar / topbar node rendered above the list (search, sort, group, …). */
  toolbar?: React.ReactNode;
  /** Detail panel rendered to the right of the list (desktop). */
  detail?: React.ReactNode;

  /** Lift cards on hover. Off by default to preserve per-page parity. */
  hoverShadow?: boolean;
  /** Optional left accent stripe per item (any CSS color). */
  accentColorOf?: (item: T) => string | undefined;
  /** Trailing actions rendered inside a group header (after the count). */
  renderGroupActions?: (groupKey: string) => React.ReactNode;

  /** Rendered when there are no rows. */
  emptyState?: React.ReactNode;

  /** Width of the list pane on desktop (the detail pane flexes). */
  listWidth?: string;
  className?: string;
  listClassName?: string;
}

export function EntityListView<T>({
  rows,
  getItemId,
  renderItem,
  selectedId,
  onSelect,
  toolbar,
  detail,
  hoverShadow = false,
  accentColorOf,
  renderGroupActions,
  emptyState,
  listWidth = "var(--entity-list-width, 360px)",
  className,
  listClassName,
}: EntityListViewProps<T>) {
  const hasItems = rows.some((r) => r.kind === "item");

  return (
    <div className={cn("flex min-h-0 flex-1 overflow-hidden", className)}>
      <div
        className={cn(
          "flex min-h-0 flex-col overflow-hidden",
          detail ? "max-md:flex-1" : "flex-1",
        )}
        style={detail ? { width: listWidth, flex: "0 0 auto" } : undefined}
      >
        {toolbar}
        <div className={cn("min-h-0 flex-1 overflow-y-auto", listClassName)}>
          {!hasItems && emptyState ? (
            emptyState
          ) : (
            <div className="flex flex-col gap-[var(--list-card-gap,8px)] px-[var(--list-pad-x,12px)] pb-[var(--list-pad-b,16px)]">
              {rows.map((row) => {
                if (row.kind === "header") {
                  return (
                    <GroupHeader
                      key={`h:${row.groupKey}`}
                      label={row.label}
                      count={row.count}
                      color={row.color}
                    >
                      {renderGroupActions?.(row.groupKey)}
                    </GroupHeader>
                  );
                }
                const id = getItemId(row.item);
                const selected = selectedId != null && String(selectedId) === String(id);
                return (
                  <ListCard
                    key={`i:${id}`}
                    selected={selected}
                    hoverShadow={hoverShadow}
                    accentColor={accentColorOf?.(row.item)}
                    onClick={onSelect ? () => onSelect(row.item) : undefined}
                  >
                    {renderItem(row.item, selected)}
                  </ListCard>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {detail && <div className="hidden min-h-0 flex-1 overflow-hidden md:flex">{detail}</div>}
    </div>
  );
}
