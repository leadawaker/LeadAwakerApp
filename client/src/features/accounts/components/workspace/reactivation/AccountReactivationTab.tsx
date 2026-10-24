// Accounts > Reactivation (agency only): the reactivation campaigns the agency
// runs for this client. A picker when there is more than one, the chosen
// campaign's settings, and New campaign in a right-hand panel. The list is the
// one Home > Reactivation shows (dbrCampaignSql: no demo campaigns, not the
// receptionist's own), so both places always agree on what counts.
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useQueryClient } from "@tanstack/react-query";
import { Megaphone, Plus } from "lucide-react";
import { useHomeReactivation } from "@/features/home/api/homeApi";
import { useCampaignById, campaignQueryKey } from "@/features/campaigns/hooks/useCampaignById";
import { NewCampaignPanel } from "./NewCampaignPanel";
import { ReactivationCampaignSettings } from "./ReactivationCampaignSettings";
import {
  forgetReactivationDeepLink, readReactivationDeepLink, stripReactivationDeepLink, type ReactivationSection,
} from "./reactivationLink";

const panelClass = "w-full h-auto rounded-2xl neu-raised border-l-0";

function Skeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {[44, 320].map((h, i) => (
        <div key={i} className="animate-pulse" style={{ height: h, borderRadius: "var(--r-card)", background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }} />
      ))}
    </div>
  );
}

function Note({ text }: { text: string }) {
  return <p style={{ fontSize: 13.5, color: "var(--mute)", padding: "12px 4px" }}>{text}</p>;
}

/** Loads the picked campaign and shows its settings. */
function CampaignHost({ campaignId, ...rest }: {
  campaignId: number; readOnly: boolean; compact: boolean; initialSection?: ReactivationSection;
  leading: ReactNode; trailing: ReactNode;
}) {
  const { t } = useTranslation("accounts");
  const { campaign, loading, onSave } = useCampaignById(campaignId);
  if (campaign) return <ReactivationCampaignSettings campaign={campaign} onSave={onSave} {...rest} />;
  // Keep the picker and New campaign on screen while a campaign loads or fails to.
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <div className="flex flex-wrap items-center gap-3">
        {rest.leading}
        <div className="ml-auto">{rest.trailing}</div>
      </div>
      {loading ? <Skeleton /> : <Note text={t("reactivationTab.loadFailed")} />}
    </div>
  );
}

export function AccountReactivationTab({ accountId, accountName, readOnly, isMobile }: {
  accountId: number; accountName: string; readOnly: boolean; isMobile: boolean;
}) {
  const { t } = useTranslation("accounts");
  const qc = useQueryClient();
  // A link from Home (?campaign= / &section= / &new=1) is read once, then stripped from the URL.
  const [deep] = useState(() => readReactivationDeepLink());
  useEffect(() => { stripReactivationDeepLink(); }, []);

  const { data, isLoading, isError } = useHomeReactivation({ accountId, period: "month", campaignId: null });
  const campaigns = data?.campaigns ?? [];
  const [picked, setPicked] = useState<number | null>(deep?.campaignId ?? null);
  const selectedId = campaigns.some((c) => c.id === picked) ? picked : campaigns[0]?.id ?? null;
  const [createOpen, setCreateOpen] = useState(!readOnly && !!deep?.create);

  const pick = (id: number) => { forgetReactivationDeepLink(); setPicked(id); };
  const closeCreate = () => { forgetReactivationDeepLink(); setCreateOpen(false); };
  const onCreated = async (row: Record<string, any>) => {
    const id = Number(row?.id ?? row?.Id);
    if (id) qc.setQueryData(campaignQueryKey(id), row);
    // The campaign list, the Services row and the Reactivation tab all read the Home facts.
    await qc.invalidateQueries({ queryKey: ["/api/home"] });
    if (id) setPicked(id);
    closeCreate();
  };

  const newButton = !readOnly && !createOpen ? (
    <button type="button" className="la-btn la-btn--wine" onClick={() => setCreateOpen(true)} data-testid="reactivation-new">
      <Plus size={14} />
      {t("reactivationTab.newCampaign")}
    </button>
  ) : null;

  const picker = campaigns.length > 1 ? (
    <select
      value={selectedId ?? ""}
      onChange={(e) => pick(Number(e.target.value))}
      aria-label={t("reactivationTab.campaign")}
      className="neu-inset-crisp"
      data-testid="reactivation-picker"
      style={{ padding: "7px 12px", borderRadius: "var(--r-button)", fontSize: 13, border: "none", background: "var(--bg)", color: "var(--ink)", maxWidth: "100%" }}
    >
      {campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
    </select>
  ) : campaigns[0] ? (
    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
      {campaigns[0].name}
    </span>
  ) : null;

  let main: ReactNode;
  if (isLoading) main = <Skeleton />;
  else if (isError) main = <Note text={t("reactivationTab.listFailed")} />;
  else if (selectedId === null) {
    main = (
      <div className="neu-raised" style={{ borderRadius: "var(--r-card)", background: "var(--card)", padding: isMobile ? 22 : 36, display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 12 }} data-testid="reactivation-empty">
        <span style={{ width: 40, height: 40, borderRadius: 12, display: "grid", placeItems: "center", background: "var(--wine-tint)", color: "var(--wine)" }}>
          <Megaphone size={18} />
        </span>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "var(--ink)" }}>{t("reactivationTab.emptyTitle")}</h3>
        <p style={{ margin: 0, fontSize: 13.5, color: "var(--mute)", lineHeight: 1.55, maxWidth: 560 }}>{t("reactivationTab.emptyBody")}</p>
        {newButton}
      </div>
    );
  } else {
    main = (
      <CampaignHost
        campaignId={selectedId}
        readOnly={readOnly}
        compact={isMobile || createOpen}
        initialSection={deep?.section ?? undefined}
        leading={picker}
        trailing={newButton}
      />
    );
  }

  const panel = createOpen && !readOnly ? (
    <NewCampaignPanel accountId={accountId} accountName={accountName} onCreated={onCreated} onClose={closeCreate} className={panelClass} />
  ) : null;

  if (isMobile) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 18 }} data-testid="account-reactivation">
        {panel}
        {main}
      </div>
    );
  }
  return (
    <div
      style={{ display: "grid", gridTemplateColumns: panel ? "minmax(0, 1fr) 400px" : "minmax(0, 1fr)", gap: 24, alignItems: "start" }}
      data-testid="account-reactivation"
    >
      <div style={{ minWidth: 0 }}>{main}</div>
      {panel && <div style={{ position: "sticky", top: "calc(var(--ws-sticky-top, 0px) + 32px)" }}>{panel}</div>}
    </div>
  );
}
