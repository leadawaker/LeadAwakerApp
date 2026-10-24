// The account's phone number as a connection: which number she answers on,
// whether it is live, and the client's paperwork for a number of their own.
// What callers hear on the line (recording notice, office sound, region) and
// how she behaves are the Voice tab; this is only the wiring.
import { useVoiceLine } from "./voice/useVoiceLine";
import { NumberCard } from "./voice/NumberCard";
import { NumberDocsCard } from "./voice/NumberDocsCard";
import { VoiceGenderProvider, voiceGender } from "./voice/voiceGender";
import { effectiveVoice } from "./voice/lineEngine";

export function PhoneConnection({ accountId }: { accountId: number }) {
  const { line, saving, save } = useVoiceLine(accountId);
  if (!line) return null;
  return (
    <VoiceGenderProvider value={voiceGender(effectiveVoice(line.voice, line.agentGender))}>
      <NumberCard line={line} canEdit saving={saving} onSave={save} />
      <NumberDocsCard
        accountId={accountId}
        language={line.locale}
        onAttach={(phoneNumber) => save({ phoneNumber })}
      />
    </VoiceGenderProvider>
  );
}
