import { useTranslation } from "react-i18next";
import { ExpandingSearch } from "@/components/crm/primitives";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useListPanelFold } from "@/hooks/useListPanelFold";
import type { VoiceScope } from "../api/voiceCallsApi";
import type { CallsTab, PeopleOptions } from "../callers";
import { CallsListTabs, CallsSettingsButton } from "./CallsPageTabs";
import type { CallsPageView } from "./callsTabs";
import type { ListOptions } from "../listOptions";
import type { AccountFilterProps, AccountOption } from "./AccountFilter";
import { PresentingToggle } from "./PresentingToggle";
import { PeopleMenus, VoiceCallsMenus } from "./VoiceCallsMenus";
import { VoiceCallsMobileTopbar } from "./VoiceCallsMobileTopbar";
import { ScopeSwitch } from "./ScopeSwitch";

interface Props {
  scope: VoiceScope;
  /** Owner only: the Demo tab of the scope switch, the Account filter and the Presenting toggle. */
  isOwner: boolean;
  /** Agency: the scope dropdown (Live | Tests, and Demo for the Owner), directly left of "Call settings". */
  canTest: boolean;
  onScope: (s: VoiceScope) => void;
  /** People · All calls (desktop: right after the title; phones: the second row). */
  tabs: CallsTab[];
  /** A tab, or Settings (the receptionist's settings: no list, so no list controls). */
  view: CallsPageView;
  /** The list tab the "Calls" back button returns to from Settings (People or All calls). */
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
  /** Settings: the spot right after the back button where the receptionist's account picker is placed. */
  onPickerSlot?: (el: HTMLElement | null) => void;
}

export function VoiceCallsTopbar({ scope, isOwner, canTest, onScope, tabs, view, listView, onView, options, setOptions, peopleOptions, setPeopleOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting, onPickerSlot }: Props) {
  const { t } = useTranslation("voiceCalls");
  const isMobile = useIsMobile(768);
  // Below 920px the inboxes show one pane at a time, so there is no list to minimize.
  const singlePane = useIsMobile(920);
  // Settings has no list: search, filters, the scope switch and the list toggle hide.
  const hasList = view !== "settings";
  // The fold button sits on the list panel head (ListPanelFoldButton): minimize / expand, as on the Chats page.
  useListPanelFold(hasList && !singlePane, { mode: "compact" });
  // Owner on Live: "Account" inside the Filter menu (follows the sidebar's account).
  const account: AccountFilterProps | undefined = isOwner && scope === "live" && (accounts.length > 1 || accountId != null)
    ? { accounts, value: accountId, onChange: onAccount }
    : undefined;
  if (isMobile) {
    return (
      <VoiceCallsMobileTopbar
        scope={scope} isOwner={isOwner} canTest={canTest} onScope={onScope} tabs={tabs} view={view} onView={onView}
        options={options} setOptions={setOptions} peopleOptions={peopleOptions} setPeopleOptions={setPeopleOptions} languages={languages}
        listView={listView} account={account}
        masked={masked} onTogglePresenting={onTogglePresenting}
      />
    );
  }
  return (
    <div className="la-page-header" style={{ gap: 12, padding: "0 17px", overflowX: "auto" }}>
      {/* Settings is titled "Call settings" (as Chat settings), with the "Calls" back button after it. */}
      <span className="la-page-title">{view === "settings" ? t("pageTabs.callSettings") : t("title")}</span>
      {view !== "settings" && <CallsListTabs tabs={tabs} view={view} onView={onView} />}

      {/* Settings: the "Calls" back button sits by the title, the account picker right after it. */}
      {view === "settings" && <CallsSettingsButton view={view} listView={listView} onView={onView} />}
      {view === "settings" && onPickerSlot && <span ref={onPickerSlot} style={{ display: "contents" }} data-testid="calls-settings-picker-slot" />}

      <div style={{ flex: 1, minWidth: 8 }} />

      {hasList && (
        <ExpandingSearch
          value={options.query}
          onChange={(v) => setOptions({ query: v })}
          placeholder={view === "people" ? t("callers.search") : t("search")}
        />
      )}

      {view === "calls" && <VoiceCallsMenus options={options} setOptions={setOptions} languages={languages} account={account} />}
      {view === "people" && <PeopleMenus options={peopleOptions} setOptions={setPeopleOptions} account={account} />}

      {isOwner && hasList && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}

      {/* Order: search, list menus, the scope dropdown, then "Call settings" right after it. */}
      {canTest && hasList && <ScopeSwitch scope={scope} onScope={onScope} canDemo={isOwner} canTest={canTest} />}

      {hasList && <CallsSettingsButton view={view} listView={listView} onView={onView} />}
    </div>
  );
}
