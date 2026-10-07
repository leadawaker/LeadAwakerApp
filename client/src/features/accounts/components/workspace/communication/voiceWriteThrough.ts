// Wizard -> Voice tab write-through (specs/voice-tab). When the onboarding wizard
// saves, the voice and handoff answers are also sent to PUT /api/accounts/:id/voice
// so the tab and the engine's Voice_Numbers mirrors stay in sync. Never blocks the
// wizard: a failure is logged and the profile save stands on its own.
import { queryClient } from "@/lib/queryClient";
import { E164, normalizePhone, putVoiceLine, voiceLineKey, type AfterHoursMode, type VoiceLinePatch } from "../voice/voiceApi";
import type { ProfileAnswers } from "./profileConstants";

/** The voice fields the wizard collects, or null when the client has no voice service. */
export function buildVoicePatch(answers: ProfileAnswers): VoiceLinePatch | null {
  if (!answers.services.includes("voice")) return null;
  const { voice, handoff } = answers.setup;
  const patch: VoiceLinePatch = {
    agentName: answers.agentName,
    agentNameCustom: answers.agentNameCustom.trim() || null,
    greeting: voice.greeting,
    pronunciation: voice.pronunciation.filter((r) => r.word.trim() && r.sayAs.trim()),
    transferName: handoff.name.trim() || null,
  };
  if (voice.voice) patch.voice = voice.voice;
  if (voice.locale) patch.locale = voice.locale;
  if (voice.afterHours) patch.afterHours = voice.afterHours as AfterHoursMode;
  // The wizard accepts any format ("06 12345678"); the endpoint wants E.164, so
  // only a number that already is one is mirrored. Anything else is left for the tab.
  const transfer = normalizePhone(handoff.number);
  if (E164.test(transfer)) patch.transferNumber = transfer;
  return patch;
}

export async function writeThroughVoice(accountId: number, answers: ProfileAnswers): Promise<void> {
  const patch = buildVoicePatch(answers);
  if (!patch) return;
  try {
    await putVoiceLine(accountId, patch);
    await queryClient.invalidateQueries({ queryKey: voiceLineKey(accountId) });
  } catch (err) {
    console.warn("[voice-tab] wizard write-through failed", err);
  }
}
