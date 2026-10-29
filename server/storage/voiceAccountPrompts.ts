/**
 * The two shared voice prompts an account's line runs on, for the Voice tab's
 * "Prompt & test" section (specs/call-costs follow-up, 2026-10-15).
 *
 * Which row a call uses is the engine's choice, mirrored here:
 * - Voice layer: the active `voice_layer_{locale}` row, newest updated_at first
 *   (engine voice_prompt_store.refresh); `voice_lean_layer_{locale}` the same way,
 *   used unless the account's testPrompt is "standard" (no lean row for pt).
 * - Backend: `voice_receptionist_demo[_{lang}]`, campaign 60 first, else
 *   account 52, newest created_at first, NULLs first like Postgres DESC
 *   (engine realtime_voice_routes._load_prompt_row).
 * Both are shared by every client line in that language: editing one edits all.
 */
import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { promptLibrary, promptVersions } from "@shared/schema";
import type { PromptLang } from "@shared/voiceReview";
import { localeLanguage, type DbLike } from "./voicePersona";

const VOICE_DEMO_CAMPAIGN_ID = 60;
const VOICE_DEMO_ACCOUNT_ID = 52;
/** An autosave snapshots the text it replaces at most this often per prompt. */
const SNAPSHOT_EVERY_MS = 15 * 60 * 1000;

export interface VoicePromptRow {
  id: number;
  name: string | null;
  useCase: string;
  promptText: string;
  updatedAt: string | null;
}

export interface AccountVoicePrompts {
  locale: string;
  layer: VoicePromptRow | null;
  /** The lean voice layer (`voice_lean_layer_{locale}`), what calls run on unless the account picks standard. None for pt. */
  lean: VoicePromptRow | null;
  backend: VoicePromptRow | null;
  /** The ElevenLabs prompt (`eleven_layer_{nl|en|pt}`), shared by every ElevenLabs line in that language. */
  eleven: VoicePromptRow | null;
}

function toRow(r: typeof promptLibrary.$inferSelect | undefined): VoicePromptRow | null {
  if (!r || r.id == null) return null;
  return {
    id: r.id,
    name: r.name,
    useCase: r.useCase ?? "",
    promptText: r.promptText ?? "",
    updatedAt: r.updatedAt ? new Date(r.updatedAt).toISOString() : null,
  };
}

const active = sql`lower(${promptLibrary.status}) = 'active'`;

async function layerRow(locale: string, prefix = "voice_layer") {
  const [r] = await db.select().from(promptLibrary)
    .where(and(eq(promptLibrary.useCase, `${prefix}_${locale}`), active))
    .orderBy(sql`${promptLibrary.updatedAt} DESC NULLS LAST`, desc(promptLibrary.id))
    .limit(1);
  return toRow(r);
}

async function backendRow(locale: string) {
  const lang = localeLanguage(locale);
  const useCase = lang === "en" ? "voice_receptionist_demo" : `voice_receptionist_demo_${lang}`;
  const [byCampaign] = await db.select().from(promptLibrary)
    .where(and(eq(promptLibrary.campaignsId, VOICE_DEMO_CAMPAIGN_ID), eq(promptLibrary.useCase, useCase), active))
    .orderBy(sql`${promptLibrary.createdAt} DESC`)
    .limit(1);
  if (byCampaign) return toRow(byCampaign);
  const [byAccount] = await db.select().from(promptLibrary)
    .where(and(eq(promptLibrary.accountsId, VOICE_DEMO_ACCOUNT_ID), eq(promptLibrary.useCase, useCase), active))
    .orderBy(sql`${promptLibrary.createdAt} DESC`)
    .limit(1);
  return toRow(byAccount);
}

/** The ElevenLabs row languages: the review and coach drafts (PromptLang) cover nl and en; pt is edited on the row itself. */
export type ElevenLang = PromptLang | "pt";

/** The active `eleven_layer_{nl|en|pt}` row, newest updated_at first (also read by the draft storage, inside its transactions). */
export async function elevenPromptRow(lang: ElevenLang, exec: DbLike = db): Promise<VoicePromptRow | null> {
  const [r] = await exec.select().from(promptLibrary)
    .where(and(eq(promptLibrary.useCase, `eleven_layer_${lang}`), active))
    .orderBy(sql`${promptLibrary.updatedAt} DESC NULLS LAST`, desc(promptLibrary.id))
    .limit(1);
  return toRow(r);
}

/** Engine rule (eleven_template.template_lang): Dutch lines use eleven_layer_nl, Portuguese (pt-BR, pt-PT) eleven_layer_pt, everything else eleven_layer_en. */
export function elevenLangOf(locale: string): ElevenLang {
  const lang = localeLanguage(locale);
  return lang === "nl" || lang === "pt" ? lang : "en";
}

async function elevenRow(locale: string) {
  return elevenPromptRow(elevenLangOf(locale));
}

async function getAccountVoicePrompts(locale: string): Promise<AccountVoicePrompts> {
  const [layer, lean, backend, eleven] = await Promise.all([
    layerRow(locale), layerRow(locale, "voice_lean_layer"), backendRow(locale), elevenRow(locale),
  ]);
  return { locale, layer, lean, backend, eleven };
}

/**
 * Autosave one of those rows. Before the first save in a quiet stretch, the
 * text being replaced goes to Prompt_Versions, so a run of autosaves can
 * always be undone from the Prompt Library's history.
 */
async function saveVoicePromptText(id: number, promptText: string, savedBy: string | null): Promise<VoicePromptRow | null> {
  const [current] = await db.select().from(promptLibrary).where(eq(promptLibrary.id, id)).limit(1);
  if (!current) return null;
  if ((current.promptText ?? "") === promptText) return toRow(current);

  const [last] = await db.select({ savedAt: promptVersions.savedAt }).from(promptVersions)
    .where(eq(promptVersions.promptsId, id))
    .orderBy(desc(promptVersions.savedAt))
    .limit(1);
  const lastAt = last?.savedAt ? new Date(last.savedAt).getTime() : 0;
  if (Date.now() - lastAt > SNAPSHOT_EVERY_MS) {
    await db.insert(promptVersions).values({
      promptsId: id,
      versionNumber: current.version ?? null,
      promptText: current.promptText,
      systemMessage: current.systemMessage,
      label: "Before Voice tab edit",
      savedAt: new Date(),
      savedBy,
    } as any);
  }

  const [row] = await db.update(promptLibrary)
    .set({ promptText, updatedAt: new Date() } as any)
    .where(eq(promptLibrary.id, id))
    .returning();
  return toRow(row);
}

export const voiceAccountPromptsStorage = { getAccountVoicePrompts, saveVoicePromptText };
