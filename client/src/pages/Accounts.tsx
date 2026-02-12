import { useEffect, useState, useRef, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Plus,
  RefreshCw,
  Save,
  Eye,
  LayoutGrid,
  Filter,
  MoreHorizontal,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";

import DataTable, { type DataTableRow, type SortConfig } from "./DataTable";

interface Row extends DataTableRow {
  [key: string]: any;
}

const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_BASE_URL = "https://api-leadawaker.netlify.app/.netlify/functions/api";

const SMALL_WIDTH_COLS = [
  "Id",
  "number of leads",
  "number of campaigns",
  "Leads",
  "Campaigns",
  "Interactions",
  "Automation Logs",
  "Users",
  "Prompt Libraries",
];

const NON_EDITABLE_FIELDS = [
  "Id",
  "Tags",
  "Leads",
  "Campaigns",
  "Interactions",
  "Automation Logs",
  "Users",
  "Prompt Libraries",
  "Created Time",
  "Last Modified Time",
  "created_at",
  "updated_at",
  "Account ID",
  "CreatedAt",
  "UpdatedAt",
  "account_id",
];

const DISPLAY_ONLY_FIELDS = [
  "Tags",
  "Leads",
  "Campaigns",
  "Interactions",
  "Automation Logs",
  "Users",
  "Prompt Libraries",
  "Created Time",
  "Last Modified Time",
  "Id",
  "Account ID",
  "account_id",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at",
];

const HIDDEN_FIELDS = [
  "Account ID",
  "ID",
  "account_id",
  "account_ID",
  "Automation Logs",
  "Prompt Libraries",
  "CreatedAt",
  "UpdatedAt",
  "created_at",
  "updated_at",
  "Created Time",
  "Last Modified Time",
  "ACC",
];

const STATUS_OPTIONS = ["Active", "Inactive", "Trial", "Suspended", "Unknown"];
const TYPE_OPTIONS = ["Agency", "Client"];
const TIMEZONE_OPTIONS = [
  "UTC",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Amsterdam",
  "America/New_York",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Asia/Dubai",
];

export default function Accounts() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [newRowData, setNewRowData] = useState<Partial<Row>>({});
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  const [colWidths, setColWidths] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem("accounts_col_widths");
    return saved ? JSON.parse(saved) : {};
  });

  const [activeView, setActiveView] = useState("Default View");
  const VIEWS = ["Default View", "Sales Pipeline", "Customer Success", "Admin Dashboard"];

  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [groupBy, setGroupBy] = useState<string>("Type");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">("medium");
  const [showVerticalLines, setShowVerticalLines] = useState(true);

  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem("accounts_sort");
    return saved ? JSON.parse(saved) : { key: "", direction: null };
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const finalFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesFilter = Object.entries(filterConfig).every(([col, val]) => {
        if (!val) return true;
        return String(row[col] || "").toLowerCase().includes(val.toLowerCase());
      });
      const matchesSearch =
        !searchTerm || Object.values(row).some((v) => String(v).toLowerCase().includes(searchTerm.toLowerCase()));
      return matchesFilter && matchesSearch;
    });
  }, [rows, filterConfig, searchTerm]);

  // NOTE: sorting is now performed inside <DataTable />; we only keep sortConfig here and persist it.
  const handleSortChange = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("accounts_sort", JSON.stringify(next));
  };

  // Selection helpers used by page-level actions (delete, etc)
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`);
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const list = data.list || [];
      setRows(list);

      if (list.length > 0) {
        const allKeys = Object.keys(list[0]);
        let ordered: string[] = ["Id", "Image"];

        if (allKeys.includes("name")) ordered.push("name");
        const techCols = [
          "twilio_account_sid",
          "twilio_auth_token",
          "twilio_messaging_service_sid",
          "twilio_default_from_number",
          "webhook_url",
          "webhook_secret",
          "max_daily_sends",
        ];
        if (allKeys.includes("status")) ordered.push("status");
        if (allKeys.includes("type")) ordered.push("type");
        if (allKeys.includes("owner_email")) ordered.push("owner_email");
        if (allKeys.includes("phone")) ordered.push("phone");
        if (allKeys.includes("business_niche")) ordered.push("business_niche");
        if (allKeys.includes("website")) ordered.push("website");
        if (allKeys.includes("notes")) ordered.push("notes");
        if (allKeys.includes("timezone")) ordered.push("timezone");
        if (allKeys.includes("business_hours_open")) ordered.push("business_hours_open");
        if (allKeys.includes("business_hours_closed")) ordered.push("business_hours_closed");

        allKeys.forEach((k) => {
          if (
            !ordered.includes(k) &&
            !techCols.includes(k) &&
            !["created_at", "updated_at", "Created Time", "Last Modified Time", "Id", "Account ID", "business_hours_open", "business_hours_closed"].includes(k)
          ) {
            ordered.push(k);
          }
        });
        techCols.forEach((k) => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });

        const middleCols = ["Leads", "Campaigns", "Automation Logs", "Users", "Prompt Libraries", "Tags"];
        middleCols.forEach((k) => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });
        ["Created Time", "Last Modified Time"].forEach((k) => {
          if (allKeys.includes(k)) ordered.push(k);
        });

        const finalCols = ["Id", ...ordered.filter((c) => c !== "Id" && !HIDDEN_FIELDS.includes(c))];
        setColumns(finalCols);
        setVisibleColumns(finalCols);

        const savedWidths = localStorage.getItem("accounts_col_widths");
        const initialWidths: { [key: string]: number } = savedWidths ? JSON.parse(savedWidths) : {};
        finalCols.forEach((col) => {
          if (!initialWidths[col]) {
            if (col === "Id" || col === "Account ID") initialWidths[col] = 80;
            else if (col === "Image") initialWidths[col] = 60;
            else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 120;
            else initialWidths[col] = 180;
          }
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      toast({ variant: "destructive", title: "Error fetching data" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
      if (
        e.key === "n" &&
        !e.ctrlKey &&
        !e.metaKey &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsCreateOpen(true);
      }
      if (
        e.key === "Delete" &&
        selectedIds.length > 0 &&
        document.activeElement?.tagName !== "INPUT" &&
        document.activeElement?.tagName !== "TEXTAREA"
      ) {
        e.preventDefault();
        setIsDeleteDialogOpen(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [selectedIds]);

  const handleInlineUpdate = async (rowId: number, col: string, value: any) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const cleanValue = value === null || value === undefined ? "" : value;

    // Multi-row sync: if current row is part of selection, update all selected
    const idsToUpdate = selectedIds.includes(rowId) ? selectedIds : [rowId];

    setRows((prev) => {
      const newRows = [...prev];
      idsToUpdate.forEach((id) => {
        const idx = newRows.findIndex((r) => r.Id === id);
        if (idx !== -1) newRows[idx] = { ...newRows[idx], [col]: cleanValue };
      });
      return newRows;
    });

    if (detailRow && idsToUpdate.includes(detailRow.Id)) {
      setDetailRow((prev) => (prev ? { ...prev, [col]: cleanValue } : null));
    }

    try {
      const updatePromises = idsToUpdate.map((id) =>
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [col]: cleanValue }),
        }),
      );

      const results = await Promise.all(updatePromises);
      if (results.some((res) => !res.ok)) throw new Error("Some updates failed");

      toast({ title: "Updated", description: `Saved changes for ${idsToUpdate.length} record(s).` });
    } catch (err) {
      toast({ variant: "destructive", title: "Sync Error", description: "Failed to save to database." });
      fetchData();
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map((id) =>
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, { method: "DELETE" }),
      );
      await Promise.all(deletePromises);
      toast({ title: "Deleted", description: `Successfully deleted ${selectedIds.length} records.` });
      setSelectedIds([]);
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Delete Failed" });
    } finally {
      setLoading(false);
      setIsDeleteDialogOpen(false);
    }
  };

  const handleCreateRow = async () => {
    try {
      const cleanData: any = {};
      Object.keys(newRowData).forEach((key) => {
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) cleanData[key] = (newRowData as any)[key];
      });

      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Creation failed");

      toast({ title: "Success", description: "New account created." });
      setIsCreateOpen(false);
      setNewRowData({});
      fetchData();
    } catch (err) {
      toast({ variant: "destructive", title: "Creation Failed" });
    }
  };

  const handleExportCSV = () => {
    const headers = columns.filter((c) => visibleColumns.includes(c));
    const csvRows = finalFilteredRows.map((row) => headers.map((header) => JSON.stringify(row[header] || "")).join(","));
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "accounts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      const lines = text.split("\n");
      const headers = lines[0].split(",");
      const newRows = lines.slice(1).map((line, index) => {
        const values = line.split(",");
        const row: any = { Id: Date.now() + index };
        headers.forEach((header, i) => {
          row[header.trim().replace(/^"|"$/g, "")] = values[i]?.trim().replace(/^"|"$/g, "");
        });
        return row;
      });
      setRows((prev) => [...prev, ...newRows]);
      toast({ title: "Imported" });
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Persist widths on every change (DataTable only emits updates)
  const handleColWidthsChange = (next: Record<string, number>) => {
    setColWidths(next);
    localStorage.setItem("accounts_col_widths", JSON.stringify(next));
  };

  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full mx-auto space-y-6">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none"
            onClick={fetchData}
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          </Button>

          <Dialog open={detailRow !== null} onOpenChange={(open) => !open && setDetailRow(null)}>
            <DialogTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none"
                disabled={selectedIds.length !== 1}
              >
                <Eye className="h-4 w-4" /> View
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg w-[400px]">{/* optional */}</DialogContent>
          </Dialog>

          <Input
            ref={searchInputRef}
            placeholder="Search accounts (Ctrl+K)"
            className="w-[240px] h-10 rounded-xl bg-white shadow-none border-slate-200"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />

          <Popover open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none relative"
              >
                <Filter className="h-4 w-4" />
                <span>Filter</span>
                {Object.values(filterConfig).filter(Boolean).length > 0 && (
                  <Badge className="absolute -top-2 -right-2 h-5 w-5 flex items-center justify-center p-0 bg-blue-600">
                    {Object.values(filterConfig).filter(Boolean).length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-80 p-4">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold">Filters</h4>
                  <Button variant="ghost" size="sm" onClick={() => setFilterConfig({})} className="h-8 text-xs">
                    Clear all
                  </Button>
                </div>
                <div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
                  {columns.map((col) => (
                    <div key={col} className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">{col}</label>
                      <Input
                        placeholder={`Filter ${col}...`}
                        className="h-8 text-sm"
                        value={filterConfig[col] || ""}
                        onChange={(e) => setFilterConfig((prev) => ({ ...prev, [col]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </PopoverContent>
          </Popover>

          <Select value={activeView} onValueChange={setActiveView}>
            <SelectTrigger className="w-[180px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-4 w-4" />
                <span>{activeView}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              {VIEWS.map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={groupBy} onValueChange={setGroupBy}>
            <SelectTrigger className="w-[160px] h-10 rounded-xl bg-white shadow-none border-slate-200 font-bold">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <span>Group: {groupBy}</span>
              </div>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="None">No Grouping</SelectItem>
              <SelectItem value="Type">By Type</SelectItem>
              <SelectItem value="Status">By Status</SelectItem>
              <SelectItem value="Timezone">By Time Zone</SelectItem>
            </SelectContent>
          </Select>

          <div className="flex-1" />

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className="h-10 rounded-xl gap-2 font-semibold bg-white border-slate-200 shadow-none">
                Fields
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-2">
              <ScrollArea className="h-72">
                <div className="space-y-1">
                  {columns.map((col) => (
                    <div
                      key={col}
                      className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer"
                      onClick={() => {
                        setVisibleColumns((prev) => (prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]));
                      }}
                    >
                      <Checkbox checked={visibleColumns.includes(col)} />
                      <span className="text-sm font-medium">{col}</span>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </PopoverContent>
          </Popover>

          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="h-10 px-4 rounded-xl bg-blue-600 text-white hover:bg-blue-700 text-sm font-semibold gap-2 shadow-none border-none">
                <Plus className="h-4 w-4" /> Add
              </Button>
            </DialogTrigger>

            <DialogContent className="max-w-2xl h-[calc(100vh-80px)] p-0 gap-0 overflow-hidden flex flex-col">
              <DialogHeader className="p-6 border-b">
                <DialogTitle>Add New Account</DialogTitle>
              </DialogHeader>
              <ScrollArea className="flex-1 p-6">
                <div className="grid grid-cols-2 gap-4 pb-4">
                  {columns
                    .filter((c) => !DISPLAY_ONLY_FIELDS.includes(c))
                    .map((col) => (
                      <div key={col} className="space-y-1.5">
                        <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">{col}</label>
                        {col === "status" ? (
                          <Select value={(newRowData as any)[col] || ""} onValueChange={(v) => setNewRowData((prev) => ({ ...prev, [col]: v }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {STATUS_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col === "type" ? (
                          <Select value={(newRowData as any)[col] || ""} onValueChange={(v) => setNewRowData((prev) => ({ ...prev, [col]: v }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TYPE_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : col === "timezone" ? (
                          <Select value={(newRowData as any)[col] || ""} onValueChange={(v) => setNewRowData((prev) => ({ ...prev, [col]: v }))}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {TIMEZONE_OPTIONS.map((o) => (
                                <SelectItem key={o} value={o}>
                                  {o}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Input
                            value={(newRowData as any)[col] || ""}
                            onChange={(e) => setNewRowData((prev) => ({ ...prev, [col]: e.target.value }))}
                            className="bg-slate-50 border-slate-200"
                          />
                        )}
                      </div>
                    ))}
                </div>
              </ScrollArea>
              <DialogFooter className="p-6 border-t bg-slate-50/50">
                <Button variant="ghost" onClick={() => setIsCreateOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleCreateRow}>Create</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="h-10 w-10 p-0 rounded-xl bg-white border-slate-200 shadow-none">
                <MoreHorizontal className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>Settings</DropdownMenuLabel>
              <DropdownMenuItem onClick={() => fileInputRef.current?.click()}>
                <Plus className="h-4 w-4 mr-2" /> Import CSV
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleExportCSV}>
                <Save className="h-4 w-4 mr-2" /> Export CSV
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuCheckboxItem checked={showVerticalLines} onCheckedChange={setShowVerticalLines}>
                Show Vertical Lines
              </DropdownMenuCheckboxItem>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Row Spacing</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={rowSpacing} onValueChange={(v: any) => setRowSpacing(v)}>
                <DropdownMenuRadioItem value="tight">Tight</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="medium">Medium</DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="spacious">Spacious</DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>

          <input type="file" accept=".csv" className="hidden" ref={fileInputRef} onChange={handleImportCSV} />
        </div>

        {/* TABLE (refactored) */}
        <DataTable
          loading={loading}
          rows={finalFilteredRows}
          columns={columns}
          visibleColumns={visibleColumns}
          onVisibleColumnsChange={setVisibleColumns}
          selectedIds={selectedIds}
          onSelectedIdsChange={setSelectedIds}
          sortConfig={sortConfig}
          onSortChange={handleSortChange}
          groupBy={groupBy}
          colWidths={colWidths}
          onColWidthsChange={handleColWidthsChange}
          rowSpacing={rowSpacing}
          showVerticalLines={showVerticalLines}
          onUpdate={handleInlineUpdate}
          statusOptions={STATUS_OPTIONS}
          typeOptions={TYPE_OPTIONS}
          timezoneOptions={TIMEZONE_OPTIONS}
          hiddenFields={HIDDEN_FIELDS}
          nonEditableFields={NON_EDITABLE_FIELDS}
          smallWidthCols={SMALL_WIDTH_COLS}
        />

        <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you sure?</AlertDialogTitle>
              <AlertDialogDescription>
                Delete {selectedIds.length} records? This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={handleDelete}>
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}