import type { ClientRow } from "../demo-clients";
import { ensureClientSocialPost } from "./clientStore";
import { socialContextFields } from "./context";
import type { SocialLang } from "./types";
import { toHandle } from "./validate";

/** A lead blob that belongs to the Instagram demo. `service` is stamped at mint;
 *  `social_post` covers a blob whose bookkeeping was lost to an older switch. */
export function isSocialBlob(blob: Record<string, unknown> | null | undefined): boolean {
  return !!blob && (blob.service === "socials" || !!blob.social_post);
}

/** Every company name the Client itself uses, across its languages. */
export function clientCompanyNames(row: Pick<ClientRow, "companyNameTemplate">): string[] {
  const t = row.companyNameTemplate as unknown;
  if (typeof t === "string") return [t];
  if (t && typeof t === "object") {
    return Object.values(t as Record<string, unknown>).filter((v): v is string => typeof v === "string");
  }
  return [];
}

/** The handle a per-lead company override implies, or "" when there is no real
 *  override (empty, or just the Client's own name in some language). */
export function overrideHandle(company: string | undefined, ownNames: string[]): string {
  const c = String(company || "").trim();
  if (!c) return "";
  const own = new Set(ownNames.map((n) => n.trim().toLowerCase()));
  return own.has(c.toLowerCase()) ? "" : toHandle(c);
}

/** Pure half of socialSnapshotFields, split out so it can be tested without a DB. */
export function snapshotFromPost(
  row: Pick<ClientRow, "companyNameTemplate" | "socialImagePath">,
  fields: Record<string, unknown>,
  companyOverride?: string,
): Record<string, unknown> {
  const out = { ...fields };
  const handle = overrideHandle(companyOverride, clientCompanyNames(row));
  if (handle) out.social_post = { ...(out.social_post as object), handle };
  if (row.socialImagePath) out.social_image_path = row.socialImagePath;
  return out;
}

/**
 * The social keys for ONE lead's demo_niche snapshot.
 *
 * `ctx` must be the Client's own context, with no prospect override on it:
 * ensureClientSocialPost may generate and SAVE the post to the shared Client
 * row, and a prospect's company must never end up in that row. The override is
 * applied only to this lead's copy, as a handle derived from it. The image is
 * snapshotted too when the Client already has one, so text and picture come
 * from the same moment; an image still generating is read live by the page.
 */
export async function socialSnapshotFields(
  row: ClientRow,
  lang: SocialLang,
  ctx: Record<string, unknown>,
  companyOverride?: string,
): Promise<Record<string, unknown>> {
  const post = await ensureClientSocialPost(row, lang, ctx);
  return snapshotFromPost(row, socialContextFields(post), companyOverride);
}

/**
 * Re-point an existing snapshot's handle after a company-only edit: the
 * override's handle, or back to the Client's own post handle when the override
 * is cleared or equals the Client's name. Null when nothing changes.
 */
export function rehandleSnapshot(
  blob: Record<string, unknown>,
  company: string,
  clientHandle: string,
  ownNames: string[],
): Record<string, unknown> | null {
  const post = blob.social_post as Record<string, unknown> | undefined;
  if (!post) return null;
  const handle = overrideHandle(company, ownNames) || clientHandle;
  if (!handle || post.handle === handle) return null;
  return { ...blob, social_post: { ...post, handle } };
}
