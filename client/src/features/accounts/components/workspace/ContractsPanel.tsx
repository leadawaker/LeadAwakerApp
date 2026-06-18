import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { Plus, FileText, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { fetchContracts, updateContract } from "@/features/billing/api/contractsApi";
import { Panel, ContractPill } from "./atoms";
import type { ContractRowData } from "./types";

const ROUTE_PREFIX = "/platform";

function contractAccountId(c: any): number | null {
  const id = c.accountsId ?? c.Accounts_id ?? c.account_id;
  return typeof id === "number" ? id : id ? Number(id) : null;
}

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

interface LinkableContract { id: number; title: string; status: string }

function AddContractPopover({ accountId, onLinked }: { accountId: number; onLinked: () => void }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();
  const [open, setOpen] = useState(false);
  const [contracts, setContracts] = useState<LinkableContract[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const all = await fetchContracts();
      const linkable = (all as any[])
        .filter((c) => contractAccountId(c) !== accountId)
        .map((c) => ({ id: c.id ?? c.Id, title: c.title ?? c.account_name ?? "—", status: (c.status ?? "").toLowerCase() }));
      setContracts(linkable);
    } catch { setContracts([]); }
    finally { setLoading(false); }
  };

  const onOpenChange = (v: boolean) => { setOpen(v); if (v && contracts === null) load(); };

  const link = async (id: number) => {
    setBusyId(id);
    try {
      await updateContract(id, { Accounts_id: accountId });
      onLinked();
      setOpen(false);
      setContracts(null);
    } catch (e) { console.error("Link contract failed", e); }
    finally { setBusyId(null); }
  };

  const statusLabel = (s: string) => t(`contractStatus.${s}`, { defaultValue: s });

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button className="la-btn la-btn--soft"><Plus size={12} />{t("panels.actions.add")}</button>
      </PopoverTrigger>
      <PopoverContent side="left" align="start" className="w-72 p-0 bg-white" style={{ maxHeight: 340, overflowY: "auto" }}>
        <div style={{ padding: "10px 12px", borderBottom: "1px solid var(--line)", fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.13em", textTransform: "uppercase", color: "var(--mute)" }}>
          {t("panels.contractLink.title")}
        </div>
        {loading ? (
          <div style={{ padding: "18px 12px", textAlign: "center", color: "var(--mute-2)", fontSize: 12 }}>{t("panels.invite.loading")}</div>
        ) : (contracts ?? []).length === 0 ? (
          <div style={{ padding: "16px 12px", textAlign: "center", color: "var(--mute-2)", fontSize: 12 }}>
            <div style={{ fontStyle: "italic", marginBottom: 8 }}>{t("panels.contractLink.empty")}</div>
            <button className="la-btn la-btn--soft" onClick={() => { setOpen(false); setLocation(`${ROUTE_PREFIX}/contracts`); }}>
              <Plus size={12} />{t("panels.contractLink.createNew")}
            </button>
          </div>
        ) : (
          <div style={{ padding: 6, display: "flex", flexDirection: "column", gap: 2 }}>
            {(contracts ?? []).map((c) => (
              <button
                key={c.id}
                onClick={() => link(c.id)}
                disabled={busyId !== null}
                className="row"
                style={{ gap: 10, padding: "8px 10px", borderRadius: "var(--r-surface)", border: "none", background: "transparent", cursor: "pointer", textAlign: "left", width: "100%" }}
                onMouseEnter={(e) => (e.currentTarget.style.background = "var(--wine-tint)")}
                onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
              >
                <FileText size={15} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{c.title}</div>
                  <div style={{ fontSize: 11, color: "var(--mute)" }}>{statusLabel(c.status)}</div>
                </div>
                {busyId === c.id && <Check size={14} style={{ color: "var(--wine)" }} />}
              </button>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

export function ContractsPanel({ contracts, loading, accountId, onRefresh }: { contracts: ContractRowData[]; loading?: boolean; accountId: number; onRefresh?: () => void }) {
  const { t } = useTranslation("accounts");
  const [, setLocation] = useLocation();

  const openContract = (id: number) => {
    if (id) { try { localStorage.setItem("billing-selected-contract", String(id)); } catch {} }
    setLocation(`${ROUTE_PREFIX}/contracts`);
  };
  const statusLabel = (s: string) => t(`contractStatus.${s}`, { defaultValue: s });

  return (
    <Panel eyebrow="04" title={t("panels.contracts")} count={contracts.length}
      action={<AddContractPopover accountId={accountId} onLinked={() => onRefresh?.()} />}>
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
