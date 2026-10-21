// Caption writer: the prompt for 3 caption options and the parsing of what comes back. Pure, so it is
// tested with a fake model. The style is data (Social_Settings.caption_style, edited by agency), never code.
// Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
import { validateCaption } from "@shared/socialPosts";
import { CAPTION_OPTION_COUNT, TEXT_LIMITS } from "@shared/socialStudio";
import { extractJsonObject } from "../aiTextHelper";

/** claudeJson's shape (server/aiTextHelper.ts), injected so tests never call a model. */
export type AiComplete = (opts: {
  system: string;
  user: string;
  model: "opus" | "sonnet";
  timeoutMs: number;
  jsonSchema?: object;
}) => Promise<{ text: string } | { error: string }>;

export const CAPTION_TIMEOUT_MS = 90_000;

export const CAPTION_SCHEMA = {
  type: "object",
  properties: {
    options: { type: "array", items: { type: "string" }, minItems: CAPTION_OPTION_COUNT, maxItems: CAPTION_OPTION_COUNT },
  },
  required: ["options"],
  additionalProperties: false,
} as const;

/** Accounts store "English" / "Dutch" / "Portuguese" (or a code), as in social/notify.ts. */
export function languageName(language: string | null | undefined): string {
  const l = (language ?? "").trim().toLowerCase();
  if (l.startsWith("pt") || l.startsWith("portug")) return "Brazilian Portuguese";
  if (l.startsWith("nl") || l.startsWith("dutch") || l.startsWith("neder")) return "Dutch";
  return "English";
}

export interface CaptionInput {
  /** The linked script, or what the video is about (typed in the panel). */
  source: { kind: "script" | "about"; text: string };
  captionStyle: string;
  aboutMe: string;
  language: string | null;
}

export function buildCaptionPrompt(input: CaptionInput): { system: string; user: string } {
  const lang = languageName(input.language);
  const parts = [
    "You write Instagram Reel captions for one account.",
    `Write every caption in ${lang}.`,
    `Return exactly ${CAPTION_OPTION_COUNT} different caption options, each one ready to post as it is.`,
    "Follow the account's caption style below exactly: its hook, structure, hashtags, call to action and any disclaimer it uses.",
    "Never promise results. Never make a claim stronger than the video text. Do not invent facts that are not in the video text or the profile.",
    "Do not use em dashes. Each caption stays under 2,200 characters and 30 hashtags.",
    "",
    "## Caption style",
    input.captionStyle.trim() || "(No style saved yet: write a short, sober caption with a question hook, 3 to 5 hashtags and a call to action.)",
  ];
  if (input.aboutMe.trim()) parts.push("", "## About the account holder (facts you may use, and things never to say)", input.aboutMe.trim());
  const label = input.source.kind === "script" ? "The video's script" : "What the video is about";
  const user = [
    `${label}:`,
    "<video>",
    input.source.text.trim().slice(0, TEXT_LIMITS.scriptBody),
    "</video>",
    "",
    `Answer with JSON only: {"options": ["caption 1", "caption 2", "caption 3"]}.`,
  ].join("\n");
  return { system: parts.join("\n"), user };
}

/** Up to 3 usable captions from the model's answer: trimmed, distinct, within Meta's limits. */
export function parseCaptionOptions(text: string): string[] {
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
  const out: string[] = [];
  for (const item of list) {
    if (typeof item !== "string") continue;
    const caption = item.trim();
    if (!caption || out.includes(caption) || !validateCaption(caption).ok) continue;
    out.push(caption);
    if (out.length === CAPTION_OPTION_COUNT) break;
  }
  return out;
}

export type CaptionOutcome = { ok: true; options: string[] } | { ok: false; reason: "no_input" | "ai_failed" | "no_options" };

export async function suggestCaptions(ai: AiComplete, input: CaptionInput): Promise<CaptionOutcome> {
  if (!input.source.text.trim()) return { ok: false, reason: "no_input" };
  const prompt = buildCaptionPrompt(input);
  const answer = await ai({ ...prompt, model: "sonnet", timeoutMs: CAPTION_TIMEOUT_MS, jsonSchema: CAPTION_SCHEMA });
  if ("error" in answer) {
    console.warn(`[social-captions] ${answer.error.slice(0, 200)}`);
    return { ok: false, reason: "ai_failed" };
  }
  const options = parseCaptionOptions(answer.text);
  return options.length ? { ok: true, options } : { ok: false, reason: "no_options" };
}
