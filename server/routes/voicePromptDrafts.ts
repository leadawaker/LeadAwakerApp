// The shared ElevenLabs prompt's draft and the change cards (voice call review and
// prompt coach). Owner only: the prompt is shared by every client line in that
// language. "Save to live" is the only route that changes what live calls say.
import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { accountIdFor, handleZodError, wrapAsync } from "./_helpers";
import { draftBodySchema, langQuery } from "./voicePromptDraftsSchemas";

export { draftBodySchema, langQuery };

const DECISION_MESSAGES: Record<"not_found" | "not_proposed" | "stale", string> = {
  not_found: "Suggestion not found",
  not_proposed: "This suggestion was already decided",
  stale: "The text this change targets has moved: the suggestion is out of date",
};

const DRAFT_MISSING = { message: "No ElevenLabs prompt for that language" };

/** The positive integer id in a path segment, or null. */
function idParam(raw: string | undefined): number | null {
  const n = Number(raw);
  return Number.isInteger(n) && n > 0 ? n : null;
}

export function registerVoicePromptDraftRoutes(app: Express) {
  app.get("/api/accounts/:id/voice/eleven-draft", requireOwner, wrapAsync(async (req, res) => {
    if (accountIdFor(req, res) == null) return;
    const lang = langQuery.safeParse(req.query.lang);
    if (!lang.success) return handleZodError(res, lang.error);
    const view = await storage.getElevenDraftView(lang.data);
    if (!view) return res.status(404).json(DRAFT_MISSING);
    res.json(view);
  }));

  app.put("/api/accounts/:id/voice/eleven-draft", requireOwner, wrapAsync(async (req, res) => {
    if (accountIdFor(req, res) == null) return;
    const body = draftBodySchema.safeParse(req.body);
    if (!body.success) return handleZodError(res, body.error);
    const view = await storage.saveElevenDraftText(body.data.lang, body.data.text, req.user?.email ?? null);
    if (!view) return res.status(404).json(DRAFT_MISSING);
    res.json(view);
  }));

  app.delete("/api/accounts/:id/voice/eleven-draft", requireOwner, wrapAsync(async (req, res) => {
    if (accountIdFor(req, res) == null) return;
    const lang = langQuery.safeParse(req.query.lang);
    if (!lang.success) return handleZodError(res, lang.error);
    const view = await storage.discardElevenDraft(lang.data);
    if (!view) return res.status(404).json(DRAFT_MISSING);
    res.json(view);
  }));

  app.post("/api/accounts/:id/voice/eleven-draft/save", requireOwner, wrapAsync(async (req, res) => {
    if (accountIdFor(req, res) == null) return;
    res.json(await storage.saveElevenDraftsToLive(req.user?.email ?? null));
  }));

  app.get("/api/accounts/:id/voice/suggestions", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    res.json(await storage.listVoiceSuggestions(accountId));
  }));

  for (const action of ["accept", "reject"] as const) {
    app.post(`/api/accounts/:id/voice/suggestions/:sid/${action}`, requireOwner, wrapAsync(async (req, res) => {
      const accountId = accountIdFor(req, res);
      if (accountId == null) return;
      const sid = idParam(req.params.sid);
      if (sid == null) return res.status(400).json({ message: "Invalid suggestion id" });
      const by = req.user?.email ?? null;
      const result = action === "accept"
        ? await storage.acceptVoiceSuggestion(accountId, sid, by)
        : await storage.rejectVoiceSuggestion(accountId, sid, by);
      if (result.status === 200) return res.json(result.card);
      res.status(result.status).json({ message: DECISION_MESSAGES[result.reason], reason: result.reason });
    }));
  }
}
