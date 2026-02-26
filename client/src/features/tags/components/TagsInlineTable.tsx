import { useState, useCallback, useRef, useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  Check,
  ChevronDown,
  ChevronRight,
  X,
  Building2,
  Megaphone,
  Zap,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { InlineColorPicker } from "./ColorPicker";
import type {
  TagTableItem,
  EnrichedTag,
  TagColKey,
} from "../types";

/* ════════════════════════════════════════════════════════════════════════════
   TagsInlineTable — table rendering with inline editing, selection, and
   a selection bar. Lives inside the Tags feature's list view.
   ════════════════════════════════════════════════════════════════════════════ */

interface TagsInlineTableProps {
  flatItems: TagTableItem[];
  tagOnlyItems: { kind: "tag"; tag: EnrichedTag }[];
  visCols: {
    key: TagColKey;
    label: string;
    width: number;
    defaultVisible: boolean;
    alwaysVisible?: boolean;
  }[];
  selectedTagIds: Set<number>;
  onSelectedTagIdsChange: (ids: Set<number>) => void;
  collapsedGroups: Set<string>;
  onToggleGroupCollapse: (label: string) => void;
  accounts: any[];
  campaigns: any[];
  accountNameMap: Map<string, string>;
  campaignNameMap: Map<string, string>;
  onUpdate: (
    tagId: number,
    field: string,
    value: string | number | null,
    extra?: Record<string, any>,
  ) => Promise<any>;
  onBulkUpdate: (
    tagIds: number[],
    field: string,
    value: string | number | null,
    extra?: Record<string, any>,
  ) => Promise<void>;
  onOpenDeleteSingle: (tag: any) => void;
  searchQuery: string;
  isFilterActive: boolean;
}

/* ── Helpers ───────────────────────────────────────────────────────────────── */

function getAccountName(
  tag: EnrichedTag,
  map: Map<string, string>,
): string {
  const id = tag.account_id ?? tag.Accounts_id;
  if (id == null) return "";
  return map.get(String(id)) ?? `Account ${id}`;
}

function getCampaignName(
  tag: EnrichedTag,
  map: Map<string, string>,
): string {
  if (tag.campaign_name) return tag.campaign_name;
  const id = tag.campaign_id;
  if (id == null) return "";
  return map.get(String(id)) ?? `Campaign ${id}`;
}

/* ════════════════════════════════════════════════════════════════════════════ */

export function TagsInlineTable({
  flatItems,
  tagOnlyItems,
  visCols,
  selectedTagIds,
  onSelectedTagIdsChange,
  collapsedGroups,
  onToggleGroupCollapse,
  accounts,
  campaigns,
  accountNameMap,
  campaignNameMap,
  onUpdate,
  onBulkUpdate,
  onOpenDeleteSingle,
  searchQuery,
  isFilterActive,
}: TagsInlineTableProps) {
  /* ── Inline editing state (lives here) ─────────────────────────────────── */
  const [editingCell, setEditingCell] = useState<{
    tagId: number;
    field: string;
  } | null>(null);
  const [editingValue, setEditingValue] = useState<string>("");

  /* ── Shift-click ref ───────────────────────────────────────────────────── */
  const lastClickedIndexRef = useRef<number>(-1);

  /* ── Flat tag index map (for shift-click range) ────────────────────────── */
  const tagIndexMap = useMemo(() => {
    const map = new Map<number, number>();
    let idx = 0;
    flatItems.forEach((item) => {
      if (item.kind === "tag") {
        map.set(item.tag.id, idx);
        idx++;
      }
    });
    return map;
  }, [flatItems]);

  const colSpan = visCols.length;
  const allSelected =
    tagOnlyItems.length > 0 &&
    tagOnlyItems.every((i) => selectedTagIds.has(i.tag.id));
  const someSelected =
    tagOnlyItems.some((i) => selectedTagIds.has(i.tag.id)) && !allSelected;

  /* ── Select-all toggle ─────────────────────────────────────────────────── */
  const handleSelectAll = useCallback(() => {
    if (allSelected) {
      onSelectedTagIdsChange(new Set());
    } else {
      onSelectedTagIdsChange(new Set(tagOnlyItems.map((i) => i.tag.id)));
    }
  }, [allSelected, tagOnlyItems, onSelectedTagIdsChange]);

  /* ── Row click (plain / Ctrl / Shift) ──────────────────────────────────── */
  const handleRowClick = useCallback(
    (tag: EnrichedTag, e: React.MouseEvent) => {
      const tagId = tag.id;
      const idx = tagIndexMap.get(tagId) ?? -1;

      if (e.shiftKey && lastClickedIndexRef.current >= 0) {
        const lo = Math.min(lastClickedIndexRef.current, idx);
        const hi = Math.max(lastClickedIndexRef.current, idx);
        const rangeIds = tagOnlyItems.slice(lo, hi + 1).map((i) => i.tag.id);
        const next = new Set(selectedTagIds);
        rangeIds.forEach((id) => next.add(id));
        onSelectedTagIdsChange(next);
      } else if (e.ctrlKey || e.metaKey) {
        const next = new Set(selectedTagIds);
        if (next.has(tagId)) next.delete(tagId);
        else next.add(tagId);
        onSelectedTagIdsChange(next);
        lastClickedIndexRef.current = idx;
      } else {
        onSelectedTagIdsChange(new Set([tagId]));
        lastClickedIndexRef.current = idx;
      }
    },
    [tagIndexMap, tagOnlyItems, selectedTagIds, onSelectedTagIdsChange],
  );

  /* ── Checkbox click (toggle without affecting others) ──────────────────── */
  const handleCheckboxClick = useCallback(
    (tagId: number, e: React.MouseEvent) => {
      e.stopPropagation();
      const next = new Set(selectedTagIds);
      if (next.has(tagId)) next.delete(tagId);
      else next.add(tagId);
      onSelectedTagIdsChange(next);
    },
    [selectedTagIds, onSelectedTagIdsChange],
  );

  /* ── Inline edit: start ────────────────────────────────────────────────── */
  const startEdit = useCallback(
    (tagId: number, field: string, currentValue: string) => {
      setEditingCell({ tagId, field });
      setEditingValue(currentValue);
    },
    [],
  );

  /* ── Inline edit: cancel ───────────────────────────────────────────────── */
  const cancelEdit = useCallback(() => {
    setEditingCell(null);
    setEditingValue("");
  }, []);

  /* ── Inline edit: commit ───────────────────────────────────────────────── */
  const commitEdit = useCallback(
    async (tagId: number, field: string, newValue: string) => {
      setEditingCell(null);
      const trimmed = newValue.trim();
      // If multi-selected and the row being edited is in the selection, batch
      if (selectedTagIds.has(tagId) && selectedTagIds.size > 1) {
        await onBulkUpdate(Array.from(selectedTagIds), field, trimmed || null);
      } else {
        await onUpdate(tagId, field, trimmed || null);
      }
    },
    [selectedTagIds, onUpdate, onBulkUpdate],
  );

  /* ── Color change (supports batch) ─────────────────────────────────────── */
  const handleColorChange = useCallback(
    async (tagId: number, newColor: string) => {
      if (selectedTagIds.has(tagId) && selectedTagIds.size > 1) {
        await onBulkUpdate(Array.from(selectedTagIds), "color", newColor);
      } else {
        await onUpdate(tagId, "color", newColor);
      }
    },
    [selectedTagIds, onUpdate, onBulkUpdate],
  );

  /* ── Account change (dropdown) ─────────────────────────────────────────── */
  const handleAccountChange = useCallback(
    async (tagId: number, accountId: string | null) => {
      if (selectedTagIds.has(tagId) && selectedTagIds.size > 1) {
        await onBulkUpdate(
          Array.from(selectedTagIds),
          "Accounts_id",
          accountId ? Number(accountId) : null,
        );
      } else {
        await onUpdate(
          tagId,
          "Accounts_id",
          accountId ? Number(accountId) : null,
        );
      }
    },
    [selectedTagIds, onUpdate, onBulkUpdate],
  );

  /* ── Campaign change (dropdown) ────────────────────────────────────────── */
  const handleCampaignChange = useCallback(
    async (tagId: number, campaignId: string | null, campaignName: string | null) => {
      if (selectedTagIds.has(tagId) && selectedTagIds.size > 1) {
        await onBulkUpdate(
          Array.from(selectedTagIds),
          "campaign_id",
          campaignId ? Number(campaignId) : null,
          { campaign_name: campaignName },
        );
      } else {
        await onUpdate(
          tagId,
          "campaign_id",
          campaignId ? Number(campaignId) : null,
          { campaign_name: campaignName },
        );
      }
    },
    [selectedTagIds, onUpdate, onBulkUpdate],
  );

  /* ════════════════════════════════════════════════════════════════════════
     Render
     ════════════════════════════════════════════════════════════════════════ */

  /* ── Empty state ─────────────────────────────────────────────────────── */
  if (tagOnlyItems.length === 0) {
    return (
      <div className="h-full flex items-center justify-center px-4">
        <DataEmptyState
          variant={searchQuery || isFilterActive ? "search" : "tags"}
          compact
        />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-transparent">
      {/* ── Selection bar ─────────────────────────────────────────────────── */}
      {selectedTagIds.size > 1 && (
        <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 border-b border-border/20">
          <span className="text-[11px] font-semibold text-foreground tabular-nums mr-1">
            {selectedTagIds.size} selected
          </span>
          <button
            className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground"
            onClick={() => onSelectedTagIdsChange(new Set())}
          >
            <X className="h-3 w-3" />
            Clear
          </button>
        </div>
      )}

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 min-h-0 overflow-auto">
        <table
          className="w-full"
          style={{ borderCollapse: "collapse", minWidth: 600 }}
        >
          {/* ── Sticky header ─────────────────────────────────────────────── */}
          <thead className="sticky top-0 z-20">
            <tr>
              {visCols.map((col) => (
                <th
                  key={col.key}
                  className="px-3 py-2 text-left text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20"
                  style={{ width: col.width, minWidth: col.width }}
                >
                  {col.key === "checkbox" ? (
                    <div
                      className={cn(
                        "h-4 w-4 rounded border flex items-center justify-center cursor-pointer",
                        allSelected
                          ? "border-brand-blue bg-brand-blue"
                          : someSelected
                            ? "border-brand-blue bg-brand-blue/30"
                            : "border-border/40",
                      )}
                      onClick={handleSelectAll}
                    >
                      {allSelected && (
                        <Check className="h-2.5 w-2.5 text-white" />
                      )}
                      {someSelected && !allSelected && (
                        <div className="h-1.5 w-1.5 bg-white rounded-sm" />
                      )}
                    </div>
                  ) : (
                    col.label
                  )}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {flatItems.map((item, index) => {
              /* ── Group header row ────────────────────────────────────────── */
              if (item.kind === "header") {
                const isCollapsed = collapsedGroups.has(item.label);
                return (
                  <tr
                    key={`h-${item.label}-${index}`}
                    className="bg-background/60 cursor-pointer select-none hover:bg-black/[0.02]"
                    onClick={() => onToggleGroupCollapse(item.label)}
                  >
                    <td
                      colSpan={colSpan}
                      className="px-4 pt-4 pb-1.5 sticky left-0 z-10"
                    >
                      <div className="flex items-center gap-2">
                        <div className="text-muted-foreground/50">
                          {isCollapsed ? (
                            <ChevronRight className="h-3.5 w-3.5" />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" />
                          )}
                        </div>
                        <span className="text-[11px] font-bold uppercase tracking-widest text-foreground/55">
                          {item.label}
                        </span>
                        <span className="text-[10px] text-muted-foreground/40 font-medium tabular-nums">
                          {item.count}
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              }

              /* ── Tag row ────────────────────────────────────────────────── */
              const { tag } = item;
              const isSelected = selectedTagIds.has(tag.id);
              const acctName = getAccountName(tag, accountNameMap);
              const campName = getCampaignName(tag, campaignNameMap);

              return (
                <tr
                  key={tag.id}
                  className={cn(
                    "group/row cursor-pointer h-10 border-b border-border/15",
                    isSelected
                      ? "bg-[#FFF1C8]"
                      : "bg-[#F1F1F1] hover:bg-[#F8F8F8]",
                  )}
                  onClick={(e) => handleRowClick(tag, e)}
                >
                  {visCols.map((col) => {
                    /* ── Checkbox ─────────────────────────────────────────── */
                    if (col.key === "checkbox") {
                      return (
                        <td
                          key="checkbox"
                          className="px-3"
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          <div
                            className={cn(
                              "h-4 w-4 rounded border flex items-center justify-center shrink-0 cursor-pointer",
                              isSelected
                                ? "border-brand-blue bg-brand-blue"
                                : "border-border/40",
                            )}
                            onClick={(e) => handleCheckboxClick(tag.id, e)}
                          >
                            {isSelected && (
                              <Check className="h-2.5 w-2.5 text-white" />
                            )}
                          </div>
                        </td>
                      );
                    }

                    /* ── Color ────────────────────────────────────────────── */
                    if (col.key === "color") {
                      return (
                        <td
                          key="color"
                          className="px-3"
                          style={{ width: col.width, minWidth: col.width }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <InlineColorPicker
                            value={tag.color ?? "gray"}
                            onChange={(c) => handleColorChange(tag.id, c)}
                          />
                        </td>
                      );
                    }

                    /* ── Name (editable) ─────────────────────────────────── */
                    if (col.key === "name") {
                      const isEdit =
                        editingCell?.tagId === tag.id &&
                        editingCell?.field === "name";
                      return (
                        <td
                          key="name"
                          className="px-2.5"
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {isEdit ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() =>
                                commitEdit(tag.id, "name", editingValue)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-[28px] text-[12px] bg-white px-1.5 rounded ring-1 ring-brand-blue/40 outline-none"
                            />
                          ) : (
                            <span
                              className="text-[12px] font-medium truncate text-foreground cursor-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(tag.id, "name", tag.name ?? "");
                              }}
                            >
                              {tag.name || (
                                <span className="text-muted-foreground/35 italic">
                                  --
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    }

                    /* ── Category (editable) ─────────────────────────────── */
                    if (col.key === "category") {
                      const isEdit =
                        editingCell?.tagId === tag.id &&
                        editingCell?.field === "category";
                      const val = tag.category ?? "";
                      return (
                        <td
                          key="category"
                          className="px-2.5"
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {isEdit ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() =>
                                commitEdit(tag.id, "category", editingValue)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-[28px] text-[12px] bg-white px-1.5 rounded ring-1 ring-brand-blue/40 outline-none"
                            />
                          ) : (
                            <span
                              className="text-[12px] text-muted-foreground truncate block cursor-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(tag.id, "category", val);
                              }}
                            >
                              {val ? (
                                val.charAt(0).toUpperCase() + val.slice(1)
                              ) : (
                                <span className="text-muted-foreground/30">
                                  --
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    }

                    /* ── Account (dropdown) ──────────────────────────────── */
                    if (col.key === "account") {
                      return (
                        <td
                          key="account"
                          className="px-2.5"
                          style={{ width: col.width, minWidth: col.width }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 w-full min-w-0 text-[12px] text-muted-foreground hover:text-foreground truncate">
                                <Building2 className="h-3 w-3 shrink-0 opacity-40" />
                                <span className="truncate">
                                  {acctName || (
                                    <span className="text-muted-foreground/30">
                                      None
                                    </span>
                                  )}
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                className="text-[12px]"
                                onClick={() =>
                                  handleAccountChange(tag.id, null)
                                }
                              >
                                <span className="text-muted-foreground">
                                  None
                                </span>
                              </DropdownMenuItem>
                              {accounts.map((a: any) => {
                                const aid = String(a.id);
                                return (
                                  <DropdownMenuItem
                                    key={aid}
                                    className="text-[12px]"
                                    onClick={() =>
                                      handleAccountChange(tag.id, aid)
                                    }
                                  >
                                    {a.name ?? `Account ${a.id}`}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      );
                    }

                    /* ── Campaign (dropdown) ─────────────────────────────── */
                    if (col.key === "campaign") {
                      return (
                        <td
                          key="campaign"
                          className="px-2.5"
                          style={{ width: col.width, minWidth: col.width }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button className="flex items-center gap-1 w-full min-w-0 text-[12px] text-muted-foreground hover:text-foreground truncate">
                                <Megaphone className="h-3 w-3 shrink-0 opacity-40" />
                                <span className="truncate">
                                  {campName || (
                                    <span className="text-muted-foreground/30">
                                      None
                                    </span>
                                  )}
                                </span>
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="w-44">
                              <DropdownMenuItem
                                className="text-[12px]"
                                onClick={() =>
                                  handleCampaignChange(tag.id, null, null)
                                }
                              >
                                <span className="text-muted-foreground">
                                  None
                                </span>
                              </DropdownMenuItem>
                              {campaigns.map((c: any) => {
                                const cid = String(c.id ?? c.Id);
                                const cname = c.name ?? `Campaign ${cid}`;
                                return (
                                  <DropdownMenuItem
                                    key={cid}
                                    className="text-[12px]"
                                    onClick={() =>
                                      handleCampaignChange(tag.id, cid, cname)
                                    }
                                  >
                                    {cname}
                                  </DropdownMenuItem>
                                );
                              })}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                      );
                    }

                    /* ── Lead count ───────────────────────────────────────── */
                    if (col.key === "leadCount") {
                      return (
                        <td
                          key="leadCount"
                          className="px-2.5 tabular-nums"
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          <span className="text-[12px] text-muted-foreground">
                            {tag.leadCount > 0 ? tag.leadCount : (
                              <span className="text-muted-foreground/30">
                                0
                              </span>
                            )}
                          </span>
                        </td>
                      );
                    }

                    /* ── Description (editable) ──────────────────────────── */
                    if (col.key === "description") {
                      const isEdit =
                        editingCell?.tagId === tag.id &&
                        editingCell?.field === "description";
                      const val = tag.description ?? "";
                      return (
                        <td
                          key="description"
                          className="px-2.5"
                          style={{ minWidth: col.width }}
                        >
                          {isEdit ? (
                            <input
                              autoFocus
                              type="text"
                              value={editingValue}
                              onChange={(e) => setEditingValue(e.target.value)}
                              onBlur={() =>
                                commitEdit(tag.id, "description", editingValue)
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter") e.currentTarget.blur();
                                if (e.key === "Escape") cancelEdit();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="w-full h-[28px] text-[12px] bg-white px-1.5 rounded ring-1 ring-brand-blue/40 outline-none"
                            />
                          ) : (
                            <span
                              className="text-[12px] text-muted-foreground truncate block cursor-text"
                              onClick={(e) => {
                                e.stopPropagation();
                                startEdit(tag.id, "description", val);
                              }}
                            >
                              {val || (
                                <span className="text-muted-foreground/30">
                                  --
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                      );
                    }

                    /* ── Auto-applied (read-only badge) ──────────────────── */
                    if (col.key === "autoApplied") {
                      return (
                        <td
                          key="autoApplied"
                          className="px-2.5"
                          style={{ width: col.width, minWidth: col.width }}
                        >
                          {tag.auto_applied ? (
                            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-700">
                              <Zap className="h-2.5 w-2.5" />
                              Auto
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30 text-[12px]">
                              --
                            </span>
                          )}
                        </td>
                      );
                    }

                    /* ── Fallback (should not happen) ────────────────────── */
                    return (
                      <td
                        key={col.key}
                        className="px-2.5"
                        style={{ width: col.width, minWidth: col.width }}
                      >
                        <span className="text-[12px] text-muted-foreground/30">
                          --
                        </span>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
