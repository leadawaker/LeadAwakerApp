import React, { useEffect, useMemo, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

import {
  Activity,
  Briefcase,
  Building2,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  FileText,
  Globe,
  Hash,
  Link as LinkIcon,
  Mail,
  Phone,
  Tag,
  User,
  Zap,
} from "lucide-react";

export interface DataTableRow {
  Id: number;
  [key: string]: any;
}

export type SortDirection = "asc" | "desc" | null;

export interface SortConfig {
  key: string;
  direction: SortDirection;
}

export type RowSpacing = "tight" | "medium" | "spacious";

export interface DataTableProps<TRow extends DataTableRow = DataTableRow> {
  loading?: boolean;

  rows: TRow[];

  /** Full set of columns (order matters). */
  columns: string[];

  /** Visible columns (order matters, used for rendering & drag-reorder). */
  visibleColumns: string[];
  onVisibleColumnsChange: (next: string[]) => void;

  /** Controlled selection. */
  selectedIds: number[];
  onSelectedIdsChange: (next: number[]) => void;

  /** Controlled sorting. */
  sortConfig: SortConfig;
  onSortChange: (next: SortConfig) => void;

  /** Controlled grouping. Expects values like "None", "Type", "Status", "Timezone". */
  groupBy: string;

  /** Controlled column widths. */
  colWidths: Record<string, number>;
  onColWidthsChange: (next: Record<string, number>) => void;

  /** Presentation controls. */
  rowSpacing: RowSpacing;
  showVerticalLines: boolean;

  /** Inline update callback (table does not do any API calls). */
  onUpdate: (rowId: number, col: string, value: any) => void;

  /** Options for dropdown-driven columns. */
  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];

  /** Column behaviors. */
  hiddenFields: string[];
  nonEditableFields: string[];

  /** (Optional) Used for initial column width defaults if parent wants to derive widths elsewhere. */
  smallWidthCols?: string[];
}

const defaultRowPadding: Record<RowSpacing, string> = {
  tight: "py-2",
  medium: "py-4",
  spacious: "py-8",
};

const initialsColors = [
  { text: "text-[#1a3a6f]", bg: "bg-[#1a3a6f]/10", dot: "bg-[#1a3a6f]" },
  { text: "text-[#2d5aa8]", bg: "bg-[#2d5aa8]/10", dot: "bg-[#2d5aa8]" },
  { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", dot: "bg-[#1E90FF]" },
  { text: "text-[#17A398]", bg: "bg-[#17A398]/10", dot: "bg-[#17A398]" },
  { text: "text-[#10b981]", bg: "bg-[#10b981]/10", dot: "bg-[#10b981]" },
  { text: "text-[#ca8a04]", bg: "bg-[#facc15]/20", dot: "bg-[#facc15]" },
];

const statusColors: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  Active: { text: "text-[#10b981]", bg: "bg-[#10b981]/10", border: "border-[#10b981]/20", dot: "bg-[#10b981]" },
  Inactive: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  Trial: { text: "text-[#1E90FF]", bg: "bg-[#1E90FF]/10", border: "border-[#1E90FF]/20", dot: "bg-[#1E90FF]" },
  Suspended: { text: "text-[#ef4444]", bg: "bg-[#ef4444]/10", border: "border-[#ef4444]/20", dot: "bg-[#ef4444]" },
  Unknown: { text: "text-muted-foreground", bg: "bg-muted/10", border: "border-border", dot: "bg-slate-400" },
};

const timezoneColors: Record<string, { text: string; bg: string; border: string }> = {
  UTC: { text: "text-slate-700", bg: "bg-slate-100", border: "border-slate-200" },
  "Europe/London": { text: "text-blue-700", bg: "bg-blue-100", border: "border-blue-200" },
  "Europe/Paris": { text: "text-indigo-700", bg: "bg-indigo-100", border: "border-indigo-200" },
  "Europe/Berlin": { text: "text-purple-700", bg: "bg-purple-100", border: "border-purple-200" },
  "Europe/Amsterdam": { text: "text-orange-700", bg: "bg-orange-100", border: "border-orange-200" },
  "America/New_York": { text: "text-emerald-700", bg: "bg-emerald-100", border: "border-emerald-200" },
  "America/Los_Angeles": { text: "text-rose-700", bg: "bg-rose-100", border: "border-rose-200" },
  "America/Sao_Paulo": { text: "text-green-700", bg: "bg-green-100", border: "border-green-200" },
  "Asia/Tokyo": { text: "text-red-700", bg: "bg-red-100", border: "border-red-200" },
  "Asia/Dubai": { text: "text-amber-700", bg: "bg-amber-100", border: "border-amber-200" },
};

const getIconForField = (col: string) => {
  const c = col.toLowerCase();
  if (c === "name") return <Building2 className="h-3.5 w-3.5" />;
  if (c.includes("email")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("phone")) return <Phone className="h-3.5 w-3.5" />;
  if (c.includes("status")) return <Activity className="h-3.5 w-3.5" />;
  if (c.includes("type")) return <Briefcase className="h-3.5 w-3.5" />;
  if (c.includes("website")) return <Globe className="h-3.5 w-3.5" />;
  if (c.includes("notes")) return <FileText className="h-3.5 w-3.5" />;
  if (c.includes("timezone")) return <Clock className="h-3.5 w-3.5" />;
  if (c.includes("twilio")) return <Zap className="h-3.5 w-3.5" />;
  if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
  if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
  if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
  if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("time") || c.includes("at")) return <Clock className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
};

const formatHeaderTitle = (col: string) => {
  if (col === "name") return "Company Name";
  if (col === "Account ID") return "ID";
  return col
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
};

const formatDateTime = (value: any) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);

  const day = String(d.getDate()).padStart(2, "0");
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const mon = months[d.getMonth()];
  const yr = String(d.getFullYear()).slice(-2);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${day}/${mon}/${yr} ${hh}:${mm}`;
};

const formatHHmm = (value: any) => {
  if (!value) return "-";
  // Accept "HH:mm:ss" or "HH:mm"
  if (typeof value === "string" && value.includes(":")) {
    const [h, m] = value.split(":");
    if (h != null && m != null) return `${h.padStart(2,"0")}:${m.padStart(2,"0")}`;
  }
  // Fallback if backend returns a date
  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) {
    return `${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
  }
  return String(value);
};

const getInitials = (name: string) => {
  if (!name) return "?";
  const parts = name.split(" ");
  if (parts.length >= 2) return (parts[0][0] + (parts[1] ? parts[1][0] : parts[0][1] || "")).toUpperCase();
  return (name[0] + (name[1] || name[0])).toUpperCase().slice(0, 2);
};

const getAccountColor = (id: number) => initialsColors[id % initialsColors.length];

const TruncatedCell = ({ value, title }: { value: any; title?: string }) => {
  const text = value === null || value === undefined ? "" : String(value);
  const tooltipTitle = title || text;

  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const check = () => {
      const truncated = el.scrollWidth - el.clientWidth > 1;
      setIsTruncated(truncated);
    };

    check();

    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const content = (
    <div ref={ref} className="w-full overflow-hidden whitespace-nowrap text-ellipsis">
      {text}
    </div>
  );

  if (!isTruncated) return content;

  return (
    <Popover>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent className="w-fit max-w-[420px] p-2 text-xs break-words">{tooltipTitle}</PopoverContent>
    </Popover>
  );
};

const DATE_COLS = new Set([
  "Created Time",
  "Last Modified Time",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at",
  "business_hours_open",
  "business_hours_closed",
]);

export default function DataTable<TRow extends DataTableRow = DataTableRow>(props: DataTableProps<TRow>) {
  const {
    loading,
    rows,
    columns,
    visibleColumns,
    onVisibleColumnsChange,
    selectedIds,
    onSelectedIdsChange,
    sortConfig,
    onSortChange,
    groupBy,
    colWidths,
    onColWidthsChange,
    rowSpacing,
    showVerticalLines,
    onUpdate,
    statusOptions,
    typeOptions,
    timezoneOptions,
    hiddenFields,
    nonEditableFields,
  } = props;

  const rowPadding = defaultRowPadding[rowSpacing];

  const sortedRows = useMemo(() => {
    if (!sortConfig.direction || !sortConfig.key) return [...rows];

    return [...rows].sort((a: any, b: any) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal === bVal) return 0;

      let comparison = 0;
      const key = sortConfig.key.toLowerCase();
      const isDate =
        key.includes("time") || key.includes("at") || sortConfig.key === "CreatedAt" || sortConfig.key === "UpdatedAt";

      if (isDate) {
        comparison = new Date(aVal || 0).getTime() - new Date(bVal || 0).getTime();
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        comparison = aVal - bVal;
      } else {
        comparison = String(aVal || "").localeCompare(String(bVal || ""));
      }

      return sortConfig.direction === "asc" ? comparison : -comparison;
    });
  }, [rows, sortConfig]);

  const groupedRows = useMemo(() => {
    if (groupBy === "None") return { All: sortedRows } as Record<string, TRow[]>;
    const groups: Record<string, TRow[]> = {};
    const field = groupBy.toLowerCase();
    sortedRows.forEach((row: any) => {
      const val = row[field] || "Unknown";
      if (!groups[val]) groups[val] = [];
      groups[val].push(row);
    });
    return groups;
  }, [sortedRows, groupBy]);

  const toggleSelectAll = () => {
    if (selectedIds.length === sortedRows.length) onSelectedIdsChange([]);
    else onSelectedIdsChange(sortedRows.map((r) => r.Id));
  };

  const toggleSelect = (id: number) => {
    onSelectedIdsChange(selectedIds.includes(id) ? selectedIds.filter((i) => i !== id) : [...selectedIds, id]);
  };

  const handleSortClick = (key: string) => {
    const prev = sortConfig;
    let direction: SortDirection = "asc";
    if (prev.key === key) {
      if (prev.direction === "asc") direction = "desc";
      else if (prev.direction === "desc") direction = null;
    }
    onSortChange({ key, direction });
  };

  const handleResize = (col: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const startX = e.pageX;
    const startWidth = colWidths[col] || 180;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const delta = moveEvent.pageX - startX;
      const newWidth = Math.max(50, startWidth + delta);
      onColWidthsChange({ ...colWidths, [col]: newWidth });
    };

    const onMouseUp = () => {
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "default";
    };

    document.body.style.cursor = "col-resize";
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  };

  const renderHeader = (col: string, idx: number) => {
    const title = formatHeaderTitle(col);

    return (
      <div
        className="flex items-center gap-2 group cursor-grab active:cursor-grabbing"
        onClick={() => handleSortClick(col)}
        draggable
        onDragStart={(e) => {
          e.dataTransfer.setData("colIdx", idx.toString());
        }}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const fromIdx = parseInt(e.dataTransfer.getData("colIdx"));
          const toIdx = idx;
          if (fromIdx === toIdx) return;
          const newCols = [...visibleColumns];
          const [moved] = newCols.splice(fromIdx, 1);
          newCols.splice(toIdx, 0, moved);
          onVisibleColumnsChange(newCols);
        }}
      >
        <span className="text-slate-400 group-hover:text-blue-500 transition-colors">{getIconForField(col)}</span>

        <Popover>
          <PopoverTrigger asChild>
            <div className="truncate cursor-help">{title}</div>
          </PopoverTrigger>
          <PopoverContent className="w-fit p-2 text-xs">{title}</PopoverContent>
        </Popover>

        {sortConfig.key === col && sortConfig.direction && (
          <span className="text-blue-500 ml-auto">
            {sortConfig.direction === "asc" ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </span>
        )}
      </div>
    );
  };

  const visibleCols = columns.filter((c) => visibleColumns.includes(c));

  return (
    <div className="space-y-8">
      {Object.entries(groupedRows).map(([groupName, groupRows]) => (
        <div key={groupName} className="space-y-2">
          <div className="flex items-center justify-between px-2">
            <h2 className="text-sm font-bold text-slate-800 uppercase tracking-tight">
              {groupBy === "None" ? `ALL ACCOUNTS - ${groupRows.length}` : `${groupName.toUpperCase()} - ${groupRows.length}`}
            </h2>
          </div>

          <div className={cn("bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden", loading && "opacity-70")}>
            <Table className="table-fixed w-full">
              <TableHeader className="bg-slate-50/50">
                <TableRow className="hover:bg-transparent border-b border-slate-200">
                  <TableHead className="w-[40px] px-4">
                    <Checkbox checked={selectedIds.length === sortedRows.length && sortedRows.length > 0} onCheckedChange={toggleSelectAll} />
                  </TableHead>

                  {visibleCols.map((col, idx) => (
                    <TableHead
                      key={col}
                      style={{ width: colWidths[col] }}
                      className={cn(
                        "relative px-4 text-[11px] font-black uppercase text-slate-500 tracking-wider overflow-hidden whitespace-nowrap text-ellipsis",
                        showVerticalLines && idx < visibleCols.length - 1 && "border-r border-slate-100",
                      )}
                    >
                      {renderHeader(col, idx)}
                      <div
                        className="absolute right-[-4px] top-0 bottom-0 w-[8px] cursor-col-resize hover:bg-blue-400/50 active:bg-blue-500 z-10"
                        onMouseDown={(e) => handleResize(col, e)}
                      />
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>

              <TableBody>
                {groupRows.map((row: any) => (
                  <TableRow
                    key={row.Id}
                    id={`row-${row.Id}`}
                    className={cn(
                      "group hover:bg-slate-50/50 transition-colors border-b border-slate-100 last:border-0",
                      selectedIds.includes(row.Id) && "bg-blue-50/30 hover:bg-blue-50/50",
                    )}
                  >
                    <TableCell className="px-4">
                      <Checkbox checked={selectedIds.includes(row.Id)} onCheckedChange={() => toggleSelect(row.Id)} />
                    </TableCell>

                    {visibleCols.map((col, idx) => (
                      <TableCell
                        key={col}
                        style={{ width: colWidths[col] }}
                        className={cn(
                          "px-4 font-medium text-slate-600 transition-all overflow-hidden",
                          rowPadding,
                          showVerticalLines && idx < visibleCols.length - 1 && "border-r border-slate-50",
                        )}
                      >
                        {col === "Image" || col === "ACC" ? (
                          <Sheet>
                            <SheetTrigger asChild>
                              <div
                                className={cn(
                                  "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                                  getAccountColor(row.Id).bg,
                                  getAccountColor(row.Id).text,
                                )}
                              >
                                {getInitials(row.name)}
                              </div>
                            </SheetTrigger>

                            <SheetContent className="sm:max-w-lg w-[400px]">
                              <SheetHeader className="border-b pb-6">
                                <div className="flex items-center gap-4">
                                  <div
                                    className={cn(
                                      "w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold",
                                      getAccountColor(row.Id).bg,
                                      getAccountColor(row.Id).text,
                                    )}
                                  >
                                    {getInitials(row.name)}
                                  </div>
                                  <div>
                                    <SheetTitle className="text-xl">{row.name || "Account Details"}</SheetTitle>
                                    <SheetDescription>View and edit account information</SheetDescription>
                                  </div>
                                </div>
                              </SheetHeader>

                              <ScrollArea className="h-[calc(100vh-140px)] py-6 pr-4">
                                <div className="space-y-6">
                                  {columns.filter((c) => !hiddenFields.includes(c)).map((c) => (
                                    <div key={c} className="space-y-1.5">
                                      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-slate-400 tracking-widest">
                                        {getIconForField(c)}
                                        <span>{c.replace(/_/g, " ")}</span>
                                      </div>

                                      {nonEditableFields.includes(c) ? (
                                        <div className="px-3 py-2 bg-slate-50 rounded-lg text-sm font-medium text-slate-500 border border-slate-100">
                                          {c.toLowerCase().includes("time") || c.toLowerCase().includes("at") ? formatDate(row[c]) : row[c] || "-"}
                                        </div>
                                      ) : c === "status" ? (
                                        <Select value={row[c] || ""} onValueChange={(v) => onUpdate(row.Id, c, v)}>
                                          <SelectTrigger className="w-full bg-white border-slate-200">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {statusOptions.map((o) => (
                                              <SelectItem key={o} value={o}>
                                                {o}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : c === "type" ? (
                                        <Select value={row[c] || ""} onValueChange={(v) => onUpdate(row.Id, c, v)}>
                                          <SelectTrigger className="w-full bg-white border-slate-200">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {typeOptions.map((o) => (
                                              <SelectItem key={o} value={o}>
                                                {o}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : c === "timezone" ? (
                                        <Select value={row[c] || ""} onValueChange={(v) => onUpdate(row.Id, c, v)}>
                                          <SelectTrigger className="w-full bg-white border-slate-200">
                                            <SelectValue />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {timezoneOptions.map((o) => (
                                              <SelectItem key={o} value={o}>
                                                {o}
                                              </SelectItem>
                                            ))}
                                          </SelectContent>
                                        </Select>
                                      ) : (
                                        <Input
                                          value={row[c] || ""}
                                          onChange={(e) => onUpdate(row.Id, c, e.target.value)}
                                          className="bg-white border-slate-200 focus:ring-blue-500"
                                        />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </ScrollArea>
                            </SheetContent>
                          </Sheet>
                        ) : col === "status" ? (
                          <Select value={row[col] || ""} onValueChange={(v) => onUpdate(row.Id, col, v)}>
                            <SelectTrigger
                              className={cn(
                                "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                statusColors[row[col]]?.bg,
                                statusColors[row[col]]?.text,
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <div className={cn("w-1.5 h-1.5 rounded-full", statusColors[row[col]]?.dot)} />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((o) => (
                                <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : ["Leads", "Campaigns", "Automation Logs", "Users", "Prompt Libraries", "Tags"].includes(col) ? (
                          <Popover>
                            <PopoverTrigger asChild>
                              <div className="cursor-pointer hover:bg-slate-100 p-1 rounded transition-colors w-full">
                                <Badge variant="secondary" className="font-normal">
                                  {row[col] ? (Array.isArray(row[col]) ? row[col].length : 1) : 0} {col.toLowerCase()}
                                </Badge>
                              </div>
                            </PopoverTrigger>
                            <PopoverContent className="w-64 p-2">
                              <div className="space-y-2">
                                <h4 className="font-medium text-sm border-b pb-1">{col}</h4>
                                <div className="text-xs text-muted-foreground">
                                  {row[col] ? (
                                    <ul className="list-disc list-inside">
                                      {Array.isArray(row[col]) ? (
                                        row[col].map((item: any, i: number) => (
                                          <li key={i}>{typeof item === "object" ? item.Name || item.title || JSON.stringify(item) : String(item)}</li>
                                        ))
                                      ) : (
                                        <li>{String(row[col])}</li>
                                      )}
                                    </ul>
                                  ) : (
                                    <p>No {col.toLowerCase()} connected to this account ID</p>
                                  )}
                                </div>
                              </div>
                            </PopoverContent>
                          </Popover>
                        ) : col === "type" ? (
                          <Select value={row[col] || ""} onValueChange={(v) => onUpdate(row.Id, col, v)}>
                            <SelectTrigger
                              className={cn(
                                "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                row[col]?.toLowerCase() === "agency" ? "bg-yellow-100 text-yellow-700" : "bg-blue-100 text-blue-700",
                              )}
                            >
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {typeOptions.map((o) => (
                                <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col === "timezone" ? (
                          <Select value={row[col] || ""} onValueChange={(v) => onUpdate(row.Id, col, v)}>
                            <SelectTrigger
                              className={cn(
                                "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
                                timezoneColors[row[col]]?.bg,
                                timezoneColors[row[col]]?.text,
                              )}
                            >
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3 w-3" />
                                <SelectValue />
                              </div>
                            </SelectTrigger>
                            <SelectContent>
                              {timezoneOptions.map((o) => (
                                <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : DATE_COLS.has(col) ? (
                          <div className="text-sm">
                            <TruncatedCell value={formatDate(row[col])} />
                          </div>
                        ) : (
                          <Input
                            defaultValue={row[col] || ""}
                            key={`${row.Id}-${col}-${row[col]}`}
                            onBlur={(e) => onUpdate(row.Id, col, e.target.value)}
                            disabled={nonEditableFields.includes(col)}
                            className="h-8 border-none bg-transparent shadow-none hover:bg-slate-100/50 transition-colors focus:bg-white focus:ring-1 focus:ring-blue-200 px-2 text-sm w-full truncate disabled:opacity-60"
                          />
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}