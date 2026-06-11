import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { CrmShell } from "@/components/crm/CrmShell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileBillingView } from "../components/mobile/MobileBillingView";
import { useWorkspace } from "@/hooks/useWorkspace";
import { usePersistedSelection } from "@/hooks/usePersistedSelection";
import { useTopbarActions } from "@/contexts/TopbarActionsContext";
import { BillingListView } from "../components/BillingListView";
import { useInvoicesData } from "../hooks/useInvoicesData";
import { useContractsData } from "../hooks/useContractsData";
import type { InvoiceRow, ContractRow } from "../types";
import type { RightPanelMode } from "../components/BillingListView";
import { useToast } from "@/hooks/use-toast";

type BillingTab = "invoices" | "contracts" | "expenses";
type SortBy = "recent" | "oldest" | "amount_desc" | "amount_asc" | "due_asc" | "due_desc" | "name_asc" | "name_desc";
type ViewMode = "list" | "table";

export function BillingPage() {
  const { t } = useTranslation("billing");
  const { currentAccountId, isAgencyUser, isOwner } = useWorkspace();
  const { clearTopbarActions } = useTopbarActions();
  const isMobile = useIsMobile();

  const [activeTab, setActiveTab] = useState<BillingTab>(() => {
    const saved = localStorage.getItem("billing-active-tab");
    if (saved === "expenses" || saved === "contracts") return saved;
    return "invoices";
  });

  const handleTabChange = useCallback((tab: string) => {
    const newTab = tab as BillingTab;
    setActiveTab(newTab);
    localStorage.setItem("billing-active-tab", newTab);
  }, []);

  // View mode (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("billing-view-mode") as ViewMode) || "list";
  });
  useEffect(() => { localStorage.setItem("billing-view-mode", viewMode); }, [viewMode]);

  // Quarter filter (NL BTW quarters)
  const [quarterFilter, setQuarterFilter] = useState<string | null>(null);

  // Year filter
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  // Account filter (agency only) — default to current workspace account
  const [accountFilter, setAccountFilter] = useState<number | "all">(() =>
    currentAccountId > 0 ? currentAccountId : "all"
  );
  // Keep in sync when workspace account changes
  useEffect(() => {
    setAccountFilter(currentAccountId > 0 ? currentAccountId : "all");
  }, [currentAccountId]);

  const effectiveAccountId = useMemo(() => {
    if (!isAgencyUser) return currentAccountId;
    if (accountFilter === "all") return undefined;
    return accountFilter as number;
  }, [isAgencyUser, accountFilter, currentAccountId]);

  // Data hooks
  const invoicesHook = useInvoicesData(effectiveAccountId);
  const contractsHook = useContractsData(effectiveAccountId);

  // Selection
  const [selectedInvoice, setSelectedInvoice] = usePersistedSelection<InvoiceRow>(
    "billing-selected-invoice",
    (i) => i.id ?? 0,
    invoicesHook.invoices,
  );
  const [selectedContract, setSelectedContract] = usePersistedSelection<ContractRow>(
    "billing-selected-contract",
    (c) => c.id ?? 0,
    contractsHook.contracts,
  );

  // Toast
  const { toast } = useToast();

  // Delete handlers — clear selection if the deleted item is selected
  const handleDeleteInvoice = useCallback(async (id: number) => {
    if (selectedInvoice?.id === id) {
      setSelectedInvoice(null);
    }
    await invoicesHook.remove(id);
  }, [invoicesHook, selectedInvoice, setSelectedInvoice]);

  const handleDeleteContract = useCallback(async (id: number) => {
    if (selectedContract?.id === id) {
      setSelectedContract(null);
    }
    await contractsHook.remove(id);
  }, [contractsHook, selectedContract, setSelectedContract]);

  // ── Invoice notification ──────────────────────────────────────────────────
  const seenInvoiceIdsKey = `billing-seen-invoices-${currentAccountId ?? "all"}`;
  useEffect(() => {
    if (invoicesHook.loading) return;
    const currentIds = invoicesHook.invoices.map((i) => i.id).filter(Boolean);
    const seenStr = localStorage.getItem(seenInvoiceIdsKey);
    if (!seenStr) {
      localStorage.setItem(seenInvoiceIdsKey, JSON.stringify(currentIds));
      return;
    }
    let seenIds: number[] = [];
    try { seenIds = JSON.parse(seenStr); } catch { /* ignore */ }
    const seenSet = new Set(seenIds);
    const newItems = invoicesHook.invoices.filter((i) => i.id && !seenSet.has(i.id));
    if (newItems.length > 0) {
      const prefsStr = localStorage.getItem("leadawaker_user_preferences") ?? "{}";
      let prefs: any = {};
      try { prefs = JSON.parse(prefsStr); } catch { /* ignore */ }
      const notifEnabled = prefs?.notifications?.events?.invoice_received?.in_app;
      if (notifEnabled !== false) {
        toast({
          title: newItems.length === 1
            ? t("invoices.notifications.newInvoice", { title: newItems[0].title || "Invoice" })
            : t("invoices.notifications.newInvoicesCount", { count: newItems.length }),
        });
      }
      localStorage.setItem(seenInvoiceIdsKey, JSON.stringify(currentIds));
    }
  }, [invoicesHook.invoices, invoicesHook.loading]);

  // ── Contract notification ─────────────────────────────────────────────────
  const seenContractIdsKey = `billing-seen-contracts-${currentAccountId ?? "all"}`;
  useEffect(() => {
    if (contractsHook.loading) return;
    const currentIds = contractsHook.contracts.map((c) => c.id).filter(Boolean);
    const seenStr = localStorage.getItem(seenContractIdsKey);
    if (!seenStr) {
      localStorage.setItem(seenContractIdsKey, JSON.stringify(currentIds));
      return;
    }
    let seenIds: number[] = [];
    try { seenIds = JSON.parse(seenStr); } catch { /* ignore */ }
    const seenSet = new Set(seenIds);
    const newItems = contractsHook.contracts.filter((c) => c.id && !seenSet.has(c.id));
    if (newItems.length > 0) {
      const prefsStr = localStorage.getItem("leadawaker_user_preferences") ?? "{}";
      let prefs: any = {};
      try { prefs = JSON.parse(prefsStr); } catch { /* ignore */ }
      const notifEnabled = prefs?.notifications?.events?.contract_received?.in_app;
      if (notifEnabled !== false) {
        toast({
          title: newItems.length === 1
            ? t("contracts.notifications.newContract", { title: newItems[0].title || "Contract" })
            : t("contracts.notifications.newContractsCount", { count: newItems.length }),
        });
      }
      localStorage.setItem(seenContractIdsKey, JSON.stringify(currentIds));
    }
  }, [contractsHook.contracts, contractsHook.loading]);

  // List controls
  const [listSearch, setListSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("recent");
  const [filterStatus, setFilterStatus] = useState<string[]>([]);

  // Right panel mode (replaces createDialogOpen for invoices)
  const [rightPanelMode, setRightPanelMode] = useState<RightPanelMode>("view");
  const [editingInvoice, setEditingInvoice] = useState<InvoiceRow | null>(null);

  // Contract upload dialog
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);

  // Clear topbar actions
  useEffect(() => { clearTopbarActions(); return () => clearTopbarActions(); }, [clearTopbarActions]);

  // Clear selection + filters when switching pages (URL changes)
  useEffect(() => {
    setListSearch("");
    setSearchOpen(false);
    setFilterStatus([]);
    setRightPanelMode("view");
    setEditingInvoice(null);
  }, [activeTab]);

  // ── Mobile: wine/paper single-pane experience (desktop tree untouched) ──────
  if (isMobile) {
    return (
      <CrmShell>
        <MobileBillingView
          activeTab={activeTab}
          onTabChange={handleTabChange}
          invoices={invoicesHook.invoices}
          contracts={contractsHook.contracts}
          isAgencyUser={isAgencyUser}
          onMarkSent={invoicesHook.markSent}
          onMarkPaid={invoicesHook.markPaid}
          onMarkSigned={contractsHook.markSigned}
          onDeleteInvoice={handleDeleteInvoice}
          onDeleteContract={handleDeleteContract}
          onEditInvoice={(inv) => { setSelectedInvoice(inv); setEditingInvoice(inv); setRightPanelMode("edit"); }}
          onNewInvoice={() => { setEditingInvoice(null); setRightPanelMode("create"); }}
          onNewContract={() => { setSelectedContract(null); setRightPanelMode("create"); }}
          listSearch={listSearch}
          setListSearch={setListSearch}
        />
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="h-full flex flex-col">
      <BillingListView
        activeTab={activeTab}
        onTabChange={handleTabChange}
        // Invoice data
        invoices={invoicesHook.invoices}
        invoicesLoading={invoicesHook.loading}
        selectedInvoice={selectedInvoice}
        onSelectInvoice={setSelectedInvoice}
        onCreateInvoice={invoicesHook.create}
        onUpdateInvoice={invoicesHook.update}
        onDeleteInvoice={handleDeleteInvoice}
        onMarkSent={invoicesHook.markSent}
        onMarkPaid={invoicesHook.markPaid}
        onRefreshInvoices={invoicesHook.fetchData}
        // Contract data
        contracts={contractsHook.contracts}
        contractsLoading={contractsHook.loading}
        selectedContract={selectedContract}
        onSelectContract={setSelectedContract}
        onCreateContract={contractsHook.create}
        onUpdateContract={contractsHook.update}
        onDeleteContract={handleDeleteContract}
        onMarkSigned={contractsHook.markSigned}
        onRefreshContracts={contractsHook.fetchData}
        // Controls
        listSearch={listSearch}
        setListSearch={setListSearch}
        searchOpen={searchOpen}
        setSearchOpen={setSearchOpen}
        sortBy={sortBy}
        setSortBy={setSortBy}
        filterStatus={filterStatus}
        setFilterStatus={setFilterStatus}
        // Account filter
        accountFilter={accountFilter}
        setAccountFilter={setAccountFilter}
        isAgencyUser={isAgencyUser}
        isOwner={isOwner}
        // Panel mode
        rightPanelMode={rightPanelMode}
        setRightPanelMode={setRightPanelMode}
        editingInvoice={editingInvoice}
        setEditingInvoice={setEditingInvoice}
        // Upload dialog
        uploadDialogOpen={uploadDialogOpen}
        setUploadDialogOpen={setUploadDialogOpen}
        // View mode
        viewMode={viewMode}
        setViewMode={setViewMode}
        // Quarter/year filters
        quarterFilter={quarterFilter}
        setQuarterFilter={setQuarterFilter}
        yearFilter={yearFilter}
        setYearFilter={setYearFilter}
      />
      </div>
    </CrmShell>
  );
}
