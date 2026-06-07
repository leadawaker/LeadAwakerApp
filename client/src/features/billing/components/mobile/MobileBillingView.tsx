// MobileBillingView.tsx — mobile Billing orchestrator (wine/paper reference layout).
// Single-pane stack: top bar, cream segmented tabs, horizontal stat strip, filter
// chips, list/table toggle, grouped section list, and a bottom-sheet detail.
// Net-new + mobile-only. Wired to the real billing data hooks/handlers passed from
// BillingPage. Desktop tree is untouched.

import { useState, useMemo, useEffect } from "react";
import { useTranslation } from "react-i18next";
import {
  Receipt, Wallet, PenLine, LayoutList, LayoutGrid, Plus, Search,
  Clock, AlertTriangle, CheckCircle2, Coins, CreditCard,
} from "lucide-react";
import { isOverdue } from "../../types";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../../types";
import { useExpensesData } from "../ExpensesListView";
import {
  MBSegment, MBViewToggle, MBStatStrip, MBChips, MBSection, MobSheet,
  MBInvoiceCard, MBContractCard, money0, money, num, dateShort, displayStatus,
  type SegOption, type StatCard, type Chip,
} from "./mobilePrimitives";
import {
  MobileInvoiceDetail, MobileExpenseDetail, MobileContractDetail,
} from "./MobileDetailSheets";

type BillingTab = "invoices" | "contracts" | "expenses";

interface MobileBillingViewProps {
  activeTab: BillingTab;
  onTabChange: (tab: string) => void;
  invoices: InvoiceRow[];
  contracts: ContractRow[];
  isAgencyUser: boolean;
  onMarkSent: (id: number) => Promise<any>;
  onMarkPaid: (id: number) => Promise<any>;
  onMarkSigned: (id: number) => Promise<any>;
  onDeleteInvoice: (id: number) => Promise<void>;
  onDeleteContract: (id: number) => Promise<void>;
  onEditInvoice: (invoice: InvoiceRow) => void;
  onNewInvoice: () => void;
  onNewContract: () => void;
  listSearch: string;
  setListSearch: (v: string) => void;
}

type Selection =
  | { kind: "invoice"; data: InvoiceRow }
  | { kind: "contract"; data: ContractRow }
  | { kind: "expense"; data: ExpenseRow }
  | null;

// ── Stat helpers ──────────────────────────────────────────────────────────────

function sum<T>(arr: T[], f: (x: T) => number): number {
  return arr.reduce((a, x) => a + f(x), 0);
}

export function MobileBillingView({
  activeTab, onTabChange, invoices, contracts, isAgencyUser,
  onMarkSent, onMarkPaid, onMarkSigned, onDeleteInvoice, onDeleteContract,
  onEditInvoice, onNewInvoice, onNewContract, listSearch, setListSearch,
}: MobileBillingViewProps) {
  const { t } = useTranslation("billing");
  const [view, setView] = useState<"list" | "table">("list");
  const [filter, setFilter] = useState("all");
  const [sel, setSel] = useState<Selection>(null);
  const [searchOpen, setSearchOpen] = useState(false);

  const { data: expensesRaw } = useExpensesData();
  const expenses = useMemo(() => expensesRaw ?? [], [expensesRaw]);

  // Reset filter when tab changes; bounce off expenses if not agency
  useEffect(() => { setFilter("all"); }, [activeTab]);
  useEffect(() => {
    if (activeTab === "expenses" && !isAgencyUser) onTabChange("invoices");
  }, [activeTab, isAgencyUser, onTabChange]);

  const q = listSearch.trim().toLowerCase();

  // ── Filtered data ──────────────────────────────────────────────────────────
  const filteredInvoices = useMemo(() => {
    let r = invoices;
    if (q) r = r.filter((i) => `${i.title ?? ""} ${i.invoice_number ?? ""} ${i.account_name ?? ""}`.toLowerCase().includes(q));
    if (filter !== "all") r = r.filter((i) => (filter === "Overdue" ? isOverdue(i) : displayStatus(i) === filter));
    return r;
  }, [invoices, q, filter]);

  const filteredContracts = useMemo(() => {
    let r = contracts;
    if (q) r = r.filter((c) => `${c.title ?? ""} ${c.account_name ?? ""}`.toLowerCase().includes(q));
    if (filter !== "all") r = r.filter((c) => (c.status || "Draft") === filter);
    return r;
  }, [contracts, q, filter]);

  const filteredExpenses = useMemo(() => {
    let r = expenses;
    if (q) r = r.filter((e) => `${e.supplier ?? ""} ${e.description ?? ""} ${e.invoiceNumber ?? ""}`.toLowerCase().includes(q));
    if (filter === "ded") r = r.filter((e) => e.nlBtwDeductible);
    else if (filter === "nonded") r = r.filter((e) => !e.nlBtwDeductible);
    else if (filter.startsWith("y")) r = r.filter((e) => String(e.year) === filter.slice(1));
    return r;
  }, [expenses, q, filter]);

  // ── Tabs ─────────────────────────────────────────────────────────────────────
  const tabOpts: SegOption[] = [
    { key: "invoices", label: t("tabs.invoices"), Ic: Receipt },
    ...(isAgencyUser ? [{ key: "expenses", label: t("tabs.expenses"), Ic: Wallet }] : []),
    { key: "contracts", label: t("tabs.contracts"), Ic: PenLine },
  ];

  // ── Chips ──────────────────────────────────────────────────────────────────
  const chips: Chip[] = useMemo(() => {
    if (activeTab === "invoices") {
      return [
        { key: "all", label: t("mobile.chips.all") },
        { key: "Sent", label: t("invoices.statusLabels.Sent"), count: invoices.filter((i) => i.status === "Sent").length },
        { key: "Overdue", label: t("invoices.statusLabels.Overdue"), count: invoices.filter(isOverdue).length },
        { key: "Paid", label: t("invoices.statusLabels.Paid"), count: invoices.filter((i) => i.status === "Paid").length },
        { key: "Draft", label: t("invoices.statusLabels.Draft"), count: invoices.filter((i) => i.status === "Draft").length },
      ];
    }
    if (activeTab === "expenses") {
      const years = Array.from(new Set(expenses.map((e) => e.year).filter(Boolean))).sort((a, b) => (b as number) - (a as number));
      return [
        { key: "all", label: t("mobile.chips.all") },
        ...years.map((y) => ({ key: `y${y}`, label: String(y), count: expenses.filter((e) => e.year === y).length })),
        { key: "ded", label: t("mobile.chips.deductible"), count: expenses.filter((e) => e.nlBtwDeductible).length },
        { key: "nonded", label: t("mobile.chips.nonDeductible"), count: expenses.filter((e) => !e.nlBtwDeductible).length },
      ];
    }
    return [
      { key: "all", label: t("mobile.chips.all") },
      { key: "Sent", label: t("contracts.statusLabels.Sent"), count: contracts.filter((c) => c.status === "Sent").length },
      { key: "Signed", label: t("contracts.statusLabels.Signed"), count: contracts.filter((c) => c.status === "Signed").length },
      { key: "Draft", label: t("contracts.statusLabels.Draft"), count: contracts.filter((c) => c.status === "Draft").length },
    ];
  }, [activeTab, invoices, contracts, expenses, t]);

  // ── Stat cards ───────────────────────────────────────────────────────────────
  const cards: StatCard[] = useMemo(() => {
    if (activeTab === "invoices") {
      return [
        { label: t("invoices.table.summary.total"), value: money0(sum(invoices, (i) => num(i.total))), sub: t("mobile.stats.invoicesCount", { count: invoices.length }), accent: "var(--wine)", Ic: Receipt },
        { label: t("invoices.table.summary.outstanding"), value: money0(sum(invoices.filter((i) => i.status === "Sent" || i.status === "Viewed" || isOverdue(i)), (i) => num(i.total))), sub: t("mobile.stats.open"), accent: "var(--stage-contacted)", Ic: Clock },
        { label: t("invoices.statusLabels.Overdue"), value: money0(sum(invoices.filter(isOverdue), (i) => num(i.total))), sub: t("mobile.stats.pastDue"), accent: "var(--stage-lost)", Ic: AlertTriangle },
        { label: t("invoices.table.summary.paid"), value: money0(sum(invoices.filter((i) => i.status === "Paid"), (i) => num(i.total))), sub: t("mobile.stats.collected"), accent: "var(--good)", Ic: CheckCircle2 },
      ];
    }
    if (activeTab === "expenses") {
      const eur = expenses.filter((e) => (e.currency || "EUR") === "EUR");
      const ded = expenses.filter((e) => e.nlBtwDeductible);
      return [
        { label: t("expenses.table.summary.totalSpend"), value: money0(sum(eur, (e) => num(e.totalAmount))), sub: t("mobile.stats.itemsCount", { count: expenses.length }), accent: "var(--wine)", Ic: Wallet },
        { label: t("expenses.table.summary.btw"), value: money0(sum(ded, (e) => num(e.vatAmount))), sub: t("mobile.stats.reclaimable"), accent: "var(--good)", Ic: CheckCircle2 },
        { label: t("expenses.table.summary.btwDeductible"), value: money0(sum(ded, (e) => num(e.totalAmount))), sub: `${ded.length}/${expenses.length}`, accent: "var(--stage-contacted)", Ic: Coins },
      ];
    }
    const ctrValue = (c: ContractRow) => num(c.fixed_fee_amount) || num(c.monthly_fee) || num(c.value_per_booking) || num(c.deposit_amount);
    const live = contracts.filter((c) => c.status === "Signed");
    return [
      { label: t("contracts.table.summary.active"), value: String(live.length), sub: t("mobile.stats.inEffect"), accent: "var(--good)", Ic: PenLine },
      { label: t("contracts.detail.totalAmount"), value: money0(sum(live, ctrValue)), sub: t("mobile.stats.committed"), accent: "var(--wine)", Ic: Coins },
      { label: t("contracts.table.summary.pending"), value: String(contracts.filter((c) => c.status === "Sent").length), sub: t("mobile.stats.awaiting"), accent: "var(--warn)", Ic: CreditCard },
    ];
  }, [activeTab, invoices, contracts, expenses, t]);

  // ── Grouped list rendering ─────────────────────────────────────────────────
  const invoiceGroups: Array<[string, string, string | null]> = [
    ["Overdue", t("invoices.statusLabels.Overdue"), "var(--stage-lost)"],
    ["Sent", t("mobile.groups.outstanding"), null],
    ["Draft", t("mobile.groups.drafts"), null],
    ["Paid", t("invoices.statusLabels.Paid"), "var(--good)"],
  ];
  const contractGroups: Array<[string, string, string | null]> = [
    ["Sent", t("mobile.groups.awaitingSignature"), "var(--warn)"],
    ["Draft", t("mobile.groups.drafts"), null],
    ["Signed", t("contracts.statusLabels.Signed"), "var(--good)"],
  ];

  function renderInvoiceList() {
    return invoiceGroups.map(([k, label, accent]) => {
      const group = filteredInvoices.filter((i) => (k === "Overdue" ? isOverdue(i) : !isOverdue(i) && i.status === k));
      if (!group.length) return null;
      return (
        <div key={k}>
          <MBSection label={label} accent={accent} count={group.length} amount={money0(sum(group, (i) => num(i.total)))} />
          {group.map((inv) => <MBInvoiceCard key={inv.id} inv={inv} t={t} onClick={() => setSel({ kind: "invoice", data: inv })} />)}
        </div>
      );
    });
  }

  function renderContractList() {
    return contractGroups.map(([k, label, accent]) => {
      const group = filteredContracts.filter((c) => (c.status || "Draft") === k);
      if (!group.length) return null;
      return (
        <div key={k}>
          <MBSection label={label} accent={accent} count={group.length} />
          {group.map((ctr) => <MBContractCard key={ctr.id} ctr={ctr} t={t} onClick={() => setSel({ kind: "contract", data: ctr })} />)}
        </div>
      );
    });
  }

  function renderExpenseList() {
    // Group by year · quarter, newest first.
    const byKey = new Map<string, ExpenseRow[]>();
    for (const e of filteredExpenses) {
      const key = `${e.year ?? "—"}·${e.quarter ?? "—"}`;
      if (!byKey.has(key)) byKey.set(key, []);
      byKey.get(key)!.push(e);
    }
    const keys = Array.from(byKey.keys()).sort((a, b) => b.localeCompare(a));
    return keys.map((key) => {
      const group = byKey.get(key)!;
      const [year, quarter] = key.split("·");
      const totalEur = sum(group.filter((e) => (e.currency || "EUR") === "EUR"), (e) => num(e.totalAmount));
      return (
        <div key={key}>
          <MBSection label={`${year} · ${quarter}`} count={group.length} amount={money0(totalEur)} />
          {group.map((exp) => (
            <div key={exp.id} onClick={() => setSel({ kind: "expense", data: exp })} className="neu-raised" style={{ padding: 15, borderRadius: "var(--r-card)", cursor: "pointer", marginBottom: 10 }}>
              <div className="row" style={{ justifyContent: "space-between", gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{exp.description || exp.supplier || t("expenses.detail.unknownSupplier")}</div>
                  <div className="row" style={{ gap: 7, marginTop: 3 }}>
                    <span style={{ fontSize: 11.5, color: "var(--mute)" }}>{exp.supplier || "—"}</span>
                    <span style={{ width: 3, height: 3, borderRadius: "50%", background: "var(--mute-2)", flexShrink: 0 }} />
                    <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--mute-2)" }}>{dateShort(exp.date)}</span>
                  </div>
                </div>
                <span className="serif" style={{ fontSize: 21, color: "var(--ink)", lineHeight: 1, flexShrink: 0 }}>{money(exp.totalAmount, exp.currency || "EUR")}</span>
              </div>
              {(exp.nlBtwDeductible || num(exp.vatAmount) > 0) && (
                <div className="row" style={{ gap: 7, marginTop: 12, paddingTop: 11, borderTop: "1px solid var(--line)" }}>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: exp.nlBtwDeductible ? "var(--good)" : "var(--mute-2)" }}>
                    {exp.nlBtwDeductible ? t("mobile.chips.deductible") : t("mobile.chips.nonDeductible")}
                  </span>
                  {num(exp.vatAmount) > 0 && exp.nlBtwDeductible && <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--good)", fontWeight: 600 }}>BTW {money(exp.vatAmount, "EUR")}</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      );
    });
  }

  const emptyHint = (Ic: typeof Receipt, label: string) => (
    <div style={{ padding: "56px 20px", textAlign: "center", color: "var(--mute-2)" }}>
      <Ic size={28} />
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, letterSpacing: "0.14em", textTransform: "uppercase", marginTop: 12 }}>{label}</div>
    </div>
  );

  const hasItems = activeTab === "invoices" ? filteredInvoices.length : activeTab === "expenses" ? filteredExpenses.length : filteredContracts.length;

  return (
    <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", background: "var(--bg)", overflow: "hidden" }}>
      {/* Top bar */}
      <div style={{ flexShrink: 0, background: "var(--bg)", borderBottom: "1px solid var(--line)" }}>
        <div className="row" style={{ justifyContent: "space-between", alignItems: "flex-end", padding: "16px 18px 12px" }}>
          <span className="serif" style={{ fontSize: 32, color: "var(--ink)", letterSpacing: "-0.02em" }}>{t("page.title")}</span>
          <button onClick={() => setSearchOpen((o) => !o)} aria-label={t("toolbar.searchInvoices")} style={{ width: 38, height: 38, borderRadius: "var(--r-pill)", border: "none", cursor: "pointer", background: "var(--surface)", boxShadow: "var(--sh-raised-crisp)", color: "var(--mute)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Search size={16} />
          </button>
        </div>
        {searchOpen && (
          <div style={{ padding: "0 16px 12px" }}>
            <div className="neu-inset" style={{ display: "flex", alignItems: "center", gap: 8, padding: "9px 13px", borderRadius: "var(--r-pill)" }}>
              <Search size={14} style={{ color: "var(--mute-2)" }} />
              <input
                autoFocus
                value={listSearch}
                onChange={(e) => setListSearch(e.target.value)}
                placeholder={activeTab === "invoices" ? t("toolbar.searchInvoices") : activeTab === "expenses" ? t("toolbar.searchExpenses") : t("toolbar.searchContracts")}
                style={{ flex: 1, border: "none", outline: "none", background: "transparent", fontSize: 13, color: "var(--ink)" }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ flexShrink: 0, padding: "12px 16px 0" }}>
        <MBSegment value={activeTab} onChange={onTabChange} options={tabOpts} />
      </div>

      {/* Scroll body */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, paddingBottom: "calc(28px + var(--safe-bottom))" }}>
        <div style={{ marginTop: 14 }}><MBStatStrip cards={cards} /></div>

        <div className="row" style={{ gap: 10, margin: "14px 0 4px", alignItems: "center" }}>
          <div style={{ flex: 1, minWidth: 0 }}><MBChips chips={chips} value={filter} onChange={setFilter} /></div>
          <div style={{ paddingRight: 16, flexShrink: 0 }}>
            <MBViewToggle value={view} onChange={(v) => setView(v as "list" | "table")} opts={[["list", LayoutList], ["table", LayoutGrid]]} />
          </div>
        </div>

        <div style={{ padding: "0 16px" }}>
          {activeTab === "invoices" && (hasItems ? renderInvoiceList() : emptyHint(Receipt, t("invoices.empty.noInvoicesFound")))}
          {activeTab === "expenses" && isAgencyUser && (hasItems ? renderExpenseList() : emptyHint(Wallet, t("expenses.empty.noExpensesFound")))}
          {activeTab === "contracts" && (hasItems ? renderContractList() : emptyHint(PenLine, t("contracts.empty.noContractsFound")))}
        </div>
      </div>

      {/* FAB — agency only, not on expenses (expense create panel is desktop-bound) */}
      {isAgencyUser && activeTab !== "expenses" && (
        <button
          onClick={activeTab === "invoices" ? onNewInvoice : onNewContract}
          aria-label={activeTab === "invoices" ? t("toolbar.newInvoice") : t("toolbar.newContract")}
          style={{
            position: "absolute", right: 18, bottom: "calc(24px + var(--safe-bottom))", zIndex: 15,
            width: 56, height: 56, borderRadius: "var(--r-card)", border: "none", cursor: "pointer",
            background: "var(--wine-grad)", color: "var(--paper)",
            boxShadow: "var(--sh-raised-large), inset 0 1px 0 rgba(255,255,255,0.12)",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          <Plus size={24} />
        </button>
      )}

      {/* Detail bottom-sheet */}
      <MobSheet open={!!sel} onClose={() => setSel(null)}>
        <div style={{ height: "100%", background: "var(--paper)", display: "flex", flexDirection: "column", paddingTop: 8 }}>
          {sel?.kind === "invoice" && (
            <MobileInvoiceDetail
              inv={sel.data}
              isAgencyUser={isAgencyUser}
              onMarkSent={onMarkSent}
              onMarkPaid={onMarkPaid}
              onEdit={() => { onEditInvoice(sel.data); setSel(null); }}
              onDelete={onDeleteInvoice}
              onClose={() => setSel(null)}
            />
          )}
          {sel?.kind === "expense" && (
            <MobileExpenseDetail exp={sel.data} isAgencyUser={isAgencyUser} onEdit={() => setSel(null)} onClose={() => setSel(null)} />
          )}
          {sel?.kind === "contract" && (
            <MobileContractDetail
              ctr={sel.data}
              isAgencyUser={isAgencyUser}
              onMarkSigned={onMarkSigned}
              onDelete={onDeleteContract}
              onClose={() => setSel(null)}
            />
          )}
        </div>
      </MobSheet>
    </div>
  );
}
