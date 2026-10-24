import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { parseInstagramReturn, stripInstagramParams } from "@/features/social/lib/socialState";
import { SOCIAL_PAGE_PATH } from "@/features/social/lib/socialPage";
import { socialPageLink } from "@shared/socialStudio";
import { useLocation, useSearch } from "wouter";
import type { ConnectionGroup } from "./ConnectionsOverview";
import { useMarkVisited } from "@/features/home/onboarding/useOnboarding";
import { useTranslation } from "react-i18next";
import { Building2, Plus } from "lucide-react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { MobileListHeader, MobileHeaderIconBtn, MobileDrawerOption, MobileDrawerSubheading } from "@/components/crm/mobile/MobileListHeader";
import { MobileSheet, MobileRecede } from "@/components/crm/mobile/MobileSheet";
import { STATUS_FILTER_OPTIONS, STATUS_I18N_KEY, GROUP_TKEYS } from "../listWidgets/accountListConstants";
import { ACCOUNT_STATUS_HEX } from "@/lib/avatarUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { myAccountLabelKey } from "@/components/crm/navGates";
import { useClientNavFacts } from "@/components/crm/useClientNavFacts";
import { useListPanelState } from "@/hooks/useListPanelState";
import { useCompactPanelState } from "@/components/crm/CompactEntityRail";
import { usePublishEntityData } from "@/contexts/PageEntityContext";
import { AccountsTopBar } from "./AccountsTopBar";
import { AccountsListPanel } from "./AccountsListPanel";
import { IdentityCard } from "./IdentityCard";
import { TabContent } from "./OverviewTab";
import { useAccountDetailData } from "./useAccountDetailData";
import { toAccountDetail } from "./adapters";
import { useHeaderMetrics } from "./useHeaderMetrics";
import { AccountCreatePanel } from "../AccountCreatePanel";
import type { NewAccountForm } from "../AccountCreateDialog";
import type { AccountRow, WorkspaceTab } from "./types";
import type { AccountGroupBy, AccountSortBy } from "../../pages/AccountsPage";
import { receptionistSettingsHref } from "./receptionist/settingsLink";
import { useHomeServices } from "@/features/home/api/homeApi";
import { readLastTab, writeLastTab } from "@/lib/lastTab";

// Onboarding ("communication") has no tab: it opens from a button on Overview.
// Socials has its own page in the nav bar (/platform/social); an old ?tab=social link is sent there.
// The receptionist is tuned where its work is: Phone is Calls > Settings, Chat is Chats > Settings
// (an old ?tab=voice / ?tab=chat link is sent there). This page is about the business itself.
// Reactivation (agency only) is the service the agency runs for the client: shown when the account
// has a reactivation campaign, and always reachable by ?tab=reactivation or the Services row to start one.
const ACCOUNT_TABS: WorkspaceTab[] = ["overview", "reactivation", "integrations", "alerts", "automations"];
const LAST_TAB_PAGE = "accounts";

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

// A ?tab= deep link survives a remount of the workspace: if a second instance mounts
// before the first one finished with the link, it must still open the tab. The memo is
// cleared once the param is consumed or the user picks a tab by hand.
let lastDeepTab: { tab: WorkspaceTab; at: number } | null = null;
function deepLinkTab(): WorkspaceTab | null {
  const wanted = new URLSearchParams(window.location.search).get("tab") as WorkspaceTab | null;
  if (wanted && (ACCOUNT_TABS.includes(wanted) || wanted === "communication")) {
    lastDeepTab = { tab: wanted, at: Date.now() };
    return wanted;
  }
  return lastDeepTab && Date.now() - lastDeepTab.at < 15000 ? lastDeepTab.tab : null;
}

export function AccountsWorkspace(p: Props) {
  const { t } = useTranslation("accounts");
  const { t: tc } = useTranslation("crm");
  const navFacts = useClientNavFacts();
  const isNarrow = useIsMobile(1024);
  const { isAgencyUser, isAdmin, isOwner, currentAccountId } = useWorkspace();
  useMarkVisited("receptionist"); // Getting-started checklist (clients only)

  // A ?tab= link wins; otherwise the tab used last (per user) reopens.
  const restoredTab = useRef(false);
  const [tab, setTab] = useState<WorkspaceTab>(() => {
    const wanted = deepLinkTab();
    restoredTab.current = !wanted;
    const pick = wanted ?? readLastTab(LAST_TAB_PAGE, ACCOUNT_TABS, "overview");
    if (pick === "automations" && !isOwner) return "overview";
    if (pick === "reactivation" && !isAgencyUser) return "overview";
    return pick;
  });
  useEffect(() => {
    if (ACCOUNT_TABS.includes(tab)) writeLastTab(LAST_TAB_PAGE, tab);
  }, [tab]);

  // Owner-only and agency-only tabs: fall back to Overview if the role changes (e.g. impersonation) while open.
  useEffect(() => {
    if ((tab === "automations" && !isOwner) || (tab === "reactivation" && !isAgencyUser)) setTab("overview");
  }, [tab, isOwner, isAgencyUser]);
  const [panelMode, setPanelMode] = useState<"view" | "create">("view");

  const { state: listPanelState, cycle } = useListPanelState();
  const { ref: compactObserverRef, narrow: rightPanelNarrow } = useCompactPanelState(isNarrow, { activateBelow: 900, deactivateAbove: 1250 });
  const isListCompact = !isNarrow && (listPanelState === "compact" || (listPanelState === "full" && rightPanelNarrow));
  const isListHidden = !isNarrow && listPanelState === "hidden";

  const setDetailNode = useCallback((node: HTMLDivElement | null) => {
    compactObserverRef(node);
  }, [compactObserverRef]);

  // The account header sticks to the top of the detail panel. Its height is
  // published as --ws-sticky-top so a tab's own sticky menu (Integrations,
  // Phone, Alerts) parks just below it instead of sliding under it.
  const [headerH, setHeaderH] = useState(0);
  const headerObserver = useMemo(() => (typeof ResizeObserver === "undefined" ? null : new ResizeObserver((entries) => {
    setHeaderH(Math.round(entries[0]?.contentRect.height ?? 0) + 24);
  })), []);
  const setHeaderNode = useCallback((node: HTMLDivElement | null) => {
    headerObserver?.disconnect();
    if (node) headerObserver?.observe(node);
  }, [headerObserver]);
  useEffect(() => () => headerObserver?.disconnect(), [headerObserver]);

  const account = selectedAccountResolver(p.selectedAccount, p.accounts);
  const accountId = account ? (account.Id ?? account.id ?? 0) : 0;

  const detailData = useAccountDetailData(accountId);

  // The Automations tab is owner only: hidden for everyone else, including via ?tab=automations.
  // Reactivation is agency only, shown when the account has a reactivation campaign (the same
  // fact as the Services row and Home) or while it is open, so an empty one can start a campaign.
  const { data: homeServices } = useHomeServices(accountId);
  const hasReactivation = accountId > 0 && !!homeServices?.reactivation;
  // A remembered Reactivation tab only reopens on an account that has a reactivation campaign.
  useEffect(() => {
    if (!restoredTab.current || accountId <= 0 || !homeServices) return;
    restoredTab.current = false;
    if (tab === "reactivation" && !homeServices.reactivation) setTab("overview");
  }, [homeServices, accountId, tab]);
  const tabs = useMemo(
    () => ACCOUNT_TABS.filter((k) => {
      if (k === "automations") return isOwner;
      if (k === "reactivation") return isAgencyUser && (hasReactivation || tab === "reactivation");
      return true;
    }),
    [isOwner, isAgencyUser, hasReactivation, tab],
  );
  // Notifications sent before Socials moved to the nav bar link to ?tab=social.
  const [, setLocation] = useLocation();
  const search = useSearch();
  useEffect(() => {
    if (new URLSearchParams(search).get("tab") === "social") setLocation(SOCIAL_PAGE_PATH, { replace: true });
  }, [search, setLocation]);
  // Links to the old Phone and Chat tabs (?tab=voice|chat, with ?section= / ?focus=) open Calls >
  // Settings or Chats > Settings on the same account: the one shown here, else the stored pick.
  useEffect(() => {
    const params = new URLSearchParams(search);
    const wanted = params.get("tab");
    if (wanted !== "voice" && wanted !== "chat") return;
    let stored = 0;
    try { stored = Number(localStorage.getItem("selected-account-id")) || 0; } catch { /* storage blocked */ }
    const target = accountId || stored || currentAccountId;
    lastDeepTab = null;
    setLocation(receptionistSettingsHref(wanted, {
      accountId: isAgencyUser && target > 0 ? target : undefined,
      section: params.get("section") ?? undefined,
      focus: params.get("focus") ?? undefined,
    }), { replace: true });
  }, [search, setLocation, isAgencyUser, accountId, currentAccountId]);
  const d = useMemo(() => (account ? toAccountDetail(account, t) : null), [account, t]);
  // Header figures that point at the tabs (calls, phone line, WhatsApp, alerts).
  const metrics = useHeaderMetrics(accountId);

  // Reset to view mode whenever selection changes.
  useEffect(() => { setPanelMode("view"); }, [accountId]);

  // After connecting a calendar via OAuth, the server redirects back here with
  // ?calendar=connected&provider=… (see server/routes/calendar.ts). The calendar
  // cards live on the Integrations tab, so open that instead of leaving the user
  // on Overview, then strip the params so a later manual tab change isn't
  // re-overridden if this component remounts.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (!params.has("calendar")) return;
    setTab("integrations");
    params.delete("calendar");
    params.delete("provider");
    params.delete("reason");
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, []);

  // After the Instagram connect flow the server redirects back with ?instagram=connected or
  // ?instagram=error&reason=… (server/routes/social.ts). Open Integrations on the Social group,
  // say how it went, refresh the card, and strip the params.
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [integrationsGroup, setIntegrationsGroup] = useState<ConnectionGroup | undefined>(undefined);
  // The toast below is made on mount, before the account list has loaded: its button reads the account when tapped.
  const accountIdRef = useRef(accountId);
  accountIdRef.current = accountId;
  useEffect(() => {
    const result = parseInstagramReturn(window.location.search);
    if (!result) return;
    setTab("integrations");
    setIntegrationsGroup("social");
    if (result.kind === "connected") {
      toast({
        title: t("social.connect.toastConnected"),
        action: <ToastAction altText={t("social.connect.toastOpenSocials")} onClick={() => setLocation(accountIdRef.current ? socialPageLink(accountIdRef.current) : SOCIAL_PAGE_PATH)}>{t("social.connect.toastOpenSocials")}</ToastAction>,
      });
    }
    else toast({ title: t("social.connect.toastFailed"), description: t(`social.connect.errors.${result.reason}`), variant: "destructive" });
    queryClient.invalidateQueries({ queryKey: ["social-status"] }); // every account's status (socialStatusKey prefix)
    window.history.replaceState(null, "", window.location.pathname + stripInstagramParams(window.location.search));
  }, []);
  // The Social group opens first once, for the account the flow returned to; switching accounts drops it.
  const returnAccountRef = useRef<number | null>(null);
  useEffect(() => {
    if (!integrationsGroup) { returnAccountRef.current = null; return; }
    if (!accountId) return; // the account list is still loading
    if (returnAccountRef.current === null) returnAccountRef.current = accountId;
    else if (returnAccountRef.current !== accountId) setIntegrationsGroup(undefined);
  }, [integrationsGroup, accountId]);

  // Deep link: /platform/accounts?tab=alerts opens that tab. Stripped once applied.
  // "voice" and "chat" (Overview's services rows, Automations' Change links) leave for Calls / Chats > Settings.
  const pickTab = (k: WorkspaceTab) => {
    if (k === "voice" || k === "chat") {
      setLocation(receptionistSettingsHref(k, { accountId: isAgencyUser && accountId ? accountId : undefined }));
      return;
    }
    lastDeepTab = null; restoredTab.current = false; setIntegrationsGroup(undefined); setTab(k);
  };

  // The tab itself is read from the URL when the state is created. The param is
  // stripped only once an account has loaded, so a remount before that re-reads it.
  useEffect(() => {
    if (!accountId) return;
    const params = new URLSearchParams(window.location.search);
    const wanted = params.get("tab");
    if (!wanted || wanted === "voice" || wanted === "chat") return; // redirected above
    params.delete("tab");
    lastDeepTab = null;
    const qs = params.toString();
    window.history.replaceState(null, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [accountId]);

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
    <div className={`la-seg la-seg--fill${isClient ? " la-seg--touch" : ""}`} style={{ overflowX: "auto", scrollbarWidth: "none" }}>
      {tabs.map((k) => (
        <button
          key={k}
          onClick={() => pickTab(k)}
          className={`la-seg-btn${tab === k ? " on" : ""}`}
          style={{ padding: "9px 10px", fontSize: 11, letterSpacing: "0.08em", whiteSpace: "nowrap", flex: "1 0 auto" }}
          data-testid={`account-tab-${k}`}
        >
          {t(`workspace.tabs.${k}`)}
        </button>
      ))}
    </div>
  );
  const mobileFrozenIdentity = account && d ? (
    <div className="shrink-0" style={{ padding: "12px 16px" }}>
      <IdentityCard d={d} metrics={metrics} onSave={p.onSave} compact clientView={isClient} />
    </div>
  ) : null;
  const mobileScrollData = account && d ? (
    <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "14px 16px 32px" }}>
      <TabContent
        tab={tab}
        isMobile
        readOnly={!isAdmin}
        onOpenTab={pickTab}
        integrationsGroup={integrationsGroup}
        data={{
          account, d, accountId, onSave: p.onSave,
          contracts: detailData.contracts,
          team: detailData.team,
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
        {/* Topbar: the page title, with the tabs on their own full-width row under it */}
        <div
          className="shrink-0 la-m-chrome"
          style={{
            display: "flex", flexDirection: "column", gap: 10,
            padding: "14px 16px 12px", borderBottom: "1px solid var(--line)", background: "var(--bg)",
            paddingTop: "max(env(safe-area-inset-top, 0px), 14px)",
          }}
        >
          <span className="serif" style={{ fontSize: 26, color: "var(--ink)", letterSpacing: "-0.02em" }}>
            {tc(myAccountLabelKey(navFacts))}
          </span>
          <div style={{ minWidth: 0 }}>{mobileTabSeg}</div>
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

  const accountsGroupPanel = (
    <>
      {(["status", "type", "none"] as AccountGroupBy[]).map((g) => (
        <MobileDrawerOption
          key={g}
          label={t(GROUP_TKEYS[g])}
          selected={p.groupBy === g}
          onClick={() => p.onGroupByChange(g)}
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
        groupPanel={accountsGroupPanel}
        groupActive={p.isGroupNonDefault}
        mainRowTrailing={isAgencyUser ? (
          <MobileHeaderIconBtn onClick={() => setPanelMode("create")} aria-label={t("toolbar.add", "New account")} data-testid="mobile-accounts-add">
            <Plus className="h-4 w-4" />
          </MobileHeaderIconBtn>
        ) : undefined}
      />
      <AccountsTopBar
        tab={tab}
        tabs={tabs}
        onTabChange={pickTab}
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
        {isAgencyUser && (
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
        )}

        {/* Desktop detail panel — this div is the single scroll container; 48px h-padding keeps shadows (22.5px reach) within the clip boundary */}
        {showDetailArea && (
          <div
            ref={setDetailNode}
            className="flex-1 min-w-0 min-h-0"
            style={{ background: "var(--bg)", padding: "0 48px 16px", overflowY: "auto", ["--ws-sticky-top" as string]: `${headerH}px` }}
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
                <div ref={setHeaderNode} style={{ position: "sticky", top: 0, background: "var(--bg)", zIndex: 10, paddingTop: 24 }}>
                  <IdentityCard d={d} metrics={metrics} onSave={p.onSave} clientView={isClient} />
                </div>
                <div style={{ height: 32 }} />
                <TabContent
                  tab={tab}
                  isMobile={false}
                  readOnly={!isAdmin}
                  integrationsGroup={integrationsGroup}
                  onOpenTab={pickTab}
                  data={{
                    account, d, accountId, onSave: p.onSave,
                    contracts: detailData.contracts,
                    team: detailData.team,
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
