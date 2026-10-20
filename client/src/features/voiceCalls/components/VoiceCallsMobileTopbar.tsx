import { useTranslation } from "react-i18next";
import { MobileDrawerOption, MobileDrawerSubheading, MobileListHeader, MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import type { VoiceScope } from "../api/voiceCallsApi";
import { VOICE_OUTCOMES } from "../api/voiceCallsApi";
import type { CallsTab } from "../callers";
import { CALLS_TAB_ICON } from "./callsTabs";
import { GROUPS, SORTS, type ListOptions } from "../listOptions";
import { OUTCOME_LABEL_KEY, VOICE_CALL_STATUSES } from "../status";
import { AccountFilter, type AccountOption } from "./AccountFilter";
import { PresentingToggle } from "./PresentingToggle";
import { ScopeSwitch } from "./ScopeSwitch";

interface Props {
  scope: VoiceScope;
  isOwner: boolean;
  onScope: (s: VoiceScope) => void;
  tabs: CallsTab[];
  view: CallsTab;
  onView: (v: CallsTab) => void;
  options: ListOptions;
  setOptions: (patch: Partial<ListOptions>) => void;
  languages: string[];
  accounts: AccountOption[];
  accountId: number | undefined;
  onAccount: (id: number | undefined) => void;
  masked: boolean;
  onTogglePresenting: () => void;
}

/**
 * Phone layout of the Calls topbar: title + search icon + one settings drawer
 * (Filter / Sort / Group). The second row: the tabs with icons (Stats, People,
 * All calls for the agency), then (Owner) the Live / Demo switch and the
 * Presenting toggle (icon only), so names can be unmasked on a phone.
 * The week numbers live in the Stats tab now, not in the header.
 */
export function VoiceCallsMobileTopbar({ scope, isOwner, onScope, tabs, view, onView, options, setOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting }: Props) {
  const { t } = useTranslation("voiceCalls");
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);
  const filtered = options.outcomes.length > 0 || options.statuses.length > 0 || options.languages.length > 0;
  const isCalls = view === "calls";

  const filterPanel = (
    <>
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
        <MobileDrawerOption label={t("menus.clearFilters")} danger onClick={() => setOptions({ outcomes: [], statuses: [], languages: [] })} />
      )}
    </>
  );

  const sortPanel = SORTS.map((s) => (
    <MobileDrawerOption key={s} label={t(`sort.${s}`)} selected={options.sort === s} onClick={() => setOptions({ sort: s })} />
  ));

  const groupPanel = GROUPS.map((g) => (
    <MobileDrawerOption key={g} label={t(`group.${g}`)} selected={options.group === g} onClick={() => setOptions({ group: g })} />
  ));

  const subRow = (
    <>
      <MobileTabSeg tabs={tabs.map((v) => ({ id: v, label: t(`tabs.${v}`), icon: CALLS_TAB_ICON[v] }))} activeId={view} onChange={onView} />
      {isOwner && view !== "stats" && <ScopeSwitch scope={scope} onScope={onScope} compact />}
      {isOwner && view !== "stats" && scope === "live" && (accounts.length > 1 || accountId != null) && (
        <AccountFilter accounts={accounts} value={accountId} onChange={onAccount} />
      )}
      {isOwner && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}
    </>
  );

  const searchLabel = view === "people" ? t("callers.search") : t("search");
  const hasList = view !== "stats";

  return (
    <MobileListHeader
      title={t("title")}
      searchValue={hasList ? options.query : undefined}
      onSearchChange={hasList ? (q) => setOptions({ query: q }) : undefined}
      searchPlaceholder={searchLabel}
      filterPanel={isCalls ? filterPanel : undefined}
      filterActive={filtered}
      filterLabel={t("menus.filter")}
      sortPanel={isCalls ? sortPanel : undefined}
      sortActive={options.sort !== "recent"}
      sortLabel={t("menus.sort")}
      groupPanel={isCalls ? groupPanel : undefined}
      groupActive={options.group !== "date"}
      groupLabel={t("menus.group")}
      subRow={subRow}
    />
  );
}
