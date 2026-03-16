import { useEffect, useRef, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import { fetchProspects, updateProspect, createProspect, deleteProspect } from "../api/prospectsApi";
import type {
  DataTableRow,
  SortConfig,
} from "@/components/DataTable/DataTable";

interface ProspectRow extends DataTableRow {
  [key: string]: any;
}

const SMALL_WIDTH_COLS = [
  "status",
  "priority",
  "source",
  "country",
  "city",
];

const HIDDEN_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "nc_order",
  "Accounts_id",
];

const NON_EDITABLE_FIELDS = [
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
];

export function useProspectsData(currentAccountId?: number) {
  const [rows, setRows] = useState<ProspectRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [visibleColumns, setVisibleColumns] = useState<string[]>([]);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    const saved = localStorage.getItem("prospects_col_widths");
    return saved ? JSON.parse(saved) : {};
  });

  const [sortConfig, setSortConfig] = useState<SortConfig>(() => {
    const saved = localStorage.getItem("prospects_sort");
    return saved ? JSON.parse(saved) : { key: "", direction: null };
  });

  const { toast } = useToast();
  const pendingSaves = useRef<Record<string, number>>({});

  const DEFAULT_VISIBLE_COLUMNS = ["name", "company", "niche", "status", "priority", "city", "next_action"];

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchProspects();
      const list = data.map((row: any) => ({
        ...row,
        Id: row.Id ?? row.id,
        "Created Time": row["Created Time"] ?? row.created_at ?? row.createdAt,
        "Last Modified Time": row["Last Modified Time"] ?? row.updated_at ?? row.updatedAt,
      }));
      setRows(list);

      if (list.length > 0) {
        const allKeys = Object.keys(list[0]);

        // Build ordered columns: prioritize prospect-relevant fields
        let ordered: string[] = [];

        const prospectFieldOrder = [
          "name", "company", "niche", "country", "city", "website",
          "phone", "email", "company_linkedin", "source", "status", "priority",
          "notes", "next_action",
        ];

        prospectFieldOrder.forEach((k) => {
          if (allKeys.includes(k)) ordered.push(k);
        });

        // Add remaining fields not already included and not hidden
        allKeys.forEach((k) => {
          if (
            !ordered.includes(k) &&
            !HIDDEN_FIELDS.includes(k) &&
            ![
              "created_at",
              "updated_at",
              "createdAt",
              "updatedAt",
              "Created Time",
              "Last Modified Time",
              "Id",
              "id",
            ].includes(k)
          ) {
            ordered.push(k);
          }
        });

        // Add timestamps at the end
        ["Created Time", "Last Modified Time"].forEach((k) => {
          if (allKeys.includes(k)) ordered.push(k);
        });

        const finalCols = ordered.filter((c) => !HIDDEN_FIELDS.includes(c));
        setColumns(finalCols);
        setVisibleColumns(DEFAULT_VISIBLE_COLUMNS.filter((c) => finalCols.includes(c)));

        const savedWidths = localStorage.getItem("prospects_col_widths");
        const initialWidths: { [key: string]: number } = savedWidths
          ? JSON.parse(savedWidths)
          : {};
        finalCols.forEach((col) => {
          if (!initialWidths[col]) {
            if (SMALL_WIDTH_COLS.includes(col)) initialWidths[col] = 120;
            else initialWidths[col] = 180;
          }
        });
        setColWidths(initialWidths);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(err instanceof Error ? err : new Error(msg));
      toast({ variant: "destructive", title: "Could not load prospects", description: msg });
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
    localStorage.setItem("prospects_col_widths", JSON.stringify(next));
  };

  const setSortConfigPersist = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("prospects_sort", JSON.stringify(next));
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
        updateProspect(id, { [col]: cleanValue })
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
      const deletePromises = idsToDelete.map((id) => deleteProspect(id));
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

  const handleCreateRow = async (newRowData: Partial<ProspectRow>) => {
    try {
      const payload: any = {};
      Object.keys(newRowData).forEach((key) => {
        if (!NON_EDITABLE_FIELDS.includes(key) && !HIDDEN_FIELDS.includes(key)) {
          payload[key] = (newRowData as any)[key];
        }
      });

      const created = await createProspect(payload);
      const normalized = {
        ...created,
        Id: created.id || created.Id,
        "Created Time": created.created_at || created["Created Time"],
      };
      setRows((prev) => [...prev, normalized]);
      toast({ title: "Success", description: "New prospect created." });
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
