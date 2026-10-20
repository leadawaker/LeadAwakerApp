// Pure rules behind the studio screens: error messages, how scripts are grouped, what the Manager's
// phone home shows, and what an agency user can do with a script. No React, no fetch.
import { SCRIPT_STATUSES, type ScriptStatus } from "@shared/socialStudio";
import type { SocialPostView } from "../api/socialApi";
import type { ScriptView, TopicView } from "../api/studioApi";

/** Reasons the studio routes send that have their own message under social:errors. */
export const STUDIO_REASONS = [
  "no_input", "ai_failed", "no_options", "rate_limited", "busy", "not_enabled",
  "transcribe_failed", "no_speech", "too_long", "empty_script", "not_sent",
  "upload_missing", "upload_used", "already_used", "not_ready", "not_found", "download_failed",
  "heygen_failed", "heygen_not_configured", "format", "size", "duration_short", "duration_long",
  "mic_denied",
] as const;

export function studioErrorKey(reason: string | null | undefined): string {
  return `errors.${reason && (STUDIO_REASONS as readonly string[]).includes(reason) ? reason : "failed"}`;
}

/** The caption writer reads the same table. */
export const captionErrorKey = studioErrorKey;

/** Agency's script board: one group per status in pipeline order, empty ones left out, newest first. */
export function groupScripts(scripts: ScriptView[]): { status: ScriptStatus; scripts: ScriptView[] }[] {
  return SCRIPT_STATUSES
    .map((status) => ({
      status,
      scripts: scripts.filter((s) => s.status === status).sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    }))
    .filter((g) => g.scripts.length > 0);
}

/** New topics first (what Gabriel still has to pick up), then the rest, newest first. Dismissed ones last. */
export function sortTopics(topics: TopicView[]): TopicView[] {
  const rank = (t: TopicView) => (t.status === "new" ? 0 : t.status === "used" ? 1 : 2);
  return [...topics].sort((a, b) => rank(a) - rank(b) || Date.parse(b.createdAt) - Date.parse(a.createdAt));
}

/** The Manager's phone home: scripts waiting for his answer, and videos waiting for his approval. */
export function managerHome(scripts: ScriptView[], posts: SocialPostView[]): { scriptsWaiting: ScriptView[]; videosWaiting: SocialPostView[]; upcoming: SocialPostView[] } {
  return {
    scriptsWaiting: scripts.filter((s) => s.reviewStatus === "waiting"),
    videosWaiting: posts.filter((p) => p.section === "needs_approval").sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)),
    upcoming: posts.filter((p) => p.section === "upcoming").sort((a, b) => Date.parse(a.scheduledAt) - Date.parse(b.scheduledAt)).slice(0, 3),
  };
}

export type ScriptAction = "draft" | "edit" | "sendForReview" | "pickVideo" | "uploadVideo" | "schedule";

/** What agency can do with a script, in display order. The server checks every one again. */
export function scriptActions(s: ScriptView): ScriptAction[] {
  if (s.status === "scheduled" || s.status === "published") return [];
  const out: ScriptAction[] = ["edit", "draft"];
  if (s.body.trim() && s.reviewStatus !== "waiting") out.push("sendForReview");
  out.push("pickVideo", "uploadVideo");
  if (s.videoUploadId) out.push("schedule");
  return out;
}

/** Whole words up to ~175 per minute: the voice guide's pace, to show "about 60 s" next to a script. */
export function spokenSeconds(body: string): number {
  const words = body.replace(/\[[^\]]*\]/g, " ").split(/\s+/).filter(Boolean).length;
  return Math.round((words / 175) * 60);
}
