import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
  DataTableRow,
  SortConfig,
} from "@/components/DataTable/DataTable";

interface AccountRow extends DataTableRow {
  [key: string]: any;
}

const TABLE_ID = "accounts";
const API_BASE_URL =
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

export function useAccountsData(currentAccountId?: number) {
  const [rows, setRows] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("accounts_col_widths");
    return saved ? JSON.parse(saved) : {};
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem("accounts_sort");
    return saved ? JSON.parse(saved) : { key: "", direction: null };
  });

  const { toast } = useToast();

  // key -> timeoutId, used for debouncing PATCH per (rowId, col)
  const pendingSaves = useRef<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    try {
      const url = new URL(API_BASE_URL);
      url.searchParams.set("tableId", TABLE_ID);
      // If you later want to filter by currentAccountId:
      // if (currentAccountId) url.searchParams.set("account_id", String(currentAccountId));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.list || []).map((row: any) => ({
        ...row,
        Id: row.Id ?? row.id, // normalize ID field
        "Created Time": row["Created Time"] ?? row.created_at,
        "Last Modified Time": row["Last Modified Time"] ?? row.updated_at,
      }));
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
  }, [currentAccountId]);

  const setColWidthsPersist = (next: Record<string, number>) => {
    setColWidths(next);
    localStorage.setItem("accounts_col_widths", JSON.stringify(next));
  };

  const setSortConfigPersist = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("accounts_sort", JSON.stringify(next));
  };

  const handleInlineUpdate = async (
    rowId: number,
    col: string,
    value: any,
    selectedIds: number[] = [],
  ) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const cleanValue = value === null || value === undefined ? "" : value;
    const idsToUpdate = selectedIds.includes(rowId) ? selectedIds : [rowId];

    // Optimistic local update
    setRows((prev) =>
      prev.map((r) =>
        idsToUpdate.includes(r.Id) ? { ...r, [col]: cleanValue } : r
      )
    );

    try {
      const updatePromises = idsToUpdate.map((id) => {
        // Build the URL carefully with lowercase tableId and id
        const url = new URL(API_BASE_URL);
        url.searchParams.set("tableId", "accounts");
        url.searchParams.set("id", String(id));

        return fetch(url.toString(), {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ [col.toLowerCase()]: cleanValue }),
        });
      });

      const results = await Promise.all(updatePromises);
      const allOk = results.every((res) => res.ok);
      
      if (!allOk) {
        const errorMsg = await results.find(r => !r.ok)?.text();
        console.error("Update failed:", errorMsg);
        throw new Error("Update failed");
      }

      toast({
        title: "Updated",
        description: `Saved ${col} for ${idsToUpdate.length} record(s).`,
      });
    } catch (err) {
      console.error("Detailed sync error:", err);
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to save to database.",
      });
      fetchData(); // Rollback on error
    }
  };

  const handleDelete = async (idsToDelete: number[]) => {
    try {
      setLoading(true);
      const deletePromises = idsToDelete.map((id) => {
        const url = new URL(API_BASE_URL);
        url.searchParams.set("tableId", "accounts");
        url.searchParams.set("id", String(id));
        return fetch(url.toString(), { method: "DELETE" });
      });
      
      const results = await Promise.all(deletePromises);
      if (results.some(r => !r.ok)) throw new Error("Delete failed");
      
      setRows((prev) => prev.filter((r) => !idsToDelete.includes(r.Id)));
      toast({
        title: "Deleted",
        description: `Successfully deleted ${idsToDelete.length} records.`,
      });
    } catch (err) {
      toast({ variant: "destructive", title: "Delete Failed" });
      fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRow = async (newRowData: Partial<AccountRow>) => {
    try {
      const payload: any = {};
      Object.keys(newRowData).forEach((key) => {
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) {
          payload[key.toLowerCase()] = (newRowData as any)[key];
        }
      });

      const url = new URL(API_BASE_URL);
      url.searchParams.set("tableId", "accounts");

      const res = await fetch(url.toString(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      
      if (!res.ok) {
        const errorMsg = await res.text();
        console.error("Create failed:", errorMsg);
        throw new Error("Creation failed");
      }

      const created = await res.json();
      // Normalize and add to state
      const normalized = {
        ...created,
        Id: created.id || created.Id,
        "Created Time": created.created_at || created["Created Time"],
      };
      setRows((prev) => [...prev, normalized]);
      toast({ title: "Success", description: "New account created." });
    } catch (err) {
      toast({ variant: "destructive", title: "Creation Failed" });
    }
  };

  return {
    rows,
    loading,
    columns,
    visibleColumns,
    setVisibleColumns,
    colWidths,
    setColWidths: setColWidthsPersist,
    sortConfig,
    setSortConfig: setSortConfigPersist,
    fetchData,
    handleInlineUpdate,
    handleDelete,
    handleCreateRow,
    HIDDEN_FIELDS,
    SMALL_WIDTH_COLS,
    NON_EDITABLE_FIELDS,
  };
}