// The number she answers on, read-only. Attaching a number, the client's
// documents and Go live are connections: they live on the Integrations tab.
// This card stays here as the readiness checklist's "number" anchor.
import { useTranslation } from "react-i18next";
import { ArrowRight, Phone } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import { useWorkspace } from "@/hooks/useWorkspace";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import { NumberStatusChip } from "./NumberCard";
import type { VoiceLine } from "./voiceApi";
import { runsOnEleven } from "./lineEngine";

// Matches the status chip beside it (NumberStatusChip): mono, small caps.
const chipStyle = { fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 } as const;

export function NumberSummaryCard({ line, onManage }: { line: VoiceLine; onManage?: () => void }) {
  const { t } = useTranslation("voiceTab");
  const { isAgencyUser } = useWorkspace();
  const purpose = isAgencyUser ? line.number?.purpose : undefined;
  const chips = (
    <span style={{ display: "inline-flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
      {(purpose === "test" || purpose === "demo") && <Pill style={chipStyle} data-testid="voice-line-purpose">{t(`lineEngine.chip.${purpose}`)}</Pill>}
      {isAgencyUser && runsOnEleven(line.number) && <Pill style={chipStyle} data-testid="voice-line-eleven">{t("lineEngine.chip.eleven")}</Pill>}
      <NumberStatusChip status={line.number?.status ?? "not_set"} />
    </span>
  );
  return (
    <VoiceCardShell card="number" icon={<Phone size={17} />} title={t("number.title")} action={chips}>
      <div style={{ fontFamily: "var(--mono)", fontSize: 15, color: line.number ? "var(--ink)" : "var(--mute)", marginBottom: onManage ? 12 : 0 }}>
        {line.number?.phoneNumber ?? t(isAgencyUser ? "number.summaryNone" : "number.summaryNoneClient")}
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
