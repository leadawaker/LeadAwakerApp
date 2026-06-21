import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Building2, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileListHeader, MobileHeaderIconBtn, MobileDrawerOption, MobileDrawerSubheading } from "@/components/crm/mobile/MobileListHeader";
import { MobileSheet, MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { STATUS_FILTER_OPTIONS, STATUS_I18N_KEY } from "../listWidgets/accountListConstants";
import { ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useCompactPanelState } from "@/components/crm/CompactEntityRail";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { AccountsTopBar } from "./AccountsTopBar";
import { AccountsListPanel } from "./AccountsListPanel";
import { IdentityCard } from "./IdentityCard";
import { TabContent } from "./OverviewTab";
import { useAccountDetailData } from "./useAccountDetailData";
import { toAccountDetail, deriveMetrics } from "./adapters";
import { AccountCreatePanel } from "../AccountCreatePanel";
import type { NewAccountForm } from "../AccountCreateDialog";
import type { AccountRow, WorkspaceTab } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";

const ACCOUNT_TABS: WorkspaceTab[] = ["overview", "integrations", "communication"];

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
  const { isAgencyUser, isAdmin } = useWorkspace();

  const [tab, setTab] = useState<WorkspaceTab>("overview");
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");

  const { state: listPanelState, cycle } = useListPanelState();
  const { ref: compactObserverRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 900, deactivateAbove: 1250 });
  const isListCompact = !isNarrow && (listPanelState === "compact" || (listPanelState === "full" && rightPanelNarrow));
  const isListHidden = !isNarrow && listPanelState === "hidden";

  const setDetailNode = useCallback((node: HTMLDivElement | null) => {
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

  const maxW = 1120;

  // On mobile: account detail is shown as a slide-up MobileSheet (drag down to dismiss).
  // Clients (non-agency) instead get a solid, footer-preserving page (no sheet).
  const isClient = !isAgencyUser;
  const mobileSheetOpen = isNarrow && !isClient && !!p.selectedAccount && panelMode !== "create";
  const showDetailArea = !isNarrow;

  // ── Shared mobile detail blocks (used by the client page + the agency sheet) ──
  const mobileTabSeg = (
    <div className="la-seg la-seg--fill">
      {ACCOUNT_TABS.map((k) => (
        <button
          key={k}
          onClick={() => setTab(k)}
          className={`la-seg-btn${tab === k ? " on" : ""}`}
          style={{ padding: "9px 0", fontSize: 11, letterSpacing: "0.08em" }}
          data-testid={`account-tab-${k}`}
        >
          {t(`workspace.tabs.${k}`)}
        </button>
      ))}
    </div>
  );
  const mobileFrozenIdentity = account && d ? (
    <div className="shrink-0" style={{ padding: "12px 16px" }}>
      <IdentityCard d={d} metrics={metrics} onSave={p.onSave} compact />
    </div>
  ) : null;
  const mobileScrollData = account && d ? (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 32px" }}>
      <TabContent
        tab={tab}
        isMobile
        readOnly={!isAdmin}
        data={{
          account, d, accountId, onSave: p.onSave,
          campaigns: detailData.campaigns,
          contracts: detailData.contracts,
          team: detailData.team,
          loadingCampaigns: detailData.loadingCampaigns,
          loadingContracts: detailData.loadingContracts,
          loadingTeam: detailData.loadingTeam,
          onRefresh: detailData.refresh,
        }}
      />
    </div>
  ) : null;

  // ── Client mobile view: solid page (topbar title + tabs · frozen header · data) ──
  if (isNarrow && isClient) {
    return (
      <div className="flex flex-col h-full w-full" data-testid="accounts-workspace-client">
        {/* Topbar: "Accounts" title + the 3 tabs next to it */}
        <div
          className="shrink-0"
          style={{
            display: "flex", alignItems: "center", gap: 12,
            padding: "14px 16px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg)",
            paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
          }}
        >
          <span className="serif" style={{ fontSize: 26, color: "var(--ink)", letterSpacing: "-0.02em", flexShrink: 0 }}>
            {t("page.title")}
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>{mobileTabSeg}</div>
        </div>
        {account && d ? (
          <div className="flex flex-col flex-1 min-h-0">
            {mobileFrozenIdentity}
            {mobileScrollData}
          </div>
        ) : (
          <div className="flex flex-1 items-center justify-center" style={{ color: "var(--mute)" }}>
            <Building2 className="w-8 h-8" style={{ color: "var(--mute-2)" }} />
          </div>
        )}
      </div>
    );
  }

  const accountsFilterPanel = (
    <>
      <MobileDrawerSubheading>{t("page.title")}</MobileDrawerSubheading>
      {STATUS_FILTER_OPTIONS.map((s) => (
        <MobileDrawerOption
          key={s}
          label={t(STATUS_I18N_KEY[s] ?? s)}
          selected={p.filterStatus.includes(s)}
          onClick={() => p.onToggleFilterStatus(s)}
        />
      ))}
      {p.isFilterActive && (
        <MobileDrawerOption label={t("toolbar.clearAllFilters")} onClick={p.onResetControls} />
      )}
    </>
  );

  const accountsSortPanel = (
    <>
      {(["recent", "name_asc", "name_desc"] as const).map((opt) => (
        <MobileDrawerOption
          key={opt}
          label={t(`sort.${opt === "recent" ? "mostRecent" : opt === "name_asc" ? "nameAZ" : "nameZA"}`, opt)}
          selected={p.sortBy === opt}
          onClick={() => p.onSortByChange(opt)}
        />
      ))}
    </>
  );

  return (
    <div className="flex flex-col h-full w-full" data-testid="accounts-workspace">
      <MobileListHeader
        title={t("page.title")}
        searchValue={p.listSearch}
        onSearchChange={p.onListSearchChange}
        searchPlaceholder={t("page.searchPlaceholder", "Search accounts...")}
        filterPanel={accountsFilterPanel}
        filterActive={p.isFilterActive}
        sortPanel={accountsSortPanel}
        sortActive={p.isSortNonDefault}
        extraActions={isAgencyUser ? (
          <MobileHeaderIconBtn onClick={() => setPanelMode("create")} aria-label={t("toolbar.add", "New account")} data-testid="mobile-accounts-add">
            <Plus className="h-4 w-4" />
          </MobileHeaderIconBtn>
        ) : undefined}
      />
      <AccountsTopBar
        tab={tab}
        onTabChange={setTab}
        showTabs={!isNarrow}
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

      {/* Mobile: create account sheet */}
      {isNarrow && panelMode === "create" && (
        <MobileSheet open onClose={() => setPanelMode("view")} data-testid="account-create-sheet">
          <div style={{ overflowY: "auto", flex: 1, padding: "0 16px 32px" }}>
            <AccountCreatePanel
              onCreate={async (data) => { await p.onCreate(data); setPanelMode("view"); }}
              onClose={() => setPanelMode("view")}
            />
          </div>
        </MobileSheet>
      )}

      {/* Mobile: account detail sheet — drag down to dismiss */}
      <MobileSheet
        open={mobileSheetOpen}
        onClose={() => p.onSelectAccount(null)}
        topGap={18}
        data-testid="account-detail-sheet"
      >
        {account && d && (
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            {/* Frozen header — identity card stays pinned */}
            {mobileFrozenIdentity}
            {/* Tab switcher below the header (also frozen) */}
            <div
              className="shrink-0"
              style={{ padding: "0 16px 10px", borderBottom: "1px solid var(--line)" }}
            >
              {mobileTabSeg}
            </div>
            {/* Scrollable data */}
            {mobileScrollData}
          </div>
        )}
      </MobileSheet>

      <div className="flex flex-1 min-h-0">
        <MobileRecede open={mobileSheetOpen} fill={isNarrow}>
          <AccountsListPanel
            accounts={p.accounts}
            loading={p.loading}
            // On mobile the detail is in a MobileSheet portal, so the list stays visible.
            // Pass null so AccountsListPanel doesn't hide itself when an account is selected.
            selectedAccount={isNarrow ? null : p.selectedAccount}
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
        </MobileRecede>

        {/* Desktop detail panel — this div is the single scroll container; 48px h-padding keeps shadows (22.5px reach) within the clip boundary */}
        {showDetailArea && (
          <div
            ref={setDetailNode}
            className="flex-1 min-w-0 min-h-0"
            style={{ background: "var(--bg)", padding: "0 48px 16px", overflowY: "auto" }}
          >
            {panelMode === "create" ? (
              <div style={{ maxWidth: 720, margin: "0 auto", paddingTop: 24 }}>
                <div className="bg-card rounded-xl overflow-hidden neu-raised">
                  <AccountCreatePanel
                    onCreate={async (data) => { await p.onCreate(data); setPanelMode("view"); }}
                    onClose={() => setPanelMode("view")}
                  />
                </div>
              </div>
            ) : account && d ? (
              <div style={{ maxWidth: maxW, margin: "0 auto", width: "100%" }}>
                <div style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 10, paddingTop: 24 }}>
                  <IdentityCard d={d} metrics={metrics} onSave={p.onSave} />
                </div>
                <div style={{ height: 32 }} />
                <TabContent
                  tab={tab}
                  isMobile={false}
                  readOnly={!isAdmin}
                  data={{
                    account, d, accountId, onSave: p.onSave,
                    campaigns: detailData.campaigns,
                    contracts: detailData.contracts,
                    team: detailData.team,
                    loadingCampaigns: detailData.loadingCampaigns,
                    loadingContracts: detailData.loadingContracts,
                    loadingTeam: detailData.loadingTeam,
                    onRefresh: detailData.refresh,
                  }}
                />
                <div style={{ height: 16 }} />
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center text-center" style={{ height: "100%", color: "var(--mute)" }}>
                <Building2 className="w-10 h-10 mb-3" style={{ color: "var(--mute-2)" }} />
                <p style={{ fontSize: 14 }}>{t("detail.selectExecution", { defaultValue: "Select an account" })}</p>
              </div>
            )}
          </div>
        )}
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
