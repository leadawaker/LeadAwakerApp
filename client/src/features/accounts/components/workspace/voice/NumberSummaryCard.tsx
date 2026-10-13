// The number she answers on, read-only. Attaching a number, the client's
// documents and Go live are connections: they live on the Integrations tab.
// This card stays here as the readiness checklist's "number" anchor.
import { useTranslation } from "react-i18next";
import { ArrowRight, Phone } from "lucide-react";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import { NumberStatusChip } from "./NumberCard";
import type { VoiceLine } from "./voiceApi";

export function NumberSummaryCard({ line, onManage }: { line: VoiceLine; onManage?: () => void }) {
  const { t } = useTranslation("voiceTab");
  return (
    <VoiceCardShell card="number" icon={<Phone size={17} />} title={t("number.title")} action={<NumberStatusChip status={line.number?.status ?? "not_set"} />}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: line.number ? "var(--ink)" : "var(--mute)", marginBottom: onManage ? 12 : 0 }}>
        {line.number?.phoneNumber ?? t("number.summaryNone")}
      </div>
      {onManage && (
        <>
          <p style={helpStyle}>{t("number.summaryHelp")}</p>
          <button type="button" className="la-btn la-btn--soft" onClick={onManage} data-testid="voice-number-manage">
            {t("number.summaryManage")} <ArrowRight size={13} />
          </button>
        </>
      )}
    </VoiceCardShell>
  );
}
