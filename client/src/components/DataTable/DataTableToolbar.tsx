/**
 * DataTableToolbar — filter bar, search, group-by, bulk actions, export button, and view/fields controls.
 * All toolbar state (filterOpen, groupSortOrder, etc.) that was previously inside DataTable lives here
 * via props or is lifted to the parent where needed.
 */
import React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  EyeOff,
  Filter,
  LayoutGrid,
  ListFilter,
  MoreHorizontal,
  Plus,
  RefreshCw,
  Settings,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { RowSpacing } from "./DataTable";
import { formatHeaderTitle } from "./dataTableUtils";

// ─── View presets (same as in original DataTable) ────────────────────────────
export const VIEW_PRESETS = [
  { key: "all", label: "All Fields", icon: <LayoutGrid className="h-4 w-4" /> },
  { key: "rollups", label: "Roll ups", icon: <ListFilter className="h-4 w-4" /> },
  { key: "twilio", label: "Twilio", icon: <Zap className="h-4 w-4" /> },
  { key: "basic", label: "Basic View", icon: <Eye className="h-4 w-4" /> },
  { key: "automation", label: "Automation", icon: <Settings className="h-4 w-4" /> },
];

type ViewMenuOption =
  | { type: "workspace"; value: string; label: string }
  | { type: "preset"; value: string; label: string; presetKey: string };

export interface DataTableToolbarProps {
  // Columns
  columns: string[];
  visibleColumns: string[];
  onVisibleColumnsChange: (next: string[]) => void;
  hiddenFields: string[];

  // Selection / bulk actions
  selectedIds: number[];
  onSelectedIdsChange: (next: number[]) => void;
  onDelete?: (ids: number[]) => void;
  renderBulkActions?: (selectedIds: number[], clearSelection: () => void) => React.ReactNode;

  // Search
  searchValue?: string;
  onSearchValueChange?: (value: string) => void;
  searchInputRef?: React.RefObject<HTMLInputElement | null>;

  // Filter
  filterConfig?: Record<string, string>;
  onFilterConfigChange?: (next: Record<string, string>) => void;

  // Group by
  groupBy: string;
  onGroupByChange?: (next: string) => void;
  groupOptions?: { value: string; label: string }[];
  groupSortOrder: "asc" | "desc";
  onGroupSortOrderChange: (next: "asc" | "desc") => void;
  hideEmptyGroups: boolean;
  onHideEmptyGroupsChange: (next: boolean) => void;

  // View presets
  viewLabel: string;
  viewKey: string;
  onViewMenuSelect: (option: ViewMenuOption) => void;
  viewMenuGroups: { label: string; options: ViewMenuOption[] }[];

  // Row spacing / vertical lines (inside the MoreHorizontal menu)
  rowSpacing: RowSpacing;
  onRowSpacingChange?: (next: RowSpacing) => void;
  showVerticalLines: boolean;
  onShowVerticalLinesChange?: (next: boolean) => void;

  // Group coloring
  groupColoring: boolean;
  onGroupColoringChange: (next: boolean) => void;

  // Refresh
  onRefresh?: () => void;
  isRefreshing?: boolean;

  // Add
  onAdd?: () => void;
  addLabel?: string;

  // Import / export
  onImportCSV?: (file: File) => void;
  onExportCSV?: () => void;
  exportable?: boolean;
  onOpenExportDialog?: () => void;
  fileInputRef?: React.RefObject<HTMLInputElement | null>;

  // Extra slots
  filterSlot?: React.ReactNode;
  importSlot?: React.ReactNode;
}

export function DataTableToolbar({
  columns,
  visibleColumns,
  onVisibleColumnsChange,
  hiddenFields,
  selectedIds,
  onSelectedIdsChange,
  onDelete,
  renderBulkActions,
  searchValue,
  onSearchValueChange,
  searchInputRef,
  filterConfig,
  onFilterConfigChange,
  groupBy,
  onGroupByChange,
  groupOptions,
  groupSortOrder,
  onGroupSortOrderChange,
  hideEmptyGroups,
  onHideEmptyGroupsChange,
  viewLabel,
  viewKey,
  onViewMenuSelect,
  viewMenuGroups,
  rowSpacing,
  onRowSpacingChange,
  showVerticalLines,
  onShowVerticalLinesChange,
  groupColoring,
  onGroupColoringChange,
  onRefresh,
  isRefreshing,
  onAdd,
  addLabel = "Add",
  onImportCSV,
  onExportCSV,
  exportable,
  onOpenExportDialog,
  fileInputRef,
  filterSlot,
  importSlot,
}: DataTableToolbarProps) {
  const [isFilterOpen, setIsFilterOpen] = React.useState(false);

  const filterValues = filterConfig ?? {};
  const filterCount = Object.values(filterValues).filter(Boolean).length;

  const handleFilterInputChange = (col: string, value: string) => {
    if (!onFilterConfigChange) return;
    const next = { ...filterValues };
    if (value) next[col] = value;
    else delete next[col];
    onFilterConfigChange(next);
  };

  const effectiveGroupOptions =
    groupOptions ??
    [
      { value: "None", label: "No Grouping" },
      { value: "Type", label: "By Type" },
      { value: "Status", label: "By Status" },
      { value: "Timezone", label: "By Time Zone" },
    ];

  const toggleableCols = columns.filter((c) => !hiddenFields.includes(c));
  const hiddenCount = toggleableCols.filter((c) => !visibleColumns.includes(c)).length;

  return (
    <div className="flex flex-wrap items-center gap-3 mb-6">
      {/* Refresh */}
      {onRefresh && (
        <Button
          variant="outline"
          className="h-10 w-10 p-0 rounded-xl bg-card dark:bg-secondary border-border shadow-none"
          onClick={onRefresh}
        >
          <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
        </Button>
      )}

      {/* Search */}
      {onSearchValueChange && (
        <Input
          ref={searchInputRef}
          placeholder="Search records (Ctrl+K)"
          className="w-[240px] h-10 rounded-xl bg-card dark:bg-secondary shadow-none border-border"
          value={searchValue ?? ""}
          onChange={(e) => onSearchValueChange(e.target.value)}
        />
      )}

      {/* Filter popover */}
      {onFilterConfigChange && (
        <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className="h-10 rounded-xl gap-2 font-semibold bg-card dark:bg-secondary border-border shadow-none relative"
            >
              <Filter className="h-4 w-4" />
              <span>Filter</span>
              {filterCount > 0 && (
                <Badge className="absolute -top-2 -right-2 h-4 w-4 flex items-center justify-center p-0 bg-brand-indigo">
                  {filterCount}
                </Badge>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-semibold">Filters</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterConfigChange?.({})}
                  className="h-8 text-xs"
                >
                  Clear all
                </Button>
              </div>
              <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                {columns.map((col) => (
                  <div key={col} className="space-y-1">
                    <label className="text-[10px] font-bold uppercase text-muted-foreground">
                      {col}
                    </label>
                    <Input
                      placeholder={`Filter ${col}...`}
                      className="h-8 text-sm"
                      value={filterValues[col] || ""}
                      onChange={(e) => handleFilterInputChange(col, e.target.value)}
                    />
                  </div>
                ))}
              </div>
            </div>
          </PopoverContent>
        </Popover>
      )}

      {/* Group by selector */}
      {onGroupByChange && effectiveGroupOptions.length > 0 && (
        <div className="flex items-center gap-1 bg-card dark:bg-secondary rounded-xl border border-border px-1">
          <Select value={groupBy} onValueChange={onGroupByChange}>
            <SelectTrigger className="h-10 w-[160px] border-none shadow-none font-semibold gap-2 focus:ring-0 [&>svg]:hidden">
              <LayoutGrid className="h-4 w-4" />
              <SelectValue placeholder="Group by..." />
            </SelectTrigger>
            <SelectContent>
              {effectiveGroupOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {groupBy !== "None" && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-muted rounded-lg">
                  {groupSortOrder === "asc" ? (
                    <ChevronUp className="h-4 w-4 text-brand-indigo" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-brand-indigo" />
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuLabel>Group Options</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuRadioGroup
                  value={groupSortOrder}
                  onValueChange={(v) => onGroupSortOrderChange(v as "asc" | "desc")}
                >
                  <DropdownMenuRadioItem value="asc">Sort Ascending</DropdownMenuRadioItem>
                  <DropdownMenuRadioItem value="desc">Sort Descending</DropdownMenuRadioItem>
                </DropdownMenuRadioGroup>
                <DropdownMenuSeparator />
                <DropdownMenuCheckboxItem
                  checked={hideEmptyGroups}
                  onCheckedChange={onHideEmptyGroupsChange}
                >
                  Hide empty groups
                </DropdownMenuCheckboxItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      )}

      {/* Extra filter slot */}
      {filterSlot}

      {/* Bulk selection bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap" data-testid="bulk-selection-bar">
          {renderBulkActions ? (
            renderBulkActions(selectedIds, () => onSelectedIdsChange([]))
          ) : (
            <>
              <Badge className="h-7 px-3 bg-brand-indigo hover:bg-brand-indigo/90 text-brand-indigo-foreground text-sm font-semibold rounded-full">
                {selectedIds.length} selected
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={() => onSelectedIdsChange([])}
              >
                Clear
              </Button>
            </>
          )}
          {onDelete && (
            <Button
              variant="destructive"
              className="h-8 px-3 rounded-xl text-sm font-semibold gap-2 shadow-none"
              onClick={() => {
                onDelete(selectedIds);
                onSelectedIdsChange([]);
              }}
            >
              Delete ({selectedIds.length})
            </Button>
          )}
        </div>
      )}

      <div className="flex-1" />

      {/* Import slot */}
      {importSlot}

      {/* Export CSV button */}
      {exportable && onOpenExportDialog && (
        <Button
          variant="outline"
          data-testid="export-csv-trigger"
          className="h-10 rounded-xl gap-2 font-semibold bg-card dark:bg-secondary border-border shadow-none text-foreground"
          onClick={onOpenExportDialog}
        >
          <Download className="h-4 w-4 text-muted-foreground" />
          Export
        </Button>
      )}

      {/* Connected [View | Fields] button group */}
      <div className="flex items-stretch rounded-xl border border-border bg-card dark:bg-secondary overflow-hidden divide-x divide-border shadow-none">
        {/* View presets — left half */}
        {viewMenuGroups.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-10 px-3 rounded-none gap-2 font-semibold shadow-none border-none text-foreground"
              >
                {VIEW_PRESETS.find((p) => p.key === viewKey)?.icon || <Eye className="h-4 w-4 text-muted-foreground" />}
                <span className="truncate max-w-[100px]">{viewLabel}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-48" align="end">
              {viewMenuGroups.map((group, idx) => (
                <div key={idx}>
                  {group.label && <DropdownMenuLabel>{group.label}</DropdownMenuLabel>}
                  {group.options.map((option) => {
                    const preset =
                      option.type === "preset"
                        ? VIEW_PRESETS.find((p) => p.key === option.presetKey)
                        : null;
                    return (
                      <DropdownMenuItem
                        key={`${group.label}-${option.value}`}
                        onClick={() => onViewMenuSelect(option)}
                        className="flex items-center gap-2"
                      >
                        {preset?.icon}
                        {option.label}
                      </DropdownMenuItem>
                    );
                  })}
                  {idx < viewMenuGroups.length - 1 && <DropdownMenuSeparator />}
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* Fields — right half */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              data-testid="column-config-trigger"
              className="h-10 px-3 rounded-none gap-2 font-semibold shadow-none border-none text-foreground"
            >
              <EyeOff className="h-4 w-4 text-muted-foreground" />
              Fields
              {hiddenCount > 0 && (
                <span
                  data-testid="column-config-hidden-count"
                  className="ml-0.5 inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full bg-brand-indigo text-brand-indigo-foreground text-[10px] font-bold"
                >
                  {hiddenCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-64 p-0 overflow-hidden"
            data-testid="column-config-panel"
            align="end"
          >
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-border bg-muted/40">
              <span className="text-xs font-semibold text-foreground uppercase tracking-wide">
                Column Visibility
              </span>
              <div className="flex gap-1">
                <button
                  data-testid="column-config-show-all"
                  onClick={() => onVisibleColumnsChange(toggleableCols)}
                  className="text-[11px] text-brand-indigo hover:text-brand-indigo/80 font-medium px-1.5 py-0.5 rounded hover:bg-brand-indigo/10 transition-colors"
                >
                  All
                </button>
                <span className="text-border">·</span>
                <button
                  data-testid="column-config-hide-all"
                  onClick={() => {
                    const first = toggleableCols[0];
                    onVisibleColumnsChange(first ? [first] : []);
                  }}
                  className="text-[11px] text-muted-foreground hover:text-foreground font-medium px-1.5 py-0.5 rounded hover:bg-muted transition-colors"
                >
                  None
                </button>
              </div>
            </div>
            <ScrollArea className="h-72">
              <div className="p-1.5 space-y-0.5">
                {toggleableCols.map((col) => {
                  const isVisible = visibleColumns.includes(col);
                  return (
                    <div
                      key={col}
                      data-testid={`column-toggle-${col}`}
                      className={cn(
                        "flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-colors select-none",
                        isVisible ? "hover:bg-muted/60" : "hover:bg-muted/40 opacity-60 hover:opacity-80",
                      )}
                      onClick={() => {
                        if (isVisible) {
                          onVisibleColumnsChange(visibleColumns.filter((c) => c !== col));
                        } else {
                          onVisibleColumnsChange([...visibleColumns, col]);
                        }
                      }}
                    >
                      <Checkbox
                        checked={isVisible}
                        data-testid={`column-checkbox-${col}`}
                        className="pointer-events-none"
                      />
                      <span
                        className={cn(
                          "text-sm flex-1 truncate",
                          isVisible ? "font-medium text-foreground" : "text-muted-foreground",
                        )}
                      >
                        {formatHeaderTitle(col)}
                      </span>
                      {isVisible ? (
                        <Eye className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>
            </ScrollArea>
            {hiddenCount > 0 && (
              <div className="px-3 py-2 border-t border-border bg-muted/20 text-[11px] text-muted-foreground">
                {hiddenCount} column{hiddenCount !== 1 ? "s" : ""} hidden
              </div>
            )}
          </PopoverContent>
        </Popover>
      </div>

      {/* Add button */}
      {onAdd && (
        <Button
          className="h-10 px-4 rounded-xl bg-brand-indigo text-brand-indigo-foreground hover:bg-brand-indigo/90 text-sm font-semibold gap-2 shadow-none border-none"
          onClick={onAdd}
        >
          <Plus className="h-4 w-4" /> {addLabel}
        </Button>
      )}

      {/* Settings (MoreHorizontal) menu */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-10 w-10 p-0 rounded-xl bg-card dark:bg-secondary border-border shadow-none"
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Settings</DropdownMenuLabel>
          <DropdownMenuCheckboxItem checked={groupColoring} onCheckedChange={onGroupColoringChange}>
            Group Coloring
          </DropdownMenuCheckboxItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Row Spacing</DropdownMenuLabel>
          {onImportCSV && (
            <DropdownMenuRadioGroup
              value={rowSpacing}
              onValueChange={(value) => onRowSpacingChange?.(value as RowSpacing)}
            >
              <DropdownMenuRadioItem value="tight" disabled={!onRowSpacingChange}>
                Tight
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="medium" disabled={!onRowSpacingChange}>
                Medium
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="spacious" disabled={!onRowSpacingChange}>
                Spacious
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Hidden file input for CSV import */}
      <input
        type="file"
        accept=".csv"
        className="hidden"
        ref={fileInputRef}
        onChange={(event) => {
          const file = event.target.files?.[0] || null;
          if (file && onImportCSV) onImportCSV(file);
          if (fileInputRef?.current) fileInputRef.current.value = "";
        }}
      />
    </div>
  );
}
