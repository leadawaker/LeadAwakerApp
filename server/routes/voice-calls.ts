import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { wrapAsync } from "./_helpers";

// Owner-only, like Demos: every row is a prospect who tried the voice demo.
export function registerVoiceCallsRoutes(app: Express): void {
  app.get("/api/voice-calls", requireOwner, wrapAsync(async (req, res) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 200);
    const offset = Math.max(Number(req.query.offset) || 0, 0);
    const calls = await storage.listVoiceCalls({ limit, offset });
    res.json({ calls });
  }));

  app.get("/api/voice-calls/:callId", requireOwner, wrapAsync(async (req, res) => {
    const call = await storage.getVoiceCall(String(req.params.callId));
    if (!call) return res.status(404).json({ message: "Call not found" });
    res.json(call);
  }));
}
