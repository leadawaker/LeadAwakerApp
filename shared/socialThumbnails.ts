// Pure rules for the Socials thumbnail creator (server/social/thumbnailRoutes.ts, the Thumbnails
// section of the Socials page). Shared by server and client: no Node-only imports.

/**
 * Output formats. `portrait` (3:4) is the default: it is how a post, and a Reel cover in the profile
 * grid, shows on Instagram. `post` is the older 4:5 feed shape; `reel` (9:16) keeps the title and
 * faces inside the center 3:4 the grid shows.
 */
export const THUMB_FORMATS = ["portrait", "post", "reel", "square", "landscape"] as const;
export type ThumbFormat = (typeof THUMB_FORMATS)[number];
export const DEFAULT_THUMB_FORMAT: ThumbFormat = "portrait";

export const THUMB_FORMAT_SIZE: Record<ThumbFormat, { width: number; height: number; ratio: string }> = {
  portrait: { width: 1080, height: 1440, ratio: "3:4" },
  reel: { width: 1080, height: 1920, ratio: "9:16" },
  post: { width: 1080, height: 1350, ratio: "4:5" },
  square: { width: 1080, height: 1080, ratio: "1:1" },
  landscape: { width: 1920, height: 1080, ratio: "16:9" },
};

/**
 * The look of a thumbnail. auto lets the image model pick ("make it for me"), presenter puts the
 * person from the reference photos on the cover, title is typography only, collage combines images.
 */
export const THUMB_KINDS = ["auto", "presenter", "title", "collage"] as const;
export type ThumbKind = (typeof THUMB_KINDS)[number];

/** Reference images: a person to put on the cover, an example of a look to copy, or an asset (logo, product, photo) to use. */
export const REF_KINDS = ["person", "style", "asset"] as const;
export type RefKind = (typeof REF_KINDS)[number];

export const THUMB_STATUSES = ["generating", "ready", "failed"] as const;
export type ThumbStatus = (typeof THUMB_STATUSES)[number];

export const THUMB_LIMITS = {
  title: 160,
  prompt: 2_000,
  styleName: 60,
  refLabel: 60,
  /** One request makes at most this many variants. */
  variants: 3,
  /** At most this many reference images go to the image model in one request. */
  refsPerRequest: 6,
  /** An account keeps at most this many reference images. */
  refsPerAccount: 60,
  refBytes: 8 * 1024 * 1024,
  stylesPerAccount: 30,
} as const;

/** A thumbnail still generating after this long was lost (a restart): it shows as failed. */
export const THUMB_STALE_MS = 15 * 60_000;

export const isThumbFormat = (v: unknown): v is ThumbFormat => typeof v === "string" && (THUMB_FORMATS as readonly string[]).includes(v);
export const isThumbKind = (v: unknown): v is ThumbKind => typeof v === "string" && (THUMB_KINDS as readonly string[]).includes(v);
export const isRefKind = (v: unknown): v is RefKind => typeof v === "string" && (REF_KINDS as readonly string[]).includes(v);

/** The status a thumbnail shows: one stuck in generating past THUMB_STALE_MS is failed. */
export function effectiveThumbStatus(status: string, createdAt: Date | string, now: Date): ThumbStatus {
  if (status === "generating") {
    const age = now.getTime() - new Date(createdAt).getTime();
    return age > THUMB_STALE_MS ? "failed" : "generating";
  }
  return status === "ready" ? "ready" : "failed";
}
