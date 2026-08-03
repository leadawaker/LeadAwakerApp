/**
 * Defaults for the call setup form.
 *
 * The engine re-validates model and voice against its own allow-list (see
 * SELECTABLE_MODELS / SELECTABLE_VOICES), so these are a starting point for
 * the UI, never the authority: an unknown model is accepted when the token is
 * minted and only rejected later at the SDP exchange, mid-call.
 */
export const DEFAULT_MODEL = "gpt-realtime-2.1";
export const DEFAULT_VOICE = "marin";
export const DEFAULT_SPEED = 1.0;
