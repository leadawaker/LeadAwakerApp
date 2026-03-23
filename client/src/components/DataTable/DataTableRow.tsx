/**
 * DataTableRow — individual row renderer with cell logic.
 * Handles: checkbox, sticky first col, all cell type variants
 * (status, type, timezone, conversion, automation_status, date, time, rollup, image/ACC, boolean, truncated text).
 * Also renders the Sheet (detail panel) for Image/ACC/full_name columns.
 */
import React, { useEffect, useRef, useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
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
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { TableCell, TableRow } from "@/components/ui/table";
import { Clock, Copy, Eye, EyeOff, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DataTableRow as DataTableRowType } from "./DataTable";
import {
  automationStatusColors,
  conversionColors,
  formatDateTime,
  formatDateTimeParts,
  formatHeaderTitle,
  formatHHmm,
  getAccountColor,
  getInitials,
  isDateCol,
  isRollupCol,
  isTimeCol,
  maskTwilioValue,
  statusColors,
  timezoneColors,
  TWILIO_SENSITIVE_FIELDS,
  TWILIO_PHONE_FIELDS,
} from "./dataTableUtils";

// ─── Icon helper (local copy — avoids importing all lucide icons) ────────────
import {
  Activity,
  Briefcase,
  Building2,
  Clock as ClockIcon,
  Database,
  FileText,
  Globe,
  Hash,
  Link as LinkIcon,
  Mail,
  Phone,
  Tag,
  User,
} from "lucide-react";

const getIconForField = (col: string) => {
  const c = col.toLowerCase();
  if (c === "name") return <Building2 className="h-3.5 w-3.5" />;
  if (c.includes("email")) return <Mail className="h-3.5 w-3.5" />;
  if (c.includes("phone")) return <Phone className="h-3.5 w-3.5" />;
  if (c.includes("status")) return <Activity className="h-3.5 w-3.5" />;
  if (c.includes("type")) return <Briefcase className="h-3.5 w-3.5" />;
  if (c.includes("website")) return <Globe className="h-3.5 w-3.5" />;
  if (c.includes("notes")) return <FileText className="h-3.5 w-3.5" />;
  if (c.includes("timezone")) return <ClockIcon className="h-3.5 w-3.5" />;
  if (c.includes("account_id") || c.includes("campaign_id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("twilio") || c.includes("twillio")) return <Zap className="h-3.5 w-3.5" />;
  if (c.includes("webhook")) return <LinkIcon className="h-3.5 w-3.5" />;
  if (c.includes("user")) return <User className="h-3.5 w-3.5" />;
  if (c.includes("tag")) return <Tag className="h-3.5 w-3.5" />;
  if (c.includes("id")) return <Hash className="h-3.5 w-3.5" />;
  if (c.includes("time") || c.includes("at")) return <ClockIcon className="h-3.5 w-3.5" />;
  return <Database className="h-3.5 w-3.5" />;
};

// ─── DateTimeCell ────────────────────────────────────────────────────────────
const DateTimeCell = ({ value }: { value: any }) => {
  const parts = formatDateTimeParts(value);
  if (!parts) return <span className="text-muted-foreground">-</span>;

  const now = new Date();
  const isToday =
    parts.d.getFullYear() === now.getFullYear() &&
    parts.d.getMonth() === now.getMonth() &&
    parts.d.getDate() === now.getDate();

  return (
    <div className="flex items-center gap-3 whitespace-nowrap">
      <span className={cn(isToday ? "text-brand-indigo font-semibold" : "")}>
        {parts.date}
      </span>
      <span className="text-muted-foreground">{parts.time}</span>
    </div>
  );
};

// ─── TruncatedCell ───────────────────────────────────────────────────────────
const TruncatedCell = ({
  value,
  title,
  onUpdate,
  rowId,
  col,
}: {
  value: any;
  title?: string;
  onUpdate?: (rowId: number, col: string, next: any) => void;
  rowId?: number;
  col?: string;
}) => {
  const text = value === null || value === undefined ? "" : String(value);
  const tooltipTitle = title || text;

  const ref = useRef<HTMLDivElement>(null);
  const [isTruncated, setIsTruncated] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  useEffect(() => {
    setDraft(text);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      const truncated = el.scrollWidth > el.clientWidth;
      setIsTruncated(truncated);
    };
    check();
    const observer = new ResizeObserver(check);
    observer.observe(el);
    return () => observer.disconnect();
  }, [text]);

  if (isEditing && onUpdate && rowId && col) {
    const widthCh = Math.max(12, draft.length + 2);
    return (
      <Input
        autoFocus
        className="h-8 w-auto min-w-[200px] max-w-none bg-card dark:bg-card shadow-lg border-brand-indigo focus:ring-2 focus:ring-brand-indigo/20 relative z-30"
        style={{ width: `${widthCh}ch` }}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (draft !== text) onUpdate(rowId, col, draft);
          setIsEditing(false);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            if (draft !== text) onUpdate(rowId, col, draft);
            setIsEditing(false);
            e.currentTarget.blur();
          }
          if (e.key === "Escape") {
            setIsEditing(false);
            e.currentTarget.blur();
          }
        }}
      />
    );
  }

  const content = (
    <div
      ref={ref}
      className="w-full min-h-[1.5rem] overflow-hidden whitespace-nowrap text-ellipsis cursor-text flex items-center"
      role="button"
      tabIndex={0}
      aria-label={`Edit ${text || "cell"}`}
      onClick={() => setIsEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setIsEditing(true);
        }
      }}
    >
      {text || "\u00A0"}
    </div>
  );

  return (
    <Popover open={isTruncated ? undefined : false}>
      <PopoverTrigger asChild>{content}</PopoverTrigger>
      <PopoverContent className="w-fit max-w-[420px] p-2 text-xs break-words shadow-xl border border-border bg-card z-[100]">
        {tooltipTitle}
      </PopoverContent>
    </Popover>
  );
};

// ─── RollupCell ──────────────────────────────────────────────────────────────
const RollupCell = ({ value, type }: { value: any; type: string }) => {
  const list = React.useMemo(() => {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    if (typeof value === "string") {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [value];
      } catch {
        return value
          .split(",")
          .map((s: string) => s.trim())
          .filter(Boolean);
      }
    }
    return [String(value)];
  }, [value]);

  const count = list.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <div className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity bg-muted/30 p-1 rounded border border-transparent hover:border-border overflow-hidden w-full">
          <Badge
            variant="secondary"
            className="bg-muted text-muted-foreground border-border font-bold px-1.5 h-5 min-w-[24px] justify-center shrink-0"
          >
            {count}
          </Badge>
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold truncate">
            {type}
          </span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-3 shadow-2xl border border-border bg-card z-[100]">
        <div className="space-y-2">
          <div className="flex items-center justify-between border-b pb-2">
            <h4 className="font-black text-[10px] uppercase tracking-widest text-muted-foreground">
              {type}
            </h4>
            <Badge className="bg-brand-indigo/10 text-brand-indigo border-brand-indigo/20">
              {count}
            </Badge>
          </div>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-1">
              {list.length > 0 ? (
                list.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="text-xs py-1 px-2 rounded hover:bg-muted/50 text-foreground/80 border border-transparent hover:border-border"
                  >
                    {typeof item === "object"
                      ? item.name || item.title || JSON.stringify(item)
                      : String(item)}
                  </div>
                ))
              ) : (
                <div className="text-xs text-muted-foreground italic p-2">No items</div>
              )}
            </div>
          </ScrollArea>
        </div>
      </PopoverContent>
    </Popover>
  );
};

// ─── TwilioFieldRow ──────────────────────────────────────────────────────────
function TwilioFieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  const [revealed, setRevealed] = React.useState(false);
  const [copied, setCopied] = React.useState(false);
  const displayValue = revealed ? (value || "—") : (value ? maskTwilioValue(String(value)) : "Not configured");

  const handleCopy = () => {
    if (!value) return;
    navigator.clipboard.writeText(String(value)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
        <Zap className="h-3.5 w-3.5" />
        <span>{label}</span>
      </div>
      <div
        className={cn(
          "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-mono",
          value
            ? "bg-card dark:bg-secondary border-border text-foreground"
            : "bg-muted/50 border-border text-muted-foreground italic text-xs font-sans tracking-normal",
        )}
      >
        <span className="flex-1 truncate">{displayValue}</span>
        {value && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted rounded"
              onClick={() => setRevealed((r) => !r)}
              title={revealed ? "Hide value" : "Show value"}
            >
              {revealed ? (
                <EyeOff className="h-3.5 w-3.5 text-muted-foreground" />
              ) : (
                <Eye className="h-3.5 w-3.5 text-muted-foreground" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 w-6 p-0 hover:bg-muted rounded"
              onClick={handleCopy}
              title={copied ? "Copied!" : "Copy"}
            >
              <Copy className={cn("h-3.5 w-3.5", copied ? "text-emerald-500" : "text-muted-foreground")} />
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── renderCell ─────────────────────────────────────────────────────────────
// Shared cell renderer used by both virtualized and non-virtualized row paths.

interface RenderCellProps {
  col: string;
  row: any;
  columns: string[];
  hiddenFields: string[];
  nonEditableFields: string[];
  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];
  automationStatusOptions?: string[];
  handleUpdate: (rowId: number, col: string, value: any) => void;
}

export function renderCell({
  col,
  row,
  columns,
  hiddenFields,
  nonEditableFields,
  statusOptions,
  typeOptions,
  timezoneOptions,
  automationStatusOptions,
  handleUpdate,
}: RenderCellProps): React.ReactNode {
  const twilioFields = [...TWILIO_SENSITIVE_FIELDS, ...TWILIO_PHONE_FIELDS];

  if (isRollupCol(col)) {
    return (
      <RollupCell
        value={row[col]}
        type={
          col === "Automation Logs"
            ? "automations"
            : col === "Prompt Libraries"
            ? "prompts"
            : col
        }
      />
    );
  }

  if (
    (col.toLowerCase().includes("use") || typeof row[col] === "boolean") &&
    (row[col] === 0 || row[col] === 1 || row[col] === true || row[col] === false)
  ) {
    return (
      <div className="flex justify-center w-full">
        <Checkbox
          checked={Boolean(row[col])}
          onCheckedChange={(checked) => handleUpdate(row.Id, col, !!checked)}
        />
      </div>
    );
  }

  if (col === "Image" || col === "ACC" || col === "full_name") {
    const visibleSheetCols = columns.filter((c) => !hiddenFields.includes(c));
    let twilioSectionAdded = false;

    return (
      <Sheet>
        <SheetTrigger asChild>
          {col === "full_name" ? (
            <div className="font-bold text-brand-indigo cursor-pointer hover:text-brand-indigo/80 transition-colors">
              {row[col]}
            </div>
          ) : (
            <div
              className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center text-[10px] font-bold cursor-pointer transition-transform hover:scale-110",
                getAccountColor(row.Id).bg,
                getAccountColor(row.Id).text,
              )}
            >
              {row.image ? (
                <img
                  src={row.image}
                  alt={row.full_name || row.name}
                  className="w-full h-full rounded-full object-cover"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : row.Image && row.Image !== "?"
                ? row.Image
                : getInitials(row.full_name || row.name)}
            </div>
          )}
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
                <SheetTitle className="text-xl">{row.name || "Record Details"}</SheetTitle>
                <SheetDescription>View and edit information</SheetDescription>
              </div>
            </div>
          </SheetHeader>
          <ScrollArea className="h-[calc(100dvh-140px)] py-6 pr-4">
            <div className="space-y-6">
              {visibleSheetCols.map((c) => {
                const isTwilio = twilioFields.includes(c);
                const showTwilioHeader = isTwilio && !twilioSectionAdded;
                if (isTwilio) twilioSectionAdded = true;
                return (
                  <React.Fragment key={c}>
                    {showTwilioHeader && (
                      <div className="flex items-center gap-2 pt-2">
                        <div className="flex items-center gap-1.5 text-[11px] font-black uppercase tracking-widest text-brand-indigo">
                          <Zap className="h-3.5 w-3.5" />
                          <span>Twilio Configuration</span>
                        </div>
                        <div className="flex-1 h-px bg-brand-indigo/20" />
                      </div>
                    )}
                    {isTwilio ? (
                      <TwilioFieldRow label={formatHeaderTitle(c)} value={row[c]} />
                    ) : (
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2 text-[10px] font-black uppercase text-muted-foreground tracking-widest">
                          {getIconForField(c)}
                          <span>{formatHeaderTitle(c)}</span>
                        </div>
                        {nonEditableFields.includes(c) ? (
                          <div className="px-3 py-2 bg-muted/50 rounded-lg text-sm font-medium text-muted-foreground border border-border">
                            {isDateCol(c)
                              ? formatDateTime(row[c])
                              : isTimeCol(c)
                              ? formatHHmm(row[c])
                              : row[c] || "-"}
                          </div>
                        ) : c === "status" ? (
                          <Select value={row[c] || ""} onValueChange={(v) => handleUpdate(row.Id, c, v)}>
                            <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {statusOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : c === "type" ? (
                          <Select value={row[c] || ""} onValueChange={(v) => handleUpdate(row.Id, c, v)}>
                            <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {typeOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : c === "timezone" ? (
                          <Select value={row[c] || ""} onValueChange={(v) => handleUpdate(row.Id, c, v)}>
                            <SelectTrigger className="w-full bg-card dark:bg-secondary border-border">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {timezoneOptions.map((o) => (
                                <SelectItem key={o} value={o}>{o}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={row[c] || ""}
                            onChange={(e) => handleUpdate(row.Id, c, e.target.value)}
                            className="bg-card dark:bg-secondary border-border focus:ring-brand-indigo"
                          />
                        )}
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    );
  }

  if (col === "automation_status" && automationStatusOptions) {
    return (
      <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
        <SelectTrigger
          className={cn(
            "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
            (automationStatusColors as any)[row[col]]?.bg || "bg-muted",
            (automationStatusColors as any)[row[col]]?.text || "text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <div
              className={cn(
                "h-1.5 w-1.5 rounded-full shrink-0",
                (automationStatusColors as any)[row[col]]?.dot || "bg-muted-foreground",
              )}
            />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {automationStatusOptions.map((o) => (
            <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full", (automationStatusColors as any)[o]?.dot || "bg-muted-foreground")} />
                {o}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col === "conversion_status") {
    return (
      <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
        <SelectTrigger
          className={cn(
            "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
            (conversionColors as any)[row[col]]?.bg || "bg-muted",
            (conversionColors as any)[row[col]]?.text || "text-muted-foreground",
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o} value={o} className="text-[10px] font-bold uppercase tracking-wider">
              <div className="flex items-center gap-2">
                <div className={cn("h-1.5 w-1.5 rounded-full", (conversionColors as any)[o]?.dot || "bg-muted-foreground")} />
                {o}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col === "status") {
    return (
      <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
        <SelectTrigger
          className={cn(
            "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
            (statusColors as any)[row[col]]?.bg,
            (statusColors as any)[row[col]]?.text,
          )}
        >
          <div className="flex items-center gap-1.5 overflow-hidden">
            <div className={cn("h-1.5 w-1.5 rounded-full shrink-0", (statusColors as any)[row[col]]?.dot)} />
            <SelectValue />
          </div>
        </SelectTrigger>
        <SelectContent>
          {statusOptions.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (col === "type") {
    return (
      <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
        <SelectTrigger
          className={cn(
            "h-7 px-2 rounded-lg border-none shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate",
            row[col]?.toLowerCase() === "agency"
              ? "bg-brand-yellow/20 text-brand-yellow"
              : "bg-brand-indigo/20 text-brand-indigo",
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
    );
  }

  if (col === "timezone") {
    return (
      <Select value={row[col] || ""} onValueChange={(v) => handleUpdate(row.Id, col, v)}>
        <SelectTrigger
          className={cn(
            "h-7 px-2 rounded-lg border border-transparent shadow-none font-bold text-[10px] uppercase tracking-wider w-full truncate bg-muted/50 text-muted-foreground",
            (timezoneColors as any)[row[col]]?.bg,
            (timezoneColors as any)[row[col]]?.text,
            (timezoneColors as any)[row[col]]?.border,
          )}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {timezoneOptions.map((o) => (
            <SelectItem key={o} value={o}>{o}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  if (isDateCol(col)) {
    return <DateTimeCell value={row[col]} />;
  }

  if (isTimeCol(col)) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground font-bold bg-muted/30 px-2 py-1 rounded">
        <Clock className="h-3 w-3" />
        {formatHHmm(row[col])}
      </div>
    );
  }

  return (
    <TruncatedCell value={row[col]} onUpdate={handleUpdate} rowId={row.Id} col={col} />
  );
}

// ─── DataTableRowComponent ───────────────────────────────────────────────────

export interface DataTableRowProps<TRow extends DataTableRowType = DataTableRowType> {
  row: TRow;
  rowIdx: number;
  visibleCols: string[];
  colWidths: Record<string, number>;
  rowPadding: string;
  showVerticalLines: boolean;
  selectedIds: number[];
  onToggleSelect: (id: number) => void;
  onRowClick?: (row: TRow) => void;
  /** Optional: for virtualized mode — ref + data-index */
  virtualRef?: (el: Element | null) => void;
  dataIndex?: number;

  // Cell rendering context
  columns: string[];
  hiddenFields: string[];
  nonEditableFields: string[];
  statusOptions: string[];
  typeOptions: string[];
  timezoneOptions: string[];
  automationStatusOptions?: string[];
  handleUpdate: (rowId: number, col: string, value: any) => void;
}

export function DataTableRowComponent<TRow extends DataTableRowType = DataTableRowType>({
  row,
  rowIdx,
  visibleCols,
  colWidths,
  rowPadding,
  showVerticalLines,
  selectedIds,
  onToggleSelect,
  onRowClick,
  virtualRef,
  dataIndex,
  columns,
  hiddenFields,
  nonEditableFields,
  statusOptions,
  typeOptions,
  timezoneOptions,
  automationStatusOptions,
  handleUpdate,
}: DataTableRowProps<TRow>) {
  const isSelected = selectedIds.includes(row.Id);

  return (
    <TableRow
      key={row.Id}
      id={`row-${row.Id}`}
      data-index={dataIndex}
      data-testid="table-row"
      ref={virtualRef as any}
      className={cn(
        "group transition-colors border-b border-border/50 last:border-0",
        rowIdx % 2 === 0
          ? "bg-transparent hover:bg-muted/30 dark:hover:bg-muted/20"
          : "bg-muted/[0.07] dark:bg-muted/[0.12] hover:bg-muted/30 dark:hover:bg-muted/20",
        isSelected && "!bg-primary/5 hover:!bg-primary/10",
        onRowClick && "cursor-pointer",
      )}
      onClick={
        onRowClick
          ? (e) => {
              const target = e.target as HTMLElement;
              if (target.closest("[data-row-checkbox]")) return;
              onRowClick(row);
            }
          : undefined
      }
    >
      <TableCell
        className={cn(
          "px-4 sticky left-0 z-20",
          isSelected ? "bg-primary/5 group-hover:bg-primary/10" : "bg-card group-hover:bg-muted/30",
        )}
        data-row-checkbox
      >
        <Checkbox checked={isSelected} onCheckedChange={() => onToggleSelect(row.Id)} />
      </TableCell>

      {visibleCols.map((col, idx) => (
        <TableCell
          key={col}
          style={{ width: colWidths[col] }}
          className={cn(
            "px-4 font-medium text-foreground/80 transition-colors overflow-visible",
            rowPadding,
            showVerticalLines && idx < visibleCols.length - 1 && "border-r border-border/30",
            idx === 0 &&
              cn(
                "sticky left-[40px] z-10 shadow-[2px_0_4px_rgba(0,0,0,0.04)]",
                isSelected
                  ? "bg-primary/5 group-hover:bg-primary/10"
                  : "bg-card group-hover:bg-muted/30",
              ),
          )}
        >
          {renderCell({
            col,
            row,
            columns,
            hiddenFields,
            nonEditableFields,
            statusOptions,
            typeOptions,
            timezoneOptions,
            automationStatusOptions,
            handleUpdate,
          })}
        </TableCell>
      ))}
    </TableRow>
  );
}
