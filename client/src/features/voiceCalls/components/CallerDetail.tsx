import { useMemo, useState } from "react";
import type { VoiceCaller, VoiceCallListItem } from "../api/voiceCallsApi";
import { callsOfCaller, maskVoiceCaller } from "../callers";
import type { CallerContext } from "./CallSidebar";
import { VoiceCallDetail } from "./VoiceCallDetail";

interface Props {
  caller: VoiceCaller;
  calls: VoiceCallListItem[];
  masked: boolean;
  isOwner: boolean;
}

/**
 * One person: the same call workspace as the Calls view (header, transcript,
 * sidebar), with the caller actions in the header and their call history in
 * the sidebar. Picking a call in the history swaps the transcript; the history
 * stays up while the next call loads.
 */
export function CallerDetail({ caller: rawCaller, calls, masked, isOwner }: Props) {
  const [callId, setCallId] = useState<string>(rawCaller.lastCallId);
  const mine = useMemo(() => callsOfCaller(calls, rawCaller), [calls, rawCaller]);
  const caller = useMemo(() => maskVoiceCaller(rawCaller, masked), [rawCaller, masked]);
  const context: CallerContext = { caller, rawCaller, isOwner, selectedId: callId, calls: mine, onSelectCall: setCallId };

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <VoiceCallDetail callId={callId} masked={masked} caller={context} />
    </div>
  );
}
