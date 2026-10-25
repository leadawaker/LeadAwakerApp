// Cover title helper: the prompt for a handful of short title options and the parsing of what comes
// back. Pure, so it is tested with a fake model. Nothing is saved: the person picks one and it lands in
// the title field of the thumbnail form.
import { TITLE_SUGGESTION_COUNT, TITLE_SUGGESTION_MAX_CHARS } from "@shared/socialThumbnails";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { extractJsonObject } from "../aiTextHelper";
import { languageName, type AiComplete } from "./captions";

export const TITLE_TIMEOUT_MS = 60_000;

export const TITLE_SCHEMA = {
  type: "object",
  properties: {
    options: { type: "array", items: { type: "string" }, minItems: TITLE_SUGGESTION_COUNT, maxItems: TITLE_SUGGESTION_COUNT },
  },
  required: ["options"],
  additionalProperties: false,
} as const;

export interface TitleInput {
  /** The script or post caption the cover is for. Empty when the person only typed a hint. */
  context: { kind: "script" | "post"; text: string } | null;
  /** What the person typed: a rough title or an idea. */
  hint: string;
  aboutMe: string;
  language: string | null;
  /** Options shown before: a second round offers different ones. */
  avoid: string[];
}

export function buildTitlePrompt(input: TitleInput): { system: string; user: string } {
  const lang = languageName(input.language);
  const parts = [
    "You write the short text printed on an Instagram Reel cover image.",
    `Write every title in ${lang}.`,
    `Return exactly ${TITLE_SUGGESTION_COUNT} different options. Each is at most ${TITLE_SUGGESTION_MAX_CHARS} characters and about 3 to 6 words.`,
    "A good cover title makes a person curious or names the one thing the video gives them. Vary the angle: a question, a number, a promise, a warning, a plain statement.",
    "Never promise results. Never claim more than the video text says. Do not invent facts that are not in the video text or the profile.",
    "No hashtags, no emojis, no quotation marks, no em dashes, no full stop at the end.",
  ];
  if (input.aboutMe.trim()) parts.push("", "## About the account holder (facts you may use, and things never to say)", input.aboutMe.trim());
  const user: string[] = [];
  if (input.context) {
    user.push(input.context.kind === "script" ? "The video's script:" : "The post's caption:", "<video>", input.context.text.trim().slice(0, TEXT_LIMITS.scriptBody), "</video>", "");
  }
  if (input.hint.trim()) user.push(input.context ? "The person's idea for the title:" : "What the video is about:", input.hint.trim().slice(0, 500), "");
  if (input.avoid.length) user.push("Already offered, so do not repeat these or anything close to them:", ...input.avoid.map((a) => `- ${a}`), "");
  user.push(`Answer with JSON only: {"options": ["title 1", "title 2", "title 3", "title 4", "title 5"]}.`);
  return { system: parts.join("\n"), user: user.join("\n") };
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/** Up to 5 usable titles: trimmed, no quotes or dashes, short enough for a cover, distinct, new. */
export function parseTitleOptions(text: string, avoid: string[] = []): string[] {
  const raw = extractJsonObject(text);
  if (!raw) return [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return [];
  }
  const list = (data as { options?: unknown })?.options;
  if (!Array.isArray(list)) return [];
  const seen = new Set(avoid.map(norm));
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const title = item
      .replace(/\s*[—–]\s*/g, ": ")
      .replace(/^["'“‘]+|["'”’]+$/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/\.$/, "");
    if (!title || title.length > TITLE_SUGGESTION_MAX_CHARS || seen.has(norm(title))) continue;
    seen.add(norm(title));
    out.push(title);
    if (out.length === TITLE_SUGGESTION_COUNT) break;
  }
  return out;
}

export type TitleOutcome = { ok: true; options: string[] } | { ok: false; reason: "no_input" | "ai_failed" | "no_options" };

export async function suggestTitles(ai: AiComplete, input: TitleInput): Promise<TitleOutcome> {
  if (!input.context?.text.trim() && !input.hint.trim()) return { ok: false, reason: "no_input" };
  const answer = await ai({ ...buildTitlePrompt(input), model: "sonnet", timeoutMs: TITLE_TIMEOUT_MS, jsonSchema: TITLE_SCHEMA });
  if ("error" in answer) {
    console.warn(`[social-titles] ${answer.error.slice(0, 200)}`);
    return { ok: false, reason: "ai_failed" };
  }
  const options = parseTitleOptions(answer.text, input.avoid);
  return options.length ? { ok: true, options } : { ok: false, reason: "no_options" };
}
