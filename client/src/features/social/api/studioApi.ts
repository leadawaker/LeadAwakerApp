// Socials studio API (server/social/studioRoutes.ts, scriptRoutes.ts): settings, Sobre mim, the
// caption writer, topics, scripts and the read-only HeyGen list.
import type { DmMode, ReviewStatus, ScriptStatus, TopicSource, TopicStatus } from "@shared/socialStudio";
import { apiFetch } from "@/lib/apiUtils";
import { jsonInit, throwUnlessOk } from "./socialApi";

const base = (accountId: number) => `/api/social/accounts/${accountId}`;

async function getJson<T>(url: string): Promise<T> {
  return (await throwUnlessOk(await apiFetch(url))).json();
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return (await throwUnlessOk(await apiFetch(url, jsonInit(method, body)))).json();
}

// ─── Settings ────────────────────────────────────────────────────────────────

export interface SocialSettingsView {
  aboutMe: string;
  /** Agency only. */
  captionStyle?: string;
  voiceGuide?: string;
  dmMode?: DmMode;
  dmHourlyCap?: number;
  dmLiveSwitch?: boolean;
}

export const socialSettingsKey = (accountId: number) => ["social-settings", accountId] as const;
export const fetchSocialSettings = (accountId: number) => getJson<SocialSettingsView>(`${base(accountId)}/settings`);
export const saveSocialSettings = (accountId: number, body: Partial<Omit<SocialSettingsView, "dmLiveSwitch">>) =>
  sendJson<SocialSettingsView>(`${base(accountId)}/settings`, "PUT", body);
export const saveAboutMe = (accountId: number, aboutMe: string) => sendJson<SocialSettingsView>(`${base(accountId)}/settings/about`, "PUT", { aboutMe });

// ─── Caption writer ──────────────────────────────────────────────────────────

export const suggestCaptions = (accountId: number, input: { scriptId: number } | { about: string }) =>
  sendJson<{ options: string[] }>(`${base(accountId)}/captions/suggest`, "POST", input);

// ─── Topics ──────────────────────────────────────────────────────────────────

export interface TopicView { id: number; text: string; source: TopicSource; status: TopicStatus; scriptId: number | null; createdAt: string }

export const socialTopicsKey = (accountId: number) => ["social-topics", accountId] as const;
export const fetchTopics = (accountId: number) => getJson<TopicView[]>(`${base(accountId)}/topics`);
/** One idea per line: the server makes one topic per line and returns them all. */
export const addTopic = (accountId: number, text: string, source: "typed" | "voice") => sendJson<TopicView[]>(`${base(accountId)}/topics`, "POST", { text, source });
export const setTopicStatus = (accountId: number, topicId: number, status: TopicStatus) => sendJson<TopicView>(`${base(accountId)}/topics/${topicId}`, "PATCH", { status });
export const transcribeTopic = (accountId: number, audioData: string, mimeType: string) =>
  sendJson<{ text: string }>(`${base(accountId)}/topics/transcribe`, "POST", { audio_data: audioData, mime_type: mimeType });

// ─── Scripts ─────────────────────────────────────────────────────────────────

export interface ScriptView {
  id: number;
  /** Sent back with the Manager's answer: an edit since the list loaded is refused, not approved unseen. */
  version: string;
  title: string;
  body: string;
  status: ScriptStatus;
  topicId: number | null;
  postId: number | null;
  post: { status: string; scheduledAt: string; permalink: string | null } | null;
  videoUploadId: string | null;
  heygenVideoId: string | null;
  reviewStatus: ReviewStatus;
  reviewNote: string | null;
  updatedAt: string;
}

export const socialScriptsKey = (accountId: number) => ["social-scripts", accountId] as const;
export const fetchScripts = (accountId: number) => getJson<ScriptView[]>(`${base(accountId)}/scripts`);
export const createScript = (accountId: number, body: { title: string; body?: string; topicId?: number }) => sendJson<ScriptView>(`${base(accountId)}/scripts`, "POST", body);
export const updateScript = (accountId: number, scriptId: number, body: { title?: string; body?: string; status?: ScriptStatus }) =>
  sendJson<ScriptView>(`${base(accountId)}/scripts/${scriptId}`, "PATCH", body);
export const draftScript = (accountId: number, scriptId: number, notes: string) => sendJson<ScriptView>(`${base(accountId)}/scripts/${scriptId}/draft`, "POST", { notes });
export const sendScriptForReview = (accountId: number, scriptId: number) => sendJson<ScriptView>(`${base(accountId)}/scripts/${scriptId}/send-for-review`, "POST");
export const reviewScript = (accountId: number, script: Pick<ScriptView, "id" | "version">, decision: "ok" | "changes", note: string) =>
  sendJson<ScriptView>(`${base(accountId)}/scripts/${script.id}/review`, "POST", { decision, note, version: script.version });
export const attachScriptVideo = (accountId: number, scriptId: number, uploadId: string) => sendJson<ScriptView>(`${base(accountId)}/scripts/${scriptId}/video`, "POST", { uploadId });
export const linkScriptPost = (accountId: number, scriptId: number, postId: number) => sendJson<ScriptView>(`${base(accountId)}/scripts/${scriptId}/link-post`, "POST", { postId });

// ─── HeyGen (read-only) ──────────────────────────────────────────────────────

export interface HeygenVideoView {
  id: string;
  title: string;
  status: string;
  durationS: number | null;
  createdAt: string | null;
  videoPageUrl: string | null;
  selectable: boolean;
  alreadyUsed: boolean;
  usedByScriptId: number | null;
}

export const heygenVideosKey = (accountId: number, token: string | null) => ["social-heygen", accountId, token ?? ""] as const;
export const fetchHeygenVideos = (accountId: number, token: string | null) =>
  getJson<{ configured: boolean; videos: HeygenVideoView[]; nextToken: string | null }>(`${base(accountId)}/heygen/videos${token ? `?token=${encodeURIComponent(token)}` : ""}`);
export const pullHeygenVideo = (accountId: number, scriptId: number, videoId: string) =>
  sendJson<{ script: ScriptView; upload: { uploadId: string; ext: string; durationS: number } }>(`${base(accountId)}/scripts/${scriptId}/heygen`, "POST", { videoId });
