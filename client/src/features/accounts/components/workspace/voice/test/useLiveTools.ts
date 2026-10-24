// The tools of the live call as rows, for both engines. GPT Live's come straight from its
// hook (pending the moment they start); ElevenLabs' run on the engine and are polled from
// the call's events while it is on. Every row says how many transcript lines existed when
// it fired (`afterLines`) so the transcript can draw it right after them. The polled events
// carry no line position, so that is the line count when the poll first saw the event.
import { useMemo, useRef } from "react";
import { useVoiceTest } from "./VoiceTestProvider";
import { useCallEventsPoll } from "./useCallEventsPoll";
import { eventToTool, type LiveToolRow } from "./liveMetrics";

export function useLiveTools(): LiveToolRow[] {
  const { phase, callEngine, live } = useVoiceTest();
  const running = phase === "live" || phase === "ending";
  const events = useCallEventsPoll(live.callId, callEngine === "elevenlabs" && running);
  const lines = live.transcript.length;
  const seen = useRef<{ callId: string | null; at: Map<number | string, number> }>({ callId: null, at: new Map() });

  return useMemo<LiveToolRow[]>(() => {
    if (callEngine !== "elevenlabs") {
      return live.tools.map((x) => ({
        id: x.id, name: x.name, result: x.result, ms: x.ms, failed: false, pending: x.pending, args: x.args, afterLines: x.afterLines,
      }));
    }
    if (seen.current.callId !== live.callId) seen.current = { callId: live.callId, at: new Map() };
    const at = seen.current.at;
    return events.map((e) => {
      const row = eventToTool(e);
      if (!at.has(row.id)) at.set(row.id, lines);
      return { ...row, args: e.args, afterLines: at.get(row.id) };
    });
  }, [callEngine, events, live.callId, live.tools, lines]);
}
