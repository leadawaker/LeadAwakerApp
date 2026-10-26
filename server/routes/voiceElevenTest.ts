// Voice tab → "Test ElevenLabs in the browser": the engine sets up the call a
// phone call on this demo or test line gets and mints a WebRTC token; the
// browser then talks to ElevenLabs directly. This only relays, agency only,
// with the internal key the browser never sees (like voicePrompts.ts).
import type { Express, Request, Response } from "express";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import { CONVERSATION_ID, elevenTestSchema, relayToEngine, releaseSchema, startedSchema } from "./voiceElevenTestRelay";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { demoSettings } from "@shared/schema";

const ENGINE_BASE = process.env.ENGINE_URL || "http://localhost:8100";

/** The first enabled engine-test number on the Demos page: the tester's own phone,
 * so caller memory and bookings behave as when they ring the line. */
async function testerNumber(): Promise<string | null> {
  const [row] = await db.select().from(demoSettings).where(eq(demoSettings.service, "voice")).limit(1);
  const tests = (row?.settings as { engineTests?: { number?: string; enabled?: boolean }[] } | undefined)?.engineTests;
  const hit = Array.isArray(tests) ? tests.find((t) => t?.enabled !== false && typeof t?.number === "string") : undefined;
  return hit?.number ?? null;
}

function send(res: Response, r: { status: number; body: unknown }) {
  if (r.status === 204) return res.status(204).end();
  return res.status(r.status).json(r.body);
}

export function registerVoiceElevenTestRoutes(app: Express) {
  app.post("/api/voice/eleven-test", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = elevenTestSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const { accountId, lineId, callerNumber } = parsed.data;
    const r = await relayToEngine(ENGINE_BASE, "/voice/eleven/browser-session",
      { account_id: accountId, line_id: lineId, caller_number: callerNumber ?? await testerNumber(),
        draft: parsed.data.draft === true },
      process.env.INTERNAL_API_KEY || "");
    send(res, r);
  }));

  app.post("/api/voice/eleven-test/:conversationId/started", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = String(req.params.conversationId || "");
    if (!CONVERSATION_ID.test(id)) return res.status(422).json({ message: "Invalid conversation id" });
    const parsed = startedSchema.safeParse(req.body ?? {});
    if (!parsed.success) return handleZodError(res, parsed.error);
    const r = await relayToEngine(ENGINE_BASE, `/voice/eleven/browser-session/${id}/started`,
      { conversation_id: parsed.data.conversationId ?? null },
      process.env.INTERNAL_API_KEY || "");
    send(res, r);
  }));

  // The browser failed to connect, or was hung up while connecting: free the engine's slot
  // now (it only frees a session that never started). Fire and forget from the client.
  app.post("/api/voice/eleven-test/:conversationId/release", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = String(req.params.conversationId || "");
    if (!CONVERSATION_ID.test(id)) return res.status(422).json({ message: "Invalid conversation id" });
    const parsed = releaseSchema.safeParse(req.body ?? {});
    if (!parsed.success) return handleZodError(res, parsed.error);
    const r = await relayToEngine(ENGINE_BASE, `/voice/eleven/browser-session/${id}/release`,
      { account_id: parsed.data.accountId },
      process.env.INTERNAL_API_KEY || "");
    send(res, r);
  }));
}
