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
  kind: z.enum(["layer", "greeting", "backend"]),
  text: z.string().max(60_000),
  locale: z.string().max(10),
  niche: z.string().max(200).nullable().optional(),
});

export function registerVoicePromptRoutes(app: Express) {
  app.post("/api/voice-prompts/preview", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = previewSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const resp = await fetch(`${ENGINE_BASE}/voice/prompt-preview`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify(parsed.data),
      signal: AbortSignal.timeout(15_000),
    });
    const data = await resp.json().catch(() => ({}));
    if (!resp.ok) return res.status(resp.status === 404 ? 404 : 502).json({ message: data?.detail || "Could not render the preview." });
    res.json(data);
  }));
}
