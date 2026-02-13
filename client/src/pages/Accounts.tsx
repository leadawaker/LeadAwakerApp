import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import DataTable, { type DataTableRow, type SortConfig } from "./DataTable";

interface Row extends DataTableRow {
  [key: string]: any;
}

const TABLE_ID = "m8hflvkkfj25aio";
const NOCODB_BASE_URL =
  "https://api-leadawaker.netlify.app/.netlify/functions/api";

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
  "lead_relations",
  "automation_logs_relations",
  "campaigns_relations",
  "interactions_relations",
  "prompt_libraries_relations",
  "users_relations",
  "tags_relations",
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


const GROUP_OPTIONS = [
  { value: "None", label: "No Grouping" },
  { value: "Type", label: "By Type" },
  { value: "Status", label: "By Status" },
  { value: "Timezone", label: "By Time Zone" },
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
  const [detailRow, setDetailRow] = useState<Row | null>(null);

  const [colWidths, setColWidths] = useState<{ [key: string]: number }>(() => {
    const saved = localStorage.getItem("accounts_col_widths");
    return saved ? JSON.parse(saved) : {};
  });

  const [filterConfig, setFilterConfig] = useState<Record<string, string>>({});
  const [groupBy, setGroupBy] = useState<string>("Type");
  const [rowSpacing, setRowSpacing] = useState<"tight" | "medium" | "spacious">(
    "medium",
  );
  const [showVerticalLines, setShowVerticalLines] = useState(true);

  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem("accounts_sort");
    return saved ? JSON.parse(saved) : { key: "", direction: null };
  });

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
        if (allKeys.includes("business_hours_open"))
          ordered.push("business_hours_open");
        if (allKeys.includes("business_hours_closed"))
          ordered.push("business_hours_closed");

        allKeys.forEach((k) => {
          if (
            !ordered.includes(k) &&
            !techCols.includes(k) &&
            ![
              "created_at",
              "updated_at",
              "Created Time",
              "Last Modified Time",
              "Id",
              "Account ID",
              "business_hours_open",
              "business_hours_closed",
            ].includes(k)
          ) {
            ordered.push(k);
          }
        });
        techCols.forEach((k) => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });

        const middleCols = [
          "Leads",
          "Campaigns",
          "Automation Logs",
          "Users",
          "Prompt Libraries",
          "Tags",
        ];
        middleCols.forEach((k) => {
          if (allKeys.includes(k) && !ordered.includes(k)) ordered.push(k);
        });
        ["Created Time", "Last Modified Time"].forEach((k) => {
          if (allKeys.includes(k)) ordered.push(k);
        });

        const finalCols = [
          "Id",
          ...ordered.filter(
            (c) => c !== "Id" && !HIDDEN_FIELDS.includes(c),
          ),
        ];
        setColumns(finalCols);
        setVisibleColumns(finalCols);

        const savedWidths = localStorage.getItem("accounts_col_widths");
        const initialWidths: { [key: string]: number } = savedWidths
          ? JSON.parse(savedWidths)
          : {};
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

      toast({
        title: "Updated",
        description: `Saved changes for ${idsToUpdate.length} record(s).`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to save to database.",
      });
      fetchData();
    }
  };

  const handleDelete = async () => {
    try {
      setLoading(true);
      const deletePromises = selectedIds.map((id) =>
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
          method: "DELETE",
        }),
      );
      await Promise.all(deletePromises);
      toast({
        title: "Deleted",
        description: `Successfully deleted ${selectedIds.length} records.`,
      });
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
        if (
          !NON_EDITABLE_FIELDS.includes(key) &&
          !HIDDEN_FIELDS.includes(key)
        )
          cleanData[key] = (newRowData as any)[key];
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
    const csvRows = finalFilteredRows.map((row) =>
      headers
        .map((header) => JSON.stringify(row[header] || ""))
        .join(","),
    );
    const csvContent = [headers.join(","), ...csvRows].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "accounts_export.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSVFile = (file: File | null) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string) || "";
      if (!text) return;

      const lines = text.split("\n").filter(Boolean);
      if (lines.length === 0) return;

      const headers = lines[0].split(",");
      const newRows = lines.slice(1).map((line, index) => {
        const values = line.split(",");
        const row: any = { Id: Date.now() + index };
        headers.forEach((header, i) => {
          row[header.trim().replace(/^"|"$/g, "")] = values[i]
            ?.trim()
            .replace(/^"|"$/g, "");
        });
        return row;
      });

      setRows((prev) => [...prev, ...newRows]);
      toast({ title: "Imported", description: "CSV import completed." });
    };
    reader.readAsText(file);
  };

  const handleColWidthsChange = (next: Record<string, number>) => {
    setColWidths(next);
    localStorage.setItem("accounts_col_widths", JSON.stringify(next));
  };

  const finalFilteredRows = useMemo(() => {
    return rows.filter((row) => {
      const matchesFilter = Object.entries(filterConfig).every(([col, val]) => {
        if (!val) return true;
        return String(row[col] || "")
          .toLowerCase()
          .includes(val.toLowerCase());
      });
      const matchesSearch =
        !searchTerm ||
        Object.values(row).some((v) =>
          String(v).toLowerCase().includes(searchTerm.toLowerCase()),
        );
      return matchesFilter && matchesSearch;
    });
  }, [rows, filterConfig, searchTerm]);

  const handleSortChange = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("accounts_sort", JSON.stringify(next));
  };


  return (
    <div className="w-full h-full overflow-y-auto">
      <div className="w-full mx-auto space-y-6">
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
          onGroupByChange={setGroupBy}
          groupOptions={GROUP_OPTIONS}
          colWidths={colWidths}
          onColWidthsChange={handleColWidthsChange}
          rowSpacing={rowSpacing}
          onRowSpacingChange={setRowSpacing}
          showVerticalLines={showVerticalLines}
          onShowVerticalLinesChange={setShowVerticalLines}
          onUpdate={handleInlineUpdate}
          statusOptions={STATUS_OPTIONS}
          typeOptions={TYPE_OPTIONS}
          timezoneOptions={TIMEZONE_OPTIONS}
          hiddenFields={HIDDEN_FIELDS}
          nonEditableFields={NON_EDITABLE_FIELDS}
          smallWidthCols={SMALL_WIDTH_COLS}
          filterConfig={filterConfig}
          onFilterConfigChange={setFilterConfig}
          searchValue={searchTerm}
          onSearchValueChange={setSearchTerm}
          onRefresh={fetchData}
          isRefreshing={loading}
          onAdd={() => setIsCreateOpen(true)}
          addLabel="Add"
          onImportCSV={handleImportCSVFile}
          onExportCSV={handleExportCSV}
        />

        <Dialog open={detailRow !== null} onOpenChange={() => setDetailRow(null)}>
          <DialogContent className="sm:max-w-lg w-[400px]">
            <DialogHeader>
              <DialogTitle>
                {detailRow?.name || detailRow?.Id || "Account details"}
              </DialogTitle>
            </DialogHeader>
            {detailRow && (
              <ScrollArea className="max-h-[60vh] pr-4">
                <div className="space-y-4 py-2">
                  {columns.map((col) => (
                    <div key={col} className="space-y-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        {col}
                      </p>
                      <p className="text-sm text-slate-700">
                        {detailRow[col] ?? "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
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
                      <label className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                        {col}
                      </label>
                      {col === "status" ? (
                        <Select
                          value={(newRowData as any)[col] || ""}
                          onValueChange={(v) =>
                            setNewRowData((prev) => ({ ...prev, [col]: v }))
                          }
                        >
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
                        <Select
                          value={(newRowData as any)[col] || ""}
                          onValueChange={(v) =>
                            setNewRowData((prev) => ({ ...prev, [col]: v }))
                          }
                        >
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
                        <Select
                          value={(newRowData as any)[col] || ""}
                          onValueChange={(v) =>
                            setNewRowData((prev) => ({ ...prev, [col]: v }))
                          }
                        >
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
                          onChange={(e) =>
                            setNewRowData((prev) => ({
                              ...prev,
                              [col]: e.target.value,
                            }))
                          }
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
              <AlertDialogAction
                className="bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}