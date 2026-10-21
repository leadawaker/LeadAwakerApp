// Speech to text through Groq Whisper, shared by the Owner's nav-bar voice note
// (/api/user/voice-note/transcribe) and the Socials topic recorder. Never throws.

/** ISO-639-1 hint for Whisper from an account language ("Portuguese", "pt-BR", "Dutch"...). undefined = auto-detect. */
export function whisperLanguage(language: string | null | undefined): string | undefined {
  const l = (language ?? "").trim().toLowerCase();
  if (l.startsWith("pt") || l.startsWith("portug")) return "pt";
  if (l.startsWith("nl") || l.startsWith("dutch") || l.startsWith("neder")) return "nl";
  if (l.startsWith("en")) return "en";
  return undefined;
}

export function audioExtFor(mimeType: string): string {
  const base = mimeType.split(";")[0].trim();
  return base.includes("webm") ? "webm" : base.includes("ogg") ? "ogg" : base.includes("mp4") ? "mp4" : base.includes("wav") ? "wav" : "webm";
}

/** Decodes a base64 or data: URL payload from the browser recorder. */
export function decodeAudioPayload(audioData: string): Buffer {
  return Buffer.from(audioData.replace(/^data:[^,]+,/, ""), "base64");
}

export async function transcribeWithGroq(
  audio: Buffer,
  mimeType: string,
  opts: { language?: string; fetchImpl?: typeof fetch } = {},
): Promise<{ text: string } | { error: string; detail?: string }> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return { error: "NO_GROQ_API_KEY" };
  const mimeBase = (mimeType || "audio/webm").split(";")[0].trim();
  const form = new FormData();
  form.append("file", new File([audio], `recording.${audioExtFor(mimeBase)}`, { type: mimeBase }));
  form.append("model", "whisper-large-v3-turbo");
  form.append("response_format", "json");
  form.append("temperature", "0");
  if (opts.language) form.append("language", opts.language);
  try {
    const res = await (opts.fetchImpl ?? fetch)("https://api.groq.com/openai/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: form,
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return { error: "Transcription failed", detail: (await res.text()).slice(0, 500) };
    const json = (await res.json()) as { text?: string };
    return { text: json.text?.trim() ?? "" };
  } catch (err: any) {
    return { error: err?.name === "TimeoutError" ? "Transcription timed out" : "Transcription failed" };
  }
}
