// The homepage visitor's country, as Cloudflare saw it. The engine picks the
// public demo's voice by it (public_demo_voice.visitor_voice): a UK visitor
// hears Frank in British English, everyone else Sara.

/**
 * Cloudflare's cf-ipcountry as a two-letter code, or null. "XX" (unknown) and
 * "T1" (Tor) say nothing about where the visitor is.
 */
export function visitorCountry(req: { headers: Record<string, string | string[] | undefined> }): string | null {
  const header = req.headers["cf-ipcountry"];
  const raw = String(Array.isArray(header) ? header[0] : header || "").trim().toUpperCase();
  return /^[A-Z]{2}$/.test(raw) && raw !== "XX" ? raw : null;
}
