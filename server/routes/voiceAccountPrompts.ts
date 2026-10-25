// Voice tab "Prompt & test": read and autosave the two shared prompts an
// account's line runs on (storage/voiceAccountPrompts.ts). Owner only: these
// rows are shared by every client line in that language.
import type { Express } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { accountIdFor, handleZodError, wrapAsync } from "./_helpers";

const saveSchema = z.object({ promptText: z.string().max(60_000) });

export function registerVoiceAccountPromptRoutes(app: Express) {
  app.get("/api/accounts/:id/voice/prompts", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const line = await storage.getVoiceLine(accountId);
    if (!line) return res.status(404).json({ message: "Account not found" });
    if (!line.locale) return res.json({ locale: null, layer: null, backend: null, eleven: null });
    res.json(await storage.getAccountVoicePrompts(line.locale));
  }));

  app.put("/api/accounts/:id/voice/prompts/:promptId", requireOwner, wrapAsync(async (req, res) => {
    const accountId = accountIdFor(req, res);
    if (accountId == null) return;
    const parsed = saveSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const line = await storage.getVoiceLine(accountId);
    if (!line?.locale) return res.status(404).json({ message: "This line has no language yet" });
    // Only the rows this line runs on: never an arbitrary prompt by id.
    const { layer, backend, eleven } = await storage.getAccountVoicePrompts(line.locale);
    const promptId = Number(req.params.promptId);
    // Decision 2: nothing autosaves to the ElevenLabs prompt; it is edited as a draft and saved to live on purpose.
    if (eleven && promptId === eleven.id) {
      return res.status(400).json({ message: "The ElevenLabs prompt is edited through its draft." });
    }
    if (promptId !== layer?.id && promptId !== backend?.id) {
      return res.status(400).json({ message: "Not a prompt this line uses" });
    }
    const row = await storage.saveVoicePromptText(promptId, parsed.data.promptText, req.user?.email ?? null);
    if (!row) return res.status(404).json({ message: "Prompt not found" });
    res.json(row);
  }));
}
