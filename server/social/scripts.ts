// Pure rules for studio topics and scripts: request bodies, what each role sees, the script-draft
// prompt (the account's voice guide is the system prompt, data not code) and parsing its answer.
// Spec: docs/superpowers/specs/2026-10-20-caption-writer-and-studio-design.md
import { createHash } from "node:crypto";
import type { SocialPost, SocialScript, SocialTopic } from "@shared/schema";
import {
  effectiveScriptStatus,
  MANUAL_SCRIPT_STATUSES,
  TEXT_LIMITS,
  type ReviewStatus,
  type ScriptStatus,
  type TopicSource,
  type TopicStatus,
} from "@shared/socialStudio";
import { extractJsonObject } from "../aiTextHelper";
import { languageName } from "./captions";
import { splitTopicLines, TOPIC_BATCH_RAW_MAX } from "./topicLines";

export const SCRIPT_TIMEOUT_MS = 150_000;

export const SCRIPT_SCHEMA = {
  type: "object",
  properties: { title: { type: "string" }, body: { type: "string" } },
  required: ["title", "body"],
  additionalProperties: false,
} as const;

type Parsed<T> = { ok: true; input: T } | { ok: false; message: string };

function obj(body: unknown): Record<string, unknown> | null {
  return typeof body === "object" && body !== null && !Array.isArray(body) ? (body as Record<string, unknown>) : null;
}

function cleanText(v: unknown, max: number): string | null {
  if (typeof v !== "string") return null;
  const t = v.replace(/\r\n/g, "\n").trim();
  return t.length > max ? null : t;
}

// ─── Topics ────────────────────────────────────────────────────────────────

export interface TopicView { id: number; text: string; source: TopicSource; status: TopicStatus; scriptId: number | null; tagIds: number[]; createdAt: string }

export function toTopicView(t: SocialTopic): TopicView {
  return { id: t.id, text: t.text, source: t.source as TopicSource, status: t.status as TopicStatus, scriptId: t.scriptId, tagIds: t.tagIds ?? [], createdAt: t.createdAt.toISOString() };
}

/** One idea per line: the text becomes one or more topics (see topicLines.ts). */
export function parseNewTopicBody(body: unknown): Parsed<{ texts: string[]; source: "typed" | "voice" }> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  const raw = typeof b.text === "string" ? b.text.replace(/\r\n?/g, "\n") : "";
  const texts = raw.length > TOPIC_BATCH_RAW_MAX ? [] : splitTopicLines(raw);
  if (texts.length === 0) return { ok: false, message: "text is required (one idea per line)" };
  if (texts.length === 1 && texts[0].length > TEXT_LIMITS.topic) return { ok: false, message: "An idea is at most 2000 characters" };
  const source = b.source === "voice" ? "voice" : "typed";
  return { ok: true, input: { texts, source } };
}

// ─── Scripts ───────────────────────────────────────────────────────────────

/** What the Manager says yes to: the title and the text. Sent back with his answer (like contentVersion for posts). */
export function scriptVersion(s: Pick<SocialScript, "title" | "body">): string {
  return createHash("sha256").update(`${s.title}\n${s.body}`).digest("hex").slice(0, 16);
}

export interface ScriptView {
  id: number;
  /** scriptVersion(): sent back with the Manager's answer, so an edit since he loaded it is refused. */
  version: string;
  title: string;
  body: string;
  status: ScriptStatus;
  topicId: number | null;
  postId: number | null;
  /** The linked post's state, so the card can say "scheduled for ..." or "published". */
  post: { status: string; scheduledAt: string; permalink: string | null } | null;
  /** An uploaded or pulled video waiting to be scheduled. */
  videoUploadId: string | null;
  heygenVideoId: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  /** Social_Tags ids of the account. */
  tagIds: number[];
  updatedAt: string;
}

export function toScriptView(s: SocialScript, post: SocialPost | null | undefined): ScriptView {
  const linked = post && post.status !== "cancelled" ? post : null;
  return {
    id: s.id,
    version: scriptVersion(s),
    title: s.title,
    body: s.body,
    status: effectiveScriptStatus(s.status as ScriptStatus, linked),
    topicId: s.topicId,
    postId: linked ? s.postId : null,
    post: linked ? { status: linked.status, scheduledAt: linked.scheduledAt.toISOString(), permalink: linked.permalink } : null,
    videoUploadId: s.videoUploadId,
    heygenVideoId: s.heygenVideoId,
    reviewStatus: s.reviewStatus as ReviewStatus,
    reviewNote: s.reviewNote,
    tagIds: s.tagIds ?? [],
    updatedAt: s.updatedAt.toISOString(),
  };
}

/** Client users see only what Gabriel sent them: scripts with a review asked for or given. */
export function visibleToClient(s: Pick<SocialScript, "reviewStatus">): boolean {
  return s.reviewStatus !== "none";
}

export function parseNewScriptBody(body: unknown): Parsed<{ title: string; body: string; topicId: number | null }> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  const title = cleanText(b.title, TEXT_LIMITS.scriptTitle);
  if (!title) return { ok: false, message: "title is required (at most 200 characters)" };
  const text = b.body === undefined ? "" : cleanText(b.body, TEXT_LIMITS.scriptBody);
  if (text === null) return { ok: false, message: "body is too long" };
  let topicId: number | null = null;
  if (b.topicId !== undefined && b.topicId !== null) {
    if (!Number.isInteger(b.topicId) || (b.topicId as number) <= 0) return { ok: false, message: "Invalid topicId" };
    topicId = b.topicId as number;
  }
  return { ok: true, input: { title, body: text, topicId } };
}

export interface ScriptEdit { title?: string; body?: string; status?: ScriptStatus }

export function parseScriptEditBody(body: unknown): Parsed<ScriptEdit> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  const out: ScriptEdit = {};
  if (b.title !== undefined) {
    const t = cleanText(b.title, TEXT_LIMITS.scriptTitle);
    if (!t) return { ok: false, message: "title must be 1 to 200 characters" };
    out.title = t;
  }
  if (b.body !== undefined) {
    const t = cleanText(b.body, TEXT_LIMITS.scriptBody);
    if (t === null) return { ok: false, message: "body is too long" };
    out.body = t;
  }
  if (b.status !== undefined) {
    if (typeof b.status !== "string" || !(MANUAL_SCRIPT_STATUSES as readonly string[]).includes(b.status)) {
      return { ok: false, message: "status must be idea, draft or approved" };
    }
    out.status = b.status as ScriptStatus;
  }
  if (Object.keys(out).length === 0) return { ok: false, message: "Nothing to change" };
  return { ok: true, input: out };
}

/**
 * What an agency edit writes. A new title or body after the script was sent drops the review back to
 * "none": the Manager saw (or said yes or no to) the old text, so Gabriel sends it again when it is ready.
 */
export function planScriptEdit(s: SocialScript, edit: ScriptEdit): Partial<SocialScript> {
  const fields: Partial<SocialScript> = { ...edit };
  const textChanged = (edit.body !== undefined && edit.body !== s.body) || (edit.title !== undefined && edit.title !== s.title);
  // Waiting too: the Manager has the old text on his screen, so Gabriel sends the new one again.
  if (textChanged && s.reviewStatus !== "none") {
    fields.reviewStatus = "none";
    fields.reviewNote = null;
  }
  if (edit.body && edit.status === undefined && s.status === "idea") fields.status = "draft";
  return fields;
}

export function parseReviewBody(body: unknown): Parsed<{ decision: "ok" | "changes"; note: string | null; version: string }> {
  const b = obj(body);
  if (!b) return { ok: false, message: "Body must be an object" };
  if (b.decision !== "ok" && b.decision !== "changes") return { ok: false, message: "decision must be ok or changes" };
  if (typeof b.version !== "string" || !b.version) return { ok: false, message: "version is required" };
  const note = typeof b.note === "string" ? b.note.trim().slice(0, TEXT_LIMITS.reviewNote) : "";
  if (b.decision === "changes" && !note) return { ok: false, message: "A note is required when asking for changes" };
  return { ok: true, input: { decision: b.decision, note: note || null, version: b.version } };
}

/** The Manager's answer. "ok" on a draft makes it approved; "changes" on an approved script makes it a draft again. */
export function planReview(s: SocialScript, decision: "ok" | "changes", note: string | null, userId: number, now: Date): Partial<SocialScript> {
  const fields: Partial<SocialScript> = { reviewStatus: decision, reviewNote: note, reviewedByUserId: userId, reviewedAt: now };
  if (decision === "ok" && (s.status === "idea" || s.status === "draft")) fields.status = "approved";
  if (decision === "changes" && s.status === "approved") fields.status = "draft";
  return fields;
}

// ─── Script draft prompt ───────────────────────────────────────────────────

/** The last spoken line of each script: the voice guide asks never to reuse a close. */
export function recentCloses(scripts: Pick<SocialScript, "id" | "body">[], exceptId: number, max = 8): string[] {
  const out: string[] = [];
  for (const s of scripts) {
    if (s.id === exceptId) continue;
    const last = s.body.split("\n").map((l) => l.trim()).filter((l) => l && !l.startsWith("```")).pop();
    if (last && !out.includes(last)) out.push(last.slice(0, 300));
    if (out.length >= max) break;
  }
  return out;
}

export function buildScriptPrompt(input: {
  voiceGuide: string;
  aboutMe: string;
  language: string | null;
  title: string;
  notes: string;
  currentBody: string;
  closesUsed: string[];
}): { system: string; user: string } {
  const system = [
    input.voiceGuide.trim() || "Write a short, spoken, first-person video script for a vertical Reel of 40 to 65 seconds.",
    input.aboutMe.trim() ? `\n## About the speaker (facts you may use, and things never to say)\n${input.aboutMe.trim()}` : "",
    "\n## Rules for this answer",
    `- Write the script in ${languageName(input.language)}, as the speaker talks, ready to be read aloud.`,
    "- Never promise results and never make a medical or other claim stronger than the speaker would make.",
    "- No em dashes. No stage directions or scene notes in the body.",
    `- Answer with JSON only: {"title": "...", "body": "..."}. The body is the spoken text only.`,
  ].filter(Boolean).join("\n");
  const user = [
    `Theme: ${input.title}`,
    input.notes.trim() ? `Notes from the agency: ${input.notes.trim()}` : "",
    input.currentBody.trim() ? `Current draft to improve:\n<draft>\n${input.currentBody.trim()}\n</draft>` : "",
    input.closesUsed.length ? `Closing lines used in earlier scripts (do not reuse any):\n${input.closesUsed.map((c) => `- ${c}`).join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
  return { system, user };
}

export function parseScriptDraft(text: string): { title: string; body: string } | null {
  const raw = extractJsonObject(text);
  if (!raw) return null;
  try {
    const d = JSON.parse(raw) as { title?: unknown; body?: unknown };
    const body = typeof d.body === "string" ? d.body.replace(/\r\n/g, "\n").trim() : "";
    if (!body || body.length > TEXT_LIMITS.scriptBody) return null;
    const title = typeof d.title === "string" ? d.title.trim().slice(0, TEXT_LIMITS.scriptTitle) : "";
    return { title, body };
  } catch {
    return null;
  }
}
