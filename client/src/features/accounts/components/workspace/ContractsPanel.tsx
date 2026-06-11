import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, FileText } from "lucide-react";
import { Panel, PanelAction, ContractPill } from "./atoms";
import type { ContractRowData } from "./types";

const ROUTE_PREFIX = "/platform";

function ContractRow({ c, onOpen, label }: { c: ContractRowData; onOpen: () => void; label: string }) {
  return (
    <div
      onClick={onOpen}
      style={{ display: "flex", alignItems: "center", gap: 14, padding: "13px 14px", borderRadius: "var(--r-surface)", cursor: "pointer", transition: "background 130ms" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <div style={{ width: 36, height: 36, borderRadius: "var(--r-button)", flexShrink: 0, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--mute)" }}><FileText size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink)", marginBottom: 5, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.name}</div>
        <ContractPill status={c.status} label={label} />
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <div className="row" style={{ justifyContent: "flex-end", alignItems: "baseline", gap: 3 }}>
          <span className="serif" style={{ fontSize: 18, color: "var(--ink)", lineHeight: 1 }}>{c.value}</span>
          <span style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)" }}>/mo</span>
        </div>
        {c.renewal && <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--mute-2)", marginTop: 5, letterSpacing: "0.04em" }}>{c.renewal}</div>}
      </div>
    </div>
  );
}

export function ContractsPanel({ contracts, loading }: { contracts: ContractRowData[]; loading?: boolean }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();

  const openContract = (id: number) => {
    if (id) { try { localStorage.setItem("billing-selected-contract", String(id)); } catch {} }
    setLocation(`${ROUTE_PREFIX}/contracts`);
  };
  const statusLabel = (s: string) => t(`contractStatus.${s}`, { defaultValue: s });

  return (
    <Panel eyebrow="04" title={t("panels.contracts")} count={contracts.length}
      action={<PanelAction icon={<Plus size={12} />} onClick={() => setLocation(`${ROUTE_PREFIX}/contracts`)}>{t("panels.actions.add")}</PanelAction>}>
      {loading ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {[0, 1].map((i) => <div key={i} style={{ height: 56, borderRadius: "var(--r-surface)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} className="animate-pulse" />)}
        </div>
      ) : contracts.length === 0 ? (
        <p style={{ fontSize: 12, color: "var(--mute-2)", fontStyle: "italic", padding: "6px 2px" }}>{t("related.noContract")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {contracts.map((c, i) => (
            <div key={c.id}>
              {i > 0 && <div className="rule" style={{ margin: "0 14px" }} />}
              <ContractRow c={c} onOpen={() => openContract(c.id)} label={statusLabel(c.status)} />
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
