// Missed-Call Text-Back provisioning API — spec: specs/missed-call-textback (Voice service, Tier 1/2).
//
// Configures the whole service from the Accounts → Integrations panel, no Twilio console for the
// client. The engine voice webhook (automations: src/webhooks/twilio_voice_mc_routes.py) reads these
// account fields at call time. Greeting audio is stored as base64 MP3 on the account and served to
// Twilio `<Play>` by the engine's public /webhooks/voice/mc/greeting/{id}.mp3 endpoint.
//
// Browser recordings (webm/opus) and Gemini TTS output (ogg/opus) are NOT playable by Twilio `<Play>`,
// so every greeting source is transcoded to MP3 via the engine's /api/voice/transcode-mp3 before
// storage.
import type { Express, Response } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync, getEngineUrl } from "./_helpers";

// Conditional-forwarding MMI code many EU carriers accept to forward only on no-answer.
// Shown as a copyable hint; carriers vary, so it's a starting point, not a guarantee.
function forwardCode(number: string | null | undefined): string | null {
  if (!number) return null;
  const digits = number.replace(/[^\d+]/g, "");
  return `**61*${digits}#`;
}

function buildStatus(a: any, campaigns: Array<{ id: number; name: string }>) {
  return {
    enabled: !!a.missedCallEnabled,
    number: a.missedCallNumber || null,
    campaignId: a.missedCallCampaignId ?? null,
    greetingMode: a.missedCallGreetingMode || "silent",
    greetingFileName: a.missedCallGreetingFileName || null,
    hasGreeting: !!a.missedCallGreetingAudioData,
    voicemailEnabled: !!a.missedCallVoicemailEnabled,
    forwardCode: forwardCode(a.missedCallNumber),
    campaigns,
  };
}

// The account's missed-call campaigns (the only ones the selector should offer).
async function missedCallCampaigns(accountId: number): Promise<Array<{ id: number; name: string }>> {
  const all = await storage.getCampaignsByAccountId(accountId);
  return all
    .filter((c: any) => (c.campaignType || "") === "missed_call")
    .map((c: any) => ({ id: c.id, name: c.name || `Campaign ${c.id}` }));
}

// Every endpoint replies with the full status (account fields + campaign options),
// so funnel the response + campaign fetch through one place.
async function respondStatus(res: Response, accountId: number, account: any) {
  res.json(buildStatus(account, await missedCallCampaigns(accountId)));
}

// Pipe any audio (data URL or hosted URL) through the engine's ffmpeg transcoder → base64 MP3.
async function transcodeToMp3(input: { audioDataUrl?: string; audioUrl?: string }): Promise<string> {
  const engineRes = await fetch(`${getEngineUrl()}/api/voice/transcode-mp3`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audio_data_url: input.audioDataUrl, audio_url: input.audioUrl }),
  });
  if (!engineRes.ok) {
    const err = await engineRes.text();
    throw new Error(`Transcode failed: ${err.slice(0, 200)}`);
  }
  const result = (await engineRes.json()) as { success: boolean; mp3_base64?: string };
  if (!result.success || !result.mp3_base64) throw new Error("Transcode returned no audio");
  return result.mp3_base64;
}

export function registerMissedCallRoutes(app: Express): void {
  // Status + the account's missed-call campaigns for the selector.
  app.get(
    "/api/accounts/:id/missed-call/status",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });
      await respondStatus(res, id, account);
    }),
  );

  // Save config (everything except the greeting audio, which has its own endpoints).
  app.post(
    "/api/accounts/:id/missed-call",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const b = req.body ?? {};
      const patch: Record<string, unknown> = {};
      if (typeof b.enabled === "boolean") patch.missedCallEnabled = b.enabled;
      if (typeof b.voicemailEnabled === "boolean") patch.missedCallVoicemailEnabled = b.voicemailEnabled;
      if ("number" in b) patch.missedCallNumber = (b.number ?? "").toString().trim() || null;
      if ("campaignId" in b) {
        patch.missedCallCampaignId = b.campaignId == null || b.campaignId === "" ? null : Number(b.campaignId);
      }
      if ("greetingMode" in b && ["silent", "voice"].includes(b.greetingMode)) {
        patch.missedCallGreetingMode = b.greetingMode;
      }

      const updated = await storage.updateAccount(id, patch as any);
      await respondStatus(res, id, updated || account);
    }),
  );

  // Store a greeting from a recorded/uploaded clip. Transcoded to MP3, mode flips to 'voice'.
  app.post(
    "/api/accounts/:id/missed-call/greeting",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const audioDataUrl = (req.body?.audioDataUrl ?? "").toString();
      const fileName = (req.body?.fileName ?? "greeting.mp3").toString();
      if (!audioDataUrl) return res.status(400).json({ message: "audioDataUrl is required" });

      let mp3Base64: string;
      try {
        mp3Base64 = await transcodeToMp3({ audioDataUrl });
      } catch (e: any) {
        return res.status(502).json({ message: e.message || "Could not process audio" });
      }

      const updated = await storage.updateAccount(id, {
        missedCallGreetingAudioData: mp3Base64,
        missedCallGreetingFileName: fileName,
        missedCallGreetingMode: "voice",
      } as any);
      await respondStatus(res, id, updated || account);
    }),
  );

  // Generate a greeting from typed text using the account's cloned voice for that locale.
  app.post(
    "/api/accounts/:id/missed-call/greeting/tts",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });

      const text = (req.body?.text ?? "").toString().trim();
      const locale = (req.body?.locale ?? "nl").toString();
      if (!text) return res.status(400).json({ message: "text is required" });
      if (!["en", "pt", "nl"].includes(locale)) return res.status(400).json({ message: "Invalid locale" });

      const voiceField = { en: "ttsVoiceIdEn", pt: "ttsVoiceIdPt", nl: "ttsVoiceIdNl" }[locale as "en" | "pt" | "nl"];
      const voiceId = (account as any)[voiceField];
      if (!voiceId) return res.status(400).json({ message: `No cloned voice for ${locale}. Clone one in the Voice section first.` });

      // Synthesize (ogg/opus) → transcode to MP3.
      const synthRes = await fetch(`${getEngineUrl()}/api/voice/synthesize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_id: voiceId, text }),
      });
      if (!synthRes.ok) {
        const err = await synthRes.text();
        return res.status(502).json({ message: "Voice synthesis failed", error: err.slice(0, 200) });
      }
      const synth = (await synthRes.json()) as { success: boolean; audio_url?: string; error?: string };
      if (!synth.success || !synth.audio_url) {
        return res.status(400).json({ message: synth.error || "Voice synthesis failed" });
      }

      let mp3Base64: string;
      try {
        mp3Base64 = await transcodeToMp3({ audioUrl: synth.audio_url });
      } catch (e: any) {
        return res.status(502).json({ message: e.message || "Could not process audio" });
      }

      const updated = await storage.updateAccount(id, {
        missedCallGreetingAudioData: mp3Base64,
        missedCallGreetingFileName: `tts-${locale}.mp3`,
        missedCallGreetingMode: "voice",
      } as any);
      await respondStatus(res, id, updated || account);
    }),
  );

  // Remove the greeting (mode falls back to silent).
  app.delete(
    "/api/accounts/:id/missed-call/greeting",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const id = Number(req.params.id);
      const account = await storage.getAccountById(id);
      if (!account) return res.status(404).json({ message: "Account not found" });
      const updated = await storage.updateAccount(id, {
        missedCallGreetingAudioData: null,
        missedCallGreetingFileName: null,
        missedCallGreetingMode: "silent",
      } as any);
      await respondStatus(res, id, updated || account);
    }),
  );

  // Preview the stored greeting MP3 (auth-gated; the engine's public endpoint is for Twilio).
  app.get(
    "/api/accounts/:id/missed-call/greeting.mp3",
    requireAuth,
    requireAgency,
    wrapAsync(async (req, res) => {
      const account = await storage.getAccountById(Number(req.params.id));
      const data = (account as any)?.missedCallGreetingAudioData;
      if (!data) return res.status(404).end();
      const audio = Buffer.from(data, "base64");
      res.setHeader("Content-Type", "audio/mpeg");
      res.setHeader("Cache-Control", "no-store");
      res.send(audio);
    }),
  );
}
