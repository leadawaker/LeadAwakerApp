import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

/** Owner only: hide or show caller names and numbers while screensharing. Icon only (eye). */
export function PresentingToggle({ masked, onToggle }: { masked: boolean; onToggle: () => void }) {
  const { t } = useTranslation("voiceCalls");
  const Icon = masked ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={masked}
      aria-label={`${t("presenting.label")}: ${masked ? t("presenting.on") : t("presenting.off")}`}
      title={t("presenting.tooltip")}
      data-testid="voice-presenting-toggle"
      className={`la-btn la-btn--soft la-btn--icon shrink-0${masked ? " on" : ""}`}
    >
      <Icon className="h-4 w-4 shrink-0" />
    </button>
  );
}

/**
 * Phones: the same switch as a row inside the header's tools drawer (Calls and Chats), Owner only.
 * The label says what a tap does: "Hide identities" while shown, "Show identities" while hidden.
 */
export function PresentingDrawerRow({ masked, onToggle, testId = "voice-presenting-toggle" }: { masked: boolean; onToggle: () => void; testId?: string }) {
  const { t } = useTranslation("voiceCalls");
  const Icon = masked ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={masked}
      data-testid={testId}
      className="row"
      style={{
        width: "100%", gap: 10, alignItems: "center", padding: "12px 4px", border: "none", cursor: "pointer",
        background: "transparent", borderTop: "1px solid var(--line)", textAlign: "left",
      }}
    >
      <Icon size={15} style={{ color: masked ? "var(--wine)" : "var(--mute)", flexShrink: 0 }} />
      <span style={{ fontSize: 14, fontWeight: 600, color: masked ? "var(--wine)" : "var(--ink)" }}>
        {masked ? t("presenting.show") : t("presenting.hide")}
      </span>
    </button>
  );
}
