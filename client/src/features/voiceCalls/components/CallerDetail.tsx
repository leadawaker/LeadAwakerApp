import { useMemo, useState } from "react";
import { useCallerCalls, type VoiceCaller, type VoiceCallListItem, type VoiceScope } from "../api/voiceCallsApi";
import { callsOfCaller, maskVoiceCaller } from "../callers";
import type { CallerContext } from "./CallSidebar";
import { VoiceCallDetail } from "./VoiceCallDetail";

interface Props {
  caller: VoiceCaller;
  calls: VoiceCallListItem[];
  masked: boolean;
  isOwner: boolean;
  scope: VoiceScope;
  accountId?: number;
  /** A call handed over by a link (/go/<code>?call=…): opened instead of the latest one. */
  initialCallId?: string | null;
}

/**
 * One person: the same call workspace as the Calls view (header, transcript,
 * sidebar), with the caller actions in the header and their call history in
 * the sidebar. Picking a call in the history swaps the transcript; the history
 * stays up while the next call loads. The history comes from a per-person
 * query, so it is complete however many calls the account has.
 */
export function CallerDetail({ caller: rawCaller, calls, masked, isOwner, scope, accountId, initialCallId }: Props) {
  const [callId, setCallId] = useState<string>(initialCallId || rawCaller.lastCallId);
  const { data: personCalls } = useCallerCalls(rawCaller, scope, accountId);
  // Until the person's own query lands, show what the loaded list already has.
  const mine = useMemo(() => personCalls ?? callsOfCaller(calls, rawCaller), [personCalls, calls, rawCaller]);
  const caller = useMemo(() => maskVoiceCaller(rawCaller, masked), [rawCaller, masked]);
  const context: CallerContext = { caller, rawCaller, isOwner, selectedId: callId, calls: mine, onSelectCall: setCallId };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <VoiceCallDetail callId={callId} masked={masked} caller={context} />
    </div>
  );
}
