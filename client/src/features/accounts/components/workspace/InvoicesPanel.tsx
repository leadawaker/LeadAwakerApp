import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Receipt } from "lucide-react";
import { fetchInvoices } from "@/features/billing/api/invoicesApi";
import { Panel } from "./atoms";

const ROUTE_PREFIX = "/platform";

type InvoiceSummary = {
  id: number;
  invoiceNumber: string | null;
  title: string | null;
  status: string | null;
  total: string | null;
  currency: string | null;
};

function normalizeInvoice(raw: any): InvoiceSummary {
  return {
    id: raw.id ?? raw.Id,
    invoiceNumber: raw.invoice_number ?? raw.invoiceNumber ?? null,
    title: raw.title ?? null,
    status: raw.status ?? null,
    total: raw.total ?? null,
    currency: raw.currency ?? "EUR",
  };
}

const STATUS_COLOR: Record<string, string> = {
  Draft: "var(--mute-2)",
  Sent: "var(--wine)",
  Viewed: "var(--wine)",
  Paid: "var(--good)",
  Cancelled: "var(--mute-2)",
};

function formatAmount(total: string | null, currency: string | null) {
  const n = parseFloat(total || "0");
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency || "EUR" }).format(n);
}

export function InvoicesPanel({ accountId, naked = false }: { accountId: number; naked?: boolean }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [invoices, setInvoices] = useState<InvoiceSummary[] | null>(null);

  useEffect(() => {
    if (!accountId) return;
    setInvoices(null);
    fetchInvoices(accountId)
      .then((rows: any[]) => setInvoices(rows.map(normalizeInvoice)))
      .catch(() => setInvoices([]));
  }, [accountId]);

  const openInvoice = (id: number) => {
    if (id) { try { localStorage.setItem("billing-selected-invoice", String(id)); } catch {} }
    setLocation(`${ROUTE_PREFIX}/billing`);
  };
  const statusLabel = (s: string) => t(`invoiceStatus.${s?.toLowerCase()}`, { defaultValue: s });

  const recent = (invoices ?? []).slice(0, 3);

  return (
    <Panel eyebrow="05" title={t("panels.invoices")} count={invoices?.length ?? undefined} naked={naked}>
      {invoices === null ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1].map((i) => <div key={i} style={{ height: 56, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} className="animate-pulse" />)}
        </div>
      ) : recent.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--mute-2)", fontStyle: "italic", padding: "6px 2px" }}>{t("related.noInvoice")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {recent.map((inv, i) => (
            <div key={inv.id}>
              {i > 0 && <div className="rule" style={{ margin: "0 14px" }} />}
              <div
                onClick={() => openInvoice(inv.id)}
                style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", borderRadius: "var(--r-surface)", cursor: "pointer", transition: "background 130ms" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <div style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}>
                  <Receipt size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {inv.title || inv.invoiceNumber || `#${inv.id}`}
                  </div>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.08em", textTransform: "uppercase", color: STATUS_COLOR[inv.status ?? ""] ?? "var(--mute)" }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", background: "currentColor" }} />
                    {statusLabel(inv.status ?? "")}
                  </span>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <span className="serif" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1 }}>{formatAmount(inv.total, inv.currency)}</span>
                </div>
              </div>
            </div>
          ))}
          {(invoices?.length ?? 0) > recent.length && (
            <button
              onClick={() => openInvoice(recent[0]?.id)}
              style={{ padding: "10px 14px", fontSize: 11.5, color: "var(--mute)", textAlign: "left", background: "transparent", border: "none", cursor: "pointer" }}
            >
              {t("panels.viewAllInvoices", { count: invoices?.length ?? 0 })}
            </button>
          )}
        </div>
      )}
    </Panel>
  );
}
