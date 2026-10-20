import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { VoiceScope } from "../api/voiceCallsApi";
import type { CallsTab, PeopleOptions } from "../callers";
import { CALLS_TAB_ICON } from "./callsTabs";
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
  /** Stats · People (everyone) · All calls (agency only). */
  tabs: CallsTab[];
  view: CallsTab;
  onView: (v: CallsTab) => void;
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
}

export function VoiceCallsTopbar({ scope, isOwner, onScope, tabs, view, onView, options, setOptions, peopleOptions, setPeopleOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting }: Props) {
  const { t } = useTranslation("voiceCalls");
  const isMobile = useIsMobile(768);
  if (isMobile) {
    return (
      <VoiceCallsMobileTopbar
        scope={scope} isOwner={isOwner} onScope={onScope} tabs={tabs} view={view} onView={onView}
        options={options} setOptions={setOptions} peopleOptions={peopleOptions} setPeopleOptions={setPeopleOptions} languages={languages}
        accounts={accounts} accountId={accountId} onAccount={onAccount}
        masked={masked} onTogglePresenting={onTogglePresenting}
      />
    );
  }
  return (
    <div className="la-page-header" style={{ gap: 12, padding: "0 17px", overflowX: "auto" }}>
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>
        {t("title")}
      </span>

      <div className="la-seg shrink-0" role="tablist" aria-label={t("callers.view.aria")}>
        {tabs.map((v) => {
          const Icon = CALLS_TAB_ICON[v];
          return (
            <button
              key={v}
              role="tab"
              aria-selected={view === v}
              data-testid={`voice-view-${v}`}
              className={cn("la-seg-btn", view === v && "on")}
              style={{ padding: "8px 14px", fontSize: 11, letterSpacing: "0.13em" }}
              onClick={() => onView(v)}
            >
              <Icon size={13} />
              {t(`tabs.${v}`)}
            </button>
          );
        })}
      </div>

      {view !== "stats" && <WeekSummary scope={scope} accountId={accountId} />}

      <div style={{ flex: 1, minWidth: 8 }} />

      {isOwner && view !== "stats" && <ScopeSwitch scope={scope} onScope={onScope} />}

      {view !== "stats" && <div className="hidden md:flex" style={{ alignItems: "center", gap: 6, background: "var(--bg)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", padding: "7px 12px", width: 200, flexShrink: 0 }}>
        <Search size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
        <input
          value={options.query}
          onChange={(e) => setOptions({ query: e.target.value })}
          placeholder={view === "people" ? t("callers.search") : t("search")}
          aria-label={view === "people" ? t("callers.search") : t("search")}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", flex: 1, fontFamily: "var(--sans)", minWidth: 0 }}
        />
      </div>}

      {isOwner && scope === "live" && view !== "stats" && (accounts.length > 1 || accountId != null) && (
        <AccountFilter accounts={accounts} value={accountId} onChange={onAccount} />
      )}

      {view === "calls" && <VoiceCallsMenus options={options} setOptions={setOptions} languages={languages} />}
      {view === "people" && <PeopleMenus options={peopleOptions} setOptions={setPeopleOptions} />}

      {isOwner && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}
    </div>
  );
}
