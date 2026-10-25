// Rules behind the Thumbnails section of the Socials page (components/thumbnails/). Pure, except
// prepareReference, which needs a browser (canvas) and is only called from a file input.
import { DEFAULT_THUMB_FORMAT, THUMB_FORMAT_SIZE, THUMB_LIMITS, type ThumbFormat, type ThumbKind } from "@shared/socialThumbnails";
import type { GenerateInput, RefView, StyleView, ThumbnailView, TitleSuggestInput } from "../api/thumbnailsApi";

/** Reasons the thumbnail routes send that have their own message (thumbnails.errors.*). */
export const THUMB_REASONS = [
  "not_configured", "no_person", "no_title", "ref_missing", "script_missing", "post_missing", "thumbnail_missing", "no_instruction",
  "bad_image", "too_large", "too_many", "rate_limited", "busy", "timed_out", "no_image", "save_failed", "no_input", "ai_failed", "no_options",
] as const;

export function thumbErrorKey(reason: string | null | undefined): string {
  return `thumbnails.errors.${reason && (THUMB_REASONS as readonly string[]).includes(reason) ? reason : "failed"}`;
}

/** A failed row's error is a reason code or the image API's own words: only codes are translated. */
export function failureText(error: string | null): { key: string } | { text: string } {
  if (!error || (THUMB_REASONS as readonly string[]).includes(error)) return { key: thumbErrorKey(error) };
  return { text: error };
}

/** CSS aspect-ratio of a format, e.g. "1080 / 1920". */
export const aspectOf = (format: string) => {
  const size = THUMB_FORMAT_SIZE[format as ThumbFormat] ?? THUMB_FORMAT_SIZE[DEFAULT_THUMB_FORMAT];
  return `${size.width} / ${size.height}`;
};

/** The gallery polls while anything is still generating. */
export const anyGenerating = (list: readonly ThumbnailView[] | undefined) => !!list?.some((t) => t.status === "generating");

export type GalleryFilter = "all" | "starred";

export function galleryItems(list: readonly ThumbnailView[], filter: GalleryFilter): ThumbnailView[] {
  return filter === "starred" ? list.filter((t) => t.starred) : [...list];
}

export interface ComposerForm {
  kind: ThumbKind;
  format: ThumbFormat;
  title: string;
  prompt: string;
  refIds: number[];
  styleId: number | null;
  /** "script:<id>" | "post:<id>" | "" */
  source: string;
  variants: number;
}

export const emptyForm = (): ComposerForm => ({ kind: "auto", format: DEFAULT_THUMB_FORMAT, title: "", prompt: "", refIds: [], styleId: null, source: "", variants: 2 });

/** A saved style fills kind, format, instructions and references; the title and source stay. */
export function applyStyle(form: ComposerForm, style: StyleView): ComposerForm {
  return { ...form, kind: style.kind, format: style.format, prompt: style.prompt, refIds: [...style.refIds], styleId: style.id };
}

/** "Use again": the settings of an earlier thumbnail, without refs that were deleted since. */
export function formFromThumbnail(t: ThumbnailView, refs: readonly RefView[]): ComposerForm {
  const have = new Set(refs.map((r) => r.id));
  return {
    kind: t.kind,
    format: t.format,
    title: t.title,
    prompt: t.prompt,
    refIds: t.refIds.filter((id) => have.has(id)),
    styleId: t.styleId,
    source: t.scriptId ? `script:${t.scriptId}` : t.postId ? `post:${t.postId}` : "",
    variants: 2,
  };
}

export function toggleRef(refIds: readonly number[], id: number): number[] {
  if (refIds.includes(id)) return refIds.filter((x) => x !== id);
  return refIds.length >= THUMB_LIMITS.refsPerRequest ? [...refIds] : [...refIds, id];
}

export function parseSource(source: string): { scriptId: number | null; postId: number | null } {
  const m = /^(script|post):(\d+)$/.exec(source);
  if (!m) return { scriptId: null, postId: null };
  const id = Number(m[2]);
  return m[1] === "script" ? { scriptId: id, postId: null } : { scriptId: null, postId: id };
}

export function toGenerateInput(form: ComposerForm): GenerateInput {
  return {
    kind: form.kind,
    format: form.format,
    title: form.title.trim(),
    prompt: form.prompt.trim(),
    refIds: form.refIds,
    styleId: form.styleId,
    ...parseSource(form.source),
    variants: form.variants,
  };
}

/** What the title helper writes from: the picked script or post, else the rough title typed so far. */
export function toTitleRequest(form: ComposerForm, avoid: readonly string[] = []): TitleSuggestInput {
  const { scriptId, postId } = parseSource(form.source);
  const from = scriptId ? { scriptId } : postId ? { postId } : { about: form.title.trim() };
  return { ...from, avoid: [...avoid] };
}

/** "Surprise me": the model picks the look; title, source, format and references stay as set. */
export function makeItForMe(form: ComposerForm): GenerateInput {
  return toGenerateInput({ ...form, kind: "auto", styleId: null });
}

/** The size a reference is shrunk to: the longest side at most max, never enlarged. */
export function fitWithin(width: number, height: number, max: number): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}

const REF_MAX_SIDE = 1536;

/** Shrinks a picked image in the browser and returns it as a data URL (PNG keeps transparency for logos). */
export async function prepareReference(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWithin(bitmap.width, bitmap.height, REF_MAX_SIDE);
    const canvas = document.createElement("canvas");
    canvas.width = size.width;
    canvas.height = size.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("bad_image");
    ctx.drawImage(bitmap, 0, 0, size.width, size.height);
    return file.type === "image/png" ? canvas.toDataURL("image/png") : canvas.toDataURL("image/jpeg", 0.9);
  } finally {
    bitmap.close();
  }
}
