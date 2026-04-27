import type { Express, Request, Response } from "express";
import twilio from "twilio";
import { storage } from "../storage";
import { broadcast } from "../sse";
import { requireAuth } from "../auth";
import { wrapAsync } from "./_helpers";
import { exec } from "child_process";
import { writeFile, unlink, readFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { pool } from "../db";

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_NL_NUMBER,
  TWILIO_BR_NUMBER,
  TWILIO_APP_SID,
  GROQ_API_KEY,
} = process.env;

function getCallerIdForNumber(to: string): string {
  return to.startsWith("+55") ? (TWILIO_BR_NUMBER ?? "") : (TWILIO_NL_NUMBER ?? "");
}

async function transcribeChannel(
  filePath: string
): Promise<Array<{ start: number; end: number; text: string }>> {
  const audioData = await readFile(filePath);
  const form = new FormData();
  form.append("file", new Blob([audioData], { type: "audio/mpeg" }), "audio.mp3");
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "verbose_json");
  form.append("timestamp_granularities[]", "segment");

  const res = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${GROQ_API_KEY}` },
    body: form,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as { segments?: Array<{ start: number; end: number; text: string }> };
  return (data.segments ?? []).map((s) => ({ start: s.start, end: s.end, text: s.text }));
}

async function generateCallSummary(transcript: string): Promise<string> {
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Summarize this sales call in 2-3 sentences, then list any next steps mentioned.\n\nTranscript:\n${transcript}`,
        },
      ],
    }),
  });
  if (!res.ok) return "";
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return data.choices?.[0]?.message?.content ?? "";
}

async function findInteractionByCallSid(callSid: string) {
  const result = await pool.query(
    `SELECT * FROM p2mxx34fvbf3ll6."Interactions" WHERE twilio_message_sid = $1 LIMIT 1`,
    [callSid]
  );
  return result.rows[0] ?? null;
}

export function registerTwilioVoiceRoutes(app: Express): void {
  // ── Token endpoint (browser client auth) ──────────────────────────
  app.post("/api/twilio/token", requireAuth, wrapAsync(async (_req, res) => {
    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_APP_SID) {
      return res.status(503).json({ error: "Twilio voice not configured" });
    }
    const token = new (twilio.jwt.AccessToken)(
      TWILIO_ACCOUNT_SID,
      TWILIO_ACCOUNT_SID,
      TWILIO_AUTH_TOKEN,
      { identity: "agent", ttl: 3600 }
    );
    const voiceGrant = new (twilio.jwt.AccessToken.VoiceGrant)({
      outgoingApplicationSid: TWILIO_APP_SID,
      incomingAllow: false,
    });
    token.addGrant(voiceGrant);
    res.json({ token: token.toJwt(), expiresAt: Date.now() + 3600 * 1000 });
  }));

  // ── TwiML endpoint (Twilio calls this when browser places a call) ──
  app.post("/api/twilio/voice", (req: Request, res: Response) => {
    const to: string = req.body?.To ?? "";
    const prospectId: string = req.body?.ProspectId ?? "";
    if (!to) {
      res.type("text/xml").send(`<Response><Say>No destination number.</Say></Response>`);
      return;
    }
    const callerId = getCallerIdForNumber(to);
    // Embed ProspectId in status callback URL — Twilio doesn't forward custom SDK params to webhooks
    const statusCbBase = "/api/twilio/call-status";
    const statusCb = prospectId ? `${statusCbBase}?ProspectId=${encodeURIComponent(prospectId)}` : statusCbBase;
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Dial callerId="${callerId}"
        record="record-from-answer-dual-channel"
        recordingStatusCallback="/api/twilio/recording-ready"
        recordingStatusCallbackMethod="POST">
    <Number statusCallbackEvent="completed" statusCallback="${statusCb}" statusCallbackMethod="POST">${to}</Number>
  </Dial>
</Response>`;
    res.type("text/xml").send(twiml);
  });

  // ── Call status webhook (fired when call ends) ─────────────────────
  app.post("/api/twilio/call-status", wrapAsync(async (req, res) => {
    const { CallSid, To, From, CallDuration, CallStatus } = req.body ?? {};
    // ProspectId is passed as a query param (custom SDK params not forwarded by Twilio)
    const prospectId = req.query.ProspectId ? parseInt(req.query.ProspectId as string, 10) : null;

    const duration = parseInt(CallDuration ?? "0", 10);
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    const label = `Call (${mins > 0 ? `${mins}m ` : ""}${secs}s)`;

    if (prospectId) {
      const interaction = await storage.createInteraction({
        type: "call",
        direction: "outbound",
        status: CallStatus === "completed" ? "delivered" : CallStatus,
        content: label,
        fromNumber: From ?? "",
        toNumber: To ?? "",
        twilioMessageSid: CallSid,
        prospectId,
        accountsId: 1,
        metadata: { duration_seconds: duration, call_status: CallStatus },
      } as any);
      broadcast(1, "new_interaction", interaction);
    }

    res.sendStatus(204);
  }));

  // ── Recording ready webhook (splits stereo, transcribes, summarises) ─
  app.post("/api/twilio/recording-ready", wrapAsync(async (req, res) => {
    const { RecordingUrl, CallSid } = req.body ?? {};
    if (!RecordingUrl || !CallSid || !GROQ_API_KEY) return res.sendStatus(204);

    res.sendStatus(204); // Respond to Twilio immediately; process async

    const tmpBase = join(tmpdir(), `call-${CallSid}`);
    const fullFile = `${tmpBase}.mp3`;
    const ch0File = `${tmpBase}-you.mp3`;
    const ch1File = `${tmpBase}-prospect.mp3`;

    try {
      // 1. Download dual-channel MP3
      const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
      const audioRes = await fetch(`${RecordingUrl}.mp3`, {
        headers: { Authorization: `Basic ${auth}` },
      });
      if (!audioRes.ok) return;
      await writeFile(fullFile, Buffer.from(await audioRes.arrayBuffer()));

      // 2. Split stereo into two mono files (ch0 = agent, ch1 = prospect)
      await new Promise<void>((resolve, reject) => {
        exec(
          `ffmpeg -y -i "${fullFile}" -map_channel 0.0.0 "${ch0File}" -map_channel 0.0.1 "${ch1File}"`,
          (err) => (err ? reject(err) : resolve())
        );
      });
      await unlink(fullFile).catch(() => {});

      // 3. Transcribe both channels concurrently
      const [youSegs, prospectSegs] = await Promise.all([
        transcribeChannel(ch0File),
        transcribeChannel(ch1File),
      ]);
      await Promise.all([unlink(ch0File), unlink(ch1File)].map((p) => p.catch(() => {})));

      // 4. Interleave by start time with speaker labels
      const interleaved = [
        ...youSegs.map((s) => ({ ...s, speaker: "You" })),
        ...prospectSegs.map((s) => ({ ...s, speaker: "Prospect" })),
      ]
        .sort((a, b) => a.start - b.start)
        .filter((s) => s.text.trim());
      const transcript = interleaved.map((s) => `${s.speaker}: ${s.text.trim()}`).join("\n");

      if (!transcript) return;

      // 5. Generate AI summary
      const summary = await generateCallSummary(transcript);

      // 6. Find interaction by CallSid (direct query — avoids loading all rows)
      const existing = await findInteractionByCallSid(CallSid);
      if (existing?.id) {
        await storage.updateInteraction(existing.id, {
          content: transcript,
          metadata: { ...(existing.metadata ?? {}), transcript, summary },
        } as any);
        broadcast(1, "interaction_updated", {
          id: existing.id,
          content: transcript,
          metadata: { ...(existing.metadata ?? {}), transcript, summary },
        });
      }
    } catch (err) {
      console.error("[twilio/recording] processing failed:", err);
      // Clean up any temp files that might remain
      await Promise.all([fullFile, ch0File, ch1File].map((f) => unlink(f).catch(() => {})));
    }
  }));
}
