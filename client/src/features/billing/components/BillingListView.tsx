import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { useBreadcrumb } from "@/contexts/BreadcrumbContext";
import { deleteExpense as deleteExpenseApi } from "../api/expensesApi";
import {
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
  ArrowUp,
  ArrowDown,
  CalendarDays,
  Filter,
  Eye,
  ListTree,
  Printer,
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
import { ContractStatCards } from "./ContractStatCards";
import { ExpensesListView, useExpensesData } from "./ExpensesListView";
import { ExpenseDetailView, ExpenseDetailViewEmpty } from "./ExpenseDetailView";
import { ExpenseCreatePanel } from "./ExpenseCreatePanel";
import { useFKeyScrollToSelected } from "@/hooks/useFKeyScrollToSelected";

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
    <div className="sticky top-0 z-20 row" style={{ gap: 10, padding: "12px 4px 8px", background: "var(--bg)", boxShadow: "0 -8px 0 8px var(--bg)" }}>
      <span style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.16em", textTransform: "uppercase", color: "var(--ink-soft)", fontWeight: 700 }}>
        {translatedLabel}
      </span>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", borderRadius: "var(--r-pill)", padding: "1px 8px" }}>
        {count}
      </span>
      <div className="rule" style={{ flex: 1, marginLeft: 4 }} />
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
  isOwner: boolean;
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
  // Tab change (for in-header tab switcher)
  onTabChange?: (tab: BillingTab) => void;
  // Quarter/year filters
  quarterFilter: string | null;
  setQuarterFilter: (v: string | null) => void;
  yearFilter: number | null;
  setYearFilter: (v: number | null) => void;
}

// ── Main component ───────────────────────────────────────────────────────────

export function BillingListView({
  activeTab,
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
  isOwner,
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
  // Tab change
  onTabChange,
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
  const [groupDirection, setGroupDirection] = useState<"asc" | "desc">("desc");
  const [invoiceGroupBy, setInvoiceGroupBy] = useState<"none" | "year_quarter">("year_quarter");
  const [expenseExportTrigger, setExpenseExportTrigger] = useState(0);

  // Responsive toolbar state
  const toolbarRef = useRef<HTMLDivElement>(null);
  const billingScrollRef = useRef<HTMLDivElement>(null);
  const [isNarrow, setIsNarrow] = useState(false);

  // F shortcut: scroll selected invoice/contract/expense into view (depends on active tab).
  const billingSelectedId = activeTab === "invoices"
    ? (selectedInvoice?.id ?? null)
    : activeTab === "contracts"
      ? (selectedContract?.id ?? null)
      : (selectedExpenseId ?? null);
  const billingSelector = activeTab === "invoices"
    ? "data-invoice-id"
    : activeTab === "contracts"
      ? "data-contract-id"
      : "data-expense-id";
  useFKeyScrollToSelected({
    containerRef: billingScrollRef,
    selectedId: billingSelectedId,
    getSelector: (id) => `[${billingSelector}="${id}"]`,
  });

  // ── Gradient tester state ──────────────────────────────────────────────────
  const GRADIENT_KEY = "la:gradient:billing";
  const [savedGradient, setSavedGradient] = useState<GradientLayer[] | null>(() => {
    try { const raw = localStorage.getItem(GRADIENT_KEY); return raw ? JSON.parse(raw) as GradientLayer[] : null; } catch { return null; }
  });
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

  const handleApplyGradient = useCallback(() => {
    localStorage.setItem(GRADIENT_KEY, JSON.stringify(gradientLayers));
    setSavedGradient(gradientLayers);
    setGradientTesterOpen(false);
  }, [gradientLayers]);
  const toggleGradientTester = useCallback(() => {
    setGradientTesterOpen(prev => {
      if (!prev && savedGradient) setGradientLayers(savedGradient);
      return !prev;
    });
  }, [savedGradient]);

  // Listen for the global gradient toggle dispatched by the nav menu button
  useEffect(() => {
    const handler = () => toggleGradientTester();
    window.addEventListener("toggle-gradient-tester", handler);
    return () => window.removeEventListener("toggle-gradient-tester", handler);
  }, [toggleGradientTester]);

  // Accounts for filter dropdown (agency only)
  const { accounts } = useAccounts({ enabled: isAgencyUser });

  // Expenses data (for auto-selection of latest + available years on expenses tab)
  const { data: expensesData } = useExpensesData(activeTab === "expenses");


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
  const xDefault = "border-[color:var(--line)] text-[color:var(--mute)] hover:text-[color:var(--ink)]";
  const xActive  = "border-[color:var(--wine)] text-[color:var(--wine)]";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  // ── Billing tab segment options ───────────────────────────────────────────
  const billingTabs = isOwner ? billingTabsAgency : billingTabsClient;

  // ── Unified header (both list and table modes) ──────────────────────────────

  const unifiedHeader = (
    <div style={{
      height: 60,
      flexShrink: 0,
      padding: '0 20px',
      borderBottom: '1px solid var(--line)',
      display: 'flex',
      alignItems: 'center',
      gap: 12,
      background: 'var(--surface)',
      overflowX: 'auto',
    }}>
      {/* Title - Serif, 24px (matching migration) */}
      <span style={{
        fontFamily: 'Georgia, serif',
        fontSize: 24,
        fontWeight: 500,
        color: 'var(--ink)',
        letterSpacing: '-0.01em',
        flexShrink: 0,
      }}>
        {t("page.title")}
      </span>

      {/* Billing section tabs (Invoices / Expenses / Contracts) */}
      {onTabChange && (
        <div className="la-seg" style={{ flexShrink: 0 }}>
          {billingTabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id as BillingTab)}
                className={`la-seg-btn${activeTab === tab.id ? ' on' : ''}`}
              >
                <Icon size={14} />
                {tab.label}
              </button>
            );
          })}
        </div>
      )}

      {/* View mode toggle (List | Table) */}
      <ViewTabBar
        tabs={viewModeTabs}
        activeId={viewMode}
        onTabChange={(m) => setViewMode(m as "list" | "table")}
        variant="segment"
      />

      {/* Sort + Date toolbar buttons (not on expenses) */}
      {!isExpensesTab && (
        <>
          {/* Sort */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("la-btn la-btn--soft shrink-0 hidden sm:inline-flex gap-1.5", isSortNonDefault && "[border-color:var(--wine)] [color:var(--wine)]")}>
                <ArrowUpDown className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{t("toolbar.sort")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.sortBy")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSortBy("recent"); }} className="text-[12px] flex items-center gap-2">
                <span className={cn("flex-1", sortBy === "recent" && "font-semibold text-[color:var(--wine)]")}>{t("sort.recent")}</span>
              </DropdownMenuItem>
              {(() => {
                const isActive = sortBy === "amount_desc" || sortBy === "amount_asc";
                const activeDir: "asc" | "desc" = sortBy === "amount_asc" ? "asc" : "desc";
                return (
                  <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSortBy(isActive ? sortBy : "amount_desc"); }} className="text-[12px] flex items-center gap-2">
                    <span className={cn("flex-1", isActive && "font-semibold text-[color:var(--wine)]")}>{t("sort.amountDesc").replace(" High", "")}</span>
                    {isActive && (
                      <>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSortBy("amount_desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "desc" ? "text-[color:var(--wine)]" : "text-foreground/30")} title="High to Low"><ArrowDown className="h-3 w-3" /></button>
                        <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setSortBy("amount_asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", activeDir === "asc" ? "text-[color:var(--wine)]" : "text-foreground/30")} title="Low to High"><ArrowUp className="h-3 w-3" /></button>
                      </>
                    )}
                  </DropdownMenuItem>
                );
              })()}
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSortBy("due_asc"); }} className="text-[12px] flex items-center gap-2">
                <span className={cn("flex-1", sortBy === "due_asc" && "font-semibold text-[color:var(--wine)]")}>{t("sort.dueSoonest")}</span>
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setSortBy("name_asc"); }} className="text-[12px] flex items-center gap-2">
                <span className={cn("flex-1", sortBy === "name_asc" && "font-semibold text-[color:var(--wine)]")}>{t("sort.nameAZ")}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Date */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("la-btn la-btn--soft shrink-0 hidden sm:inline-flex gap-1.5", isDateActive && "[border-color:var(--wine)] [color:var(--wine)]")}>
                <CalendarDays className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{t("toolbar.date")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48">
              {availableYears.length > 0 && (
                <>
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("dateFilter.year")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {availableYears.map((year) => (
                    <DropdownMenuItem key={year} onClick={() => setYearFilter(yearFilter === year ? null : year)} className={cn("text-[12px]", yearFilter === year && "font-semibold text-[color:var(--wine)]")}>
                      {year}{yearFilter === year && <Check className="h-3 w-3 ml-auto" />}
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
                <DropdownMenuItem key={id} onClick={() => setQuarterFilter(quarterFilter === id ? null : id)} className={cn("text-[12px]", quarterFilter === id && "font-semibold text-[color:var(--wine)]")}>
                  <span className="flex-1 flex items-center gap-2">
                    <span className="font-medium" style={{ color: "var(--ink)" }}>{id}</span>
                    <span style={{ color: "var(--mute)" }}>{t(monthsKey)}</span>
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
        </>
      )}

      {/* Flex spacer */}
      <div style={{ flex: 1 }} />

      {/* Right side controls: Search + Filter + New button */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: 'relative', flexShrink: 0 }}>
          <input
            className="neu-input"
            placeholder={isExpensesTab ? t("toolbar.searchExpenses") : isInvoicesTab ? t("toolbar.searchInvoices") : t("toolbar.searchContracts")}
            value={isExpensesTab ? expenseSearch : listSearch}
            onChange={(e) => isExpensesTab ? setExpenseSearch(e.target.value) : setListSearch(e.target.value)}
            style={{ paddingLeft: 32, paddingRight: (isExpensesTab ? expenseSearch : listSearch) ? 28 : 12, paddingTop: 0, paddingBottom: 0, height: 32, fontSize: 12, width: 190 }}
          />
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--mute-2)', display: 'flex', pointerEvents: 'none' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/></svg>
          </span>
          {(isExpensesTab ? expenseSearch : listSearch) && (
            <button
              onClick={() => isExpensesTab ? setExpenseSearch("") : setListSearch("")}
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--mute-2)', display: 'flex', padding: 0 }}
            >
              <X style={{ width: 10, height: 10 }} />
            </button>
          )}
        </div>

        {/* Filter (Status + Account) — not on expenses */}
        {!isExpensesTab && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className={cn("la-btn la-btn--soft shrink-0 gap-1.5", isFilterActive && "[border-color:var(--wine)] [color:var(--wine)]")}>
                <Filter className="h-3.5 w-3.5 shrink-0" />
                <span className="text-[11px]">{t("toolbar.filter")}</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 max-h-80 overflow-y-auto">
              <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.status")}</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {statusOptions.map((s) => {
                const color = statusColors[s];
                return (
                  <DropdownMenuItem key={s} onClick={(e) => { e.preventDefault(); toggleFilterStatus(s); }} className="flex items-center gap-2 text-[12px]">
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: color?.dot || "#94A3B8" }} />
                    <span className="flex-1">{s}</span>
                    {filterStatus.includes(s) && <Check className="h-3 w-3 shrink-0" style={{ color: "var(--wine)" }} />}
                  </DropdownMenuItem>
                );
              })}
              {isAgencyUser && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("statusFilter.account")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setAccountFilter("all")} className={cn("text-[12px]", accountFilter === "all" && "font-semibold text-[color:var(--wine)]")}>
                    All accounts
                    {accountFilter === "all" && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  {accounts.map((acct) => (
                    <DropdownMenuItem key={acct.id} onClick={() => setAccountFilter(acct.id)} className={cn("text-[12px]", accountFilter === acct.id && "font-semibold text-[color:var(--wine)]")}>
                      <Building2 className="h-3 w-3 shrink-0 text-muted-foreground mr-1.5" />
                      {acct.name}
                      {accountFilter === acct.id && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => { setFilterStatus([]); setAccountFilter("all"); }} className="text-[12px] text-destructive">{t("toolbar.clearAllFilters")}</DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        {/* New button */}
        {isAgencyUser && (
          <button
            onClick={isExpensesTab ? () => { setExpensePanelOpen(true); setMobileView("detail"); } : handleAddClick}
            title={isExpensesTab ? t("toolbar.newExpense") : isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}
            className="la-btn la-btn--wine shrink-0 gap-1.5"
          >
            <Plus className="h-3.5 w-3.5 shrink-0" />
            <span className="text-[11px]">
              {isExpensesTab ? t("toolbar.newExpense") : isInvoicesTab ? t("toolbar.newInvoice") : t("toolbar.newContract")}
            </span>
          </button>
        )}
      </div>

      {/* Mobile-only back button (hidden on desktop) */}
      {mobileView === "detail" && (
        <button
          onClick={() => setMobileView("list")}
          style={{ display: 'flex', height: 36, width: 36, borderRadius: 999, border: '1px solid var(--line)', background: 'var(--surface)', alignItems: 'center', justifyContent: 'center', flexShrink: 0, cursor: 'pointer' }}
          className="md:hidden"
        >
          <ChevronLeft style={{ width: 16, height: 16, color: 'var(--ink)' }} />
        </button>
      )}
    </div>
  );

  // ── Left panel header (list mode) — 309px wrapper ─────────────────────────
  // DEPRECATED: Replaced by unified header above, kept for reference
  // const leftPanelHeader = (
  //   <div className="pl-[17px] pr-[17px] pt-3 md:pt-10 pb-3 shrink-0 flex items-center">
  //     ...
  //   </div>
  // );

  // ── Right panel list-mode toolbar (mobile back + view toggle + gradient) ────

  const toolbarControls = (
    /* Mobile back button — only visible on small screens */
    <button
      onClick={() => setMobileView("list")}
      className="md:hidden h-9 w-9 rounded-full border grid place-items-center shrink-0"
      style={{ borderColor: "var(--line)", background: "var(--surface)" }}
    >
      <ChevronLeft className="h-4 w-4" style={{ color: "var(--ink)" }} />
    </button>
  );

  // ── Left panel list-mode toolbar (Search + Sort + Filter + Date + Group + Create) ──

  const leftPanelToolbar = (
    isExpensesTab ? (
      <div className="pl-2 pr-[17px] pb-2 flex items-center gap-1 shrink-0">
        {/* Group — expenses only */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className={cn(xBase, "hover:max-w-[100px]", expenseGroupBy !== "none" ? xActive : xDefault)}>
              <ListTree className="h-4 w-4 shrink-0" />
              <span className={xSpan}>{t("toolbar.group")}</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-48">
            <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">{t("toolbar.groupBy")}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setExpenseGroupBy("none"); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", expenseGroupBy === "none" && "font-semibold text-[color:var(--wine)]")}>{t("groupOptions.none")}</span>
              {expenseGroupBy === "none" && <Check className="h-3 w-3" />}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setExpenseGroupBy("year_quarter"); }} className="text-[12px] flex items-center gap-2">
              <span className={cn("flex-1", expenseGroupBy === "year_quarter" && "font-semibold text-[color:var(--wine)]")}>{t("groupOptions.yearQuarter")}</span>
              {expenseGroupBy === "year_quarter" && (
                <>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("asc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "asc" ? "text-[color:var(--wine)]" : "text-foreground/30")} title="Ascending"><ArrowUp className="h-3 w-3" /></button>
                  <button type="button" onClick={(e) => { e.preventDefault(); e.stopPropagation(); setGroupDirection("desc"); }} className={cn("p-0.5 rounded hover:bg-muted/60 transition-colors", groupDirection === "desc" ? "text-[color:var(--wine)]" : "text-foreground/30")} title="Descending"><ArrowDown className="h-3 w-3" /></button>
                </>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    ) : null
  );

  // ── Card list (list mode, non-expenses tab) ────────────────────────────────

  const cardList = (
    <>
      {/* Card list */}
      <div ref={billingScrollRef} className="flex-1 overflow-y-auto p-[3px]">
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
                  <div key={item.invoice.id || idx} data-invoice-id={item.invoice.id} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
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
                <div key={item.contract.id || idx} data-contract-id={item.contract.id} className="animate-card-enter" style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}>
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

  // ── Render ──────────────────────────────────────────────────────────────────
  // (Table mode toolbar is now integrated into the unified header above)


  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: 'var(--surface)' }} data-testid="billing-list-view">
      {/* Unified header (all modes) */}
      {unifiedHeader}

      <div className="flex-1 flex flex-col md:flex-row overflow-hidden gap-[var(--panel-gap)]" style={{ background: 'var(--surface)' }}>
        {viewMode === "list" ? (
          /* ── LIST MODE: original split-panel layout ── */
          <>
            {/* Left panel */}
            <div className={cn("w-full md:w-[var(--toolbar-w)] md:shrink-0 flex flex-col overflow-hidden min-h-[300px] md:min-h-0", mobileView === "detail" ? "hidden md:flex" : "flex")} style={{ borderRadius: "var(--r-card)", background: "var(--card)", border: "1px solid var(--line)" }}>
              {/* No header here anymore - using unified header above */}

            {/* ── List toolbar: search + create + sort + filter + date + group ── */}
            {leftPanelToolbar}

            {/* Stat cards for contracts tab (above card list) */}
            {!isExpensesTab && !isInvoicesTab && <ContractStatCards contracts={filteredContracts} />}

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
                groupDirection={groupDirection}
              />
            )}
          </div>

          {/* Right panel */}
          <div className={cn("relative flex-1 flex flex-col min-w-0 overflow-hidden rounded-lg min-h-[400px] md:min-h-0", mobileView === "list" ? "hidden md:flex" : "flex")}>
            {/* Content */}
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
                    noBackground={gradientTesterOpen || !!savedGradient}
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
                  noBackground={gradientTesterOpen || !!savedGradient}
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
                  noBackground={gradientTesterOpen || !!savedGradient}
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
                        className="la-btn la-btn--wine mt-4 text-[12px]"
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
              {/* No header here - using unified header above */}

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
            <div className="w-full md:w-[500px] shrink-0 flex flex-col overflow-hidden rounded-lg bg-card">
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
            <div className="w-full md:w-[500px] shrink-0 flex flex-col overflow-hidden rounded-lg bg-card">
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
      </div>

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
        onApply={handleApplyGradient}
      />
    </div>
  );
}
