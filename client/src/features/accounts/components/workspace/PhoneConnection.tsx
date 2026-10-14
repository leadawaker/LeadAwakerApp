// The account's phone number as a connection: which number she answers on,
// whether it is live, and the client's paperwork for a number of their own.
// How she behaves on a call is the Phone line tab; this is only the wiring.
import { useVoiceLine } from "./voice/useVoiceLine";
import { NumberCard } from "./voice/NumberCard";
import { NumberDocsCard } from "./voice/NumberDocsCard";
import { RecordingNoticeCard } from "./voice/RecordingNoticeControl";

export function PhoneConnection({ accountId }: { accountId: number }) {
  const { line, saving, save } = useVoiceLine(accountId);
  if (!line) return null;
  return (
    <>
      <NumberCard line={line} canEdit saving={saving} onSave={save} />
      {line.number && <RecordingNoticeCard line={line} saving={saving} onSave={save} />}
      <NumberDocsCard
        accountId={accountId}
        language={line.locale}
        onAttach={(phoneNumber) => save({ phoneNumber })}
      />
    </>
  );
}
