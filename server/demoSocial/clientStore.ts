import { eq } from "drizzle-orm";
import { db } from "../db";
import { nicheVocabulary, type SocialPostByLang } from "@shared/schema";
import type { ClientRow } from "../demo-clients";
import { generateSocialPost } from "./generatePost";
import { ensureSocialImage } from "./image";
import type { SocialLang, SocialPost } from "./types";

export function upsertLangSlot(
  existing: SocialPostByLang | null | undefined,
  lang: SocialLang,
  post: SocialPost,
): SocialPostByLang {
  return { ...(existing ?? {}), [lang]: post };
}

export function getClientSocialPost(row: ClientRow, lang: SocialLang): SocialPost | null {
  return (row.socialPost as SocialPostByLang | null)?.[lang] ?? null;
}

export async function saveClientSocialPost(niche: string, lang: SocialLang, post: SocialPost): Promise<void> {
  const [row] = await db.select({ socialPost: nicheVocabulary.socialPost })
    .from(nicheVocabulary).where(eq(nicheVocabulary.niche, niche)).limit(1);
  await db.update(nicheVocabulary)
    .set({ socialPost: upsertLangSlot(row?.socialPost as SocialPostByLang | null, lang, post) })
    .where(eq(nicheVocabulary.niche, niche));
}

export async function setClientSocialImage(niche: string, file: string): Promise<void> {
  await db.update(nicheVocabulary).set({ socialImagePath: file }).where(eq(nicheVocabulary.niche, niche));
}

export function startClientSocialImage(niche: string, prompt: string): void {
  void ensureSocialImage(niche, prompt, (file) => setClientSocialImage(niche, file));
}

function str(v: unknown): string {
  if (typeof v === "string") return v;
  return "";
}

/** One shape for `generateSocialPost`'s input, built from a Client row and its
 *  NicheContext, shared by ensureClientSocialPost and the text-regenerate
 *  route so the two paths cannot drift (kb fallback, area, niche label). */
export function socialPostInput(
  row: ClientRow,
  lang: SocialLang,
  ctx: Record<string, unknown>,
): Parameters<typeof generateSocialPost>[0] {
  return {
    language: lang,
    companyName: str(ctx.company_name),
    serviceName: str(ctx.service_name),
    nicheLabel: str(ctx.niche_label) || row.niche,
    usp: str(ctx.usp),
    kb: str(ctx.kb) || str(ctx.business_description),
    area: str(ctx.area),
  };
}

/** Reuse the Client's post for this language, or generate and save it. The
 *  image is started in the background whenever the Client has none. */
export async function ensureClientSocialPost(
  row: ClientRow,
  lang: SocialLang,
  ctx: Record<string, unknown>,
): Promise<SocialPost> {
  let post = getClientSocialPost(row, lang);
  if (!post) {
    post = await generateSocialPost(socialPostInput(row, lang, ctx));
    await saveClientSocialPost(row.niche, lang, post);
  }
  if (!row.socialImagePath) startClientSocialImage(row.niche, post.image_prompt);
  return post;
}
