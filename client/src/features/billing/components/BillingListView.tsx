import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { deleteExpense as deleteExpenseApi } from "../api/expensesApi";
import {
  Search,
  Building2,
  Receipt,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  X,
  Check,
  Wallet,
  PenLine,
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
  Paintbrush,
} from "lucide-react";
import { GradientTester, GradientControlPoints, DEFAULT_LAYERS, layerToStyle, type GradientLayer } from "@/components/ui/gradient-tester";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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

// ── Tab definitions (tKey pattern — computed inside component) ───────────────

const BILLING_TAB_AGENCY_DEFS = [
  { id: "invoices",  tKey: "tabs.invoices",  icon: Receipt  },
  { id: "expenses",  tKey: "tabs.expenses",  icon: Wallet },
  { id: "contracts", tKey: "tabs.contracts", icon: PenLine },
];

const BILLING_TAB_CLIENT_DEFS = [
  { id: "invoices",  tKey: "tabs.invoices",  icon: Receipt  },
  { id: "contracts", tKey: "tabs.contracts", icon: PenLine },
];

const VIEW_MODE_TAB_DEFS = [
  { id: "list",  tKey: "tabs.list",  icon: LayoutList  },
  { id: "table", tKey: "tabs.table", icon: LayoutGrid  },
];

// ── Status filter options ────────────────────────────────────────────────────

const INVOICE_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Paid", "Overdue", "Cancelled"];
const CONTRACT_STATUS_OPTIONS = ["Draft", "Sent", "Viewed", "Signed", "Expired", "Cancelled"];

// ── Sort tKeys ───────────────────────────────────────────────────────────────

const SORT_TKEYS: Record<SortBy, string> = {
  recent:      "sort.recent",
  amount_desc: "sort.amountDesc",
  amount_asc:  "sort.amountAsc",
  due_asc:     "sort.dueSoonest",
  name_asc:    "sort.nameAZ",
};


// ── Date grouping ────────────────────────────────────────────────────────────

// Returns stable raw English keys used as bucket keys for ordering (NOT translated)
function getDateGroupKey(dateStr: string | null | undefined): string {
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

// Map raw bucket keys to i18n translation keys
const DATE_GROUP_I18N_KEYS: Record<string, string> = {
  "Today":        "dateGroups.today",
  "Yesterday":    "dateGroups.yesterday",
  "This Week":    "dateGroups.thisWeek",
  "This Month":   "dateGroups.thisMonth",
  "Last 3 Months":"dateGroups.last3Months",
  "Older":        "dateGroups.older",
  "No Date":      "dateGroups.noDate",
};

const DATE_GROUP_ORDER = ["Today", "Yesterday", "This Week", "This Month", "Last 3 Months", "Older", "No Date"];

type BillingListItem =
  | { kind: "header"; label: string; count: number }
  | { kind: "invoice"; invoice: InvoiceRow }
  | { kind: "contract"; contract: ContractRow };

function GroupHeader({ label, count }: { label: string; count: number }) {
  const { t } = useTranslation("billing");
  const translatedLabel = t(DATE_GROUP_I18N_KEYS[label] ?? label, label);
  return (
    <div className="sticky top-0 z-20 bg-muted px-3 pt-3 pb-3">
      <div className="flex items-center gap-[10px]">
        <div className="flex-1 h-px bg-foreground/15" />
        <span className="text-[12px] font-bold text-foreground tracking-wide shrink-0">{translatedLabel}</span>
        <span className="text-foreground/20 shrink-0">–</span>
        <span className="text-[12px] font-medium text-muted-foreground tabular-nums shrink-0">{count}</span>
        <div className="flex-1 h-px bg-foreground/15" />
      </div>
    </div>
  );
}

// ── Constants ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 20;

// Per-tab gradient presets — loaded when the gradient tester opens
const DISABLED_LAYERS_1_TO_3: GradientLayer[] = [
  { id: 1, label: "White bloom", enabled: false, type: "radial", ellipseW: 72, ellipseH: 56, posX: 100, posY: 0, colorStops: [{ color: "#FFFFFF", opacity: 1, position: 0 }, { color: "#FFFFFF", opacity: 0.8, position: 30 }, { color: "#000000", opacity: 0, position: 60 }] },
  { id: 2, label: "Yellow", enabled: false, type: "radial", ellipseW: 95, ellipseH: 80, posX: 0, posY: 0, colorStops: [{ color: "#FFF286", opacity: 1, position: 0 }, { color: "#FFF286", opacity: 0.60, position: 40 }, { color: "#FFF286", opacity: 0.25, position: 64 }, { color: "#000000", opacity: 0, position: 80 }] },
  { id: 3, label: "Peach", enabled: false, type: "radial", ellipseW: 62, ellipseH: 72, posX: 100, posY: 36, colorStops: [{ color: "#F1DAA2", opacity: 0.62, position: 0 }, { color: "#000000", opacity: 0, position: 64 }] },
];

const INVOICE_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  ...DISABLED_LAYERS_1_TO_3,
  { id: 4, label: "Teal bloom", enabled: true, type: "radial", ellipseW: 150, ellipseH: 92, posX: 18, posY: 92, colorStops: [{ color: "#339585", opacity: 0.4, position: 0 }, { color: "#000000", opacity: 0, position: 69 }] },
  { id: 5, label: "Blue top-left", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 2, posY: 2, colorStops: [{ color: "#C7E0FF", opacity: 1, position: 5 }, { color: "#000000", opacity: 0, position: 30 }] },
  { id: 6, label: "Teal center", enabled: true, type: "radial", ellipseW: 77, ellipseH: 93, posX: 63, posY: 52, colorStops: [{ color: "#47A286", opacity: 0.38, position: 0 }, { color: "#000000", opacity: 0, position: 66 }] },
];

const EXPENSE_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  ...DISABLED_LAYERS_1_TO_3,
  { id: 4, label: "Yellow-green bloom", enabled: true, type: "radial", ellipseW: 150, ellipseH: 101, posX: 40, posY: 91, colorStops: [{ color: "#D0DA00", opacity: 0.4, position: 0 }, { color: "#000000", opacity: 0, position: 69 }] },
  { id: 5, label: "Blue top-left", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 2, posY: 2, colorStops: [{ color: "#C7E0FF", opacity: 1, position: 5 }, { color: "#000000", opacity: 0, position: 30 }] },
  { id: 6, label: "Amber center", enabled: true, type: "radial", ellipseW: 80, ellipseH: 102, posX: 53, posY: 59, colorStops: [{ color: "#C39219", opacity: 0.38, position: 0 }, { color: "#000000", opacity: 0, position: 66 }] },
];

const CONTRACT_LAYERS: GradientLayer[] = [
  { id: 0, label: "Base", enabled: true, type: "solid", solidColor: "#ffffff", ellipseW: 100, ellipseH: 100, posX: 50, posY: 50, colorStops: [] },
  ...DISABLED_LAYERS_1_TO_3,
  { id: 4, label: "Lilac bloom", enabled: true, type: "radial", ellipseW: 124, ellipseH: 162, posX: 20, posY: 92, colorStops: [{ color: "#DB99F4", opacity: 0.4, position: 0 }, { color: "#000000", opacity: 0, position: 69 }] },
  { id: 5, label: "Blue top-left", enabled: true, type: "radial", ellipseW: 200, ellipseH: 200, posX: 2, posY: 2, colorStops: [{ color: "#C7E0FF", opacity: 1, position: 5 }, { color: "#000000", opacity: 0, position: 30 }] },
  { id: 6, label: "Lavender center", enabled: true, type: "radial", ellipseW: 80, ellipseH: 102, posX: 62, posY: 47, colorStops: [{ color: "#D1BBE9", opacity: 0.38, position: 0 }, { color: "#000000", opacity: 0, position: 66 }] },
];

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
  const { t } = useTranslation("billing");
  const queryClient = useQueryClient();
  const [mobileView, setMobileView] = useState<"list" | "detail">("list");
  const [currentPage, setCurrentPage] = useState(0);
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

  // ── Breadcrumb ─────────────────────────────────────────────────────────────
  const { setCrumb } = useBreadcrumb();
  useEffect(() => {
    const tabLabel = activeTab === "invoices" ? t("tabs.invoices") : activeTab === "contracts" ? t("tabs.contracts") : t("tabs.expenses");
    const itemName =
      activeTab === "invoices" ? (selectedInvoice?.title || selectedInvoice?.invoice_number || null) :
      activeTab === "contracts" ? (selectedContract?.title || null) :
      null;
    setCrumb(itemName ? `${tabLabel} / ${itemName}` : tabLabel);
    return () => setCrumb(null);
  }, [activeTab, selectedInvoice, selectedContract, setCrumb, t]);

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

  // ── Gradient tester state ──────────────────────────────────────────────────
  const [gradientTesterOpen, setGradientTesterOpen] = useState(false);
  const [gradientLayers, setGradientLayers] = useState<GradientLayer[]>(DEFAULT_LAYERS);
  const [gradientDragMode, setGradientDragMode] = useState(false);

  const getTabLayers = useCallback((tab: BillingTab): GradientLayer[] => {
    if (tab === "invoices") return INVOICE_LAYERS;
    if (tab === "expenses") return EXPENSE_LAYERS;
    return CONTRACT_LAYERS;
  }, []);

  const updateGradientLayer = useCallback((id: number, patch: Partial<GradientLayer>) => {
    if (id === -1) { setGradientLayers(prev => [...prev, patch as GradientLayer]); return; }
    if ((patch as any).id === -999) { setGradientLayers(prev => prev.filter(l => l.id !== id)); return; }
    setGradientLayers(prev => prev.map(l => l.id === id ? { ...l, ...patch } : l));
  }, []);

  const resetGradientLayers = useCallback(() => {
    setGradientLayers(getTabLayers(activeTab));
    setGradientDragMode(false);
  }, [activeTab, getTabLayers]);

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
      const key = getDateGroupKey(dateField);
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
  const billingTabsAgency: TabDef[] = useMemo(() =>
    BILLING_TAB_AGENCY_DEFS.map(({ id, tKey, icon }) => ({ id, label: t(tKey), icon })),
    [t]
  );
  const billingTabsClient: TabDef[] = useMemo(() =>
    BILLING_TAB_CLIENT_DEFS.map(({ id, tKey, icon }) => ({ id, label: t(tKey), icon })),
    [t]
  );
  const viewModeTabs: TabDef[] = useMemo(() =>
    VIEW_MODE_TAB_DEFS.map(({ id, tKey, icon }) => ({ id, label: t(tKey), icon })),
    [t]
  );
  const billingTabs = isAgencyUser ? billingTabsAgency : billingTabsClient;

  /** Navigate to a billing sub-tab (parent handles URL navigation) */
  const handleBillingTabNav = useCallback((tabId: string) => {
    onTabChange(tabId);
  }, [onTabChange]);

  /** Inline billing sub-tab buttons */
  const billingTabButtons = (
    <ViewTabBar tabs={billingTabs} activeId={activeTab} onTabChange={handleBillingTabNav} variant="segment" />
  );

  // ── Add button handler ─────────────────────────────────────────────────────

  function handleAddClick() {
    if (isInvoicesTab) {
      setEditingInvoice(null);
      setDuplicatingInvoice(null);
      if (viewMode === "table") {
        setCreateSheetOpen(true);
      } else {
        setRightPanelMode("create");
        setMobileView("detail"); // show right panel on mobile
      }
    } else if (activeTab === "contracts") {
      onSelectContract(null);
      if (viewMode === "table") {
        setCreateSheetOpen(true);
      } else {
        setRightPanelMode("create");
        setMobileView("detail"); // show right panel on mobile
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
    setMobileView("detail");
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
    if (!window.confirm(ids.length === 1 ? t("invoices.deleteConfirm", { count: ids.length }) : t("invoices.deleteConfirmPlural", { count: ids.length }))) return;
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
    if (!window.confirm(ids.length === 1 ? t("contracts.deleteConfirm", { count: ids.length }) : t("contracts.deleteConfirmPlural", { count: ids.length }))) return;
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

  const xBase = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // ── Left panel header (list mode) — 309px wrapper ─────────────────────────

  const leftPanelHeader = (
    <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 shrink-0 flex items-center">
      <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
        <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
        <div className="flex items-center gap-2">
          {billingTabButtons}
          {/* Mobile-only "+ New" button visible from list view */}
          {isAgencyUser && (
            <button
              data-testid={isExpensesTab ? "mobile-new-expense-btn" : isInvoicesTab ? "mobile-new-invoice-btn" : "mobile-new-contract-btn"}
              onClick={() => {
                if (isExpensesTab) {
                  setExpensePanelOpen(true);
                } else {
                  handleAddClick();
                }
                setMobileView("detail");
              }}
              className="md:hidden h-9 w-9 rounded-full bg-brand-indigo text-white grid place-items-center shrink-0 hover:bg-brand-indigo/90"
              title={isExpensesTab ? t("toolbar.newExpense") : isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}
            >
              <Plus className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  // ── Right panel list-mode toolbar (Sort, Filter, Date, Search, +) ────────

  const toolbarControls = (
    <>
      {/* Mobile back button — only visible on small screens */}
      <button
        onClick={() => setMobileView("list")}
        className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      {/* View mode toggle (List | Table) */}
      <ViewTabBar tabs={viewModeTabs} activeId={viewMode} onTabChange={(m) => setViewMode(m as "list" | "table")} variant="segment" />

      <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

      {/* Add button — expand-on-hover */}
      {isAgencyUser && (
        <button
          onClick={isExpensesTab ? () => { setExpensePanelOpen(true); setMobileView("detail"); } : handleAddClick}
          className={cn(xBase, "hover:max-w-[130px]", xDefault)}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className={xSpan}>{isExpensesTab ? t("toolbar.newExpense") : isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}</span>
        </button>
      )}

      {/* Inline search bar */}
      <div className="h-9 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-white/60 dark:bg-white/[0.10] px-3 shrink-0">
        <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
        <input
          className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
          placeholder={isExpensesTab ? t("toolbar.searchExpenses") : isInvoicesTab ? t("toolbar.searchInvoices") : t("toolbar.searchContracts")}
          value={isExpensesTab ? expenseSearch : listSearch}
          onChange={(e) => isExpensesTab ? setExpenseSearch(e.target.value) : setListSearch(e.target.value)}
        />
        {(isExpensesTab ? expenseSearch : listSearch) && (
          <button onClick={() => isExpensesTab ? setExpenseSearch("") : setListSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
            <X className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Sort — expand-on-hover */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[100px]", isSortNonDefault ? xActive : xDefault)}>
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {(isExpensesTab
            ? ([
                { key: "recent" as SortBy, tKey: "sort.recent" },
                { key: "amount_desc" as SortBy, tKey: "sort.amountDesc" },
                { key: "amount_asc" as SortBy, tKey: "sort.amountAsc" },
                { key: "name_asc" as SortBy, tKey: "sort.supplierAZ" },
              ])
            : (Object.keys(SORT_TKEYS) as SortBy[]).map((k) => ({ key: k, tKey: SORT_TKEYS[k] }))
          ).map(({ key: opt, tKey }) => (
            <DropdownMenuItem key={opt} onClick={() => setSortBy(opt)} className={cn("text-[12px]", sortBy === opt && "font-semibold text-brand-indigo")}>
              {t(tKey)}
              {sortBy === opt && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Filter — expand-on-hover (Status + Account) — not on expenses */}
      {!isExpensesTab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive || (isAgencyUser && accountFilter !== "all") ? xActive : xDefault)}>
              <Filter className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.filter")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.status")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {statusOptions.map((s) => {
              const color = statusColors[s];
              return (
                <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                  <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color?.dot || "#94A3B8" }} />
                  <span className="flex-1">{s}</span>
                  {filterStatus.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                </DropdownMenuItem>
              );
            })}
            {isAgencyUser && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.account")}</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setAccountFilter("all")} className={cn("text-[12px]", accountFilter === "all" && "font-semibold text-brand-indigo")}>
                  {t("statusFilter.allAccounts")}
                  {accountFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
                {accounts.map((acct) => (
                  <DropdownMenuItem key={acct.id} onClick={() => setAccountFilter(acct.id)} className={cn("text-[12px]", accountFilter === acct.id && "font-semibold text-brand-indigo")}>
                    <Building2 className="h-3 w-3 shrink-0 text-muted-foreground mr-1.5" />
                    {acct.name}
                    {accountFilter === acct.id && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                ))}
              </>
            )}
            {(isFilterActive || (isAgencyUser && accountFilter !== "all")) && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => { setFilterStatus([]); setAccountFilter("all"); }} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Date — expand-on-hover (Quarter + Year) */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button className={cn(xBase, "hover:max-w-[80px]", isDateActive ? xActive : xDefault)}>
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.date")}</span>
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-48">
          {availableYears.length > 0 && (
            <>
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("dateFilter.year")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {availableYears.map((year) => (
                <DropdownMenuItem key={year} onClick={() => setYearFilter(yearFilter === year ? null : year)} className={cn("text-[12px]", yearFilter === year && "font-semibold text-brand-indigo")}>
                  {year}
                  {yearFilter === year && <Check className="h-3 w-3 ml-auto" />}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("dateFilter.quarter")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {[
            { id: "Q1", monthsKey: "dateFilter.q1Months" },
            { id: "Q2", monthsKey: "dateFilter.q2Months" },
            { id: "Q3", monthsKey: "dateFilter.q3Months" },
            { id: "Q4", monthsKey: "dateFilter.q4Months" },
          ].map(({ id, monthsKey }) => (
            <DropdownMenuItem key={id} onClick={() => setQuarterFilter(quarterFilter === id ? null : id)} className={cn("text-[12px]", quarterFilter === id && "font-semibold text-brand-indigo")}>
              <span className="flex-1 flex items-center gap-2">
                <span className="font-medium text-foreground">{id}</span>
                <span className="text-muted-foreground">{t(monthsKey)}</span>
              </span>
              {quarterFilter === id && <Check className="h-3 w-3 shrink-0" />}
            </DropdownMenuItem>
          ))}
          {isDateActive && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => { setQuarterFilter(null); setYearFilter(null); }} className="text-[12px] text-destructive">{t("toolbar.clearDates")}</DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Group — expand-on-hover (expenses only) */}
      {isExpensesTab && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "hover:max-w-[100px]", expenseGroupBy !== "none" ? xActive : xDefault)}>
              <ListTree className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.group")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-40">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.groupBy")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setExpenseGroupBy("none")} className={cn("text-[12px]", expenseGroupBy === "none" && "font-semibold text-brand-indigo")}>
              {t("groupOptions.none")}
              {expenseGroupBy === "none" && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setExpenseGroupBy("year_quarter")} className={cn("text-[12px]", expenseGroupBy === "year_quarter" && "font-semibold text-brand-indigo")}>
              {t("groupOptions.yearQuarter")}
              {expenseGroupBy === "year_quarter" && <Check className="h-3 w-3 ml-auto" />}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      {/* Gradient tester toggle — expand-on-hover */}
      <button
        type="button"
        onClick={() => {
          if (!gradientTesterOpen) setGradientLayers(getTabLayers(activeTab));
          setGradientTesterOpen(prev => !prev);
        }}
        className={cn(xBase, "hover:max-w-[100px]", gradientTesterOpen ? "border-indigo-200 text-indigo-600 bg-indigo-100" : xDefault)}
        title="Gradient Tester"
      >
        <Paintbrush className="h-4 w-4 shrink-0" />
        <span className={xSpan}>{t("toolbar.style")}</span>
      </button>
    </>
  );

  // ── Card list (list mode, non-expenses tab) ────────────────────────────────

  const cardList = (
    <>
      {/* Card list */}
      <div className="flex-1 overflow-y-auto p-[3px]">
        {isLoading ? (
          <ListSkeleton />
        ) : flatItems.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            {isInvoicesTab ? (
              <Receipt className="w-8 h-8 text-muted-foreground/30 mb-3" />
            ) : (
              <PenLine className="w-8 h-8 text-muted-foreground/30 mb-3" />
            )}
            <p className="text-sm font-medium text-muted-foreground">
              {isInvoicesTab ? t("invoices.empty.noInvoicesYet") : t("contracts.empty.noContractsYet")}
            </p>
            {listSearch && (
              <p className="text-xs text-muted-foreground/70 mt-1">{t("invoices.empty.tryDifferentSearch")}</p>
            )}
          </div>
        ) : (
          <div key={`billing-page-${currentPage}-${activeTab}`} className="flex flex-col gap-[3px] pb-2">
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
                  <div key={item.invoice.id || idx} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
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
                <div key={item.contract.id || idx} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
                  <ContractCard
                    contract={item.contract}
                    isSelected={isSelected}
                    onClick={() => { onSelectContract(item.contract); setMobileView("detail"); }}
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
            {t("toolbar.previous")}
          </button>
          <span className="text-[10px] text-muted-foreground tabular-nums">
            {currentPage * PAGE_SIZE + 1}–{Math.min((currentPage + 1) * PAGE_SIZE, totalCount)} of {totalCount}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(maxPage, p + 1))}
            disabled={currentPage >= maxPage}
            className="text-[10px] text-muted-foreground hover:text-foreground disabled:opacity-30 flex items-center gap-0.5"
          >
            {t("toolbar.next")}
            <ChevronRight className="h-3 w-3" />
          </button>
        </div>
      )}
    </>
  );

  // ── Table mode toolbar ─────────────────────────────────────────────────────

  const tableToolbar = (
    <div ref={toolbarRef} className="flex items-center gap-1.5 flex-1 min-w-0">

      {/* View mode toggle (List | Table) */}
      <ViewTabBar
        tabs={viewModeTabs}
        activeId={viewMode}
        onTabChange={(m) => setViewMode(m as "list" | "table")}
        variant="segment"
      />

      <div className="w-px h-5 bg-border/40 mx-1 shrink-0" />

      {/* ── Expenses: add + search ── */}
      {isExpensesTab && isAgencyUser && (
        <button
          title={t("toolbar.newExpense")}
          onClick={() => { setExpensePanelOpen(true); setMobileView("detail"); }}
          className={cn(xBase, "hover:max-w-[130px]", xDefault)}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className={xSpan}>{t("toolbar.newExpense")}</span>
        </button>
      )}
      {isExpensesTab && (
        <>
          <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />
          <div className="h-9 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 shrink-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input
              className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
              placeholder={t("toolbar.searchExpenses")}
              value={expenseSearch}
              onChange={(e) => setExpenseSearch(e.target.value)}
            />
            {expenseSearch && (
              <button onClick={() => setExpenseSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {/* ── + New invoice/contract (agency, non-expenses) ── */}
      {!isExpensesTab && isAgencyUser && (
        <button
          title={isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}
          onClick={handleAddClick}
          className={cn(xBase, "hover:max-w-[130px]", xDefault)}
        >
          <Plus className="h-4 w-4 shrink-0" />
          <span className={xSpan}>{isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}</span>
        </button>
      )}

      {/* Separator + search */}
      {!isExpensesTab && (
        <>
          {isAgencyUser && <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />}
          <div className="h-9 flex items-center gap-1.5 rounded-full border border-black/[0.125] bg-card px-3 shrink-0">
            <Search className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
            <input
              className="h-full bg-transparent border-none outline-none text-[12px] text-foreground placeholder:text-muted-foreground/40 w-32 min-w-0"
              placeholder={isInvoicesTab ? t("toolbar.searchInvoices") : t("toolbar.searchContracts")}
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
            />
            {listSearch && (
              <button onClick={() => setListSearch("")} className="text-muted-foreground/40 hover:text-muted-foreground shrink-0">
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {/* Sort — expand-on-hover */}
      <Popover open={toolbarSortOpen} onOpenChange={setToolbarSortOpen}>
        <PopoverTrigger asChild>
          <button
            title={t("toolbar.sort")}
            className={cn(xBase, "hover:max-w-[100px]", isSortNonDefault ? xActive : xDefault)}
          >
            <ArrowUpDown className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.sort")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-44 p-1">
          {(Object.keys(SORT_TKEYS) as SortBy[]).map((opt) => (
            <button
              key={opt}
              onClick={() => { setSortBy(opt); setToolbarSortOpen(false); }}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", sortBy === opt && "font-semibold text-brand-indigo")}
            >
              <span className="flex-1 text-left">{t(SORT_TKEYS[opt])}</span>
              {sortBy === opt && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Date — expand-on-hover (combined Quarter + Year) */}
      <Popover open={toolbarDateOpen} onOpenChange={setToolbarDateOpen}>
        <PopoverTrigger asChild>
          <button
            title={t("toolbar.date")}
            className={cn(xBase, "hover:max-w-[80px]", isDateActive ? xActive : xDefault)}
          >
            <CalendarDays className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.date")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-48 p-1">
          {/* Year section first */}
          {availableYears.length > 0 && (
            <>
              <div className="px-2 pt-2 pb-1">
                <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("dateFilter.year")}</span>
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
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("dateFilter.quarter")}</span>
          </div>
          {[
            { id: "Q1", monthsKey: "dateFilter.q1Months" },
            { id: "Q2", monthsKey: "dateFilter.q2Months" },
            { id: "Q3", monthsKey: "dateFilter.q3Months" },
            { id: "Q4", monthsKey: "dateFilter.q4Months" },
          ].map(({ id, monthsKey }) => (
            <button
              key={id}
              onClick={() => setQuarterFilter(quarterFilter === id ? null : id)}
              className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", quarterFilter === id && "font-semibold text-brand-indigo")}
            >
              <span className="flex-1 text-left flex items-center gap-2">
                <span className="font-medium text-foreground">{id}</span>
                <span className="text-muted-foreground">{t(monthsKey)}</span>
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
                {t("toolbar.clearDates")}
              </button>
            </>
          )}
        </PopoverContent>
      </Popover>

      {/* Group — expand-on-hover (year+quarter grouping for invoices and expenses) */}
      <Popover open={toolbarGroupOpen} onOpenChange={setToolbarGroupOpen}>
        <PopoverTrigger asChild>
          <button
            title={t("toolbar.group")}
            className={cn(xBase, "hover:max-w-[100px]", currentGroupBy !== "none" ? xActive : xDefault)}
          >
            <ListTree className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.group")}</span>
          </button>
        </PopoverTrigger>
        <PopoverContent side="bottom" align="start" className="w-44 p-1">
          {([
            { key: "none" as const, tKey: "groupOptions.noneFlatLabel" },
            { key: "year_quarter" as const, tKey: "groupOptions.yearPlusQuarter" },
          ] as const).map(({ key, tKey }) => (
            <button
              key={key}
              onClick={() => { setCurrentGroupBy(key); setToolbarGroupOpen(false); }}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted",
                currentGroupBy === key && "font-semibold text-brand-indigo"
              )}
            >
              <span className="flex-1 text-left">{t(tKey)}</span>
              {currentGroupBy === key && <Check className="h-3 w-3 shrink-0" />}
            </button>
          ))}
        </PopoverContent>
      </Popover>

      {/* Filter — expand-on-hover (combined Status + Account) */}
      {!isExpensesTab && (
        <Popover open={toolbarFilterOpen} onOpenChange={setToolbarFilterOpen}>
          <PopoverTrigger asChild>
            <button
              title={t("toolbar.filter")}
              className={cn(xBase, "hover:max-w-[100px]", isTableFilterActive ? xActive : xDefault)}
            >
              <Filter className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.filter")}</span>
            </button>
          </PopoverTrigger>
          <PopoverContent side="bottom" align="start" className="w-48 p-1">
            {/* Status section */}
            <div className="px-2 pt-2 pb-1 flex items-center justify-between">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("statusFilter.status")}</span>
              {filterStatus.length > 0 && (
                <button onClick={() => setFilterStatus([])} className="text-[9px] text-destructive hover:underline font-semibold">{t("toolbar.clearAllFilters")}</button>
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
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{t("statusFilter.account")}</span>
                  {accountFilter !== "all" && (
                    <button onClick={() => setAccountFilter("all")} className="text-[9px] text-destructive hover:underline font-semibold">{t("toolbar.clearAllFilters")}</button>
                  )}
                </div>
                <div className="max-h-40 overflow-y-auto">
                  <button
                    onClick={() => setAccountFilter("all")}
                    className={cn("w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[12px] hover:bg-muted", accountFilter === "all" && "font-semibold text-brand-indigo")}
                  >
                    <span className="flex-1 text-left">{t("statusFilter.allAccounts")}</span>
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

      {/* Fields — expand-on-hover (column visibility, invoices + contracts tabs only) */}
      {!isExpensesTab && (
        <Popover open={toolbarFieldsOpen} onOpenChange={setToolbarFieldsOpen}>
          <PopoverTrigger asChild>
            <button
              title={t("toolbar.fields")}
              className={cn(xBase, "hover:max-w-[100px]", xDefault)}
            >
              <Eye className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.fields")}</span>
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
                  <span className="flex-1 text-left">{t(col.tKey)}</span>
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
              {t("toolbar.showAllFields")}
            </button>
          </PopoverContent>
        </Popover>
      )}

      {/* ── Right side: action buttons (visible only when items selected) + search ── */}
      <div className="ml-auto flex items-center gap-1">

        {/* Print button (expenses only) — expand-on-hover */}
        {isExpensesTab && (
          <button
            onClick={() => setExpenseExportTrigger((prev) => prev + 1)}
            title={t("toolbar.export")}
            className={cn(xBase, "hover:max-w-[130px]", xDefault)}
          >
            <Printer className="h-4 w-4 shrink-0" />
            <span className={xSpan}>{t("toolbar.export")}</span>
          </button>
        )}

        {/* Invoice action buttons — only when selected */}
        {isInvoicesTab && invoiceSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title={t("toolbar.edit")}
              onClick={handleTableEdit}
              disabled={invoiceSelectedIds.size !== 1}
              className={cn(xBase, "hover:max-w-[80px]", xDefault, "disabled:opacity-40 disabled:pointer-events-none")}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.edit")}</span>
            </button>
            <button
              title={t("toolbar.copy")}
              onClick={handleTableDuplicate}
              disabled={invoiceSelectedIds.size !== 1}
              className={cn(xBase, "hover:max-w-[80px]", xDefault, "disabled:opacity-40 disabled:pointer-events-none")}
            >
              <Copy className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.copy")}</span>
            </button>
            <button
              title={t("toolbar.delete")}
              onClick={handleTableDeleteInvoices}
              className={cn(xBase, "hover:max-w-[100px]", xDefault, "hover:text-red-600")}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.delete")}</span>
            </button>
            <button
              title={invoiceSendPaidAction === "paid" ? t("toolbar.markPaid") : t("toolbar.send")}
              onClick={() => invoiceSendPaidAction === "paid" ? handleTableMarkPaid() : handleTableMarkSent()}
              className={cn(xBase, "hover:max-w-[80px]", xDefault, invoiceSendPaidAction === "paid" && "hover:text-emerald-700")}
            >
              {invoiceSendPaidAction === "paid" ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <SendHorizontal className="h-4 w-4 shrink-0" />}
              <span className={xSpan}>{invoiceSendPaidAction === "paid" ? t("toolbar.paid") : t("toolbar.send")}</span>
            </button>
            <button
              onClick={() => setInvoiceSelectedIds(new Set())}
              title={t("toolbar.clearSelection")}
              className={cn(xBase, "hover:max-w-[130px]", xDefault)}
            >
              <X className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.selected", { count: invoiceSelectedIds.size })}</span>
            </button>
          </>
        )}

        {/* Contract action buttons — only when selected */}
        {!isInvoicesTab && !isExpensesTab && contractSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title={t("toolbar.delete")}
              onClick={handleTableDeleteContracts}
              className={cn(xBase, "hover:max-w-[100px]", xDefault, "hover:text-red-600")}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.delete")}</span>
            </button>
            <button
              title={t("toolbar.sign")}
              onClick={handleTableMarkSigned}
              disabled={contractSelectedIds.size !== 1}
              className={cn(xBase, "hover:max-w-[80px]", xDefault, "hover:text-emerald-700 disabled:opacity-40 disabled:pointer-events-none")}
            >
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.sign")}</span>
            </button>
            <button
              onClick={() => setContractSelectedIds(new Set())}
              title={t("toolbar.clearSelection")}
              className={cn(xBase, "hover:max-w-[130px]", xDefault)}
            >
              <X className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.selected", { count: contractSelectedIds.size })}</span>
            </button>
          </>
        )}

        {/* Expense action buttons — only when selected */}
        {isExpensesTab && expenseSelectedIds.size > 0 && isAgencyUser && (
          <>
            <button
              title={t("toolbar.edit")}
              onClick={() => {
                const id = Array.from(expenseSelectedIds)[0];
                const exp = (expensesData ?? []).find((e) => e.id === id);
                if (!exp) return;
                setEditingExpense(exp);
                setExpensePanelOpen(true);
              }}
              disabled={expenseSelectedIds.size !== 1}
              className={cn(xBase, "hover:max-w-[80px]", xDefault, "disabled:opacity-40 disabled:pointer-events-none")}
            >
              <Pencil className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.edit")}</span>
            </button>
            <button
              title={t("toolbar.delete")}
              onClick={async () => {
                const ids = Array.from(expenseSelectedIds);
                if (!window.confirm(ids.length === 1 ? t("expenses.deleteConfirm", { count: ids.length }) : t("expenses.deleteConfirmPlural", { count: ids.length }))) return;
                for (const id of ids) await deleteExpenseApi(id);
                setExpenseSelectedIds(new Set());
                await queryClient.invalidateQueries({ queryKey: ["expenses"] });
              }}
              className={cn(xBase, "hover:max-w-[100px]", xDefault, "hover:text-red-600")}
            >
              <Trash2 className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.delete")}</span>
            </button>
            <button
              onClick={() => setExpenseSelectedIds(new Set())}
              title={t("toolbar.clearSelection")}
              className={cn(xBase, "hover:max-w-[130px]", xDefault)}
            >
              <X className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.selected", { count: expenseSelectedIds.size })}</span>
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
          <div className={cn("w-full md:w-[340px] md:shrink-0 bg-muted rounded-lg flex flex-col overflow-hidden", mobileView === "detail" ? "hidden md:flex" : "flex")}>
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
                  setMobileView("detail");
                }}
                groupBy={expenseGroupBy}
              />
            )}
          </div>

          {/* Right panel */}
          <div className={cn("relative flex-1 flex flex-col min-w-0 overflow-hidden rounded-lg bg-card", mobileView === "list" ? "hidden md:flex" : "flex")}>
            {/* Gradient background — renders across all right-panel states */}
            {gradientTesterOpen ? (
              <>
                {gradientLayers.map(layer => {
                  const style = layerToStyle(layer);
                  if (!style) return null;
                  return <div key={layer.id} className="absolute inset-0" style={style} />;
                })}
                {gradientDragMode && (
                  <GradientControlPoints layers={gradientLayers} onUpdateLayer={updateGradientLayer} />
                )}
              </>
            ) : (
              <>
                <div className="absolute inset-0 bg-[#F8F3EB] dark:bg-background" />
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.9)_0%,transparent_60%)] dark:opacity-[0.08]" />
              </>
            )}
            {/* Content — relative so it renders above gradient */}
            <div className="relative flex flex-col flex-1 min-h-0 overflow-hidden">
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
                    toolbarSlot={toolbarControls}
                    noBackground={gradientTesterOpen}
                  />
                ) : (
                  <ExpenseDetailViewEmpty
                    onNew={isAgencyUser ? () => { setEditingExpense(null); setExpensePanelOpen(true); } : undefined}
                    toolbarSlot={toolbarControls}
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
                  toolbarSlot={toolbarControls}
                  noBackground={gradientTesterOpen}
                />
              ) : (
                <InvoiceDetailViewEmpty toolbarSlot={toolbarControls} />
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
                  toolbarSlot={toolbarControls}
                  noBackground={gradientTesterOpen}
                />
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="shrink-0 px-[3px] pt-[3px]">
                    <div className="px-4 pt-3 pb-1.5 flex items-center gap-1.5 overflow-x-auto [scrollbar-width:none]">
                      {toolbarControls}
                    </div>
                  </div>
                  <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
                    <PenLine className="w-12 h-12 text-muted-foreground/20 mb-4" />
                    <p className="text-sm font-medium text-muted-foreground">{t("contracts.empty.selectAContract")}</p>
                    <p className="text-xs text-muted-foreground/60 mt-1">{t("contracts.empty.selectAContractDesc")}</p>
                    {isAgencyUser && (
                      <button
                        onClick={() => { onSelectContract(null); setRightPanelMode("create"); }}
                        className="mt-4 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium bg-brand-indigo text-white hover:opacity-90"
                      >
                        {t("contracts.form.uploadContract")}
                      </button>
                    )}
                  </div>
                </div>
              )
            ) : null}
            </div>
          </div>
        </>
      ) : (
        /* ── TABLE MODE: full-width, with optional inline right panel ── */
        <>
          {/* Left: table area */}
          <div className="flex-1 min-w-0 flex flex-col overflow-hidden rounded-lg bg-muted">

            {/* Title + billing tabs (same 309px wrapper as list mode) + table toolbar */}
            <div className="pl-[17px] pr-3.5 pt-3 md:pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
              <div className="flex items-center justify-between w-full md:w-[309px] md:shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">{t("page.title")}</h2>
                {billingTabButtons}
              </div>
              {tableToolbar}
            </div>

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

      <GradientTester
        open={gradientTesterOpen}
        onClose={() => setGradientTesterOpen(false)}
        layers={gradientLayers}
        onUpdateLayer={updateGradientLayer}
        onResetLayers={resetGradientLayers}
        dragMode={gradientDragMode}
        onToggleDragMode={() => setGradientDragMode(prev => !prev)}
      />

    </div>
  );
}
