import type { Express, Request, Response } from "express";
import { db } from "../db";
import { users } from "@shared/schema";
import { eq } from "drizzle-orm";
import { encryptApiKey, decryptApiKey } from "../encryption";
import { requireAuth } from "../auth";

export function registerUserSettingsRoutes(app: Express): void {
  // Set Claude API key
  app.post("/api/user/claude-key", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    const { apiKey } = req.body;
    if (!apiKey || typeof apiKey !== "string") {
      return res.status(400).json({ message: "apiKey is required and must be a string" });
    }

    try {
      const encrypted = encryptApiKey(apiKey);
      await db
        .update(users)
        .set({ encryptedClaudeApiKey: encrypted })
        .where(eq(users.id, req.user!.id));

      res.json({ message: "Claude API key saved successfully" });
    } catch (err: any) {
      console.error("[user-settings] Failed to save Claude API key:", err);
      res.status(500).json({ message: "Failed to save API key" });
    }
  });

  // Get Claude API key (returns masked version for verification)
  app.get("/api/user/claude-key", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user!.id),
      });

      if (!user || !user.encryptedClaudeApiKey) {
        return res.json({ hasKey: false, masked: null });
      }

      // Return masked version: first 5 and last 5 chars visible
      const decrypted = decryptApiKey(user.encryptedClaudeApiKey);
      const masked = `${decrypted.slice(0, 5)}...${decrypted.slice(-5)}`;

      res.json({ hasKey: true, masked });
    } catch (err: any) {
      console.error("[user-settings] Failed to get Claude API key:", err);
      res.status(500).json({ message: "Failed to retrieve API key status" });
    }
  });

  // Delete Claude API key
  app.delete("/api/user/claude-key", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    try {
      await db
        .update(users)
        .set({ encryptedClaudeApiKey: null })
        .where(eq(users.id, req.user.id));

      res.json({ message: "Claude API key deleted successfully" });
    } catch (err: any) {
      console.error("[user-settings] Failed to delete Claude API key:", err);
      res.status(500).json({ message: "Failed to delete API key" });
    }
  });

  // Get user's actual Claude API key (internal use only, for making API calls)
  app.get("/api/user/claude-key/internal", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });

    try {
      const user = await db.query.users.findFirst({
        where: eq(users.id, req.user!.id),
      });

      if (!user || !user.encryptedClaudeApiKey) {
        return res.status(404).json({ message: "No API key configured" });
      }

      const decrypted = decryptApiKey(user.encryptedClaudeApiKey);
      res.json({ apiKey: decrypted });
    } catch (err: any) {
      console.error("[user-settings] Failed to retrieve internal Claude API key:", err);
      res.status(500).json({ message: "Failed to retrieve API key" });
    }
  });

  // Transcribe a voice note recorded from the navbar mic (Owner only — personal scratch notes,
  // not tied to a lead/conversation). Reuses the Groq Whisper pattern from leads.ts.
  app.post("/api/user/voice-note/transcribe", requireAuth, async (req: Request, res: Response) => {
    if (!req.user) return res.status(401).json({ message: "Not authenticated" });
    if (req.user.role !== "Owner") return res.status(403).json({ message: "Forbidden" });

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(200).json({ error: "NO_GROQ_API_KEY" });

    const { audio_data, mime_type } = req.body;
    if (!audio_data) return res.status(400).json({ message: "No audio data provided" });

    try {
      const base64Clean = (audio_data as string).replace(/^data:[^,]+,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");

      const rawMime = (mime_type || "audio/webm") as string;
      const mimeBase = rawMime.split(";")[0].trim();
      const ext = mimeBase.includes("webm") ? "webm" : mimeBase.includes("ogg") ? "ogg" : mimeBase.includes("mp4") ? "mp4" : mimeBase.includes("wav") ? "wav" : "webm";

      const file = new File([audioBuffer], `recording.${ext}`, { type: mimeBase });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "json");
      formData.append("temperature", "0");

      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { "Authorization": `Bearer ${apiKey}` },
        body: formData,
      });

      if (!response.ok) {
        const errBody = await response.text();
        console.error("[voice-note/transcribe] Groq error:", errBody);
        return res.status(500).json({ error: "Transcription failed", detail: errBody });
      }

      const json = await response.json() as any;
      const text = json.text?.trim() ?? "";
      return res.json({ transcription: text });
    } catch (err) {
      console.error("[voice-note/transcribe] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  });
}
