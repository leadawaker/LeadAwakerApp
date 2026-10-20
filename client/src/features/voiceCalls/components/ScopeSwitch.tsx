import { useTranslation } from "react-i18next";
import { FlaskConical, Radio, type LucideIcon } from "lucide-react";
import type { VoiceScope } from "../api/voiceCallsApi";

/**
 * Owner only: Live (real calls on client lines) or Demo (calls on the demo
 * personas). The two look nothing alike on purpose, so it is always clear
 * which one is on screen: Live is green with a radio mast and a pulsing dot,
 * Demo is wine with a flask.
 */
const LOOK: Record<VoiceScope, { Icon: LucideIcon; color: string }> = {
  live: { Icon: Radio, color: "var(--good)" },
  demo: { Icon: FlaskConical, color: "var(--wine)" },
};

const SCOPES: VoiceScope[] = ["live", "demo"];

export function ScopeSwitch({ scope, onScope, compact }: { scope: VoiceScope; onScope: (s: VoiceScope) => void; compact?: boolean }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <div
      role="tablist"
      aria-label={t("tabs.aria")}
      data-testid="voice-scope-switch"
      style={{ display: "inline-flex", alignItems: "center", gap: 3, padding: 3, borderRadius: "var(--r-pill)", background: "var(--bg)", boxShadow: "var(--sh-inset-super-crisp)", flexShrink: 0 }}
    >
      {SCOPES.map((s) => {
        const on = scope === s;
        const { Icon, color } = LOOK[s];
        return (
          <button
            key={s}
            type="button"
            role="tab"
            aria-selected={on}
            data-testid={`voice-tab-${s}`}
            onClick={() => onScope(s)}
            style={{
              display: "inline-flex", alignItems: "center", gap: 6, border: "none", cursor: "pointer",
              height: compact ? 30 : 32, padding: compact ? "0 11px" : "0 13px", borderRadius: "var(--r-pill)",
              fontFamily: "var(--sans)", fontSize: 12.5, fontWeight: on ? 700 : 600,
              background: on ? `color-mix(in srgb, ${color} 14%, var(--card))` : "transparent",
              color: on ? color : "var(--mute)",
              boxShadow: on ? `inset 0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)` : "none",
              transition: "background 130ms, color 130ms",
            }}
          >
            <Icon size={14} style={{ flexShrink: 0 }} />
            {t(`tabs.${s}`)}
            {s === "live" && on && (
              <span aria-hidden="true" className="animate-pulse" style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0 }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
