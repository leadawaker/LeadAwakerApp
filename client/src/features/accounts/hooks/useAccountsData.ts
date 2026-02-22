import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchAccounts, updateAccount, createAccount, deleteAccount } from "../api/accountsApi";
import type {
  DataTableRow,
  SortConfig,
} from "@/components/DataTable/DataTable";

interface AccountRow extends DataTableRow {
  [key: string]: any;
}

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
  "accounts_id",
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
  "password_hash",
  "passwordHash",
  "nc_order",
  "ncOrder",
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
  const [error, setError] = useState<Error | null>(null);
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
  const pendingSaves = useRef<Record<string, number>>({});

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchAccounts();
      const list = data.map((row: any) => ({
        ...row,
        Id: row.Id ?? row.id,
        "Created Time": row["Created Time"] ?? row.created_at ?? row.createdAt,
        "Last Modified Time": row["Last Modified Time"] ?? row.updated_at ?? row.updatedAt,
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
              "createdAt",
              "updatedAt",
              "Created Time",
              "Last Modified Time",
              "Id",
              "id",
              "Account ID",
              "business_hours_open",
              "business_hours_closed",
            ].includes(k) &&
            !HIDDEN_FIELDS.includes(k)
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
            if (col === "Id" || col === "Account ID") initialWidths[col] = 56;
            else if (col === "Image") initialWidths[col] = 52;
            else if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 120;
            else initialWidths[col] = 180;
          }
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
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
      const updatePromises = idsToUpdate.map((id) =>
        updateAccount(id, { [col]: cleanValue })
      );

      await Promise.all(updatePromises);

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
      const deletePromises = idsToDelete.map((id) => deleteAccount(id));
      await Promise.all(deletePromises);

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
          payload[key] = (newRowData as any)[key];
        }
      });

      const created = await createAccount(payload);
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
    error,
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
