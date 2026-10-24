// The call review as the test panel shows it, modelled on ElevenLabs' call view: the
// summary row, the waveform with tool markers and the player, what she understood, then
// the transcript in call order. Clicking a marker or a transcript line seeks the
// recording. `column`: the test panel sits in the Voice tab's sticky column (the
// transcript then fits the column's height). The Calls page lays the same parts out in
// its own panel (voiceCalls/components/CallReviewPanel).
import { useCallback, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCallReview, useRecording, type ReviewStatus } from "./useCallReview";
import { ReviewSummary } from "./ReviewSummary";
import { ReviewWaveform, type SeekRef } from "./ReviewWaveform";
import { ReviewTranscript } from "./ReviewTranscript";
import { UnderstoodCard } from "./UnderstoodCard";
import { VOICE_OUTCOMES, type VoiceOutcome } from "@/features/voiceCalls/api/voiceCallsApi";
import type { CallReview } from "./reviewMath";

const box = { borderRadius: "var(--r-card)", padding: 12, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 } as const;
const help = { fontSize: 12.5, color: "var(--mute)", margin: 0, lineHeight: 1.5 } as const;

export const outcomeOf = (v: string | null | undefined): VoiceOutcome | null => VOICE_OUTCOMES.find((o) => o === v) ?? null;

/** Seek state shared by the waveform and the transcript: with audio the player seeks (and reports the time back); without, the cursor just moves. */
export function useReviewSeek() {
  const [currentS, setCurrentS] = useState(0);
  const seekRef: SeekRef = useRef<((s: number, play?: boolean) => void) | null>(null);
  const seek = useCallback((s: number, play = false) => {
    if (seekRef.current) seekRef.current(s, play);
    else setCurrentS(Math.max(0, s));
  }, []);
  return { currentS, setCurrentS, seekRef, seek };
}

function ReviewBody({ review, column, processing }: { review: CallReview; column: boolean; processing: boolean }) {
  const { t } = useTranslation("voiceTab");
  const recording = useRecording(review.recordingUrl);
  const { currentS, setCurrentS, seekRef, seek } = useReviewSeek();

  return (
    <div className="neu-inset-crisp" style={box} data-testid="voice-test-review" data-call-id={review.callId}>
      <ReviewSummary review={review} />
      <ReviewWaveform review={review} recording={recording} currentS={currentS} onTime={setCurrentS} seekRef={seekRef} />
      <UnderstoodCard emptyKey="emptyReview" data={{
        intents: review.recap?.intents ?? [], interests: review.recap?.interests ?? [], notes: review.recap?.notes ?? [],
        outcome: outcomeOf(review.recap?.outcome),
      }} />
      <section style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
        <span className="eyebrow eyebrow-sm">{t("test.panel.review.transcript")}</span>
        <ReviewTranscript turns={review.turns} tools={review.tools} currentS={currentS} onSeek={seek} column={column} processing={processing} />
      </section>
    </div>
  );
}

/** Loading, waiting for the call to be written, or failed (with a retry). */
export function ReviewStatusLine({ status, retry }: { status: ReviewStatus; retry: () => void }) {
  const { t } = useTranslation("voiceTab");
  return status === "failed" ? (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
      <p style={{ ...help, color: "hsl(var(--destructive))" }} role="alert">{t("test.panel.review.failed")}</p>
      <button type="button" className="la-btn la-btn--soft" onClick={retry}>{t("test.panel.review.retry")}</button>
    </div>
  ) : (
    <p style={{ ...help, display: "flex", alignItems: "center", gap: 8 }}>
      <Loader2 size={13} className="animate-spin" />
      {t(status === "waiting" ? "test.panel.review.waiting" : "test.panel.review.loading")}
    </p>
  );
}

export function CallReviewView({ callId, column = false }: { callId: string; column?: boolean }) {
  const { review, status, retry, processing } = useCallReview(callId);

  if (review) return <ReviewBody key={review.callId} review={review} column={column} processing={processing} />;

  return (
    <div className="neu-inset-crisp" style={box} data-testid="voice-test-review" data-call-id={callId} data-status={status} aria-live="polite">
      <ReviewStatusLine status={status} retry={retry} />
    </div>
  );
}
