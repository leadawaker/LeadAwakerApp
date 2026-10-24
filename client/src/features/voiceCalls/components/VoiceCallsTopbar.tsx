import { useTranslation } from "react-i18next";
import { PanelLeft, PanelLeftClose } from "lucide-react";
import { ExpandingSearch } from "@/components/crm/primitives";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListPanelState } from "@/hooks/useListPanelState";
import type { VoiceScope } from "../api/voiceCallsApi";
import type { CallsTab, PeopleOptions } from "../callers";
import { CallsListTabs, CallsPageTabs } from "./CallsPageTabs";
import type { CallsPageView } from "./callsTabs";
import type { ListOptions } from "../listOptions";
import { AccountFilter, type AccountOption } from "./AccountFilter";
import { PresentingToggle } from "./PresentingToggle";
import { PeopleMenus, VoiceCallsMenus } from "./VoiceCallsMenus";
import { VoiceCallsMobileTopbar } from "./VoiceCallsMobileTopbar";
import { ScopeSwitch } from "./ScopeSwitch";
import { WeekSummary } from "./WeekSummary";

interface Props {
  scope: VoiceScope;
  /** Owner only: shows the Live | Demo switch (by the search), the account chip and the Presenting toggle. */
  isOwner: boolean;
  onScope: (s: VoiceScope) => void;
  /** People (everyone) · All calls (agency only). */
  tabs: CallsTab[];
  /** A tab, or Settings (the receptionist's settings: no list, so no list controls). */
  view: CallsPageView;
  /** The list tab "Calls" returns to from Settings (People or All calls). */
  listView: CallsTab;
  onView: (v: CallsPageView) => void;
  options: ListOptions;
  setOptions: (patch: Partial<ListOptions>) => void;
  peopleOptions: PeopleOptions;
  setPeopleOptions: (patch: Partial<PeopleOptions>) => void;
  languages: string[];
  accounts: AccountOption[];
  accountId: number | undefined;
  onAccount: (id: number | undefined) => void;
  masked: boolean;
  onTogglePresenting: () => void;
  /** Settings: the spot right after the tabs where the receptionist's account picker is placed. */
  onPickerSlot?: (el: HTMLElement | null) => void;
}

export function VoiceCallsTopbar({ scope, isOwner, onScope, tabs, view, listView, onView, options, setOptions, peopleOptions, setPeopleOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting, onPickerSlot }: Props) {
  const { t } = useTranslation("voiceCalls");
  const isMobile = useIsMobile(768);
  // Below 920px the inboxes show one pane at a time, so there is no list to minimize.
  const singlePane = useIsMobile(920);
  const { state: panel, setState: setPanel } = useListPanelState();
  const listCompact = panel === "compact";
  // Settings has no list: search, filters, the scope switch and the list toggle hide.
  const hasList = view !== "settings";
  if (isMobile) {
    return (
      <VoiceCallsMobileTopbar
        scope={scope} isOwner={isOwner} onScope={onScope} tabs={tabs} view={view} onView={onView}
        options={options} setOptions={setOptions} peopleOptions={peopleOptions} setPeopleOptions={setPeopleOptions} languages={languages}
        accounts={accounts} accountId={accountId} onAccount={onAccount}
        masked={masked} onTogglePresenting={onTogglePresenting} onPickerSlot={onPickerSlot}
      />
    );
  }
  return (
    <div className="la-page-header" style={{ gap: 12, padding: "0 17px", overflowX: "auto" }}>
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>
        {t("title")}
      </span>

      <CallsPageTabs view={view} listView={listView} onView={onView} />
      {view === "settings" && onPickerSlot && <span ref={onPickerSlot} style={{ display: "contents" }} data-testid="calls-settings-picker-slot" />}
      <CallsListTabs tabs={tabs} view={view} onView={onView} />

      {/* Minimize / expand the list, as on the Chats page */}
      {hasList && !singlePane && (
        <button
          type="button"
          onClick={() => setPanel(listCompact ? "full" : "compact")}
          className="la-btn la-btn--soft la-btn--icon shrink-0"
          aria-label={listCompact ? t("expandList") : t("minimizeList")}
          title={listCompact ? t("expandList") : t("minimizeList")}
          data-testid="voice-list-toggle"
        >
          {listCompact ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      )}

      {hasList && <WeekSummary scope={scope} accountId={accountId} />}

      <div style={{ flex: 1, minWidth: 8 }} />

      {isOwner && hasList && <ScopeSwitch scope={scope} onScope={onScope} />}

      {hasList && (
        <ExpandingSearch
          value={options.query}
          onChange={(v) => setOptions({ query: v })}
          placeholder={view === "people" ? t("callers.search") : t("search")}
        />
      )}

      {isOwner && scope === "live" && hasList && (accounts.length > 1 || accountId != null) && (
        <AccountFilter accounts={accounts} value={accountId} onChange={onAccount} />
      )}

      {view === "calls" && <VoiceCallsMenus options={options} setOptions={setOptions} languages={languages} />}
      {view === "people" && <PeopleMenus options={peopleOptions} setOptions={setPeopleOptions} />}

      {isOwner && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}
    </div>
  );
}
