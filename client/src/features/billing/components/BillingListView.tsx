import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { deleteExpense as deleteExpenseApi } from "../api/expensesApi";
import {
  Search,
  SlidersHorizontal,
  Building2,
  Receipt,
  FileText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  ReceiptText,
  LayoutList,
  LayoutGrid,
  Plus,
  Pencil,
  Copy,
  Trash2,
  CheckCircle2,
  SendHorizontal,
  ArrowUpDown,
  CalendarDays,
  Filter,
  Eye,
  ListTree,
  Printer,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ViewTabBar, type TabDef } from "@/components/ui/view-tab-bar";
import { IconBtn } from "@/components/ui/icon-btn";
import { cn } from "@/lib/utils";
import { useAccounts } from "@/hooks/useApiData";
import { isOverdue, INVOICE_STATUS_COLORS, CONTRACT_STATUS_COLORS } from "../types";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../types";
import { InvoiceCard } from "./InvoiceCard";
import { ContractCard } from "./ContractCard";
import { InvoiceDetailView, InvoiceDetailViewEmpty } from "./InvoiceDetailView";
import { ContractDetailView } from "./ContractDetailView";
import { InvoiceCreatePanel } from "./InvoiceCreatePanel";
import { ContractUploadDialog } from "./ContractUploadDialog";
import { ContractCreatePanel } from "./ContractCreatePanel";
import { ExpensesView } from "./ExpensesView";
import { InvoicesInlineTable, INVOICE_FIELD_DEFS, ALL_INVOICE_COLS, DEFAULT_INVOICE_COLS } from "./InvoicesInlineTable";
import { ContractsInlineTable, CONTRACT_FIELD_DEFS, ALL_CONTRACT_COLS, DEFAULT_CONTRACT_COLS } from "./ContractsInlineTable";
import { ExpensesListView, useExpensesData } from "./ExpensesListView";
import { ExpenseDetailView, ExpenseDetailViewEmpty } from "./ExpenseDetailView";
import { ExpenseCreatePanel } from "./ExpenseCreatePanel";

// ── Types ────────────────────────────────────────────────────────────────────

type BillingTab = "invoices" | "contracts" | "expenses";
type SortBy = "recent" | "amount_desc" | "amount_asc" | "due_asc" | "name_asc";
export type RightPanelMode = "view" | "create" | "edit";

// ── Tab definitions ──────────────────────────────────────────────────────────

const BILLING_TABS_AGENCY: TabDef[] = [
  { id: "invoices",  label: "Invoices",  icon: Receipt  },
  { id: "expenses",  label: "Expenses",  icon: ReceiptText },
  { id: "contracts", label: "Contracts", icon: FileText },
];

const BILLING_TABS_CLIENT: TabDef[] = [
  { id: "invoices",  label: "Invoices",  icon: Receipt  },
  { id: "contracts", label: "Contracts", icon: FileText },
];

const VIEW_MODE_TABS: TabDef[] = [
  { id: "list",  label: "List",  icon: LayoutList  },
  { id: "table", label: "Table", icon: LayoutGrid  },
];

// ── Status filter options ────────────────────────────────────────────────────

const INVOICE_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"];
const CONTRACT_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Signed", "Expired", "Cancelled"];

// ── Sort labels ──────────────────────────────────────────────────────────────

const SORT_LABELS: Record<SortBy, string> = {
  recent:      "Most Recent",
  amount_desc: "Amount High",
  amount_asc:  "Amount Low",
  due_asc:     "Due Soonest",
  name_asc:    "Name A–Z",
};


// ── Date grouping ────────────────────────────────────────────────────────────

function getDateGroupLabel(dateStr: string | null | undefined): string {
  if (!dateStr) return "No Date";
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86_400_000);
    if (diff <= 0)  return "Today";
    if (diff === 1) return "Yesterday";
    if (diff < 7)   return "This Week";
    if (diff < 30)  return "This Month";
    if (diff < 90)  return "Last 3 Months";
    return "Older";
  } catch { return "No Date"; }
}

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Date"];

type BillingListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "invoice"; invoice: InvoiceRow }
  | { kind: "contract"; contract: ContractRow };

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-1.5 pb-1.5">
      <div className="flex items-center gap-0">
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
        <span className="text-[10px] font-bold text-foreground/55 uppercase tracking-widest shrink-0">{label}</span>
        <span className="ml-1 text-[9px] text-muted-foreground/45 font-semibold shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15 mx-[8px]" />
      </div>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// ── Skeleton loader ──────────────────────────────────────────────────────────

function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-foreground/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-foreground/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-foreground/8 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface BillingListViewProps {
  activeTab: BillingTab;
  onTabChange: (tab: string) => void;
  // Invoice data
  invoices: InvoiceRow[];
  invoicesLoading: boolean;
  selectedInvoice: InvoiceRow | null;
  onSelectInvoice: (invoice: InvoiceRow | null) => void;
  onCreateInvoice: (payload: Record<string, any>) => Promise<InvoiceRow>;
  onUpdateInvoice: (id: number, patch: Record<string, any>) => Promise<InvoiceRow>;
  onDeleteInvoice: (id: number) => Promise<void>;
  onMarkSent: (id: number) => Promise<InvoiceRow>;
  onMarkPaid: (id: number) => Promise<InvoiceRow>;
  onRefreshInvoices: () => Promise<void>;
  // Contract data
  contracts: ContractRow[];
  contractsLoading: boolean;
  selectedContract: ContractRow | null;
  onSelectContract: (contract: ContractRow | null) => void;
  onCreateContract: (payload: Record<string, any>) => Promise<ContractRow>;
  onUpdateContract: (id: number, patch: Record<string, any>) => Promise<ContractRow>;
  onDeleteContract: (id: number) => Promise<void>;
  onMarkSigned: (id: number) => Promise<ContractRow>;
  onRefreshContracts: () => Promise<void>;
  // Controls
  listSearch: string;
  setListSearch: (v: string) => void;
  searchOpen: boolean;
  setSearchOpen: (v: boolean) => void;
  sortBy: SortBy;
  setSortBy: (v: SortBy) => void;
  filterStatus: string[];
  setFilterStatus: (v: string[]) => void;
  // Account filter
  accountFilter: number | "all";
  setAccountFilter: (v: number | "all") => void;
  isAgencyUser: boolean;
  // Panel mode (replaces dialogs for invoices)
  rightPanelMode: RightPanelMode;
  setRightPanelMode: (v: RightPanelMode) => void;
  editingInvoice: InvoiceRow | null;
  setEditingInvoice: (v: InvoiceRow | null) => void;
  // Upload dialog (contracts only)
  uploadDialogOpen: boolean;
  setUploadDialogOpen: (v: boolean) => void;
  // View mode
  viewMode: "list" | "table";
  setViewMode: (v: "list" | "table") => void;
  // Quarter/year filters
  quarterFilter: string | null;
  setQuarterFilter: (v: string | null) => void;
  yearFilter: number | null;
  setYearFilter: (v: number | null) => void;
}

// ── Main component ───────────────────────────────────────────────────────────

export function BillingListView({
  activeTab,
  onTabChange,
  // Invoice data
  invoices,
  invoicesLoading,
  selectedInvoice,
  onSelectInvoice,
  onCreateInvoice,
  onUpdateInvoice,
  onDeleteInvoice,
  onMarkSent,
  onMarkPaid,
  onRefreshInvoices,
  // Contract data
  contracts,
  contractsLoading,
  selectedContract,
  onSelectContract,
  onCreateContract,
  onUpdateContract,
  onDeleteContract,
  onMarkSigned,
  onRefreshContracts,
  // Controls
  listSearch,
  setListSearch,
  searchOpen,
  setSearchOpen,
  sortBy,
  setSortBy,
  filterStatus,
  setFilterStatus,
  // Account filter
  accountFilter,
  setAccountFilter,
  isAgencyUser,
  // Panel mode
  rightPanelMode,
  setRightPanelMode,
  editingInvoice,
  setEditingInvoice,
  // Upload dialog
  uploadDialogOpen,
  setUploadDialogOpen,
  // View mode
  viewMode,
  setViewMode,
  // Quarter/year filters
  quarterFilter,
  setQuarterFilter,
  yearFilter,
  setYearFilter,
}: BillingListViewProps) {
  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [duplicatingInvoice, setDuplicatingInvoice] = useState<InvoiceRow | null>(null);

  // Multi-select state for inline tables
  const [invoiceSelectedIds, setInvoiceSelectedIds] = useState<Set<number>>(new Set());
  const [contractSelectedIds, setContractSelectedIds] = useState<Set<number>>(new Set());

  // Sheet for table-mode create/edit/duplicate
  const [createSheetOpen, setCreateSheetOpen] = useState(false);

  // Expense create panel
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);

  // Expense selection + search state (list mode)
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [expenseSearch, setExpenseSearch] = useState("");
  const [expenseSearchOpen, setExpenseSearchOpen] = useState(false);
  const [expenseSelectedIds, setExpenseSelectedIds] = useState<Set<number>>(new Set());
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);

  // Column visibility for table mode
  const [visibleInvoiceColumns, setVisibleInvoiceColumns] = useState<Set<string>>(new Set(DEFAULT_INVOICE_COLS));
  const [visibleContractColumns, setVisibleContractColumns] = useState<Set<string>>(new Set(DEFAULT_CONTRACT_COLS));

  // Toolbar popover states (table mode)
  const [toolbarSortOpen, setToolbarSortOpen] = useState(false);
  const [toolbarDateOpen, setToolbarDateOpen] = useState(false);
  const [toolbarFilterOpen, setToolbarFilterOpen] = useState(false);
  const [toolbarFieldsOpen, setToolbarFieldsOpen] = useState(false);
  const [toolbarGroupOpen, setToolbarGroupOpen] = useState(false);
  const [expenseGroupBy, setExpenseGroupBy] = useState<"none" | "year_quarter">("year_quarter");
  const [invoiceGroupBy, setInvoiceGroupBy] = useState<"none" | "year_quarter">("year_quarter");
  const [expenseExportTrigger, setExpenseExportTrigger] = useState(0);

  // Responsive toolbar state
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);
  const [tableSearchExpanded, setTableSearchExpanded] = useState(true);

  // Accounts for filter dropdown (agency only)
  const { accounts } = useAccounts({ enabled: isAgencyUser });

  // Expenses data (for auto-selection of latest + available years on expenses tab)
  const { data: expensesData } = useExpensesData();

  // Expenses tab is only for agency users — redirect to invoices if non-agency tries to access
  useEffect(() => {
    if (activeTab === "expenses" && !isAgencyUser) {
      onTabChange("invoices");
    }
  }, [activeTab, isAgencyUser, onTabChange]);

  // ── Responsive toolbar: collapse to icon circles when narrow ───────────────
  useEffect(() => {
    const el = toolbarRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => {
      const w = entry.contentRect.width;
      setIsNarrow(w < 920);
      if (w >= 920) setTableSearchExpanded(false);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // ── Auto-generate next invoice number ─────────────────────────────────────
  const nextInvoiceNumber = useMemo(() => {
    const year = new Date().getFullYear();
    if (invoices.length === 0) return `INV-${year}-001`;
    const maxNum = invoices.reduce((max, inv) => {
      const match = String(inv.invoice_number || "").match(/(\d+)$/);
      const n = match ? parseInt(match[1], 10) : 0;
      return Math.max(max, n);
    }, 0);
    return `INV-${year}-${String(maxNum + 1).padStart(3, "0")}`;
  }, [invoices]);

  // ── Filtered & sorted invoices ─────────────────────────────────────────────

  const filteredInvoices = useMemo(() => {
    let result = [...invoices];

    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      result = result.filter((i) =>
        String(i.title || "").toLowerCase().includes(q) ||
        String(i.invoice_number || "").toLowerCase().includes(q) ||
        String(i.account_name || "").toLowerCase().includes(q)
      );
    }

    if (filterStatus.length > 0) {
      result = result.filter((i) => {
        const status = isOverdue(i) ? "Overdue" : String(i.status || "");
        return filterStatus.includes(status);
      });
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "amount_desc": return parseFloat(String(b.total || "0")) - parseFloat(String(a.total || "0"));
        case "amount_asc":  return parseFloat(String(a.total || "0")) - parseFloat(String(b.total || "0"));
        case "due_asc":     return (a.due_date || "9999").localeCompare(b.due_date || "9999");
        case "name_asc":    return String(a.title || "").localeCompare(String(b.title || ""));
        default:            return (b.created_at || "").localeCompare(a.created_at || "");
      }
    });

    if (quarterFilter) {
      result = result.filter((i) => {
        const dateStr = i.issued_date || i.created_at;
        if (!dateStr) return false;
        const m = new Date(dateStr).getMonth();
        const q = m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
        return q === quarterFilter;
      });
    }
    if (yearFilter) {
      result = result.filter((i) => {
        const dateStr = i.issued_date || i.created_at;
        if (!dateStr) return false;
        return new Date(dateStr).getFullYear() === yearFilter;
      });
    }

    return result;
  }, [invoices, listSearch, filterStatus, sortBy, quarterFilter, yearFilter]);

  // ── Filtered & sorted contracts ────────────────────────────────────────────

  const filteredContracts = useMemo(() => {
    let result = [...contracts];

    if (listSearch.trim()) {
      const q = listSearch.toLowerCase();
      result = result.filter((c) =>
        String(c.title || "").toLowerCase().includes(q) ||
        String(c.account_name || "").toLowerCase().includes(q) ||
        String(c.description || "").toLowerCase().includes(q)
      );
    }

    if (filterStatus.length > 0) {
      result = result.filter((c) => filterStatus.includes(String(c.status || "")));
    }

    result.sort((a, b) => {
      switch (sortBy) {
        case "name_asc": return String(a.title || "").localeCompare(String(b.title || ""));
        case "due_asc":  return (a.end_date || "9999").localeCompare(b.end_date || "9999");
        default:         return (b.created_at || "").localeCompare(a.created_at || "");
      }
    });

    if (quarterFilter) {
      result = result.filter((c) => {
        const dateStr = c.start_date || c.created_at;
        if (!dateStr) return false;
        const m = new Date(dateStr).getMonth();
        const q = m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4";
        return q === quarterFilter;
      });
    }
    if (yearFilter) {
      result = result.filter((c) => {
        const dateStr = c.start_date || c.created_at;
        if (!dateStr) return false;
        return new Date(dateStr).getFullYear() === yearFilter;
      });
    }

    return result;
  }, [contracts, listSearch, filterStatus, sortBy, quarterFilter, yearFilter]);

  // ── Current list ───────────────────────────────────────────────────────────

  const isInvoicesTab = activeTab === "invoices";
  const isExpensesTab = activeTab === "expenses";
  const currentGroupBy = isExpensesTab ? expenseGroupBy : invoiceGroupBy;
  const setCurrentGroupBy = isExpensesTab
    ? (v: "none" | "year_quarter") => setExpenseGroupBy(v)
    : (v: "none" | "year_quarter") => setInvoiceGroupBy(v);
  const currentList = isInvoicesTab ? filteredInvoices : filteredContracts;
  const isLoading = isInvoicesTab ? invoicesLoading : contractsLoading;
  const totalCount = isExpensesTab ? 0 : currentList.length;
  const maxPage = Math.max(0, Math.ceil(totalCount / PAGE_SIZE) - 1);

  const paginatedItems = useMemo(() => {
    if (isExpensesTab) return [];
    const start = currentPage * PAGE_SIZE;
    return currentList.slice(start, start + PAGE_SIZE);
  }, [currentList, currentPage, isExpensesTab]);

  // ── Grouped items for date-grouped rendering ─────────────────────────────
  const flatItems = useMemo((): BillingListItem[] => {
    if (paginatedItems.length === 0) return [];

    const buckets = new Map<string, (InvoiceRow | ContractRow)[]>();

    for (const item of paginatedItems) {
      const dateField = isInvoicesTab
        ? ((item as InvoiceRow).issued_date || (item as InvoiceRow).created_at)
        : ((item as ContractRow).start_date || (item as ContractRow).created_at);
      const key = getDateGroupLabel(dateField);
      if (!buckets.has(key)) buckets.set(key, []);
      buckets.get(key)!.push(item);
    }

    const orderedKeys = DATE_GROUP_ORDER.filter((k) => buckets.has(k));
    const result: BillingListItem[] = [];

    for (const key of orderedKeys) {
      const group = buckets.get(key);
      if (!group?.length) continue;
      result.push({ kind: "header", label: key, count: group.length });
      for (const g of group) {
        if (isInvoicesTab) {
          result.push({ kind: "invoice", invoice: g as InvoiceRow });
        } else {
          result.push({ kind: "contract", contract: g as ContractRow });
        }
      }
    }

    return result;
  }, [paginatedItems, isInvoicesTab]);

  // ── Only show selectedInvoice if it still exists in the current invoices array
  const effectiveSelectedInvoice = selectedInvoice && invoices.some((i) => i.id === selectedInvoice.id)
    ? selectedInvoice
    : null;

  // Reset page on filter/sort/tab change
  useEffect(() => { setCurrentPage(0); }, [listSearch, filterStatus, sortBy, activeTab]);

  // Auto-select first item
  useEffect(() => {
    if (isInvoicesTab && !effectiveSelectedInvoice && filteredInvoices.length > 0 && rightPanelMode === "view") {
      onSelectInvoice(filteredInvoices[0]);
    }
  }, [filteredInvoices, effectiveSelectedInvoice, isInvoicesTab, rightPanelMode, onSelectInvoice]);

  useEffect(() => {
    if (!isInvoicesTab && !isExpensesTab && !selectedContract && filteredContracts.length > 0) {
      onSelectContract(filteredContracts[0]);
    }
  }, [filteredContracts, selectedContract, isInvoicesTab, isExpensesTab, onSelectContract]);

  // Auto-select latest expense when switching to expenses tab (list mode)
  useEffect(() => {
    if (isExpensesTab && !selectedExpenseId && expensesData && expensesData.length > 0 && viewMode === "list") {
      const sorted = [...expensesData].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
      setSelectedExpenseId(sorted[0].id);
    }
  }, [isExpensesTab, selectedExpenseId, expensesData, viewMode]);

  // ── Status filter helpers ──────────────────────────────────────────────────

  const statusOptions = isInvoicesTab ? INVOICE_STATUS_OPTIONS : CONTRACT_STATUS_OPTIONS;
  const statusColors = isInvoicesTab ? INVOICE_STATUS_COLORS : CONTRACT_STATUS_COLORS;
  const isFilterActive = filterStatus.length > 0;
  const isSortNonDefault = sortBy !== "recent";
  const isSettingsActive = isFilterActive || isSortNonDefault || !!quarterFilter || !!yearFilter;
  // Table-mode computed active states
  const isDateActive = !!quarterFilter || !!yearFilter;
  const isTableFilterActive = filterStatus.length > 0 || (isAgencyUser && !isExpensesTab && accountFilter !== "all");

  const toggleFilterStatus = (s: string) => {
    setFilterStatus(
      filterStatus.includes(s)
        ? filterStatus.filter((x) => x !== s)
        : [...filterStatus, s]
    );
  };

  // ── Available years for year filter dropdown ───────────────────────────────

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    if (isExpensesTab) {
      (expensesData ?? []).forEach((r) => {
        const y = r.year ?? (r.date ? new Date(r.date).getFullYear() : null);
        if (y) years.add(y);
      });
    } else {
      const allItems = isInvoicesTab
        ? invoices.map((i) => i.issued_date || i.created_at)
        : contracts.map((c) => c.start_date || c.created_at);
      allItems.forEach((d) => {
        if (d) { try { years.add(new Date(d).getFullYear()); } catch { /* ignore */ } }
      });
    }
    return Array.from(years).sort((a, b) => b - a); // descending
  }, [invoices, contracts, isInvoicesTab, isExpensesTab, expensesData]);

  // ── Tabs ──────────────────────────────────────────────────────────────────
  const billingTabs = isAgencyUser ? BILLING_TABS_AGENCY : BILLING_TABS_CLIENT;

  // ── Add button handler ─────────────────────────────────────────────────────

  function handleAddClick() {
    if (isInvoicesTab) {
      setEditingInvoice(null);
      setDuplicatingInvoice(null);
      if (viewMode === "table") {
        setCreateSheetOpen(true);
      } else {
        setRightPanelMode("create");
      }
    } else if (activeTab === "contracts") {
      onSelectContract(null);
      if (viewMode === "table") {
        setCreateSheetOpen(true);
      } else {
        setRightPanelMode("create");
      }
    }
  }

  // ── Duplicate handler ──────────────────────────────────────────────────────

  const handleDuplicate = useCallback((invoice: InvoiceRow) => {
    setDuplicatingInvoice(invoice);
    setEditingInvoice(null);
    if (viewMode === "table") {
      setCreateSheetOpen(true);
    } else {
      setRightPanelMode("create");
    }
  }, [setEditingInvoice, setRightPanelMode, viewMode]);

  // ── Handle invoice select (closes create panel in list mode) ───────────────

  function handleSelectInvoice(invoice: InvoiceRow) {
    onSelectInvoice(invoice);
    setRightPanelMode("view");
  }

  // ── Table-mode action handlers ─────────────────────────────────────────────

  function handleTableEdit() {
    const id = Array.from(invoiceSelectedIds)[0];
    const inv = filteredInvoices.find((i) => i.id === id);
    if (!inv) return;
    setEditingInvoice(inv);
    setDuplicatingInvoice(null);
    setCreateSheetOpen(true);
  }

  function handleTableDuplicate() {
    const id = Array.from(invoiceSelectedIds)[0];
    const inv = filteredInvoices.find((i) => i.id === id);
    if (!inv) return;
    setDuplicatingInvoice(inv);
    setEditingInvoice(null);
    setCreateSheetOpen(true);
  }

  async function handleTableDeleteInvoices() {
    const ids = Array.from(invoiceSelectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} invoice${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    for (const id of ids) {
      await onDeleteInvoice(id);
    }
    setInvoiceSelectedIds(new Set());
  }

  async function handleTableMarkPaid() {
    for (const id of Array.from(invoiceSelectedIds)) {
      await onMarkPaid(id);
    }
  }

  async function handleTableMarkSent() {
    for (const id of Array.from(invoiceSelectedIds)) {
      await onMarkSent(id);
    }
  }

  async function handleTableDeleteContracts() {
    const ids = Array.from(contractSelectedIds);
    if (!ids.length) return;
    if (!window.confirm(`Delete ${ids.length} contract${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
    for (const id of ids) {
      await onDeleteContract(id);
    }
    setContractSelectedIds(new Set());
  }

  async function handleTableMarkSigned() {
    const id = Array.from(contractSelectedIds)[0];
    if (!id) return;
    await onMarkSigned(id);
  }

  // ── Right panel: which content to show ────────────────────────────────────

  const showCreatePanel = isInvoicesTab && (rightPanelMode === "create" || rightPanelMode === "edit");

  // ── Send/Paid contextual button — shows "Send" or "Paid" based on selection ─

  const selectedInvoicesArr = useMemo(
    () => filteredInvoices.filter((i) => invoiceSelectedIds.has(i.id)),
    [filteredInvoices, invoiceSelectedIds]
  );

  const invoiceSendPaidAction = useMemo(() => {
    if (selectedInvoicesArr.length === 0) return "send" as const;
    const allSentOrViewed = selectedInvoicesArr.every(
      (i) => i.status === "Sent" || i.status === "Viewed"
    );
    return allSentOrViewed ? ("paid" as const) : ("send" as const);
  }, [selectedInvoicesArr]);

  // ── Toolbar button base classes ────────────────────────────────────────────

  const tbBase = "h-10 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors whitespace-nowrap shrink-0 select-none";
  const tbDefault = "border border-border/55 text-foreground/60 hover:text-foreground hover:bg-card";
  const tbActive = "bg-card border border-border/55 text-foreground";

  // ── Left panel header (list mode) ─────────────────────────────────────────

  const leftPanelHeader = (
    <>
      {/* Header row 1: title + printer (expenses only) */}
      <div className="px-3 pt-5 pb-1 shrink-0">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight shrink-0">
            {isExpensesTab ? "Expenses" : isInvoicesTab ? "Invoices" : "Contracts"}
          </h2>
          {isExpensesTab && viewMode === "list" && (
            <IconBtn
              onClick={() => setExpenseExportTrigger((t) => t + 1)}
              title="Export PDF"
            >
              <Printer className="h-3.5 w-3.5" />
            </IconBtn>
          )}
        </div>
      </div>

      {/* Header row 2: view mode toggle + search + settings */}
      <div className="px-3 pt-1 pb-2 shrink-0 flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <ViewTabBar
            tabs={VIEW_MODE_TABS}
            activeId={viewMode}
            onTabChange={(m) => setViewMode(m as "list" | "table")}
          />
        </div>

        {/* Expenses circle add button (list mode only) */}
        {isExpensesTab && isAgencyUser && viewMode === "list" && (
          <IconBtn
            onClick={() => setExpensePanelOpen(true)}
            title="Add Expense"
          >
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        )}

        {/* Invoice/Contract circle add button (list mode only) */}
        {!isExpensesTab && isAgencyUser && viewMode === "list" && (
          <IconBtn
            onClick={handleAddClick}
            title={isInvoicesTab ? "New Invoice" : "New Contract"}
          >
            <Plus className="h-3.5 w-3.5" />
          </IconBtn>
        )}

        {/* Expense search (list mode) */}
        {isExpensesTab && viewMode === "list" && (
          <Popover open={expenseSearchOpen} onOpenChange={setExpenseSearchOpen}>
            <PopoverTrigger asChild>
              <IconBtn active={!!expenseSearch} title="Search">
                <Search className="h-3.5 w-3.5" />
              </IconBtn>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-56 p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder="Search expenses..."
                  value={expenseSearch}
                  onChange={(e) => setExpenseSearch(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                />
                {expenseSearch && (
                  <button
                    onClick={() => setExpenseSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Search — only show for non-expenses tab */}
        {!isExpensesTab && (
          <Popover open={searchOpen} onOpenChange={setSearchOpen}>
            <PopoverTrigger asChild>
              <IconBtn active={!!listSearch} title="Search">
                <Search className="h-3.5 w-3.5" />
              </IconBtn>
            </PopoverTrigger>
            <PopoverContent
              side="bottom"
              align="end"
              className="w-56 p-2"
              onOpenAutoFocus={(e) => e.preventDefault()}
            >
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                <input
                  autoFocus
                  type="text"
                  placeholder={isInvoicesTab ? "Search invoices..." : "Search contracts..."}
                  value={listSearch}
                  onChange={(e) => setListSearch(e.target.value)}
                  className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                />
                {listSearch && (
                  <button
                    onClick={() => setListSearch("")}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            </PopoverContent>
          </Popover>
        )}

        {/* Settings (merged filter + sort + account filter + quarter + year) */}
        <Popover open={settingsOpen} onOpenChange={setSettingsOpen}>
          <PopoverTrigger asChild>
            <IconBtn active={isSettingsActive} title="Filter & Sort">
              <SlidersHorizontal className="h-3.5 w-3.5" />
            </IconBtn>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="end" className="w-56 p-0 overflow-hidden">

            {/* Account filter (agency only, not on expenses tab) */}
            {isAgencyUser && !isExpensesTab && (
              <>
                <div className="px-3 pt-2.5 pb-1">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Account</span>
                </div>
                <div className="max-h-32 overflow-y-auto px-1 pb-1">
                  <button
                    onClick={() => setAccountFilter("all")}
                    className={cn(
                      "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                      accountFilter === "all" && "font-semibold text-brand-indigo"
                    )}
                  >
                    <span className="flex-1 text-left">All Accounts</span>
                    {accountFilter === "all" && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                  {accounts.map((acct) => (
                    <button
                      key={acct.id}
                      onClick={() => setAccountFilter(acct.id)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                        accountFilter === acct.id && "font-semibold text-brand-indigo"
                      )}
                    >
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left truncate">{acct.name}</span>
                      {accountFilter === acct.id && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  ))}
                </div>
                <div className="h-px bg-border/40 mx-1" />
              </>
            )}

            {/* Sort */}
            <div className="px-3 pt-2.5 pb-1">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Sort by</span>
            </div>
            <div className="px-1 pb-1">
              {(isExpensesTab
                ? ([
                    { key: "recent" as SortBy,      label: "Most Recent" },
                    { key: "amount_desc" as SortBy, label: "Amount High" },
                    { key: "amount_asc" as SortBy,  label: "Amount Low" },
                    { key: "name_asc" as SortBy,    label: "Supplier A–Z" },
                  ])
                : (Object.keys(SORT_LABELS) as SortBy[]).map((k) => ({ key: k, label: SORT_LABELS[k] }))
              ).map(({ key: opt, label }) => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                    sortBy === opt && "font-semibold text-brand-indigo"
                  )}
                >
                  <span className="flex-1 text-left">{label}</span>
                  {sortBy === opt && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
            </div>

            {/* Status filter (not on expenses tab) */}
            {!isExpensesTab && (
              <>
                <div className="h-px bg-border/40 mx-1" />
                <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
                  {isFilterActive && (
                    <button
                      onClick={() => setFilterStatus([])}
                      className="text-[9px] text-destructive hover:underline font-semibold"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <div className="px-1 pb-1">
                  {statusOptions.map((s) => {
                    const color = statusColors[s];
                    return (
                      <button
                        key={s}
                        onClick={() => toggleFilterStatus(s)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted"
                      >
                        <span
                          className="w-1.5 h-1.5 rounded-full shrink-0"
                          style={{ backgroundColor: color?.dot || "#94A3B8" }}
                        />
                        <span className="flex-1 text-left">{s}</span>
                        {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </>
            )}

            {/* Year filter — above Quarter */}
            {availableYears.length > 0 && (
              <>
                <div className="h-px bg-border/40 mx-1" />
                <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Year</span>
                  {yearFilter && (
                    <button onClick={() => setYearFilter(null)} className="text-[9px] text-destructive hover:underline font-semibold">Clear</button>
                  )}
                </div>
                <div className="px-1 pb-1">
                  {availableYears.map((year) => (
                    <button
                      key={year}
                      onClick={() => setYearFilter(yearFilter === year ? null : year)}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                        yearFilter === year && "font-semibold text-brand-indigo"
                      )}
                    >
                      <span className="flex-1 text-left">{year}</span>
                      {yearFilter === year && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}

            {/* Quarter filter */}
            <div className="h-px bg-border/40 mx-1" />
            <div className="px-3 pt-2.5 pb-1 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Quarter</span>
              {quarterFilter && (
                <button onClick={() => setQuarterFilter(null)} className="text-[9px] text-destructive hover:underline font-semibold">Clear</button>
              )}
            </div>
            <div className="px-1 pb-2">
              {[
                { id: "Q1", label: "Q1 — Jan – Mar" },
                { id: "Q2", label: "Q2 — Apr – Jun" },
                { id: "Q3", label: "Q3 – Jul – Sep" },
                { id: "Q4", label: "Q4 — Oct – Dec" },
              ].map(({ id, label }) => (
                <button
                  key={id}
                  onClick={() => setQuarterFilter(quarterFilter === id ? null : id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                    quarterFilter === id && "font-semibold text-brand-indigo"
                  )}
                >
                  <span className="flex-1 text-left">{label}</span>
                  {quarterFilter === id && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </>
  );

  // ── Card list (list mode, non-expenses tab) ────────────────────────────────

  const cardList = (
    <>
      {/* Card list */}
      <div className="flex-1 overflow-y-auto px-[3px]">
        {isLoading ? (
          <ListSkeleton />
        ) : flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            {isInvoicesTab ? (
              <Receipt className="w-8 h-8 text-muted-foreground/30 mb-3" />
            ) : (
              <FileText className="w-8 h-8 text-muted-foreground/30 mb-3" />
            )}
            <p className="text-sm font-medium text-muted-foreground">
              {isInvoicesTab ? "No invoices yet" : "No contracts yet"}
            </p>
            {listSearch && (
              <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>
            )}
          </div>
        ) : (
          <div key={`billing-page-${currentPage}-${activeTab}`}>
            {flatItems.map((item, idx) => {
              if (item.kind === "header") {
                return (
                  <div key={`h-${item.label}-${idx}`}>
                    <GroupHeader label={item.label} count={item.count} />
                  </div>
                );
              }
              if (item.kind === "invoice") {
                const isSelected = effectiveSelectedInvoice?.id === item.invoice.id && rightPanelMode === "view";
                return (
                  <div key={item.invoice.id || idx}>
                    <InvoiceCard
                      invoice={item.invoice}
                      isSelected={isSelected}
                      onClick={() => handleSelectInvoice(item.invoice)}
                    />
                  </div>
                );
              }
              const isSelected = selectedContract?.id === item.contract.id;
              return (
                <div key={item.contract.id || idx}>
                  <ContractCard
                    contract={item.contract}
                    isSelected={isSelected}
                    onClick={() => onSelectContract(item.contract)}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Pagination footer */}
      {totalCount > PAGE_SIZE && (
        <div className="h-[18px] px-3 py-1 border-t border-border/20 flex items-center justify-between shrink-0">
          <button
            onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
            disabled={currentPage === 0}
            className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-0.5"
          >
            <ChevronLeft className="h-3 w-3" />
            Previous
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
            disabled={currentPage >= maxPage}
            className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-0.5"
          >
            Next
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );

  // ── Table mode toolbar ─────────────────────────────────────────────────────

  const tableToolbar = (
    <div ref={toolbarRef} className="px-3 pt-1 pb-2 shrink-0 flex items-center gap-1.5 flex-wrap">

      {/* View mode toggle */}
      <ViewTabBar
        tabs={VIEW_MODE_TABS}
        activeId={viewMode}
        onTabChange={(m) => setViewMode(m as "list" | "table")}
      />

      <div className="w-px h-5 bg-border/40 mx-1 shrink-0" />

      {/* ── Expenses: add + search ── */}
      {isExpensesTab && isAgencyUser && (
        <button
          title="Add Expense"
          onClick={() => setExpensePanelOpen(true)}
          className={cn(
            isNarrow
              ? "icon-circle-lg icon-circle-base"
              : cn(tbBase, "border border-border/60 text-foreground hover:bg-card")
          )}
        >
          <Plus className="h-4 w-4" />
          {!isNarrow && "Expense"}
        </button>
      )}
      {isExpensesTab && (
        <>
          <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
          {isNarrow ? (
            <Popover open={expenseSearchOpen} onOpenChange={setExpenseSearchOpen}>
              <PopoverTrigger asChild>
                <button
                  title="Search"
                  className={cn("icon-circle-lg icon-circle-base", expenseSearch && "ring-2 ring-brand-indigo/30")}
                >
                  <Search className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Search expenses…"
                    value={expenseSearch}
                    onChange={(e) => setExpenseSearch(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                  />
                  {expenseSearch && (
                    <button
                      onClick={() => setExpenseSearch("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className={cn(
              "h-10 px-3 rounded-full inline-flex items-center gap-1.5 border border-border/60 shrink-0",
              expenseSearch ? "bg-card text-foreground" : "bg-transparent text-foreground/60"
            )}>
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder="Search expenses…"
                value={expenseSearch}
                onChange={(e) => setExpenseSearch(e.target.value)}
                className="w-[130px] bg-transparent text-[12px] focus:outline-none placeholder:text-muted-foreground/50"
              />
              {expenseSearch && (
                <button onClick={() => setExpenseSearch("")} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* ── + New invoice/contract (agency, non-expenses) ── */}
      {!isExpensesTab && isAgencyUser && (
        <button
          title={isInvoicesTab ? "New Invoice" : "New Contract"}
          onClick={handleAddClick}
          className={cn(
            isNarrow
              ? "icon-circle-lg icon-circle-base"
              : cn(tbBase, "border border-border/60 text-foreground hover:bg-card")
          )}
        >
          <Plus className="h-4 w-4" />
          {!isNarrow && (isInvoicesTab ? "Invoice" : "Contract")}
        </button>
      )}

      {/* Separator + search */}
      {!isExpensesTab && (
        <>
          {isAgencyUser && <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />}
          {isNarrow ? (
            <Popover open={tableSearchExpanded} onOpenChange={setTableSearchExpanded}>
              <PopoverTrigger asChild>
                <button
                  title="Search"
                  className={cn("icon-circle-lg icon-circle-base", listSearch && "ring-2 ring-brand-indigo/30")}
                >
                  <Search className="h-4 w-4" />
                </button>
              </PopoverTrigger>
              <PopoverContent side="bottom" align="start" className="w-56 p-2" onOpenAutoFocus={(e) => e.preventDefault()}>
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                  <input
                    autoFocus
                    type="text"
                    placeholder={isInvoicesTab ? "Search invoices…" : "Search contracts…"}
                    value={listSearch}
                    onChange={(e) => setListSearch(e.target.value)}
                    className="w-full pl-7 pr-7 py-1.5 text-[12px] rounded-md border border-border bg-popover placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-brand-indigo/50"
                  />
                  {listSearch && (
                    <button
                      onClick={() => setListSearch("")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full hover:bg-muted flex items-center justify-center text-muted-foreground"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          ) : (
            <div className={cn(
              "h-10 px-3 rounded-full inline-flex items-center gap-1.5 border border-border/60 shrink-0",
              listSearch ? "bg-card text-foreground" : "bg-transparent text-foreground/60"
            )}>
              <Search className="h-4 w-4 shrink-0" />
              <input
                type="text"
                placeholder={isInvoicesTab ? "Search invoices…" : "Search contracts…"}
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                className="w-[130px] bg-transparent text-[12px] focus:outline-none placeholder:text-muted-foreground/50"
              />
              {listSearch && (
                <button onClick={() => setListSearch("")} className="text-muted-foreground hover:text-foreground shrink-0">
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}
        </>
      )}

      {/* Sort */}
      <Popover open={toolbarSortOpen} onOpenChange={setToolbarSortOpen}>
        <PopoverTrigger asChild>
          <button
            title="Sort"
            className={cn(
              isNarrow
                ? "icon-circle-lg icon-circle-base"
                : cn(tbBase, isSortNonDefault ? tbActive : tbDefault)
            )}
          >
            <ArrowUpDown className="h-4 w-4" />
            {!isNarrow && (isSortNonDefault ? SORT_LABELS[sortBy] : "Sort")}
            {!isNarrow && <ChevronDown className="h-3.5 w-3.5 opacity-40" />}
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-44 p-1">
          {(Object.keys(SORT_LABELS) as SortBy[]).map((opt) => (
            <button
              key={opt}
              onClick={() => { setSortBy(opt); setToolbarSortOpen(false); }}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", sortBy === opt && "font-semibold text-brand-indigo")}
            >
              <span className="flex-1 text-left">{SORT_LABELS[opt]}</span>
              {sortBy === opt && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Date (combined Quarter + Year) */}
      <Popover open={toolbarDateOpen} onOpenChange={setToolbarDateOpen}>
        <PopoverTrigger asChild>
          <button
            title="Date"
            className={cn(
              isNarrow
                ? "icon-circle-lg icon-circle-base"
                : cn(tbBase, isDateActive ? tbActive : tbDefault)
            )}
          >
            <CalendarDays className="h-4 w-4" />
            {!isNarrow && (
              <>
                {[quarterFilter, yearFilter ? String(yearFilter) : null].filter(Boolean).join(" · ") || "Date"}
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-48 p-1">
          {/* Year section first */}
          {availableYears.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Year</span>
              </div>
              {availableYears.map((year) => (
                <button
                  key={year}
                  onClick={() => setYearFilter(yearFilter === year ? null : year)}
                  className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", yearFilter === year && "font-semibold text-brand-indigo")}
                >
                  <span className="flex-1 text-left">{year}</span>
                  {yearFilter === year && <Check className="h-3 w-3 shrink-0" />}
                </button>
              ))}
              <div className="h-px bg-border/40 mx-1 my-1" />
            </>
          )}
          {/* Quarter section below */}
          <div className="px-2 pt-1 pb-1">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Quarter</span>
          </div>
          {[
            { id: "Q1", months: "Jan–Mar" },
            { id: "Q2", months: "Apr–Jun" },
            { id: "Q3", months: "Jul–Sep" },
            { id: "Q4", months: "Oct–Dec" },
          ].map(({ id, months }) => (
            <button
              key={id}
              onClick={() => setQuarterFilter(quarterFilter === id ? null : id)}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", quarterFilter === id && "font-semibold text-brand-indigo")}
            >
              <span className="flex-1 text-left flex items-center gap-2">
                <span className="font-medium text-foreground">{id}</span>
                <span className="text-muted-foreground">{months}</span>
              </span>
              {quarterFilter === id && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
          {isDateActive && (
            <>
              <div className="h-px bg-border/40 my-1" />
              <button
                onClick={() => { setQuarterFilter(null); setYearFilter(null); setToolbarDateOpen(false); }}
                className="w-full px-2 py-1.5 text-[11px] text-destructive hover:bg-muted rounded-md text-left"
              >
                Clear dates
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Group — year+quarter grouping for invoices and expenses */}
      <Popover open={toolbarGroupOpen} onOpenChange={setToolbarGroupOpen}>
        <PopoverTrigger asChild>
          <button
            title="Group"
            className={cn(
              isNarrow
                ? "icon-circle-lg icon-circle-base"
                : cn(tbBase, currentGroupBy !== "none" ? tbActive : tbDefault)
            )}
          >
            <ListTree className="h-4 w-4" />
            {!isNarrow && (
              <>
                {currentGroupBy === "year_quarter" ? "Grouped" : "Group"}
                <ChevronDown className="h-3.5 w-3.5 opacity-40" />
              </>
            )}
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-44 p-1">
          {([
            { key: "none" as const, label: "None (flat)" },
            { key: "year_quarter" as const, label: "Year + Quarter" },
          ] as const).map(({ key, label }) => (
            <button
              key={key}
              onClick={() => { setCurrentGroupBy(key); setToolbarGroupOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                currentGroupBy === key && "font-semibold text-brand-indigo"
              )}
            >
              <span className="flex-1 text-left">{label}</span>
              {currentGroupBy === key && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Filter (combined Status + Account) */}
      {!isExpensesTab && (
        <Popover open={toolbarFilterOpen} onOpenChange={setToolbarFilterOpen}>
          <PopoverTrigger asChild>
            <button
              title="Filter"
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base"
                  : cn(tbBase, isTableFilterActive ? tbActive : tbDefault)
              )}
            >
              <Filter className="h-4 w-4" />
              {!isNarrow && (
                <>
                  {isTableFilterActive ? "Filter" : "Filter"}
                  <ChevronDown className="h-3.5 w-3.5 opacity-40" />
                </>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-48 p-1">
            {/* Status section */}
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Status</span>
              {filterStatus.length > 0 && (
                <button onClick={() => setFilterStatus([])} className="text-[9px] text-destructive hover:underline font-semibold">Clear</button>
              )}
            </div>
            {statusOptions.map((s) => {
              const color = statusColors[s];
              return (
                <button
                  key={s}
                  onClick={() => toggleFilterStatus(s)}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted"
                >
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color?.dot || "#94A3B8" }} />
                  <span className="flex-1 text-left">{s}</span>
                  {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </button>
              );
            })}
            {/* Account section (agency only) */}
            {isAgencyUser && (
              <>
                <div className="h-px bg-border/40 mx-1 my-1" />
                <div className="px-2 pt-1 pb-1 flex items-center justify-between">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Account</span>
                  {accountFilter !== "all" && (
                    <button onClick={() => setAccountFilter("all")} className="text-[9px] text-destructive hover:underline font-semibold">Clear</button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setAccountFilter("all")}
                    className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", accountFilter === "all" && "font-semibold text-brand-indigo")}
                  >
                    <span className="flex-1 text-left">All Accounts</span>
                    {accountFilter === "all" && <Check className="h-3 w-3 shrink-0" />}
                  </button>
                  {accounts.map((acct) => (
                    <button
                      key={acct.id}
                      onClick={() => setAccountFilter(acct.id)}
                      className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", accountFilter === acct.id && "font-semibold text-brand-indigo")}
                    >
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
                      <span className="flex-1 text-left truncate">{acct.name}</span>
                      {accountFilter === acct.id && <Check className="h-3 w-3 shrink-0" />}
                    </button>
                  ))}
                </div>
              </>
            )}
          </PopoverContent>
        </Popover>
      )}

      {/* Fields — column visibility (invoices + contracts tabs only) */}
      {!isExpensesTab && (
        <Popover open={toolbarFieldsOpen} onOpenChange={setToolbarFieldsOpen}>
          <PopoverTrigger asChild>
            <button
              title="Fields"
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base"
                  : cn(tbBase, tbDefault)
              )}
            >
              <Eye className="h-4 w-4" />
              {!isNarrow && "Fields"}
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-48 p-1">
            {(isInvoicesTab ? INVOICE_FIELD_DEFS : CONTRACT_FIELD_DEFS).map((col) => {
              const visSet = isInvoicesTab ? visibleInvoiceColumns : visibleContractColumns;
              const setter = isInvoicesTab ? setVisibleInvoiceColumns : setVisibleContractColumns;
              const isVisible = visSet.has(col.key);
              return (
                <button
                  key={col.key}
                  onClick={() => {
                    const next = new Set(visSet);
                    if (isVisible) {
                      if (next.size > 1) next.delete(col.key);
                    } else {
                      next.add(col.key);
                    }
                    setter(next);
                  }}
                  className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted"
                >
                  <span className={cn(
                    "w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0",
                    isVisible ? "bg-brand-indigo border-brand-indigo" : "border-border"
                  )}>
                    {isVisible && <Check className="h-2.5 w-2.5 text-white" />}
                  </span>
                  <span className="flex-1 text-left">{col.label}</span>
                </button>
              );
            })}
            <div className="h-px bg-border/40 my-1" />
            <button
              onClick={() => {
                if (isInvoicesTab) setVisibleInvoiceColumns(new Set(ALL_INVOICE_COLS));
                else setVisibleContractColumns(new Set(ALL_CONTRACT_COLS));
                setToolbarFieldsOpen(false);
              }}
              className="w-full px-2 py-1.5 text-[11px] text-brand-indigo hover:bg-muted rounded-md text-left"
            >
              Show all fields
            </button>
          </PopoverContent>
        </Popover>
      )}

      {/* ── Right side: action buttons (visible only when items selected) + search ── */}
      <div className="ml-auto flex items-center gap-1">

        {/* Print button (expenses only) */}
        {isExpensesTab && (
          <button
            onClick={() => setExpenseExportTrigger((t) => t + 1)}
            title="Export PDF"
            className={cn(
              isNarrow
                ? "icon-circle-lg icon-circle-base"
                : cn(tbBase, tbDefault)
            )}
          >
            <Printer className="h-4 w-4" />
            {!isNarrow && "Export"}
          </button>
        )}

        {/* Invoice action buttons — only when selected */}
        {isInvoicesTab && invoiceSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title="Edit"
              onClick={handleTableEdit}
              disabled={invoiceSelectedIds.size !== 1}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base disabled:opacity-40 disabled:pointer-events-none"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card disabled:opacity-40 disabled:pointer-events-none")
              )}
            >
              <Pencil className="h-4 w-4" />
              {!isNarrow && "Edit"}
            </button>
            <button
              title="Copy"
              onClick={handleTableDuplicate}
              disabled={invoiceSelectedIds.size !== 1}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base disabled:opacity-40 disabled:pointer-events-none"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card disabled:opacity-40 disabled:pointer-events-none")
              )}
            >
              <Copy className="h-4 w-4" />
              {!isNarrow && "Copy"}
            </button>
            <button
              title="Delete"
              onClick={handleTableDeleteInvoices}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base hover:text-red-600"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card hover:text-red-600")
              )}
            >
              <Trash2 className="h-4 w-4" />
              {!isNarrow && "Delete"}
            </button>
            <button
              title={invoiceSendPaidAction === "paid" ? "Mark Paid" : "Send"}
              onClick={() => invoiceSendPaidAction === "paid" ? handleTableMarkPaid() : handleTableMarkSent()}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card", invoiceSendPaidAction === "paid" && "hover:text-emerald-700")
              )}
            >
              {invoiceSendPaidAction === "paid" ? <CheckCircle2 className="h-4 w-4" /> : <SendHorizontal className="h-4 w-4" />}
              {!isNarrow && (invoiceSendPaidAction === "paid" ? "Paid" : "Send")}
            </button>
            <button
              onClick={() => setInvoiceSelectedIds(new Set())}
              title="Clear selection"
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base relative"
                  : cn(tbBase, tbDefault)
              )}
            >
              {isNarrow ? (
                <>
                  <span className="text-[13px] font-bold tabular-nums">{invoiceSelectedIds.size}</span>
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground/80 text-white flex items-center justify-center">
                    <X className="h-2.5 w-2.5" />
                  </span>
                </>
              ) : (
                `${invoiceSelectedIds.size} Selected`
              )}
            </button>
          </>
        )}

        {/* Contract action buttons — only when selected */}
        {!isInvoicesTab && !isExpensesTab && contractSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title="Delete"
              onClick={handleTableDeleteContracts}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base hover:text-red-600"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card hover:text-red-600")
              )}
            >
              <Trash2 className="h-4 w-4" />
              {!isNarrow && "Delete"}
            </button>
            <button
              title="Sign"
              onClick={handleTableMarkSigned}
              disabled={contractSelectedIds.size !== 1}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none")
              )}
            >
              <CheckCircle2 className="h-4 w-4" />
              {!isNarrow && "Sign"}
            </button>
            <button
              onClick={() => setContractSelectedIds(new Set())}
              title="Clear selection"
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base relative"
                  : cn(tbBase, tbDefault)
              )}
            >
              {isNarrow ? (
                <>
                  <span className="text-[13px] font-bold tabular-nums">{contractSelectedIds.size}</span>
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground/80 text-white flex items-center justify-center">
                    <X className="h-2.5 w-2.5" />
                  </span>
                </>
              ) : (
                `${contractSelectedIds.size} Selected`
              )}
            </button>
          </>
        )}

        {/* Expense action buttons — only when selected */}
        {isExpensesTab && expenseSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title="Edit"
              onClick={() => {
                const id = Array.from(expenseSelectedIds)[0];
                const exp = (expensesData ?? []).find((e) => e.id === id);
                if (!exp) return;
                setEditingExpense(exp);
                setExpensePanelOpen(true);
              }}
              disabled={expenseSelectedIds.size !== 1}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base disabled:opacity-40 disabled:pointer-events-none"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card disabled:opacity-40 disabled:pointer-events-none")
              )}
            >
              <Pencil className="h-4 w-4" />
              {!isNarrow && "Edit"}
            </button>
            <button
              title="Delete"
              onClick={async () => {
                const ids = Array.from(expenseSelectedIds);
                if (!window.confirm(`Delete ${ids.length} expense${ids.length !== 1 ? "s" : ""}? This cannot be undone.`)) return;
                for (const id of ids) await deleteExpenseApi(id);
                setExpenseSelectedIds(new Set());
                await queryClient.invalidateQueries({ queryKey: ["expenses"] });
              }}
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base hover:text-red-600"
                  : cn(tbBase, "border border-border/60 text-foreground hover:bg-card hover:text-red-600")
              )}
            >
              <Trash2 className="h-4 w-4" />
              {!isNarrow && "Delete"}
            </button>
            <button
              onClick={() => setExpenseSelectedIds(new Set())}
              title="Clear selection"
              className={cn(
                isNarrow
                  ? "icon-circle-lg icon-circle-base relative"
                  : cn(tbBase, tbDefault)
              )}
            >
              {isNarrow ? (
                <>
                  <span className="text-[13px] font-bold tabular-nums">{expenseSelectedIds.size}</span>
                  <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-foreground/80 text-white flex items-center justify-center">
                    <X className="h-2.5 w-2.5" />
                  </span>
                </>
              ) : (
                `${expenseSelectedIds.size} Selected`
              )}
            </button>
          </>
        )}

      </div>
    </div>
  );

    // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full gap-[3px]" data-testid="billing-list-view">

      {viewMode === "list" ? (
        /* ── LIST MODE: original split-panel layout ── */
        <>
          {/* Left panel */}
          <div className="w-[340px] shrink-0 bg-muted rounded-lg flex flex-col overflow-hidden">
            {leftPanelHeader}

            {/* Card list (invoices / contracts) */}
            {!isExpensesTab && cardList}

            {/* Expenses tab: compact individual rows */}
            {isExpensesTab && (
              <ExpensesListView
                quarterFilter={quarterFilter}
                yearFilter={yearFilter}
                searchQuery={expenseSearch}
                sortBy={sortBy as "recent" | "amount_desc" | "amount_asc" | "name_asc"}
                selectedId={selectedExpenseId}
                onSelect={(expense) => {
                  setSelectedExpenseId(expense.id);
                  setExpensePanelOpen(false);
                }}
              />
            )}
          </div>

          {/* Right panel */}
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-card rounded-lg">
            {isExpensesTab ? (
              expensePanelOpen ? (
                <ExpenseCreatePanel
                  editingExpense={editingExpense}
                  onClose={() => {
                    setExpensePanelOpen(false);
                    setEditingExpense(null);
                  }}
                />
              ) : (() => {
                const selectedExpense = (expensesData ?? []).find((e) => e.id === selectedExpenseId) ?? null;
                return selectedExpense ? (
                  <ExpenseDetailView
                    expense={selectedExpense}
                    onEdit={(exp) => {
                      setEditingExpense(exp);
                      setExpensePanelOpen(true);
                    }}
                    onDeleted={() => setSelectedExpenseId(null)}
                    onNew={isAgencyUser ? () => { setEditingExpense(null); setExpensePanelOpen(true); } : undefined}
                  />
                ) : (
                  <ExpenseDetailViewEmpty
                    onNew={isAgencyUser ? () => { setEditingExpense(null); setExpensePanelOpen(true); } : undefined}
                  />
                );
              })()
            ) : isInvoicesTab ? (
              showCreatePanel ? (
                <InvoiceCreatePanel
                  editingInvoice={editingInvoice}
                  prefillInvoice={duplicatingInvoice}
                  nextInvoiceNumber={nextInvoiceNumber}
                  accounts={accounts}
                  isAgencyUser={isAgencyUser}
                  onCreate={onCreateInvoice}
                  onUpdate={onUpdateInvoice}
                  onClose={() => {
                    setRightPanelMode("view");
                    setEditingInvoice(null);
                    setDuplicatingInvoice(null);
                  }}
                />
              ) : effectiveSelectedInvoice ? (
                <InvoiceDetailView
                  invoice={effectiveSelectedInvoice}
                  allInvoices={invoices}
                  account={accounts.find((a) => a.id === effectiveSelectedInvoice.Accounts_id) ?? null}
                  isAgencyUser={isAgencyUser}
                  onMarkSent={onMarkSent}
                  onMarkPaid={onMarkPaid}
                  onEdit={() => {
                    setEditingInvoice(effectiveSelectedInvoice);
                    setDuplicatingInvoice(null);
                    setRightPanelMode("edit");
                  }}
                  onDuplicate={handleDuplicate}
                  onDelete={onDeleteInvoice}
                  onRefresh={onRefreshInvoices}
                />
              ) : (
                <InvoiceDetailViewEmpty />
              )
            ) : activeTab === "contracts" ? (
              rightPanelMode === "create" ? (
                <ContractCreatePanel
                  accounts={accounts}
                  isAgencyUser={isAgencyUser}
                  onCreate={onCreateContract}
                  onClose={() => setRightPanelMode("view")}
                />
              ) : selectedContract ? (
                <ContractDetailView
                  contract={selectedContract}
                  isAgencyUser={isAgencyUser}
                  onMarkSigned={onMarkSigned}
                  onDelete={onDeleteContract}
                  onRefresh={onRefreshContracts}
                  onUpdate={onUpdateContract}
                  onNew={isAgencyUser ? () => { onSelectContract(null); setRightPanelMode("create"); } : undefined}
                />
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                  <FileText className="w-12 h-12 text-muted-foreground/20 mb-4" />
                  <p className="text-sm font-medium text-muted-foreground">Select a contract</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Choose a contract from the list to view details</p>
                  {isAgencyUser && (
                    <button
                      onClick={() => { onSelectContract(null); setRightPanelMode("create"); }}
                      className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-brand-indigo text-white hover:opacity-90"
                    >
                      Upload Contract
                    </button>
                  )}
                </div>
              )
            ) : null}
          </div>
        </>
      ) : (
        /* ── TABLE MODE: full-width, with optional inline right panel ── */
        <>
          {/* Left: table area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-lg bg-muted">

            {/* Header row 1: title */}
            <div className="px-3 pt-5 pb-1 shrink-0">
              <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight shrink-0">
                {isExpensesTab ? "Expenses" : isInvoicesTab ? "Invoices" : "Contracts"}
              </h2>
            </div>

            {/* Toolbar (includes List/Table toggle + action + filter buttons) */}
            {tableToolbar}

            {/* Table content — edge-to-edge, no side margins */}
            <div className="flex-1 min-h-0 overflow-hidden bg-card">
              {isExpensesTab ? (
                <ExpensesView
                  quarterFilter={quarterFilter}
                  yearFilter={yearFilter}
                  searchQuery={expenseSearch}
                  selectedIds={expenseSelectedIds}
                  onSelectionChange={setExpenseSelectedIds}
                  groupBy={expenseGroupBy}
                  exportTrigger={expenseExportTrigger}
                />
              ) : isInvoicesTab ? (
                <InvoicesInlineTable
                  invoices={filteredInvoices}
                  loading={invoicesLoading}
                  selectedInvoice={effectiveSelectedInvoice}
                  onSelectInvoice={(invoice) => onSelectInvoice(invoice)}
                  selectedIds={invoiceSelectedIds}
                  onSelectionChange={setInvoiceSelectedIds}
                  visibleColumns={visibleInvoiceColumns}
                  groupBy={invoiceGroupBy}
                />
              ) : (
                <ContractsInlineTable
                  contracts={filteredContracts}
                  loading={contractsLoading}
                  selectedContract={selectedContract}
                  onSelectContract={(contract) => onSelectContract(contract)}
                  selectedIds={contractSelectedIds}
                  onSelectionChange={setContractSelectedIds}
                  visibleColumns={visibleContractColumns}
                />
              )}
            </div>
          </div>

          {/* Right: Inline create / edit / duplicate panel (no overlay — same as list view) */}
          {createSheetOpen && (
            <div className="w-[500px] shrink-0 flex flex-col overflow-hidden rounded-lg bg-card">
              {isInvoicesTab ? (
                <InvoiceCreatePanel
                  editingInvoice={editingInvoice}
                  prefillInvoice={duplicatingInvoice}
                  nextInvoiceNumber={nextInvoiceNumber}
                  accounts={accounts}
                  isAgencyUser={isAgencyUser}
                  onCreate={async (payload) => {
                    const result = await onCreateInvoice(payload);
                    setCreateSheetOpen(false);
                    setDuplicatingInvoice(null);
                    return result;
                  }}
                  onUpdate={async (id, patch) => {
                    const result = await onUpdateInvoice(id, patch);
                    setCreateSheetOpen(false);
                    setEditingInvoice(null);
                    return result;
                  }}
                  onClose={() => {
                    setCreateSheetOpen(false);
                    setEditingInvoice(null);
                    setDuplicatingInvoice(null);
                  }}
                />
              ) : (
                <ContractCreatePanel
                  accounts={accounts}
                  isAgencyUser={isAgencyUser}
                  onCreate={async (payload) => {
                    const result = await onCreateContract(payload);
                    setCreateSheetOpen(false);
                    return result;
                  }}
                  onClose={() => setCreateSheetOpen(false)}
                />
              )}
            </div>
          )}
          {isExpensesTab && expensePanelOpen && (
            <div className="w-[500px] shrink-0 flex flex-col overflow-hidden rounded-lg bg-card">
              <ExpenseCreatePanel
                editingExpense={editingExpense}
                onClose={() => {
                  setExpensePanelOpen(false);
                  setEditingExpense(null);
                }}
              />
            </div>
          )}
        </>
      )}

      {/* ── Contract upload dialog ── */}
      <ContractUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        accounts={accounts}
        isAgencyUser={isAgencyUser}
        onCreate={onCreateContract}
      />


    </div>
  );
}
