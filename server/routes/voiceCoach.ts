// The prompt coach chat (Voice tab, beside the prompt editor). Owner only, like the prompt routes: the
// coach reads the shared ElevenLabs prompt. A turn never writes the draft or the live prompt, it only
// answers and adds change cards (routes/voicePromptDrafts.ts decides what happens to them).
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { accountIdFor, handleZodError, wrapAsync } from "./_helpers";
import { liveCoachDeps, runCoachTurn } from "../voice/coach/runCoach";

const turnBody = z.object({
  message: z.string().trim().min(1).max(4000),
  lang: z.enum(["nl", "en"]),
});

// Accounts with a turn in flight: a turn takes up to 3 minutes, and a second one would answer the same history twice.
const inFlight = new Set<number>();

export function registerVoiceCoachRoutes(app: Express) {
  app.get("/api/accounts/:id/voice/coach", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    res.json({ messages: await storage.listCoachMessages(accountId) });
  }));

  app.post("/api/accounts/:id/voice/coach", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const body = turnBody.safeParse(req.body);
    if (!body.success) return handleZodError(res, body.error);
    if (inFlight.has(accountId)) return res.status(429).json({ message: "The coach is still answering." });
    inFlight.add(accountId);
    try {
      const result = await runCoachTurn(liveCoachDeps(), {
        accountId, lineLanguage: body.data.lang, message: body.data.message, by: req.user?.email ?? null,
      });
      if (result.status === 502) return res.status(502).json({ message: result.message });
      res.json({ messages: result.messages, suggestions: result.suggestions });
    } finally {
      inFlight.delete(accountId);
    }
  }));
}
