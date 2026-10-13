/** Opens one call on the Voice Calls page, using the page's own one-shot hand-off (see VoiceCallsPage consumeCallDeepLink). */
export function openCall(callId: string, setLocation: (to: string) => void): void {
  try { localStorage.setItem("selected-voice-call-id", callId); } catch { /* the page still opens, without the call selected */ }
  setLocation("/platform/voice-calls");
}
