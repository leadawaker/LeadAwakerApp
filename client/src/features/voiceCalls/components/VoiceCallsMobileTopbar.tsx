import { useTranslation } from "react-i18next";
import { MobileDrawerOption, MobileDrawerSubheading, MobileListHeader, MobileTabSeg } from "@/components/crm/mobile/MobileListHeader";
import type { VoiceScope } from "../api/voiceCallsApi";
import { VOICE_OUTCOMES } from "../api/voiceCallsApi";
import { VIEWS, type VoiceView } from "../callers";
import { GROUPS, SORTS, type ListOptions } from "../listOptions";
import { OUTCOME_LABEL_KEY, VOICE_CALL_STATUSES } from "../status";
import { AccountFilter, type AccountOption } from "./AccountFilter";
import { PresentingToggle } from "./PresentingToggle";

const SCOPES: VoiceScope[] = ["live", "demo"];

interface Props {
  scope: VoiceScope;
  isOwner: boolean;
  onScope: (s: VoiceScope) => void;
  view: VoiceView;
  onView: (v: VoiceView) => void;
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
 * Phone layout of the Voice calls topbar: title + search icon + one settings
 * drawer (Filter / Sort / Group), with the source and view tabs on a second row.
 * Owners also get the Presenting toggle (icon only) on that row, so they can
 * unmask caller names on a phone.
 */
export function VoiceCallsMobileTopbar({ scope, isOwner, onScope, view, onView, options, setOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting }: Props) {
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
      {isOwner && (
        <MobileTabSeg tabs={SCOPES.map((s) => ({ id: s, label: t(`tabs.${s}`) }))} activeId={scope} onChange={onScope} />
      )}
      <MobileTabSeg tabs={VIEWS.map((v) => ({ id: v, label: t(`callers.view.${v}`) }))} activeId={view} onChange={onView} />
      {isOwner && scope === "live" && (accounts.length > 1 || accountId != null) && (
        <AccountFilter accounts={accounts} value={accountId} onChange={onAccount} />
      )}
      {isOwner && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}
    </>
  );

  const searchLabel = view === "callers" ? t("callers.search") : t("search");

  return (
    <MobileListHeader
      title={t("title")}
      searchValue={options.query}
      onSearchChange={(q) => setOptions({ query: q })}
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
