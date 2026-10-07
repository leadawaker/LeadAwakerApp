import { useTranslation } from "react-i18next";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import type { VoiceScope } from "../api/voiceCallsApi";
import { VIEWS, type VoiceView } from "../callers";
import type { ListOptions } from "../listOptions";
import { AccountFilter, type AccountOption } from "./AccountFilter";
import { PresentingToggle } from "./PresentingToggle";
import { VoiceCallsMenus } from "./VoiceCallsMenus";

const SCOPES: VoiceScope[] = ["live", "demo"];

interface Props {
  scope: VoiceScope;
  /** Owner only: shows the Live | Demo tabs, the account chip and the Presenting toggle. */
  isOwner: boolean;
  onScope: (s: VoiceScope) => void;
  /** Calls or Callers: shown to everyone with access. */
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

export function VoiceCallsTopbar({ scope, isOwner, onScope, view, onView, options, setOptions, languages, accounts, accountId, onAccount, masked, onTogglePresenting }: Props) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div className="la-page-header" style={{ gap: 12, padding: "0 17px", overflowX: "auto" }}>
      <span className="serif" style={{ fontSize: 20, color: "var(--ink)", letterSpacing: "-0.01em", flexShrink: 0 }}>
        {t("title")}
      </span>

      {isOwner && (
        <div className="la-seg shrink-0" role="tablist" aria-label={t("tabs.aria")} style={{ marginLeft: 4 }}>
          {SCOPES.map((s) => (
            <button
              key={s}
              role="tab"
              aria-selected={scope === s}
              data-testid={`voice-tab-${s}`}
              className={cn("la-seg-btn", scope === s && "on")}
              style={{ padding: "8px 14px", fontSize: 11, letterSpacing: "0.13em" }}
              onClick={() => onScope(s)}
            >
              {t(`tabs.${s}`)}
            </button>
          ))}
        </div>
      )}

      <div className="la-seg shrink-0" role="tablist" aria-label={t("callers.view.aria")}>
        {VIEWS.map((v) => (
          <button
            key={v}
            role="tab"
            aria-selected={view === v}
            data-testid={`voice-view-${v}`}
            className={cn("la-seg-btn", view === v && "on")}
            style={{ padding: "8px 14px", fontSize: 11, letterSpacing: "0.13em" }}
            onClick={() => onView(v)}
          >
            {t(`callers.view.${v}`)}
          </button>
        ))}
      </div>

      <div style={{ flex: 1 }} />

      <div className="hidden md:flex" style={{ alignItems: "center", gap: 6, background: "var(--bg)", borderRadius: "var(--r-surface)", boxShadow: "var(--sh-inset-crisp)", padding: "7px 12px", width: 200, flexShrink: 0 }}>
        <Search size={13} style={{ color: "var(--mute-2)", flexShrink: 0 }} />
        <input
          value={options.query}
          onChange={(e) => setOptions({ query: e.target.value })}
          placeholder={view === "callers" ? t("callers.search") : t("search")}
          aria-label={view === "callers" ? t("callers.search") : t("search")}
          style={{ border: "none", outline: "none", background: "transparent", fontSize: 12.5, color: "var(--ink)", flex: 1, fontFamily: "var(--sans)", minWidth: 0 }}
        />
      </div>

      {isOwner && scope === "live" && (accounts.length > 1 || accountId != null) && (
        <AccountFilter accounts={accounts} value={accountId} onChange={onAccount} />
      )}

      {view === "calls" && <VoiceCallsMenus options={options} setOptions={setOptions} languages={languages} />}

      {isOwner && <PresentingToggle masked={masked} onToggle={onTogglePresenting} />}
    </div>
  );
}
