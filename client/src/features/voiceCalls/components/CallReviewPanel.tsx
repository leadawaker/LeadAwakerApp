// The Calls page's call, as the call review (features/voiceCalls/review), for everyone who
// may open the call: the summary row (duration, reply delays, tools; cost for the Owner),
// the waveform with tool markers and the player (play, skip, speed, zoom, download), then
// the transcript as speaker bubbles with the reply delays and the tools at their moment.
// On top of the review it keeps what the Calls page had: transcript search, the playing
// line kept in view while playing (scrolling by hand pauses that, playing picks it up),
// why a recording is missing (pending, expired, unavailable), booking receipts, and for
// agency the backend delegations as chips. What she understood is the sidebar's summary.
// The server decides what each viewer gets (tool details agency only, cost Owner only).
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useWorkspace } from "@/hooks/useWorkspace";
import type { VoiceCallDetail } from "../api/voiceCallsApi";
import { recordingMayStillCome, recordingMissingKey } from "../recordingNote";
import { useCallReview, useRecording } from "../review/useCallReview";
import { ReviewSummary } from "../review/ReviewSummary";
import { ReviewWaveform } from "../review/ReviewWaveform";
import { ReviewTranscript, type TranscriptExtra } from "../review/ReviewTranscript";
import { ReviewStatusLine, useReviewSeek } from "../review/CallReviewView";
import { countMatches } from "../review/highlight";
import { fallbackTurns } from "../review/fallbackTurns";
import type { CallReview } from "../review/reviewMath";
import { CallEventChip } from "./CallEventChip";
import { TranscriptSearch } from "./TranscriptSearch";

const RECEIPT = {
  alignSelf: "center", maxWidth: "86%", padding: "5px 12px", borderRadius: "var(--r-pill)", fontSize: 12, lineHeight: 1.45,
  color: "var(--ink-soft)", textAlign: "center", overflowWrap: "anywhere",
} as const;

/** Seconds into the recording of a wall-clock moment. */
const offsetS = (iso: string | null, t0: number): number | null => {
  if (!iso) return null;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? null : Math.max(0, (ms - t0) / 1000);
};

/** Lines the review leaves out: booking receipts (written, never spoken) and, for agency, delegations and refusals. */
function extrasOf(call: VoiceCallDetail): TranscriptExtra[] {
  const t0 = new Date(call.recordingStartedAt ?? call.startedAt).getTime();
  const out: TranscriptExtra[] = [];
  for (const turn of call.turns) {
    if (turn.kind !== "receipt" || !turn.content) continue;
    out.push({
      atS: offsetS(turn.createdAt, t0) ?? Number.MAX_SAFE_INTEGER, key: `receipt-${turn.id}`,
      node: <div style={{ display: "flex" }}><span className="neu-inset-super-crisp" style={RECEIPT} data-testid="voice-call-receipt">{turn.content}</span></div>,
    });
  }
  for (const event of call.events ?? []) {
    if (event.kind === "tool") continue; // the review's own tool tags
    out.push({ atS: offsetS(event.startedAt, t0) ?? 0, key: `event-${event.id}`, node: <CallEventChip event={event} /> });
  }
  return out;
}

function ReviewBody({ call, review, processing, mask }: {
  call: VoiceCallDetail; review: CallReview; processing: boolean; mask: ((text: string) => string) | null;
}) {
  const { t } = useTranslation("voiceCalls");
  const { isOwner } = useWorkspace();
  const recording = useRecording(review.recordingUrl, recordingMayStillCome(call.startedAt) ? undefined : 1);
  const { currentS, setCurrentS, seekRef, seek } = useReviewSeek();
  const [follow, setFollow] = useState(true);
  const [query, setQuery] = useState("");

  const turns = useMemo(() => (mask ? review.turns.map((x) => ({ ...x, text: mask(x.text) })) : review.turns), [review.turns, mask]);
  const extras = useMemo(() => extrasOf(call), [call]);
  const matches = useMemo(() => countMatches(turns.map((x) => x.text), query), [turns, query]);
  const speakers = useMemo(() => ({ agent: t("ai"), user: t("caller") }), [t]);
  // A line plays from where it starts, and the list follows it again.
  const playFrom = useCallback((s: number) => { setFollow(true); seek(s, true); }, [seek]);

  return (
    <>
      <div style={{ flexShrink: 0, padding: "16px 20px 14px", borderBottom: "1px solid var(--line)", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ fontSize: 18, fontWeight: 700, color: "var(--ink)", lineHeight: 1, flexShrink: 0 }}>{t("sections.transcript")}</span>
          <div style={{ flex: 1, minWidth: 0, display: "flex", justifyContent: "flex-end" }}>
            <TranscriptSearch query={query} onQuery={setQuery} matches={matches} />
          </div>
        </div>
        <ReviewSummary review={review} showCost={isOwner} />
        <ReviewWaveform review={review} recording={recording} currentS={currentS} onTime={setCurrentS} seekRef={seekRef}
          speakers={speakers} missingNote={t(recordingMissingKey(call.startedAt))} onPlay={() => setFollow(true)} />
      </div>
      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "12px 15px 16px" }}>
        <ReviewTranscript turns={turns} tools={review.tools} currentS={currentS} onSeek={playFrom} column={false} processing={processing}
          query={query} speakers={speakers} extras={extras} fill follow={follow} onUserScroll={() => setFollow(false)} />
      </div>
    </>
  );
}

/**
 * The review request failed: the call's own turns (already loaded with the call) in the same
 * bubbles, under the error and its retry, so nobody sees an empty call. No waveform or tools.
 */
function FallbackTranscript({ call, mask }: { call: VoiceCallDetail; mask: ((text: string) => string) | null }) {
  const { t } = useTranslation("voiceCalls");
  const turns = useMemo(() => {
    const out = fallbackTurns(call);
    return mask ? out.map((x) => ({ ...x, text: mask(x.text) })) : out;
  }, [call, mask]);
  const extras = useMemo(() => extrasOf(call), [call]);
  const speakers = useMemo(() => ({ agent: t("ai"), user: t("caller") }), [t]);
  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", padding: "12px 15px 16px" }} data-testid="voice-call-review-fallback">
      <ReviewTranscript turns={turns} tools={[]} currentS={-1} onSeek={() => {}} column={false}
        speakers={speakers} extras={extras} fill follow={false} />
    </div>
  );
}

export function CallReviewPanel({ call, mask }: {
  call: VoiceCallDetail;
  /** Presenting mode: hides the caller's name and numbers in what they said. */
  mask: ((text: string) => string) | null;
}) {
  const { review, status, retry, processing } = useCallReview(call.callId);
  return (
    <div className="glass" style={{ flex: 1, minWidth: 0, minHeight: 0, borderRadius: "var(--r-card)", overflow: "hidden", display: "flex", flexDirection: "column" }}
      data-testid="voice-call-review" data-call-id={call.callId} data-status={review ? "ready" : status}>
      {review && review.callId === call.callId ? (
        <ReviewBody key={review.callId} call={call} review={review} processing={processing} mask={mask} />
      ) : (
        <>
          <div style={{ padding: "16px 20px", flexShrink: 0 }} aria-live="polite"><ReviewStatusLine status={status} retry={retry} /></div>
          {status === "failed" && <FallbackTranscript call={call} mask={mask} />}
        </>
      )}
    </div>
  );
}
