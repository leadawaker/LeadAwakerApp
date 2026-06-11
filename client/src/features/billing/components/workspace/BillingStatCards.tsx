import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Receipt, Coins, AlertTriangle, CheckCircle, FileText, Clock, Wallet } from "lucide-react";
import type { InvoiceRow, ContractRow, ExpenseRow } from "../../types";
import { formatCurrency } from "../../types";
import { StatCard } from "./atoms";
import { effectiveInvoiceStatus, parseNum, expenseBtw } from "./adapters";

type Tab = "invoices" | "contracts" | "expenses";

export function BillingStatCards({ tab, invoices, contracts, expenses }: {
  tab: Tab;
  invoices: InvoiceRow[];
  contracts: ContractRow[];
  expenses: ExpenseRow[];
}) {
  const { t } = useTranslation("billing");

  const invoiceStats = useMemo(() => {
    let billed = 0, outstanding = 0, overdue = 0, collected = 0;
    for (const i of invoices) {
      const total = parseNum(i.total);
      const status = effectiveInvoiceStatus(i);
      if (status !== "Cancelled" && status !== "Draft") billed += total;
      if (status === "Sent" || status === "Viewed") outstanding += total;
      if (status === "Overdue") overdue += total;
      if (status === "Paid") collected += total;
    }
    return { billed, outstanding, overdue, collected };
  }, [invoices]);

  const contractStats = useMemo(() => {
    let activeValue = 0, awaiting = 0, signed = 0, drafts = 0;
    for (const c of contracts) {
      const status = c.status || "Draft";
      if (status === "Signed") {
        signed++;
        const v = c.fixed_fee_amount ? parseNum(c.fixed_fee_amount)
          : c.monthly_fee ? parseNum(c.monthly_fee) * 12
          : c.value_per_booking ? parseNum(c.value_per_booking)
          : c.deposit_amount ? parseNum(c.deposit_amount) : 0;
        activeValue += v;
      }
      if (status === "Sent" || status === "Viewed") awaiting++;
      if (status === "Draft") drafts++;
    }
    return { activeValue, awaiting, signed, drafts };
  }, [contracts]);

  const expenseStats = useMemo(() => {
    let total = 0, btw = 0, deductible = 0;
    for (const e of expenses) {
      if ((e.currency || "EUR") !== "USD") total += parseNum(e.totalAmount);
      btw += expenseBtw(e);
      if (e.nlBtwDeductible) deductible++;
    }
    return { total, btw, deductible, count: expenses.length };
  }, [expenses]);

  let cards: { label: string; value: string; sub?: string; accent?: string; icon: React.ReactNode }[] = [];

  if (tab === "invoices") {
    cards = [
      { label: t("stats.billed", "Billed"), value: formatCurrency(invoiceStats.billed), accent: "var(--wine)", icon: <Receipt size={15} /> },
      { label: t("stats.outstanding", "Outstanding"), value: formatCurrency(invoiceStats.outstanding), accent: "var(--stage-contacted)", icon: <Coins size={15} /> },
      { label: t("stats.overdue", "Overdue"), value: formatCurrency(invoiceStats.overdue), accent: "var(--stage-lost)", icon: <AlertTriangle size={15} /> },
      { label: t("stats.collected", "Collected"), value: formatCurrency(invoiceStats.collected), accent: "var(--good)", icon: <CheckCircle size={15} /> },
    ];
  } else if (tab === "contracts") {
    cards = [
      { label: t("contracts.stats.activeValue"), value: formatCurrency(contractStats.activeValue), accent: "var(--wine)", icon: <FileText size={15} /> },
      { label: t("contracts.stats.awaitingSignature"), value: String(contractStats.awaiting), accent: "var(--warn)", icon: <Clock size={15} /> },
      { label: t("contracts.stats.signed"), value: String(contractStats.signed), accent: "var(--good)", icon: <CheckCircle size={15} /> },
      { label: t("contracts.stats.drafts"), value: String(contractStats.drafts), icon: <FileText size={15} /> },
    ];
  } else {
    cards = [
      { label: t("stats.totalSpend", "Total spend"), value: formatCurrency(expenseStats.total), accent: "var(--wine)", icon: <Wallet size={15} /> },
      { label: t("stats.reclaimableBtw", "Reclaimable BTW"), value: formatCurrency(expenseStats.btw), accent: "var(--good)", icon: <Receipt size={15} /> },
      { label: t("stats.deductible", "Deductible"), value: `${expenseStats.deductible} / ${expenseStats.count}`, accent: "var(--stage-contacted)", icon: <CheckCircle size={15} /> },
    ];
  }

  return (
    <div className="row" style={{ gap: 10, padding: "0 0 28px", flexWrap: "wrap" }}>
      {cards.map((c) => (
        <StatCard key={c.label} label={c.label} value={c.value} sub={c.sub} accent={c.accent} icon={c.icon} />
      ))}
    </div>
  );
}
