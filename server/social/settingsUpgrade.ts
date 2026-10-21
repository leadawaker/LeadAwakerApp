// "Upgrade with AI" for the caption style and the voice guide (Socials > Settings). Pure: the request
// parsing, which published captions to learn from, how transcripts are trimmed, the prompt and the
// parsing of the answer. Tested with a fake model. Saves nothing: the editor shows the proposal and
// the card's own Save button stores it.
import { TEXT_LIMITS } from "@shared/socialStudio";
import { extractJsonObject } from "../aiTextHelper";
import { languageName } from "./captions";

export const UPGRADE_FIELDS = ["caption_style", "voice_guide"] as const;
export type UpgradeField = (typeof UPGRADE_FIELDS)[number];

export const UPGRADE_TIMEOUT_MS = 150_000;
export const MAX_CAPTIONS = 30;
export const MAX_CAPTION_CHARS = 2_200; // Instagram's own caption limit
export const MAX_NOTES_CHARS = 8_000;
export const MAX_TRANSCRIPTS = 10;
export const MAX_TRANSCRIPT_CHARS = 12_000;
export const MAX_TRANSCRIPTS_TOTAL = 40_000;
export const MAX_CHANGES = 12;

export const limitFor = (field: UpgradeField) => (field === "caption_style" ? TEXT_LIMITS.captionStyle : TEXT_LIMITS.voiceGuide);

export const UPGRADE_SCHEMA = {
  type: "object",
  properties: {
    text: { type: "string" },
    changes: { type: "array", items: { type: "string" }, maxItems: MAX_CHANGES },
  },
  required: ["text", "changes"],
  additionalProperties: false,
} as const;

export interface UpgradeRequest {
  field: UpgradeField;
  currentText: string;
  notes: string;
  useCaptions: boolean;
  transcripts: string[];
  /** The language the change list is written in (the agency user's screen), e.g. "en". */
  uiLanguage: string;
}

export function parseUpgradeBody(body: any): { ok: true; input: UpgradeRequest } | { ok: false; message: string } {
  const field = body?.field;
  if (!(UPGRADE_FIELDS as readonly string[]).includes(field)) return { ok: false, message: "Invalid field" };
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  const currentText = str(body?.currentText);
  if (currentText.length > limitFor(field)) return { ok: false, message: "Current text is too long" };
  const transcripts = Array.isArray(body?.transcripts) ? body.transcripts.filter((t: unknown): t is string => typeof t === "string") : [];
  return {
    ok: true,
    input: {
      field,
      currentText,
      notes: str(body?.notes).slice(0, MAX_NOTES_CHARS),
      useCaptions: body?.useCaptions === true,
      transcripts: trimTranscripts(transcripts),
      uiLanguage: str(body?.uiLanguage).slice(0, 10),
    },
  };
}

/** A caption source row: Social_Insight_Media (what Instagram lists) or a published Social_Posts row. */
export interface CaptionRow { caption: string | null; at: Date | null; igMediaId?: string | null; postId?: number | null }

/**
 * The newest published captions, at most `max`, each cut to Instagram's limit. Instagram's own list
 * comes first; a published CRM post is added only when that list does not already hold it (same
 * post id, or the same text). Empty captions are skipped.
 */
export function selectCaptions(insight: CaptionRow[], posts: CaptionRow[], max = MAX_CAPTIONS): string[] {
  const seenPosts = new Set(insight.map((r) => r.postId).filter((id): id is number => typeof id === "number"));
  const rows = [...insight, ...posts.filter((p) => !(typeof p.postId === "number" && seenPosts.has(p.postId)))];
  rows.sort((a, b) => (b.at?.getTime() ?? 0) - (a.at?.getTime() ?? 0));
  const seenText = new Set<string>();
  const out: string[] = [];
  for (const r of rows) {
    const text = (r.caption ?? "").trim();
    if (!text) continue;
    const key = text.replace(/\s+/g, " ").toLowerCase();
    if (seenText.has(key)) continue;
    seenText.add(key);
    out.push(text.slice(0, MAX_CAPTION_CHARS));
    if (out.length >= max) break;
  }
  return out;
}

/** Non-empty transcripts, each cut to MAX_TRANSCRIPT_CHARS, at most MAX_TRANSCRIPTS and MAX_TRANSCRIPTS_TOTAL in all. */
export function trimTranscripts(list: string[]): string[] {
  const out: string[] = [];
  let total = 0;
  for (const raw of list) {
    if (out.length >= MAX_TRANSCRIPTS) break;
    const t = raw.trim().slice(0, MAX_TRANSCRIPT_CHARS);
    if (!t) continue;
    const room = MAX_TRANSCRIPTS_TOTAL - total;
    if (room <= 0) break;
    const piece = t.slice(0, room);
    out.push(piece);
    total += piece.length;
  }
  return out;
}

export function hasUpgradeInput(input: Pick<UpgradeRequest, "notes" | "transcripts">, captions: string[]): boolean {
  return !!input.notes.trim() || input.transcripts.length > 0 || captions.length > 0;
}

const uiLanguageName = (code: string) => {
  const l = code.toLowerCase();
  return l.startsWith("pt") ? "Brazilian Portuguese" : l.startsWith("nl") ? "Dutch" : "English";
};

const WHAT: Record<UpgradeField, { name: string; purpose: string }> = {
  caption_style: {
    name: "caption style guide",
    purpose: "The caption writer follows it exactly when it writes Instagram captions for this account: hook, structure, length, emojis, hashtags, call to action, disclaimer, words to use and avoid, and a few real captions as examples.",
  },
  voice_guide: {
    name: "voice guide",
    purpose: "The script writer follows it as its instructions for every short video script: how the account holder speaks on camera, rhythm, vocabulary, openings and closes, what he never says.",
  },
};

export function buildUpgradePrompt(input: UpgradeRequest & { captions: string[]; aboutMe: string; accountLanguage: string | null }): { system: string; user: string } {
  const what = WHAT[input.field];
  const limit = limitFor(input.field);
  const fallbackLang = languageName(input.accountLanguage);
  const system = [
    `You improve the ${what.name} of one Instagram account. ${what.purpose}`,
    "Rules:",
    `- The result is still a ${what.name}: instructions for a writer, not a caption or a script itself. Keep its structure and headings where they work.`,
    "- Keep everything in the current text that still applies. Change or remove a part only when the new material shows it is wrong, outdated or contradicted. Add what the new material teaches.",
    "- The new material: the user's notes (highest priority, they are direct instructions), transcripts of the account holder's videos (how he really speaks), and published captions (how the account really writes). Learn patterns; quote at most a few short real examples.",
    `- Write the guide in the language the current text is written in. If the current text is empty, write it in ${fallbackLang}.`,
    `- The whole text must stay under ${limit.toLocaleString("en")} characters. Be concise.`,
    "- Never invent facts about the person (credentials, prices, results). Medical or legal claims stay as careful as the current text.",
    `- "changes": a short list (at most ${MAX_CHANGES} items) of what you added, removed or edited, one plain sentence each, written in ${uiLanguageName(input.uiLanguage)}.`,
    'Answer with JSON only: {"text": "<the full new guide>", "changes": ["..."]}',
  ].join("\n");

  const parts: string[] = [];
  parts.push(`CURRENT ${what.name.toUpperCase()}:\n${input.currentText.trim() || "(empty)"}`);
  if (input.aboutMe.trim()) parts.push(`ABOUT THE ACCOUNT HOLDER (context only, do not copy into the guide):\n${input.aboutMe.trim()}`);
  if (input.notes.trim()) parts.push(`NOTES FROM THE USER:\n${input.notes.trim()}`);
  input.transcripts.forEach((t, i) => parts.push(`VIDEO TRANSCRIPT ${i + 1}:\n${t}`));
  if (input.captions.length) parts.push(`PUBLISHED CAPTIONS (newest first):\n${input.captions.map((c, i) => `[${i + 1}]\n${c}`).join("\n\n")}`);
  parts.push(`Write the improved ${what.name}.`);
  return { system, user: parts.join("\n\n---\n\n") };
}

export type UpgradeAnswer = { ok: true; text: string; changes: string[] } | { ok: false; reason: "no_options" | "too_long" };

export function parseUpgradeAnswer(raw: string, field: UpgradeField): UpgradeAnswer {
  let obj: { text?: unknown; changes?: unknown } | null = null;
  try {
    const json = extractJsonObject(raw);
    obj = json ? JSON.parse(json) : null;
  } catch {
    obj = null;
  }
  const text = typeof obj?.text === "string" ? obj.text.trim() : "";
  if (!text) return { ok: false, reason: "no_options" };
  if (text.length > limitFor(field)) return { ok: false, reason: "too_long" };
  const changes = Array.isArray(obj?.changes)
    ? obj.changes.filter((c): c is string => typeof c === "string" && !!c.trim()).map((c) => c.trim().slice(0, 300)).slice(0, MAX_CHANGES)
    : [];
  return { ok: true, text, changes };
}
