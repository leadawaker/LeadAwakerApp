import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type {
  DataTableRow,
  SortConfig,
} from "@/components/DataTable/DataTable";

interface AccountRow extends DataTableRow {
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
      const url = new URL(NOCODB_BASE_URL);
      url.searchParams.set("tableId", TABLE_ID);
      // If you later want to filter by currentAccountId:
      // if (currentAccountId) url.searchParams.set("account_id", String(currentAccountId));

      const res = await fetch(url.toString());
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
      const data = await res.json();
      const list = (data.list || []) as AccountRow[];
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

  const handleInlineUpdate = (
    rowId: number,
    col: string,
    value: any,
    selectedIds: number[] = [],
  ) => {
    if (NON_EDITABLE_FIELDS.includes(col)) return;
    const cleanValue = value === null || value === undefined ? "" : value;

    const idsToUpdate = selectedIds.includes(rowId) ? selectedIds : [rowId];

    // optimistic local update
    setRows((prev) => {
      const newRows = [...prev];
      idsToUpdate.forEach((id) => {
        const idx = newRows.findIndex((r) => r.Id === id);
        if (idx !== -1) newRows[idx] = { ...newRows[idx], [col]: cleanValue };
      });
      return newRows;
    });

    // debounce server save per (rowId, col)
    const key = `${rowId}:${col}`;
    const existingTimeoutId = pendingSaves.current[key];
    if (existingTimeoutId) {
      window.clearTimeout(existingTimeoutId);
    }

    const timeoutId = window.setTimeout(async () => {
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
      } finally {
        delete pendingSaves.current[key];
      }
    }, 500); // wait 500ms after last change to this cell

    pendingSaves.current[key] = timeoutId;
  };

  const handleDelete = async (idsToDelete: number[]) => {
    try {
      setLoading(true);
      const deletePromises = idsToDelete.map((id) =>
        fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}&id=${id}`, {
          method: "DELETE",
        }),
      );
      await Promise.all(deletePromises);
      toast({
        title: "Deleted",
        description: `Successfully deleted ${idsToDelete.length} records.`,
      });
      setRows((prev) => prev.filter((r) => !idsToDelete.includes(r.Id)));
    } catch (err) {
      toast({ variant: "destructive", title: "Delete Failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRow = async (newRowData: Partial<AccountRow>) => {
    try {
      const cleanData: any = {};
      Object.keys(newRowData).forEach((key) => {
        if (
          !NON_EDITABLE_FIELDS.includes(key) &&
          !HIDDEN_FIELDS.includes(key)
        ) {
          cleanData[key] = (newRowData as any)[key];
        }
      });

      const res = await fetch(`${NOCODB_BASE_URL}?tableId=${TABLE_ID}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cleanData),
      });
      if (!res.ok) throw new Error("Creation failed");

      const created = (await res.json()) as AccountRow;
      setRows((prev) => [...prev, created]);
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