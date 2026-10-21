import { useTranslation } from "react-i18next";
import { FlaskConical, Radio } from "lucide-react";
import { PillSwitch } from "@/components/crm/primitives/PillSwitch";
import type { VoiceScope } from "../api/voiceCallsApi";

/**
 * Owner only: Live (real calls on client lines) or Demo (calls on the demo
 * personas). The two look nothing alike on purpose, so it is always clear
 * which one is on screen: Live is green with a radio mast and a pulsing dot,
 * Demo is wine with a flask.
 */
export function ScopeSwitch({ scope, onScope, compact }: { scope: VoiceScope; onScope: (s: VoiceScope) => void; compact?: boolean }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <PillSwitch<VoiceScope>
      items={[
        { id: "live", label: t("scope.live"), icon: Radio, color: "var(--good)", dot: true },
        { id: "demo", label: t("scope.demo"), icon: FlaskConical, color: "var(--wine)" },
      ]}
      value={scope}
      onChange={onScope}
      ariaLabel={t("scope.aria")}
      testId="voice-scope-switch"
      itemTestId={(s) => `voice-tab-${s}`}
      compact={compact}
    />
  );
}
