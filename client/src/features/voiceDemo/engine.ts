export const ENGINE_BASE_URL =
  import.meta.env.VITE_VOICE_ENGINE_URL ?? "https://webhooks.leadawaker.com";

/** The shape of a demo token the engine mints for a prospect's `/voice-demo?token=` link. */
export const DEMO_TOKEN_RE = /^[A-Za-z0-9]{4,64}$/;

/** The page's `?token=` when it is a minted demo token, else null. */
export function demoTokenFromUrl(): string | null {
  if (typeof window === "undefined") return null;
  const token = new URLSearchParams(window.location.search).get("token") || "";
  return DEMO_TOKEN_RE.test(token) ? token : null;
}
