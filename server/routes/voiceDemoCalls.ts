// Demos page → a minted voice demo → "Sara calls now" / "Call me + prospect".
// The engine places and bridges the calls (POST /voice/demo-calls); this only
// relays, agency only, with the internal key the browser never sees (like
// voiceElevenTest.ts). In bridge mode the owner's phone comes from Demo_Settings.
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { demoSettings } from "@shared/schema";
import { getEngineUrl, handleZodError, wrapAsync } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import { forgetE164, ownerNumberFrom } from "./demoVoiceSchemas";
import { DEMO_CALL_ID, engineStartBody, relayDemoCall, saraSchema, startDemoCallSchema } from "./voiceDemoCallsRelay";

async function voiceSettings(): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(demoSettings).where(eq(demoSettings.service, "voice")).limit(1);
  return (row?.settings as Record<string, unknown>) || {};
}

function send(res: Response, r: { status: number; body: unknown }) {
  if (r.status === 204) return res.status(204).end();
  return res.status(r.status).json(r.body);
}

const key = () => process.env.INTERNAL_API_KEY || "";

export function registerVoiceDemoCallRoutes(app: Express) {
  app.post("/api/voice/demo-calls", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = startDemoCallSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const to = forgetE164(parsed.data.toNumber);
    if (!to) {
      return res.status(400).json({ message: `Not a phone number: ${parsed.data.toNumber}. Use international format, e.g. +31612345678.` });
    }
    const owner = parsed.data.mode === "bridge" ? ownerNumberFrom(await voiceSettings()) : null;
    const r = await relayDemoCall(getEngineUrl(), "POST", "/voice/demo-calls",
      engineStartBody({ ...parsed.data, toNumber: to }, owner), key());
    send(res, r);
  }));

  app.get("/api/voice/demo-calls/:id", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!DEMO_CALL_ID.test(id)) return res.status(422).json({ message: "Invalid call id" });
    send(res, await relayDemoCall(getEngineUrl(), "GET", `/voice/demo-calls/${id}`, null, key()));
  }));

  app.post("/api/voice/demo-calls/:id/sara", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!DEMO_CALL_ID.test(id)) return res.status(422).json({ message: "Invalid call id" });
    const parsed = saraSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    send(res, await relayDemoCall(getEngineUrl(), "POST", `/voice/demo-calls/${id}/sara`, parsed.data, key()));
  }));

  app.post("/api/voice/demo-calls/:id/end", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const id = String(req.params.id || "");
    if (!DEMO_CALL_ID.test(id)) return res.status(422).json({ message: "Invalid call id" });
    send(res, await relayDemoCall(getEngineUrl(), "POST", `/voice/demo-calls/${id}/end`, {}, key()));
  }));
}
