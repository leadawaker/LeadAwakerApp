import { useTranslation } from "react-i18next";
import { MobileDrawerOption, MobileDrawerSubheading, MobileListHeader } from "@/components/crm/mobile/MobileListHeader";
import type { VoiceScope } from "../api/voiceCallsApi";
import { VOICE_OUTCOMES } from "../api/voiceCallsApi";
import { PEOPLE_GROUPS, PEOPLE_RANGES, PEOPLE_SORTS, peopleFiltered, type CallsTab, type PeopleOptions } from "../callers";
import { CallsListTabs, CallsSettingsButton } from "./CallsPageTabs";
import type { CallsPageView } from "./callsTabs";
import { GROUPS, SORTS, type ListOptions } from "../listOptions";
import { OUTCOME_LABEL_KEY, VOICE_CALL_STATUSES } from "../status";
import { AccountDrawerOptions, type AccountFilterProps } from "./AccountFilter";
import { PresentingDrawerRow } from "./PresentingToggle";
import { ScopeSwitch } from "./ScopeSwitch";

interface Props {
  scope: VoiceScope;
  isOwner: boolean;
  canTest: boolean;
  onScope: (s: VoiceScope) => void;
  tabs: CallsTab[];
  view: CallsPageView;
  /** The list tab the "Calls" back button returns to from Settings. */
  listView: CallsTab;
  onView: (v: CallsPageView) => void;
  options: ListOptions;
  setOptions: (patch: Partial<ListOptions>) => void;
  peopleOptions: PeopleOptions;
  setPeopleOptions: (patch: Partial<PeopleOptions>) => void;
  languages: string[];
  /** Owner on Live: "Account" in the Filter drawer. */
  account?: AccountFilterProps;
  masked: boolean;
  onTogglePresenting: () => void;
}

/**
 * Phone layout of the Calls topbar, laid out like Chats: the title, then the right cluster: (agency) the round
 * Live / Tests (Owner: / Demo) scope menu button beside the round Call settings gear, search and the tools
 * drawer (Filter / Sort / Group; the Owner's Account filter sits in Filter, the Owner's
 * Hide / Show identities row below). The second row: People | All calls.
 * Inside settings: the title "Call settings" and a "← Calls" pill; the account picker keeps
 * its own row above the sections. The week numbers sit at the top of the list itself.
 */
export function VoiceCallsMobileTopbar({ scope, isOwner, canTest, onScope, tabs, view, listView, onView, options, setOptions, peopleOptions, setPeopleOptions, languages, account, masked, onTogglePresenting }: Props) {
  const { t } = useTranslation("voiceCalls");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const accountSet = account?.value != null;
  const filtered = options.outcomes.length > 0 || options.statuses.length > 0 || options.languages.length > 0 || accountSet;
  const accountOptions = account ? <AccountDrawerOptions {...account} /> : null;
  const isCalls = view === "calls";
  // Settings has no list: no search, filters or scope switch.
  const hasList = view !== "settings";

  const filterPanel = (
    <>
      {accountOptions}
      <MobileDrawerSubheading>{t("menus.outcome")}</MobileDrawerSubheading>
      {VOICE_OUTCOMES.map((o) => (
        <MobileDrawerOption key={o} label={t(`outcomes.${OUTCOME_LABEL_KEY[o]}`)} selected={options.outcomes.includes(o)} onClick={() => setOptions({ outcomes: toggle(options.outcomes, o) })} />
      ))}
      <MobileDrawerSubheading>{t("menus.status")}</MobileDrawerSubheading>
      {VOICE_CALL_STATUSES.map((s) => (
        <MobileDrawerOption key={s} label={t(`status.${s}`)} selected={options.statuses.includes(s)} onClick={() => setOptions({ statuses: toggle(options.statuses, s) })} />
      ))}
      {languages.length > 1 && (
        <>
          <MobileDrawerSubheading>{t("menus.language")}</MobileDrawerSubheading>
          {languages.map((l) => (
            <MobileDrawerOption key={l} label={l ? l.toUpperCase() : t("unknownLanguage")} selected={options.languages.includes(l)} onClick={() => setOptions({ languages: toggle(options.languages, l) })} />
          ))}
        </>
      )}
      {filtered && (
        <MobileDrawerOption label={t("menus.clearFilters")} danger onClick={() => { setOptions({ outcomes: [], statuses: [], languages: [] }); if (accountSet) account?.onChange(undefined); }} />
      )}
    </>
  );

  const sortPanel = SORTS.map((s) => (
    <MobileDrawerOption key={s} label={t(`sort.${s}`)} selected={options.sort === s} onClick={() => setOptions({ sort: s })} />
  ));

  const groupPanel = GROUPS.map((g) => (
    <MobileDrawerOption key={g} label={t(`group.${g}`)} selected={options.group === g} onClick={() => setOptions({ group: g })} />
  ));

  const people = peopleOptions;
  const peopleActive = peopleFiltered(people) || accountSet;
  const peopleFilterPanel = (
    <>
      {accountOptions}
      <MobileDrawerSubheading>{t("menus.outcome")}</MobileDrawerSubheading>
      {VOICE_OUTCOMES.map((o) => (
        <MobileDrawerOption key={o} label={t(`outcomes.${OUTCOME_LABEL_KEY[o]}`)} selected={people.outcomes.includes(o)} onClick={() => setPeopleOptions({ outcomes: toggle(people.outcomes, o) })} />
      ))}
      <MobileDrawerSubheading>{t("menus.dateRange")}</MobileDrawerSubheading>
      {PEOPLE_RANGES.map((r) => (
        <MobileDrawerOption key={r} label={t(`range.${r}`)} selected={people.range === r} onClick={() => setPeopleOptions({ range: r })} />
      ))}
      {peopleActive && (
        <MobileDrawerOption label={t("menus.clearFilters")} danger onClick={() => { setPeopleOptions({ outcomes: [], range: "all" }); if (accountSet) account?.onChange(undefined); }} />
      )}
    </>
  );
  const peopleSortPanel = PEOPLE_SORTS.map((s) => (
    <MobileDrawerOption key={s} label={t(`peopleSort.${s}`)} selected={people.sort === s} onClick={() => setPeopleOptions({ sort: s })} />
  ));
  const peopleGroupPanel = PEOPLE_GROUPS.map((g) => (
    <MobileDrawerOption key={g} label={t(`group.${g}`)} selected={people.group === g} onClick={() => setPeopleOptions({ group: g })} />
  ));
  const isPeople = view === "people";

  // Second row: People | All calls (list only; settings has no second row).
  const subRow = hasList && tabs.length > 1 ? <CallsListTabs tabs={tabs} view={view as CallsTab} onView={onView} fill /> : undefined;
  // Owner: the Identities switch as a row in the tools drawer.
  const presentingRow = hasList && isOwner ? <PresentingDrawerRow masked={masked} onToggle={onTogglePresenting} /> : undefined;

  const searchLabel = view === "people" ? t("callers.search") : t("search");

  return (
    <MobileListHeader
      title={hasList ? t("title") : t("pageTabs.callSettings")}
      tabSwitcher={(
        <>
          {hasList && canTest && <ScopeSwitch scope={scope} onScope={onScope} canDemo={isOwner} canTest={canTest} menu />}
          <CallsSettingsButton view={view} listView={listView} onView={onView} />
        </>
      )}
      searchValue={hasList ? options.query : undefined}
      onSearchChange={hasList ? (q) => setOptions({ query: q }) : undefined}
      searchPlaceholder={searchLabel}
      filterPanel={isCalls ? filterPanel : isPeople ? peopleFilterPanel : undefined}
      filterActive={isPeople ? peopleActive : filtered}
      filterLabel={t("menus.filter")}
      sortPanel={isCalls ? sortPanel : isPeople ? peopleSortPanel : undefined}
      sortActive={isPeople ? people.sort !== "latest" : options.sort !== "recent"}
      sortLabel={t("menus.sort")}
      groupPanel={isCalls ? groupPanel : isPeople ? peopleGroupPanel : undefined}
      groupActive={isPeople ? people.group !== "date" : options.group !== "date"}
      groupLabel={t("menus.group")}
      extraActions={presentingRow}
      subRow={subRow}
    />
  );
}
