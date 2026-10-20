// Pure rules for the Socials studio (caption writer, topics, scripts, HeyGen pulls).
// Shared by server and client: no Node-only imports. Spec:
// docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md

export const SCRIPT_STATUSES = ["idea", "draft", "approved", "video_ready", "scheduled", "published"] as const;
export type ScriptStatus = (typeof SCRIPT_STATUSES)[number];

/** Statuses agency sets by hand. video_ready, scheduled and published follow the video and the post. */
export const MANUAL_SCRIPT_STATUSES: readonly ScriptStatus[] = ["idea", "draft", "approved"];

/** The Manager's look at a script Gabriel sent over: none (not sent), waiting, ok, changes. */
export const REVIEW_STATUSES = ["none", "waiting", "ok", "changes"] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const TOPIC_STATUSES = ["new", "used", "dismissed"] as const;
export type TopicStatus = (typeof TOPIC_STATUSES)[number];
export type TopicSource = "typed" | "voice" | "seed";

/** Comment-to-DM per account: off by default, dry_run logs what it would send, live needs INSTAGRAM_DM_LIVE=1 too. */
export const DM_MODES = ["off", "dry_run", "live"] as const;
export type DmMode = (typeof DM_MODES)[number];

export const TEXT_LIMITS = {
  captionStyle: 20_000,
  voiceGuide: 40_000,
  aboutMe: 8_000,
  topic: 2_000,
  scriptTitle: 200,
  scriptBody: 20_000,
  captionAbout: 4_000,
  reviewNote: 1_000,
} as const;

export const CAPTION_OPTION_COUNT = 3;

/**
 * The status a script shows: a linked post decides once it exists (published, or scheduled while it
 * is on its way), else the stored status. A cancelled or failed post leaves the script where it was.
 */
export function effectiveScriptStatus(stored: ScriptStatus, post: { status: string } | null | undefined): ScriptStatus {
  if (!post) return stored;
  if (post.status === "published") return "published";
  if (post.status === "scheduled" || post.status === "held" || post.status === "publishing") return "scheduled";
  return stored;
}

export function isScriptStatus(v: unknown): v is ScriptStatus {
  return typeof v === "string" && (SCRIPT_STATUSES as readonly string[]).includes(v);
}

export function isDmMode(v: unknown): v is DmMode {
  return typeof v === "string" && (DM_MODES as readonly string[]).includes(v);
}

/** The Socials page for one account: notifications and in-app links carry the account, so an agency user lands on it. */
export function socialPageLink(accountId: number, section?: string): string {
  return `/platform/social?account=${accountId}${section ? `&section=${section}` : ""}`;
}
