// "Try her out": one big button that calls this account's line in the
// browser, and the recent test calls folded underneath. The prompts she is
// given are edited (and shown filled in) further down the Prompt & test
// section, so this card is only the call.
import { useVoiceT } from "./voiceGender";
import { Headphones, PhoneCall } from "lucide-react";
import { VoiceCardShell, helpStyle } from "./voiceAtoms";
import type { VoiceLine } from "./voiceApi";
import { TestCallsList } from "./TestCallsList";

/** The /voice-demo link that answers as this account's line. */
function testUrl(line: VoiceLine): string {
  const q = new URLSearchParams({ account: String(line.accountId), start: "1" });
  // Only labels the page before the call; the engine decides the rest.
  if (line.persona?.companyName) q.set("company", line.persona.companyName);
  if (line.locale) q.set("locale", line.locale);
  return `/voice-demo?${q.toString()}`;
}

export function TestCard({ line }: { line: VoiceLine }) {
  const { t } = useVoiceT();
  const canTest = !!line.persona;

  return (
    <VoiceCardShell card="test" icon={<Headphones size={17} />} title={t("test.title")}>
      <a
        href={canTest ? testUrl(line) : undefined}
        target="_blank"
        rel="noopener"
        className="la-btn la-btn--wine"
        aria-disabled={!canTest}
        style={{
          width: "100%", justifyContent: "center", padding: "16px 20px", fontSize: 14,
          ...(canTest ? {} : { opacity: 0.5, pointerEvents: "none" }),
        }}
        data-testid="voice-test-call"
      >
        <PhoneCall size={16} />
        {t("test.call")}
      </a>
      <p style={{ ...helpStyle, margin: "10px 0 0", textAlign: "center" }}>
        {canTest ? t("test.filedNote") : t("test.needsPersona")}
      </p>
      {canTest && <TestCallsList accountId={line.accountId} />}
    </VoiceCardShell>
  );
}
