import { useState, useEffect, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
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
type SortBy = "recent" | "amount_desc" | "amount_asc" | "due_asc" | "name_asc";
type ViewMode = "list" | "table";

export function BillingPage() {
  const { currentAccountId, isAgencyUser } = useWorkspace();
  const { clearTopbarActions } = useTopbarActions();

  // Tab state — derived from URL path
  const [location] = useLocation();
  const activeTab = useMemo<BillingTab>(() => {
    if (location.endsWith("/expenses")) return "expenses";
    if (location.endsWith("/contracts")) return "contracts";
    return "invoices"; // default
  }, [location]);

  // View mode (persisted)
  const [viewMode, setViewMode] = useState<ViewMode>(() => {
    return (localStorage.getItem("billing-view-mode") as ViewMode) || "list";
  });
  useEffect(() => { localStorage.setItem("billing-view-mode", viewMode); }, [viewMode]);

  // Quarter filter (NL BTW quarters)
  const [quarterFilter, setQuarterFilter] = useState<string | null>(null);

  // Year filter
  const [yearFilter, setYearFilter] = useState<number | null>(null);

  // Account filter (agency only)
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
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
            ? `New invoice: ${newItems[0].title || "Invoice"}`
            : `${newItems.length} new invoices received`,
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
            ? `New contract: ${newItems[0].title || "Contract"}`
            : `${newItems.length} new contracts received`,
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

  // Clear selection + panel mode on tab switch (keep viewMode across tab switches)
  const handleTabChange = useCallback((_tab: string) => {
    // No-op for tab switching — tab changes happen via URL navigation now
    setListSearch("");
    setSearchOpen(false);
    setFilterStatus([]);
    setRightPanelMode("view");
    setEditingInvoice(null);
  }, []);

  return (
    <CrmShell>
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
    </CrmShell>
  );
}
