import type { Express } from "express";
import { requireAuth } from "../auth";
import { accountIdFor, getEngineUrl, wrapAsync } from "./_helpers";

// The after-call WhatsApp an account's callers get (Voice tab, Follow-up card).
// The words and the link live in the engine (voice/after_call_followup.py
// COPY + _booking_link); this only proxies its preview so the card shows the
// exact text and can never drift from what is sent.
export function registerVoiceFollowUpPreviewRoutes(app: Express): void {
  app.get("/api/accounts/:id/voice/follow-up-preview", requireAuth, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    try {
      const resp = await fetch(`${getEngineUrl()}/voice/phone/followup/preview?account_id=${accountId}`, {
        headers: { "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
        signal: AbortSignal.timeout(10_000),
      });
      const data = await resp.json().catch(() => ({}));
      if (!resp.ok) return res.status(resp.status === 404 ? 404 : 502).json({ message: (data as { detail?: string }).detail || `engine ${resp.status}` });
      res.json(data);
    } catch (err) {
      res.status(502).json({ message: err instanceof Error ? err.message : String(err) });
    }
  }));
}
