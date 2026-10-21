// Pure rules for studio tags: the tag name (trimmed, inner spaces collapsed, 1 to 40 characters),
// the create / edit bodies and a tag_ids list (whole numbers, no repeats, only the account's own tags).
import type { SocialTag } from "@shared/schema";
import { isTagColor, TAG_COLORS, TAG_IDS_MAX, TAG_NAME_MAX, type TagColor } from "@shared/socialStudio";

type Parsed<T> = { ok: true; input: T } | { ok: false; message: string };

export interface TagView { id: number; name: string; color: TagColor }

export function toTagView(t: SocialTag): TagView {
  return { id: t.id, name: t.name, color: isTagColor(t.color) ? t.color : "wine" };
}

/** The name as stored, or null when it is empty or too long. */
export function normalizeTagName(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const name = v.replace(/\s+/g, " ").trim();
  return name.length === 0 || name.length > TAG_NAME_MAX ? null : name;
}

/** Same name ignoring case (the unique index uses lower(name)). */
export function sameTagName(a: string, b: string): boolean {
  return a.toLowerCase() === b.toLowerCase();
}

function obj(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

/** A new tag: a name, and a color (the first palette color when none is given). */
export function parseNewTagBody(body: unknown): Parsed<{ name: string; color: TagColor }> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  const name = normalizeTagName(b.name);
  if (!name) return { ok: false, message: `name is required (at most ${TAG_NAME_MAX} characters)` };
  if (b.color !== undefined && !isTagColor(b.color)) return { ok: false, message: `color must be one of ${TAG_COLORS.join(", ")}` };
  return { ok: true, input: { name, color: (b.color as TagColor | undefined) ?? TAG_COLORS[0] } };
}

/** A rename and/or a recolor: at least one of the two. */
export function parseTagEditBody(body: unknown): Parsed<{ name?: string; color?: TagColor }> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  const out: { name?: string; color?: TagColor } = {};
  if (b.name !== undefined) {
    const name = normalizeTagName(b.name);
    if (!name) return { ok: false, message: `name must be 1 to ${TAG_NAME_MAX} characters` };
    out.name = name;
  }
  if (b.color !== undefined) {
    if (!isTagColor(b.color)) return { ok: false, message: `color must be one of ${TAG_COLORS.join(", ")}` };
    out.color = b.color;
  }
  if (out.name === undefined && out.color === undefined) return { ok: false, message: "Nothing to change" };
  return { ok: true, input: out };
}

/** { tagIds: number[] }: positive whole numbers, repeats dropped, every id one of the account's tags. */
export function parseTagIdsBody(body: unknown, accountTagIds: ReadonlySet<number>): Parsed<number[]> {
  const b = obj(body);
  if (!b || !Array.isArray(b.tagIds)) return { ok: false, message: "tagIds must be a list" };
  if (!b.tagIds.every((x) => Number.isInteger(x) && (x as number) > 0)) return { ok: false, message: "tagIds must be whole numbers" };
  const ids = Array.from(new Set(b.tagIds as number[]));
  if (ids.length > TAG_IDS_MAX) return { ok: false, message: `At most ${TAG_IDS_MAX} tags` };
  if (!ids.every((id) => accountTagIds.has(id))) return { ok: false, message: "Unknown tag" };
  return { ok: true, input: ids };
}

/** Postgres unique violation: a tag with that name already exists for the account. */
export const isDuplicateName = (err: unknown) => (err as { code?: string } | null)?.code === "23505";
