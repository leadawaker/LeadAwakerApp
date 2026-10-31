// Prompt editor → preview of a voice prompt as one Client's call receives it.
//
// The engine renders it (POST /voice/prompt-preview) with the same builder a
// real call uses, so the preview cannot drift from what she hears. This only
// relays, agency only, with the internal key the browser never sees.
import type { Express, Request, Response } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";

const previewSchema = z.object({
  // eleven: the read-only prompt ElevenLabs gets for lineId (needs accountId too).
  kind: z.enum(["layer", "greeting", "backend", "eleven"]),
  // "" renders the saved prompt (the Voice tab's "What she is told").
  text: z.string().max(60_000).default(""),
  locale: z.string().max(10).default("en-GB"),
  niche: z.string().max(200).nullable().optional(),
  // Instead of niche: that account's line, in its own locale.
  accountId: z.number().int().positive().optional(),
  // kind "eleven": the Voice_Numbers row, which must be accountId's own (the engine 404s otherwise).
  lineId: z.number().int().positive().optional(),
  // kind "layer": the voice layer calls run on (voice_lean_layer_*), with its compact stock lines.
  leanLayer: z.boolean().optional(),
  // kind "backend": `text` is the backend's skeleton (voice_backend_layer), not the business prompt.
  backendLayer: z.boolean().optional(),
  // kind "layer" or "backend": also return `marked`, the text with each filled-in value wrapped, for the editor's highlights.
  mark: z.boolean().optional(),
});

export function registerVoicePromptRoutes(app: Express) {
  app.post("/api/voice-prompts/preview", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const resp = await fetch(`${ENGINE_BASE}/voice/prompt-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify({
        ...parsed.data, accountId: undefined, account_id: parsed.data.accountId, lineId: undefined, line_id: parsed.data.lineId,
        leanLayer: undefined, lean_layer: parsed.data.leanLayer ?? false,
        backendLayer: undefined, backend_layer: parsed.data.backendLayer ?? false,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      // The engine's own sentence for a missing line (404), a missing client or persona (409) or ids (422).
      const status = [404, 409, 422].includes(resp.status) ? resp.status : 502;
      const detail = (data as { detail?: unknown })?.detail;
      return res.status(status).json({ message: typeof detail === "string" && detail ? detail : "Could not render the preview." });
    }
    res.json(data);
  }));
}
