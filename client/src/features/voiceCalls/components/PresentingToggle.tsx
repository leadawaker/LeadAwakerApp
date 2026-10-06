import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";

/** Owner only: hide or show caller names and numbers while screensharing. */
export function PresentingToggle({ masked, onToggle }: { masked: boolean; onToggle: () => void }) {
  const { t } = useTranslation("voiceCalls");
  const Icon = masked ? EyeOff : Eye;
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={masked}
      aria-label={t("presenting.label")}
      title={t("presenting.tooltip")}
      data-testid="voice-presenting-toggle"
      className={`la-btn la-btn--soft${masked ? " on" : ""}`}
      style={{ height: 32, flexShrink: 0 }}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="hidden lg:inline">{masked ? t("presenting.on") : t("presenting.off")}</span>
    </button>
  );
}
