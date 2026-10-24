// Pure parts of the thumbnail routes: request body checks and what the client sees of each row.
import type { SocialThumbnail, SocialThumbnailRef, SocialThumbnailStyle } from "@shared/schema";
import {
  DEFAULT_THUMB_FORMAT,
  THUMB_LIMITS,
  effectiveThumbStatus,
  isRefKind,
  isThumbFormat,
  isThumbKind,
  type RefKind,
  type ThumbFormat,
  type ThumbKind,
  type ThumbStatus,
} from "@shared/socialThumbnails";

type Parsed<T> = { ok: true; value: T } | { ok: false; message: string };

const obj = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : "");
const isPosInt = (v: unknown): v is number => Number.isInteger(v) && (v as number) > 0;

function optionalId(v: unknown, name: string): Parsed<number | null> {
  if (v === undefined || v === null) return { ok: true, value: null };
  return isPosInt(v) ? { ok: true, value: v } : { ok: false, message: `Invalid ${name}` };
}

function refIdList(v: unknown): Parsed<number[]> {
  if (v === undefined || v === null) return { ok: true, value: [] };
  if (!Array.isArray(v) || !v.every(isPosInt)) return { ok: false, message: "refIds must be a list of ids" };
  const ids = [...new Set(v as number[])];
  if (ids.length > THUMB_LIMITS.refsPerRequest) return { ok: false, message: `At most ${THUMB_LIMITS.refsPerRequest} reference images` };
  return { ok: true, value: ids };
}

export interface GenerateInput {
  kind: ThumbKind;
  format: ThumbFormat;
  title: string;
  prompt: string;
  refIds: number[];
  styleId: number | null;
  scriptId: number | null;
  postId: number | null;
  variants: number;
}

export function parseGenerateBody(body: unknown): Parsed<GenerateInput> {
  const b = obj(body);
  const kind = b.kind ?? "auto";
  if (!isThumbKind(kind)) return { ok: false, message: "Invalid kind" };
  const format = b.format ?? DEFAULT_THUMB_FORMAT;
  if (!isThumbFormat(format)) return { ok: false, message: "Invalid format" };
  const title = str(b.title).trim();
  if (title.length > THUMB_LIMITS.title) return { ok: false, message: "Title is too long" };
  const prompt = str(b.prompt).trim();
  if (prompt.length > THUMB_LIMITS.prompt) return { ok: false, message: "Instructions are too long" };
  const variants = b.variants ?? 1;
  if (!Number.isInteger(variants) || (variants as number) < 1 || (variants as number) > THUMB_LIMITS.variants) {
    return { ok: false, message: `variants must be 1 to ${THUMB_LIMITS.variants}` };
  }
  const refIds = refIdList(b.refIds);
  if (!refIds.ok) return refIds;
  const styleId = optionalId(b.styleId, "styleId");
  if (!styleId.ok) return styleId;
  const scriptId = optionalId(b.scriptId, "scriptId");
  if (!scriptId.ok) return scriptId;
  const postId = optionalId(b.postId, "postId");
  if (!postId.ok) return postId;
  if (scriptId.value && postId.value) return { ok: false, message: "Pick a script or a post, not both" };
  return {
    ok: true,
    value: { kind, format, title, prompt, refIds: refIds.value, styleId: styleId.value, scriptId: scriptId.value, postId: postId.value, variants: variants as number },
  };
}

export interface StyleInput { name: string; kind: ThumbKind; prompt: string; format: ThumbFormat; refIds: number[] }

export function parseStyleBody(body: unknown): Parsed<StyleInput> {
  const b = obj(body);
  const name = str(b.name).trim();
  if (!name || name.length > THUMB_LIMITS.styleName) return { ok: false, message: `name must be 1 to ${THUMB_LIMITS.styleName} characters` };
  if (!isThumbKind(b.kind)) return { ok: false, message: "Invalid kind" };
  const format = b.format ?? DEFAULT_THUMB_FORMAT;
  if (!isThumbFormat(format)) return { ok: false, message: "Invalid format" };
  const prompt = str(b.prompt).trim();
  if (prompt.length > THUMB_LIMITS.prompt) return { ok: false, message: "Instructions are too long" };
  const refIds = refIdList(b.refIds);
  if (!refIds.ok) return refIds;
  return { ok: true, value: { name, kind: b.kind, prompt, format, refIds: refIds.value } };
}

export function parseRefBody(body: unknown): Parsed<{ kind: RefKind; label: string; data: unknown }> {
  const b = obj(body);
  if (!isRefKind(b.kind)) return { ok: false, message: "Invalid kind" };
  const label = str(b.label).trim();
  if (label.length > THUMB_LIMITS.refLabel) return { ok: false, message: "Label is too long" };
  return { ok: true, value: { kind: b.kind, label, data: b.data } };
}

/**
 * The references a request sends: the picked ones, and, unless the cover is title-only, the account's
 * person photos (newest first) in the slots left when no person is among them. So the same face comes
 * back on every cover, whether the look is Auto, a collage, a saved style or "Make it for me".
 */
export function pickRequestRefs(kind: ThumbKind, picked: SocialThumbnailRef[], all: SocialThumbnailRef[]): SocialThumbnailRef[] {
  if (kind === "title" || picked.some((r) => r.kind === "person")) return picked;
  const room = THUMB_LIMITS.refsPerRequest - picked.length;
  const people = all.filter((r) => r.kind === "person" && !picked.some((p) => p.id === r.id)).slice(0, Math.max(0, room));
  return [...people, ...picked];
}

const base = (accountId: number) => `/api/social/accounts/${accountId}`;

export interface ThumbnailView {
  id: number;
  batchId: string;
  styleId: number | null;
  scriptId: number | null;
  postId: number | null;
  kind: string;
  format: string;
  title: string;
  prompt: string;
  refIds: number[];
  status: ThumbStatus;
  error: string | null;
  starred: boolean;
  imageUrl: string | null;
  createdAt: string;
}

export function toThumbnailView(row: SocialThumbnail, now: Date): ThumbnailView {
  const status = effectiveThumbStatus(row.status, row.createdAt, now);
  return {
    id: row.id,
    batchId: row.batchId,
    styleId: row.styleId,
    scriptId: row.scriptId,
    postId: row.postId,
    kind: row.kind,
    format: row.format,
    title: row.title,
    prompt: row.prompt,
    refIds: row.refIds ?? [],
    status,
    error: status === "failed" ? row.error || "timed_out" : null,
    starred: row.starred,
    imageUrl: status === "ready" && row.filePath ? `${base(row.accountsId)}/thumbnails/${row.id}/image` : null,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export interface RefView { id: number; kind: string; label: string; imageUrl: string; createdAt: string }

export function toRefView(row: SocialThumbnailRef): RefView {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    imageUrl: `${base(row.accountsId)}/thumbnail-refs/${row.id}/image`,
    createdAt: new Date(row.createdAt).toISOString(),
  };
}

export interface StyleView { id: number; name: string; kind: string; prompt: string; format: string; refIds: number[] }

/** refIds left out when their reference image was deleted since. */
export function toStyleView(row: SocialThumbnailStyle, refIds: Set<number>): StyleView {
  return { id: row.id, name: row.name, kind: row.kind, prompt: row.prompt, format: row.format, refIds: (row.refIds ?? []).filter((id) => refIds.has(id)) };
}
