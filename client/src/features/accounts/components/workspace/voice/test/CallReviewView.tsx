// The test panel's body after a call, and when a test from the list is opened
// (VoiceTestPanel, phase "review"): the shared call review (features/voiceCalls/review),
// fitted to the Voice tab's sticky column when the panel sits there. "New test" sits
// above it in VoiceTestPanel.
import { CallReviewView as SharedCallReviewView } from "@/features/voiceCalls/review/CallReviewView";
import { useOptionalVoiceTest } from "./VoiceTestProvider";

export function CallReviewView({ callId }: { callId: string }) {
  const column = useOptionalVoiceTest()?.column ?? false;
  return <SharedCallReviewView callId={callId} column={column} />;
}
