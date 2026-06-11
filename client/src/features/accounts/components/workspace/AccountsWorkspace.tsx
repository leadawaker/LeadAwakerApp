import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useCompactPanelState } from "@/components/crm/CompactEntityRail";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { AccountsTopBar } from "./AccountsTopBar";
import { AccountsListPanel } from "./AccountsListPanel";
import { IdentityCard } from "./IdentityCard";
import { TabContent } from "./OverviewTab";
import { useUltraWide } from "./useUltraWide";
import { useAccountDetailData } from "./useAccountDetailData";
import { toAccountDetail, deriveMetrics } from "./adapters";
import { AccountCreatePanel } from "../AccountCreatePanel";
import type { NewAccountForm } from "../AccountCreateDialog";
import type { AccountRow, WorkspaceTab } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";

interface Props {
  accounts: AccountRow[];
  loading: boolean;
  selectedAccount: AccountRow | null;
  onSelectAccount: (a: AccountRow | null) => void;
  count: number;
  onCreate: (data: NewAccountForm) => Promise<void>;
  onSave: (field: string, value: string) => Promise<void>;
  onDelete: () => void;
  // Lifted list controls
  listSearch: string;
  onListSearchChange: (v: string) => void;
  filterStatus: string[];
  onToggleFilterStatus: (s: string) => void;
  isFilterActive: boolean;
  onResetControls: () => void;
  sortBy: AccountSortBy;
  onSortByChange: (v: AccountSortBy) => void;
  isSortNonDefault: boolean;
  groupBy: AccountGroupBy;
  onGroupByChange: (v: AccountGroupBy) => void;
  groupDirection: "asc" | "desc";
  onGroupDirectionChange: (v: "asc" | "desc") => void;
  isGroupNonDefault: boolean;
}

export function AccountsWorkspace(p: Props) {
  const { t } = useTranslation("accounts");
  const isNarrow = useIsMobile(1024);

  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");

  const { state: listPanelState, cycle } = useListPanelState();
  const { ref: compactObserverRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 900, deactivateAbove: 1250 });
  const isListCompact = !isNarrow && (listPanelState === "compact" || (listPanelState === "full" && rightPanelNarrow));
  const isListHidden = !isNarrow && listPanelState === "hidden";

  const detailRef = useRef<HTMLDivElement | null>(null);
  const ultra = useUltraWide(detailRef);
  const setDetailNode = useCallback((node: HTMLDivElement | null) => {
    detailRef.current = node;
    compactObserverRef(node);
  }, [compactObserverRef]);

  const account = selectedAccountResolver(p.selectedAccount, p.accounts);
  const accountId = account ? (account.Id ?? account.id ?? 0) : 0;

  const detailData = useAccountDetailData(accountId);
  const d = useMemo(() => (account ? toAccountDetail(account, t) : null), [account, t]);
  const metrics = useMemo(
    () => (account ? deriveMetrics(detailData.campaigns, detailData.contracts, detailData.team, t) : []),
    [account, detailData.campaigns, detailData.contracts, detailData.team, t],
  );

  // Reset to view mode whenever selection changes.
  useEffect(() => { setPanelMode("view"); }, [accountId]);

  // Publish entity data for the AI chat context.
  const publishEntity = usePublishEntityData();
  useEffect(() => {
    if (!account) return;
    publishEntity({
      entityType: "account",
      entityId: accountId,
      entityName: account.name || "Unknown Account",
      summary: {
        id: accountId, name: account.name, status: account.status, type: account.type,
        ownerEmail: account.owner_email, phone: account.phone, website: account.website,
        businessNiche: account.business_niche, timezone: account.timezone, language: account.language,
      },
      updatedAt: Date.now(),
    });
  }, [publishEntity, accountId, account]);

  // In ultra-wide every panel is on one screen, so the tab switcher is hidden and
  // the content is always the full overview.
  const effectiveTab: WorkspaceTab = ultra ? "overview" : tab;
  const maxW = effectiveTab === "overview" ? (ultra ? undefined : 1180) : effectiveTab === "integrations" ? 1120 : 1080;

  const showDetailArea = !(isNarrow && !p.selectedAccount && panelMode === "view");

  return (
    <div className="flex flex-col h-full w-full" data-testid="accounts-workspace">
      <AccountsTopBar
        tab={tab}
        onTabChange={setTab}
        showTabs={!ultra}
        count={p.count}
        listPanelState={listPanelState}
        onCycle={cycle}
        listSearch={p.listSearch}
        onListSearchChange={p.onListSearchChange}
        filterStatus={p.filterStatus}
        onToggleFilterStatus={p.onToggleFilterStatus}
        isFilterActive={p.isFilterActive}
        onResetControls={p.onResetControls}
        sortBy={p.sortBy}
        onSortByChange={p.onSortByChange}
        isSortNonDefault={p.isSortNonDefault}
        groupBy={p.groupBy}
        onGroupByChange={p.onGroupByChange}
        groupDirection={p.groupDirection}
        onGroupDirectionChange={p.onGroupDirectionChange}
        isGroupNonDefault={p.isGroupNonDefault}
        onCreate={() => setPanelMode("create")}
        onDelete={p.onDelete}
        hasSelection={!!p.selectedAccount}
      />

      <div className="flex flex-1 min-h-0 overflow-hidden">
        <AccountsListPanel
          accounts={p.accounts}
          loading={p.loading}
          selectedAccount={p.selectedAccount}
          onSelectAccount={(a) => { p.onSelectAccount(a); setPanelMode("view"); }}
          listSearch={p.listSearch}
          filterStatus={p.filterStatus}
          sortBy={p.sortBy}
          groupBy={p.groupBy}
          groupDirection={p.groupDirection}
          isListCompact={isListCompact}
          isListHidden={isListHidden}
          isNarrow={isNarrow}
        />

        <div
          ref={setDetailNode}
          className={cn("flex-1 min-w-0 overflow-y-auto", showDetailArea ? "block" : "hidden")}
          style={{ background: "var(--bg)", padding: isNarrow ? "16px 16px 40px" : "24px 30px 40px" }}
        >
          {panelMode === "create" ? (
            <div style={{ maxWidth: 720, margin: "0 auto" }} className="bg-card rounded-xl overflow-hidden neu-raised">
              <AccountCreatePanel
                onCreate={async (data) => { await p.onCreate(data); setPanelMode("view"); }}
                onClose={() => setPanelMode("view")}
              />
            </div>
          ) : account && d ? (
            <div style={{ maxWidth: maxW ?? "none", margin: "0 auto", display: "flex", flexDirection: "column", gap: 22 }}>
              {isNarrow && (
                <button onClick={() => p.onSelectAccount(null)} className="la-btn la-btn--soft" style={{ alignSelf: "flex-start" }}>
                  <ChevronLeft className="h-4 w-4" />{t("detail.close")}
                </button>
              )}
              <IdentityCard d={d} metrics={metrics} onSave={p.onSave} />
              <TabContent
                tab={effectiveTab}
                ultra={ultra}
                isMobile={isNarrow}
                data={{
                  account, d, accountId, onSave: p.onSave,
                  campaigns: detailData.campaigns,
                  contracts: detailData.contracts,
                  team: detailData.team,
                  loadingCampaigns: detailData.loadingCampaigns,
                  loadingContracts: detailData.loadingContracts,
                  loadingTeam: detailData.loadingTeam,
                }}
              />
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%", color: "var(--mute)" }}>
              <Building2 className="w-10 h-10 mb-3" style={{ color: "var(--mute-2)" }} />
              <p style={{ fontSize: 14 }}>{t("detail.selectExecution", { defaultValue: "Select an account" })}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Keep the freshest version of the selected account from the live list (optimistic edits).
function selectedAccountResolver(selected: AccountRow | null, accounts: AccountRow[]): AccountRow | null {
  if (!selected) return null;
  const sid = selected.Id ?? selected.id;
  const fresh = accounts.find((a) => (a.Id ?? a.id) === sid);
  return fresh ?? selected;
}
