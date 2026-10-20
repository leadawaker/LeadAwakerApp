/** Fired when a call is opened while the Calls page is already mounted (its Stats tab links to calls). */
export const OPEN_VOICE_CALL_EVENT = "open-voice-call";

/** Opens one call on the Calls page, using the page's own one-shot hand-off (see VoiceCallsPage consumeCallDeepLink). */
export function openCall(callId: string, setLocation: (to: string) => void): void {
  try { localStorage.setItem("selected-voice-call-id", callId); } catch { /* the page still opens, without the call selected */ }
  setLocation("/platform/voice-calls");
  window.dispatchEvent(new CustomEvent(OPEN_VOICE_CALL_EVENT, { detail: callId }));
}
