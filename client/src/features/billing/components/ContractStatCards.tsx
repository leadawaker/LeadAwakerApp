import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FileText, Clock, CheckCircle, Edit3 } from "lucide-react";
import type { ContractRow } from "../types";
import { formatCurrency } from "../types";

interface ContractStatCardsProps {
  contracts: ContractRow[];
}

export function ContractStatCards({ contracts }: ContractStatCardsProps) {
  const { t } = useTranslation("billing");

  const stats = useMemo(() => {
    let activeValue = 0;
    let awaitingCount = 0;
    let signedCount = 0;
    let draftCount = 0;

    for (const c of contracts) {
      const status = c.status || "Draft";
      if (status === "Signed") {
        signedCount++;
        const cur = c.currency || "EUR";
        const v = c.fixed_fee_amount
          ? parseFloat(String(c.fixed_fee_amount))
          : c.monthly_fee
            ? parseFloat(String(c.monthly_fee)) * 12
            : c.value_per_booking
              ? parseFloat(String(c.value_per_booking))
              : c.deposit_amount
                ? parseFloat(String(c.deposit_amount))
                : 0;
        if (!isNaN(v)) activeValue += v;
      }
      if (status === "Sent" || status === "Viewed") awaitingCount++;
      if (status === "Draft") draftCount++;
    }

    return { activeValue, awaitingCount, signedCount, draftCount };
  }, [contracts]);

  const cards = [
    {
      label: t("contracts.stats.activeValue"),
      value: formatCurrency(stats.activeValue),
      accent: "var(--wine)",
      Icon: FileText,
      serif: true,
    },
    {
      label: t("contracts.stats.awaitingSignature"),
      value: String(stats.awaitingCount),
      accent: "var(--warn)",
      Icon: Clock,
      serif: false,
    },
    {
      label: t("contracts.stats.signed"),
      value: String(stats.signedCount),
      accent: "var(--good)",
      Icon: CheckCircle,
      serif: false,
    },
    {
      label: t("contracts.stats.drafts"),
      value: String(stats.draftCount),
      accent: undefined,
      Icon: Edit3,
      serif: false,
    },
  ];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, padding: "8px 8px 4px" }}>
      {cards.map((card) => (
        <div
          key={card.label}
          className="neu-raised"
          style={{
            flex: "1 1 0",
            minWidth: 0,
            padding: "14px 16px",
            borderRadius: "var(--r-card)",
            background: "var(--card)",
            position: "relative",
            overflow: "hidden",
          }}
        >
          {card.accent && (
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: card.accent }} />
          )}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 6 }}>
            <span className="eyebrow eyebrow-sm">{card.label}</span>
            <card.Icon
              size={14}
              style={{ color: card.accent || "var(--mute-2)", flexShrink: 0, marginTop: 1 }}
            />
          </div>
          {card.serif ? (
            <div className="serif" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1.05, marginTop: 8, letterSpacing: "-0.01em" }}>
              {card.value}
            </div>
          ) : (
            <div className="serif" style={{ fontSize: 32, color: "var(--ink)", lineHeight: 1.05, marginTop: 8, letterSpacing: "-0.01em" }}>
              {card.value}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
