// "Improve with AI" for a script: the text in the editor (saved or not) plus Gabriel's notes go in, a new
// title and body come out. Nothing is saved here: the client keeps every pass as a version and writes
// one only when he presses Save. Pure: request body, prompt and the paragraph clean-up of the answer.
import { TEXT_LIMITS } from "@shared/socialStudio";
import { buildScriptPrompt, parseScriptDraft } from "./scripts";

export const IMPROVE_NOTES_MAX = 4_000;

type Parsed<T> = { ok: true; input: T } | { ok: false; message: string };

export interface ImproveInput { body: string; notes: string; title: string | null }

export function parseImproveBody(raw: unknown): Parsed<ImproveInput> {
  const b = typeof raw === "object" && raw !== null && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
  if (!b) return { ok: false, message: "Body must be an object" };
  const text = (v: unknown) => (typeof v === "string" ? v.replace(/\r\n?/g, "\n").trim() : "");
  if (b.body !== undefined && typeof b.body !== "string") return { ok: false, message: "body must be text" };
  const body = text(b.body);
  if (body.length > TEXT_LIMITS.scriptBody) return { ok: false, message: "body is too long" };
  const notes = text(b.notes);
  if (notes.length > IMPROVE_NOTES_MAX) return { ok: false, message: `notes are at most ${IMPROVE_NOTES_MAX} characters` };
  // The title in the editor may be unsaved too; the saved one is the fallback.
  const title = text(b.title).slice(0, TEXT_LIMITS.scriptTitle) || null;
  return { ok: true, input: { body, notes, title } };
}

export function buildImprovePrompt(input: {
  voiceGuide: string;
  aboutMe: string;
  language: string | null;
  title: string;
  notes: string;
  body: string;
  closesUsed: string[];
}): { system: string; user: string } {
  // Same voice guide, About me and rules as the draft; the notes are Gabriel's, so they are followed.
  const base = buildScriptPrompt({ ...input, notes: "", currentBody: input.body });
  const system = [
    base.system,
    "- Write the body as short spoken paragraphs of one to three sentences, separated by one blank line. Each paragraph is one breath on camera.",
    "- Plain text only in the body: no headings, no bullet points, no markdown, no quotes around it.",
  ].join("\n");
  const task = input.body.trim()
    ? "Improve the current script below. Keep the speaker's meaning and what already works, follow the notes, and return the full new script."
    : "There is no text yet: write the script from the theme and the notes.";
  const user = [
    task,
    input.notes.trim() ? `Notes from Gabriel (follow these):\n<notes>\n${input.notes.trim()}\n</notes>` : "",
    base.user,
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

const SENTENCE_END = /(?<=[.!?…])\s+(?=["“«(¿¡]?[\p{Lu}\d])/u;

/**
 * Spoken paragraphs separated by one blank line, whatever the model sent: CRLF, trailing spaces and
 * runs of blank lines tidied, single line breaks taken as paragraph breaks when there is no blank line
 * at all, one long block split into
 * pairs of sentences, em dashes turned into commas (the voice guide never uses them).
 */
export function normalizeParagraphs(text: string): string {
  const clean = text
    .replace(/\r\n?/g, "\n")
    .replace(/\s*\u2014\s*/g, ", ")
    .split("\n")
    .map((l) => l.replace(/[ \t]+$/g, "").replace(/^[ \t]+/g, ""))
    .join("\n")
    .trim();
  if (!clean) return "";
  // Blank lines present: those are the paragraphs. None: each line is one.
  let paragraphs = (/\n\s*\n/.test(clean) ? clean.split(/\n\s*\n+/) : clean.split("\n")).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 1) {
    const sentences = paragraphs[0].split(SENTENCE_END).filter(Boolean);
    if (sentences.length > 3) {
      paragraphs = [];
      for (let i = 0; i < sentences.length; i += 2) paragraphs.push(sentences.slice(i, i + 2).join(" "));
    }
  }
  return paragraphs.join("\n\n");
}

/** The model's JSON answer with its body in paragraphs; null when there is no usable body. */
export function parseImproveAnswer(text: string): { title: string; body: string } | null {
  const draft = parseScriptDraft(text);
  if (!draft) return null;
  const body = normalizeParagraphs(draft.body);
  if (!body || body.length > TEXT_LIMITS.scriptBody) return null;
  return { title: draft.title, body };
}
