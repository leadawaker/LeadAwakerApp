// src/features/accounts/hooks/useAccountsData.ts
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";
import type { DataTableRow, SortConfig } from "@/components/DataTable/DataTable";
import {
  listAccounts,
  updateAccount,
  createAccount,
  deleteAccounts,
  type Account,
} from "../api/accountsApi";

type AccountRow = DataTableRow & Account;

// constants like SMALL_WIDTH_COLS, HIDDEN_FIELDS, etc. can live here
// or in a separate config file inside features/accounts if they get big.

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

  const fetchData = async () => {
    setLoading(true);
    try {
      const list = await listAccounts(
        currentAccountId ? { accountId: currentAccountId } : undefined,
      );
      const typed = list as AccountRow[];
      setRows(typed);

      if (typed.length > 0) {
        const allKeys = Object.keys(typed[0]);
        // reuse your existing column ordering logic here
        // const finalCols = ...
        // setColumns(finalCols);
        // setVisibleColumns(finalCols);
        // init colWidths defaults if needed
      }
    } catch {
      toast({ variant: "destructive", title: "Error fetching accounts" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [currentAccountId]);

  const handleInlineUpdate = async (
    rowId: number,
    col: string,
    value: any,
  ) => {
    const cleanValue =
      value === null || value === undefined ? "" : value;

    setRows((prev) =>
      prev.map((r) => (r.Id === rowId ? { ...r, [col]: cleanValue } : r)),
    );

    try {
      await updateAccount(rowId, { [col]: cleanValue } as any);
    } catch {
      toast({
        variant: "destructive",
        title: "Sync Error",
        description: "Failed to save to database.",
      });
      fetchData();
    }
  };

  const handleDelete = async (ids: number[]) => {
    setLoading(true);
    try {
      await deleteAccounts(ids);
      setRows((prev) => prev.filter((r) => !ids.includes(r.Id)));
      toast({
        title: "Deleted",
        description: `Successfully deleted ${ids.length} records.`,
      });
    } catch {
      toast({ variant: "destructive", title: "Delete Failed" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRow = async (payload: Partial<AccountRow>) => {
    const created = await createAccount(payload);
    setRows((prev) => [...prev, created as AccountRow]);
  };

  const setColWidthsPersist = (next: Record<string, number>) => {
    setColWidths(next);
    localStorage.setItem("accounts_col_widths", JSON.stringify(next));
  };

  const setSortConfigPersist = (next: SortConfig) => {
    setSortConfig(next);
    localStorage.setItem("accounts_sort", JSON.stringify(next));
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
  };
}