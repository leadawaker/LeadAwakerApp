import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Trash2, X, Plus } from "lucide-react";
import { MobileListHeader, MobileHeaderIconBtn, MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useCompactPanelState } from "@/components/crm/CompactEntityRail";
import { useAccounts } from "@/hooks/useApiData";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../../types";
import { BillingTopBar } from "./BillingTopBar";
import { BillingListPanel, type BillingGroupBy } from "./BillingListPanel";
import { BillingStatCards } from "./BillingStatCards";
import { InvoiceDetailPanel, InvoiceDetailPanelEmpty } from "./InvoiceDetailPanel";
import { ContractDetailPanel, ContractDetailPanelEmpty } from "./ContractDetailPanel";
import { ExpenseDetailPanel, ExpenseDetailPanelEmpty } from "./ExpenseDetailPanel";
import {
  effectiveInvoiceStatus, parseNum, expenseYear, expenseQuarterNum,
} from "./adapters";
// Reused (already-wired) form + table components.
import { InvoiceCreatePanel } from "../InvoiceCreatePanel";
import { ContractCreatePanel } from "../ContractCreatePanel";
import { ExpenseCreatePanel } from "../ExpenseCreatePanel";
import { ExpensesView } from "../ExpensesView";
import { useExpensesData } from "../ExpensesListView";
import { ContractUploadDialog } from "../ContractUploadDialog";
import { InvoicesInlineTable, DEFAULT_INVOICE_COLS } from "../InvoicesInlineTable";
import { ContractsInlineTable, DEFAULT_CONTRACT_COLS } from "../ContractsInlineTable";
import { deleteExpense } from "../../api/expensesApi";

type Tab = "invoices" | "contracts" | "expenses";
type ViewMode = "list" | "table";

interface Props {
  activeTab: Tab;
  onTabChange: (t: Tab) => void;
  // Invoices
  invoices: InvoiceRow[];
  invoicesLoading: boolean;
  selectedInvoice: InvoiceRow | null;
  onSelectInvoice: (i: InvoiceRow | null) => void;
  onCreateInvoice: (payload: Record<string, any>) => Promise<InvoiceRow>;
  onUpdateInvoice: (id: number, patch: Record<string, any>) => Promise<InvoiceRow>;
  onDeleteInvoice: (id: number) => Promise<void>;
  onMarkSent: (id: number) => Promise<InvoiceRow>;
  onMarkPaid: (id: number) => Promise<InvoiceRow>;
  onRefreshInvoices: () => Promise<void>;
  // Contracts
  contracts: ContractRow[];
  contractsLoading: boolean;
  selectedContract: ContractRow | null;
  onSelectContract: (c: ContractRow | null) => void;
  onCreateContract: (payload: Record<string, any>) => Promise<ContractRow>;
  onUpdateContract: (id: number, patch: Record<string, any>) => Promise<ContractRow>;
  onDeleteContract: (id: number) => Promise<void>;
  onMarkSigned: (id: number) => Promise<ContractRow>;
  onRefreshContracts: () => Promise<void>;
  // Shared
  isAgencyUser: boolean;
  isOwner: boolean;
  accountFilter: number | "all";
  setAccountFilter: (v: number | "all") => void;
}

const QUARTER_OF = (m: number) => (m <= 2 ? "Q1" : m <= 5 ? "Q2" : m <= 8 ? "Q3" : "Q4");

export function BillingWorkspace(p: Props) {
  const { t } = useTranslation("billing");
  const queryClient = useQueryClient();
  const isNarrow = useIsMobile(1024);
  const isExpenses = p.activeTab === "expenses";

  // ── List-panel fold state ────────────────────────────────────────────────
  const { state: listPanelState, cycle } = useListPanelState();
  const { ref: compactObserverRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 900, deactivateAbove: 1250 });
  const isListCompact = !isNarrow && (listPanelState === "compact" || (listPanelState === "full" && rightPanelNarrow));
  const isListHidden = !isNarrow && listPanelState === "hidden";
  const detailRef = useRef<HTMLDivElement | null>(null);
  const setDetailNode = useCallback((node: HTMLDivElement | null) => { detailRef.current = node; compactObserverRef(node); }, [compactObserverRef]);

  // ── Workspace UI state ───────────────────────────────────────────────────
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [groupBy, setGroupBy] = useState<BillingGroupBy>("date");
  const [groupDirection, setGroupDirection] = useState<"asc" | "desc">("desc");
  const [panelMode, setPanelMode] = useState<"view" | "create" | "edit">("view");
  const [viewMode, setViewMode] = useState<ViewMode>(() => (localStorage.getItem("billing-view-mode") as ViewMode) || "list");
  useEffect(() => { localStorage.setItem("billing-view-mode", viewMode); }, [viewMode]);
  const [yearFilter, setYearFilter] = useState<number | null>(null);
  const [quarterFilter, setQuarterFilter] = useState<string | null>(null);

  // Invoice create/edit/duplicate
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);
  const [duplicatingInvoice, setDuplicatingInvoice] = useState<InvoiceRow | null>(null);
  // Expense selection / create
  const [selectedExpenseId, setSelectedExpenseId] = useState<number | null>(null);
  const [editingExpense, setEditingExpense] = useState<ExpenseRow | null>(null);
  const [expensePanelOpen, setExpensePanelOpen] = useState(false);
  const [expenseSelectedIds, setExpenseSelectedIds] = useState<Set<number>>(new Set());
  // Table-mode multi-select
  const [invoiceSelectedIds, setInvoiceSelectedIds] = useState<Set<number>>(new Set());
  const [contractSelectedIds, setContractSelectedIds] = useState<Set<number>>(new Set());
  // List-mode multi-select (shared across tabs — cleared on tab change)
  const [listSelectedIds, setListSelectedIds] = useState<Set<number>>(new Set());
  const visibleInvoiceColumns = useMemo(() => new Set(DEFAULT_INVOICE_COLS), []);
  const visibleContractColumns = useMemo(() => new Set(DEFAULT_CONTRACT_COLS), []);
  // Contract upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  const { accounts } = useAccounts({ enabled: p.isAgencyUser });
  const { data: expensesData } = useExpensesData(isExpenses);

  // Reset transient state on tab change.
  useEffect(() => {
    setSearch(""); setFilterStatus([]); setSortBy("recent"); setPanelMode("view");
    setEditingInvoice(null); setDuplicatingInvoice(null); setExpensePanelOpen(false);
    setGroupBy(p.activeTab === "expenses" ? "year_quarter" : "date");
    setGroupDirection("desc");
    setListSelectedIds(new Set());
  }, [p.activeTab]);

  // ── Filtered + sorted lists ──────────────────────────────────────────────
  const applyDateFilter = useCallback(<T,>(rows: T[], dateOf: (r: T) => string | null | undefined): T[] => {
    let r = rows;
    if (quarterFilter) r = r.filter((x) => { const d = dateOf(x); return d ? QUARTER_OF(new Date(d).getMonth()) === quarterFilter : false; });
    if (yearFilter) r = r.filter((x) => { const d = dateOf(x); return d ? new Date(d).getFullYear() === yearFilter : false; });
    return r;
  }, [quarterFilter, yearFilter]);

  const filteredInvoices = useMemo(() => {
    let r = [...p.invoices];
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((i) => `${i.title ?? ""} ${i.invoice_number ?? ""} ${i.account_name ?? ""}`.toLowerCase().includes(q)); }
    if (filterStatus.length) r = r.filter((i) => filterStatus.includes(effectiveInvoiceStatus(i)));
    r = applyDateFilter(r, (i) => i.issued_date || i.created_at);
    r.sort((a, b) => sortCompare(sortBy, parseNum(a.total), parseNum(b.total), a.due_date, b.due_date, a.title, b.title, a.created_at, b.created_at));
    return r;
  }, [p.invoices, search, filterStatus, sortBy, applyDateFilter]);

  const filteredContracts = useMemo(() => {
    let r = [...p.contracts];
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((c) => `${c.title ?? ""} ${c.account_name ?? ""} ${c.description ?? ""}`.toLowerCase().includes(q)); }
    if (filterStatus.length) r = r.filter((c) => filterStatus.includes(String(c.status || "Draft")));
    r = applyDateFilter(r, (c) => c.start_date || c.created_at);
    r.sort((a, b) => sortCompare(sortBy, 0, 0, a.end_date, b.end_date, a.title, b.title, a.created_at, b.created_at));
    return r;
  }, [p.contracts, search, filterStatus, sortBy, applyDateFilter]);

  const filteredExpenses = useMemo(() => {
    let r = [...(expensesData ?? [])];
    if (search.trim()) { const q = search.toLowerCase(); r = r.filter((e) => `${e.supplier ?? ""} ${e.description ?? ""} ${e.invoiceNumber ?? ""} ${e.notes ?? ""}`.toLowerCase().includes(q)); }
    if (quarterFilter) r = r.filter((e) => (e.quarter ? e.quarter === quarterFilter : e.date ? QUARTER_OF(new Date(e.date).getMonth()) === quarterFilter : false));
    if (yearFilter) r = r.filter((e) => expenseYear(e) === yearFilter);
    r.sort((a, b) => {
      switch (sortBy) {
        case "amount_desc": return parseNum(b.totalAmount) - parseNum(a.totalAmount);
        case "amount_asc": return parseNum(a.totalAmount) - parseNum(b.totalAmount);
        case "name_asc": return (a.supplier || "").localeCompare(b.supplier || "");
        case "oldest": return (a.date || "").localeCompare(b.date || "");
        default: return (b.date || "").localeCompare(a.date || "");
      }
    });
    return r;
  }, [expensesData, search, sortBy, quarterFilter, yearFilter]);

  // Auto-select first item.
  useEffect(() => {
    if (p.activeTab === "invoices" && panelMode === "view" && !p.selectedInvoice && filteredInvoices.length) p.onSelectInvoice(filteredInvoices[0]);
  }, [p.activeTab, panelMode, p.selectedInvoice, filteredInvoices]);
  useEffect(() => {
    if (p.activeTab === "contracts" && panelMode === "view" && !p.selectedContract && filteredContracts.length) p.onSelectContract(filteredContracts[0]);
  }, [p.activeTab, panelMode, p.selectedContract, filteredContracts]);
  useEffect(() => {
    if (isExpenses && selectedExpenseId == null && filteredExpenses.length && viewMode === "list") setSelectedExpenseId(filteredExpenses[0].id);
  }, [isExpenses, selectedExpenseId, filteredExpenses, viewMode]);

  const availableYears = useMemo(() => {
    const years = new Set<number>();
    const src = isExpenses ? (expensesData ?? []).map((e) => e.date) : p.activeTab === "invoices" ? p.invoices.map((i) => i.issued_date || i.created_at) : p.contracts.map((c) => c.start_date || c.created_at);
    src.forEach((d) => { if (d) { try { years.add(new Date(d).getFullYear()); } catch { /* ignore */ } } });
    if (isExpenses) (expensesData ?? []).forEach((e) => { if (e.year) years.add(e.year); });
    return Array.from(years).sort((a, b) => b - a);
  }, [isExpenses, expensesData, p.invoices, p.contracts, p.activeTab]);

  // Next invoice number for create panel.
  const nextInvoiceNumber = useMemo(() => {
    const year = new Date().getFullYear();
    if (p.invoices.length === 0) return `INV-${year}-001`;
    const maxNum = p.invoices.reduce((m, inv) => { const mt = String(inv.invoice_number || "").match(/(\d+)$/); return Math.max(m, mt ? parseInt(mt[1], 10) : 0); }, 0);
    return `INV-${year}-${String(maxNum + 1).padStart(3, "0")}`;
  }, [p.invoices]);

  // ── List panel routing ───────────────────────────────────────────────────
  const listItems = p.activeTab === "invoices" ? filteredInvoices : p.activeTab === "contracts" ? filteredContracts : filteredExpenses;
  const listLoading = p.activeTab === "invoices" ? p.invoicesLoading : p.activeTab === "contracts" ? p.contractsLoading : false;
  const selectedId = p.activeTab === "invoices" ? (p.selectedInvoice?.id ?? null) : p.activeTab === "contracts" ? (p.selectedContract?.id ?? null) : selectedExpenseId;

  const handleSelect = (item: InvoiceRow | ContractRow | ExpenseRow) => {
    setPanelMode("view");
    if (p.activeTab === "invoices") p.onSelectInvoice(item as InvoiceRow);
    else if (p.activeTab === "contracts") p.onSelectContract(item as ContractRow);
    else { setSelectedExpenseId((item as ExpenseRow).id); setExpensePanelOpen(false); }
  };

  // ── Create / delete handlers ─────────────────────────────────────────────
  const handleCreate = () => {
    if (p.activeTab === "invoices") { setEditingInvoice(null); setDuplicatingInvoice(null); setPanelMode("create"); }
    else if (p.activeTab === "contracts") { p.onSelectContract(null); setPanelMode("create"); }
    else { setEditingExpense(null); setExpensePanelOpen(true); }
  };
  const handleDelete = () => {
    if (p.activeTab === "invoices" && p.selectedInvoice) p.onDeleteInvoice(p.selectedInvoice.id);
    else if (p.activeTab === "contracts" && p.selectedContract) p.onDeleteContract(p.selectedContract.id);
  };
  const handleDuplicate = (inv: InvoiceRow) => { setDuplicatingInvoice(inv); setEditingInvoice(null); setPanelMode("create"); };

  const hasSelection = p.activeTab === "invoices" ? !!p.selectedInvoice : p.activeTab === "contracts" ? !!p.selectedContract : selectedExpenseId != null;

  // ── Bulk delete for table mode ───────────────────────────────────────────
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const activeBulkIds = p.activeTab === "invoices" ? invoiceSelectedIds : p.activeTab === "contracts" ? contractSelectedIds : expenseSelectedIds;
  const clearActiveBulk = () => {
    if (p.activeTab === "invoices") setInvoiceSelectedIds(new Set());
    else if (p.activeTab === "contracts") setContractSelectedIds(new Set());
    else setExpenseSelectedIds(new Set());
  };
  const handleListCheck = useCallback((id: number) => {
    setListSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleListBulkDelete = useCallback(async () => {
    if (listSelectedIds.size === 0) return;
    if (p.activeTab === "invoices") {
      await Promise.all([...listSelectedIds].map((id) => p.onDeleteInvoice(id)));
      await p.onRefreshInvoices();
    } else if (p.activeTab === "contracts") {
      await Promise.all([...listSelectedIds].map((id) => p.onDeleteContract(id)));
      await p.onRefreshContracts();
    } else {
      await Promise.all([...listSelectedIds].map((id) => deleteExpense(id)));
      await queryClient.invalidateQueries({ queryKey: ["expenses"] });
    }
    setListSelectedIds(new Set());
  }, [listSelectedIds, p.activeTab, p.onDeleteInvoice, p.onDeleteContract, p.onRefreshInvoices, p.onRefreshContracts, queryClient]);

  const handleBulkDelete = useCallback(async () => {
    if (bulkDeleting || activeBulkIds.size === 0) return;
    setBulkDeleting(true);
    try {
      if (p.activeTab === "invoices") {
        await Promise.all([...invoiceSelectedIds].map((id) => p.onDeleteInvoice(id)));
        setInvoiceSelectedIds(new Set());
        await p.onRefreshInvoices();
      } else if (p.activeTab === "contracts") {
        await Promise.all([...contractSelectedIds].map((id) => p.onDeleteContract(id)));
        setContractSelectedIds(new Set());
        await p.onRefreshContracts();
      } else {
        await Promise.all([...expenseSelectedIds].map((id) => deleteExpense(id)));
        setExpenseSelectedIds(new Set());
        await queryClient.invalidateQueries({ queryKey: ["expenses"] });
      }
    } finally {
      setBulkDeleting(false);
    }
  }, [bulkDeleting, activeBulkIds.size, p.activeTab, invoiceSelectedIds, contractSelectedIds, expenseSelectedIds, p.onDeleteInvoice, p.onDeleteContract, p.onRefreshInvoices, p.onRefreshContracts, queryClient]);
  const count = p.activeTab === "invoices" ? filteredInvoices.length : p.activeTab === "contracts" ? filteredContracts.length : filteredExpenses.length;
  const showStatCards = !(isExpenses && viewMode === "table");
  const selectedExpense = (expensesData ?? []).find((e) => e.id === selectedExpenseId) ?? null;
  const invoiceAccount = p.selectedInvoice ? (accounts.find((a) => a.id === p.selectedInvoice!.Accounts_id) ?? null) : null;

  // Table mode = full-width table (no list panel), with optional create panel on the right.
  const tableMode = viewMode === "table";

  return (
    <div className="flex flex-col h-full w-full" data-testid="billing-workspace">
      <MobileListHeader
        title={t("page.title")}
        tabSwitcher={(
          <MobileTabSeg
            tabs={(["invoices", "contracts", "expenses"] as const).map((tab) => ({ id: tab, label: t(`tabs.${tab}`) }))}
            activeId={p.activeTab}
            onChange={(id) => p.onTabChange(id as Tab)}
          />
        )}
        searchValue={search}
        onSearchChange={setSearch}
        searchPlaceholder={t("toolbar.searchPlaceholder", "Search...")}
        extraActions={p.isOwner ? (
          <MobileHeaderIconBtn onClick={handleCreate} aria-label={t("toolbar.add", "Add")} data-testid="mobile-billing-add">
            <Plus className="h-4 w-4" />
          </MobileHeaderIconBtn>
        ) : undefined}
      />
      <BillingTopBar
        tab={p.activeTab}
        onTabChange={p.onTabChange}
        isOwner={p.isOwner}
        count={count}
        listPanelState={listPanelState}
        onCycle={cycle}
        search={search}
        onSearchChange={setSearch}
        filterStatus={filterStatus}
        onToggleFilterStatus={(s) => setFilterStatus((f) => f.includes(s) ? f.filter((x) => x !== s) : [...f, s])}
        isAgencyUser={p.isAgencyUser}
        accountFilter={p.accountFilter}
        onAccountFilterChange={p.setAccountFilter}
        accounts={accounts}
        onResetFilters={() => { setFilterStatus([]); p.setAccountFilter("all"); }}
        sortBy={sortBy}
        onSortByChange={setSortBy}
        groupBy={groupBy}
        onGroupByChange={setGroupBy}
        groupDirection={groupDirection}
        onGroupDirectionChange={setGroupDirection}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        availableYears={availableYears}
        yearFilter={yearFilter}
        onYearFilterChange={setYearFilter}
        quarterFilter={quarterFilter}
        onQuarterFilterChange={setQuarterFilter}
        onCreate={handleCreate}
        onDelete={handleDelete}
        hasSelection={hasSelection}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        {!tableMode && (
          <BillingListPanel
            tab={p.activeTab}
            items={listItems}
            loading={listLoading}
            selectedId={selectedId}
            onSelect={handleSelect}
            groupBy={groupBy}
            groupDirection={groupDirection}
            isListCompact={isListCompact}
            isListHidden={isListHidden}
            isNarrow={isNarrow}
            listSelectedIds={listSelectedIds}
            onListCheck={handleListCheck}
            onListBulkDelete={handleListBulkDelete}
            onListClearSelection={() => setListSelectedIds(new Set())}
          />
        )}

        <div ref={setDetailNode} className="flex-1 min-w-0 overflow-hidden flex flex-col" style={{ background: "var(--bg)" }}>
          {renderMain()}
        </div>
      </div>

      <ContractUploadDialog
        open={uploadDialogOpen}
        onOpenChange={setUploadDialogOpen}
        accounts={accounts}
        isAgencyUser={p.isAgencyUser}
        onCreate={p.onCreateContract}
      />
    </div>
  );

  function renderMain() {
    // Table mode — full-width table (all tabs), optional create panel on the right.
    if (tableMode) {
      const showCreate =
        (p.activeTab === "invoices" && (panelMode === "create" || panelMode === "edit")) ||
        (p.activeTab === "contracts" && panelMode === "create") ||
        (isExpenses && expensePanelOpen);
      return (
        <div className="flex-1 min-h-0 flex overflow-hidden">
          <div className="flex-1 min-w-0 overflow-hidden bg-card flex flex-col">
            {activeBulkIds.size > 0 && (
              <div className="shrink-0 flex items-center gap-3 px-4 py-2.5 border-b" style={{ background: "var(--wine-tint)", borderColor: "var(--wine)" }}>
                <span style={{ fontSize: 12.5, fontWeight: 700, color: "var(--wine)" }}>{activeBulkIds.size} {t("toolbar.selected", "selected")}</span>
                <div style={{ flex: 1 }} />
                <button
                  onClick={handleBulkDelete}
                  disabled={bulkDeleting}
                  className="flex items-center gap-1.5"
                  style={{ fontSize: 12, fontWeight: 700, color: "var(--stage-lost)", background: "none", border: "none", cursor: "pointer", opacity: bulkDeleting ? 0.6 : 1 }}
                >
                  <Trash2 size={13} />{bulkDeleting ? t("toolbar.deleting", "Deleting…") : t("toolbar.delete", "Delete")}
                </button>
                <button onClick={clearActiveBulk} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--mute)", display: "flex", alignItems: "center" }}>
                  <X size={15} />
                </button>
              </div>
            )}
            <div className="flex-1 min-h-0 overflow-hidden">
            {p.activeTab === "invoices" ? (
              <InvoicesInlineTable
                invoices={filteredInvoices}
                loading={p.invoicesLoading}
                selectedInvoice={p.selectedInvoice}
                onSelectInvoice={(i) => p.onSelectInvoice(i)}
                selectedIds={invoiceSelectedIds}
                onSelectionChange={setInvoiceSelectedIds}
                visibleColumns={visibleInvoiceColumns}
                groupBy="none"
              />
            ) : p.activeTab === "contracts" ? (
              <ContractsInlineTable
                contracts={filteredContracts}
                loading={p.contractsLoading}
                selectedContract={p.selectedContract}
                onSelectContract={(c) => p.onSelectContract(c)}
                selectedIds={contractSelectedIds}
                onSelectionChange={setContractSelectedIds}
                visibleColumns={visibleContractColumns}
              />
            ) : (
              <ExpensesView
                quarterFilter={quarterFilter}
                yearFilter={yearFilter}
                searchQuery={search}
                selectedIds={expenseSelectedIds}
                onSelectionChange={setExpenseSelectedIds}
                groupBy={groupBy === "year_quarter" ? "year_quarter" : "none"}
                exportTrigger={0}
              />
            )}
            </div>
          </div>
          {showCreate && (
            <div className="w-full md:w-[500px] shrink-0 overflow-hidden flex flex-col" style={{ background: "var(--bg)" }}>
              {p.activeTab === "invoices" ? (
                <InvoiceCreatePanel
                  editingInvoice={editingInvoice}
                  prefillInvoice={duplicatingInvoice}
                  nextInvoiceNumber={nextInvoiceNumber}
                  accounts={accounts}
                  isAgencyUser={p.isAgencyUser}
                  onCreate={p.onCreateInvoice}
                  onUpdate={p.onUpdateInvoice}
                  onClose={() => { setPanelMode("view"); setEditingInvoice(null); setDuplicatingInvoice(null); }}
                />
              ) : p.activeTab === "contracts" ? (
                <ContractCreatePanel accounts={accounts} isAgencyUser={p.isAgencyUser} onCreate={p.onCreateContract} onClose={() => setPanelMode("view")} />
              ) : (
                <ExpenseCreatePanel editingExpense={editingExpense} onClose={() => { setExpensePanelOpen(false); setEditingExpense(null); }} />
              )}
            </div>
          )}
        </div>
      );
    }

    // Create / edit panels are full-height self-contained forms.
    if (p.activeTab === "invoices" && (panelMode === "create" || panelMode === "edit")) {
      return (
        <div className="flex-1 min-h-0 overflow-hidden">
          <InvoiceCreatePanel
            editingInvoice={editingInvoice}
            prefillInvoice={duplicatingInvoice}
            nextInvoiceNumber={nextInvoiceNumber}
            accounts={accounts}
            isAgencyUser={p.isAgencyUser}
            onCreate={p.onCreateInvoice}
            onUpdate={p.onUpdateInvoice}
            onClose={() => { setPanelMode("view"); setEditingInvoice(null); setDuplicatingInvoice(null); }}
          />
        </div>
      );
    }
    if (p.activeTab === "contracts" && panelMode === "create") {
      return (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ContractCreatePanel accounts={accounts} isAgencyUser={p.isAgencyUser} onCreate={p.onCreateContract} onClose={() => setPanelMode("view")} />
        </div>
      );
    }
    if (isExpenses && expensePanelOpen) {
      return (
        <div className="flex-1 min-h-0 overflow-hidden">
          <ExpenseCreatePanel editingExpense={editingExpense} onClose={() => { setExpensePanelOpen(false); setEditingExpense(null); }} />
        </div>
      );
    }

    // Contracts + expenses detail are full-height self-contained components.
    if (p.activeTab === "contracts") {
      return (
        <div className="flex-1 min-h-0 overflow-hidden">
          {p.contractsLoading && !p.selectedContract ? (
            <BillingDetailSkeleton isNarrow={isNarrow} />
          ) : p.selectedContract ? (
            <ContractDetailPanel
              contract={p.selectedContract}
              isAgencyUser={p.isAgencyUser}
              onMarkSigned={p.onMarkSigned}
              onDelete={p.onDeleteContract}
              onRefresh={p.onRefreshContracts}
              onUpdate={p.onUpdateContract}
              onNew={p.isAgencyUser ? () => { p.onSelectContract(null); setPanelMode("create"); } : undefined}
            />
          ) : <ContractDetailPanelEmpty />}
        </div>
      );
    }
    if (isExpenses) {
      const sy = selectedExpense ? expenseYear(selectedExpense) : null;
      const sq = selectedExpense ? expenseQuarterNum(selectedExpense) : null;
      const quarterExpenses = selectedExpense ? (expensesData ?? []).filter((e) => expenseYear(e) === sy && expenseQuarterNum(e) === sq) : [];
      return (
        <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: isNarrow ? "16px 16px 40px" : "24px 30px 40px" }}>
          <div style={{ maxWidth: 1180, margin: "0 auto" }}>
            {selectedExpense ? (
              <>
                <BillingStatCards tab="expenses" invoices={[]} contracts={[]} expenses={quarterExpenses} />
                <ExpenseDetailPanel
                  expense={selectedExpense}
                  onEdit={(exp) => { setEditingExpense(exp); setExpensePanelOpen(true); }}
                  onDeleted={() => setSelectedExpenseId(null)}
                  onNew={p.isAgencyUser ? () => { setEditingExpense(null); setExpensePanelOpen(true); } : undefined}
                />
              </>
            ) : <ExpenseDetailPanelEmpty onNew={p.isAgencyUser ? () => { setEditingExpense(null); setExpensePanelOpen(true); } : undefined} />}
          </div>
        </div>
      );
    }

    // Invoices detail — stacked cards in a padded scroll area.
    return (
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: isNarrow ? "16px 16px 40px" : "24px 30px 40px" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          {showStatCards && <BillingStatCards tab="invoices" invoices={filteredInvoices} contracts={[]} expenses={[]} />}
          {p.invoicesLoading && !p.selectedInvoice ? (
            <BillingDetailSkeleton isNarrow={isNarrow} />
          ) : p.selectedInvoice ? (
            <InvoiceDetailPanel
              invoice={p.selectedInvoice}
              account={invoiceAccount}
              isAgencyUser={p.isAgencyUser}
              onMarkSent={p.onMarkSent}
              onMarkPaid={p.onMarkPaid}
              onEdit={(inv) => { setEditingInvoice(inv); setDuplicatingInvoice(null); setPanelMode("edit"); }}
              onDuplicate={handleDuplicate}
              onRefresh={p.onRefreshInvoices}
            />
          ) : <InvoiceDetailPanelEmpty />}
        </div>
      </div>
    );
  }
}

// Loading placeholder for the invoice/contract detail card — mirrors the real
// `neu-raised` white card (border-radius var(--r-card), background var(--card))
// so the right panel doesn't sit empty while data is still loading.
function BillingDetailSkeleton({ isNarrow }: { isNarrow: boolean }) {
  return (
    <div style={{ padding: isNarrow ? "16px 16px 40px" : "24px 30px 40px" }}>
      <div style={{ maxWidth: 1180, margin: "0 auto" }}>
        <div
          className="neu-raised animate-pulse"
          style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: "18px 20px", display: "flex", flexDirection: "column", gap: 14 }}
        >
          <div className="flex items-center justify-between">
            <div className="h-5 w-40 rounded bg-primary/10" />
            <div className="h-6 w-20 rounded-full bg-primary/10" />
          </div>
          <div className="h-px w-full bg-border/40" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="h-3 w-24 rounded bg-primary/10" />
              <div className="h-3.5 rounded bg-primary/10" style={{ width: `${30 + (i % 3) * 10}%` }} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Shared comparator for invoice/contract sorting.
function sortCompare(sortBy: string, amtA: number, amtB: number, dueA: string | null, dueB: string | null, nameA: string | null, nameB: string | null, createdA: string | null, createdB: string | null): number {
  switch (sortBy) {
    case "amount_desc": return amtB - amtA;
    case "amount_asc": return amtA - amtB;
    case "due_asc": return (dueA || "9999").localeCompare(dueB || "9999");
    case "due_desc": return (dueB || "0").localeCompare(dueA || "0");
    case "name_asc": return String(nameA || "").localeCompare(String(nameB || ""));
    case "name_desc": return String(nameB || "").localeCompare(String(nameA || ""));
    case "oldest": return (createdA || "").localeCompare(createdB || "");
    default: return (createdB || "").localeCompare(createdA || "");
  }
}
