// Everything with I/O the studio routes need (studioRoutes.ts, scriptRoutes.ts). The real wiring is
// server/routes/socialStudio.ts; tests pass in-memory fakes.
import type { RequestHandler } from "express";
import type {
  InsertSocialScript,
  InsertSocialTopic,
  SocialHeygenPull,
  SocialPost,
  SocialScript,
  SocialSettings,
  SocialTag,
  SocialTopic,
} from "@shared/schema";
import type { AiComplete } from "./captions";
import type { GetAccount } from "./gate";
import type { HeygenClient } from "./heygen";
import type { SocialNotifType } from "./notify";
import type { UploadOutcome, VideoCheck } from "./upload";

export interface StudioDeps {
  requireAuth: RequestHandler;
  now(): Date;
  /** SOCIAL_UPLOAD_DIR in production: the same <uploadDir>/<accountId>/<uuid>.<ext> layout as Reel uploads. */
  uploadDir: string;
  maxUploadBytes: number;
  store: {
    getAccount: GetAccount;
    getSocialSettings(accountId: number): Promise<SocialSettings | null>;
    upsertSocialSettings(accountId: number, fields: Partial<SocialSettings>, userId: number | null): Promise<SocialSettings>;
    listSocialTopics(accountId: number): Promise<SocialTopic[]>;
    insertSocialTopic(row: InsertSocialTopic): Promise<SocialTopic>;
    updateSocialTopic(accountId: number, topicId: number, fields: Partial<InsertSocialTopic>): Promise<SocialTopic | null>;
    listSocialScripts(accountId: number): Promise<SocialScript[]>;
    getSocialScript(accountId: number, scriptId: number): Promise<SocialScript | null>;
    insertSocialScript(row: InsertSocialScript): Promise<SocialScript>;
    updateSocialScript(accountId: number, scriptId: number, fields: Partial<InsertSocialScript>): Promise<SocialScript | null>;
    listHeygenPulls(accountId: number): Promise<SocialHeygenPull[]>;
    insertHeygenPull(row: { accountsId: number; heygenVideoId: string; scriptId: number | null; uploadId: string; pulledByUserId: number | null }): Promise<SocialHeygenPull>;
    deleteHeygenPull(accountId: number, heygenVideoId: string): Promise<void>;
    listSocialTags(accountId: number): Promise<SocialTag[]>;
    /** Throws 23505 when the account already has that name (ignoring case). */
    insertSocialTag(row: { accountsId: number; name: string; color: string }): Promise<SocialTag>;
    updateSocialTag(accountId: number, tagId: number, fields: { name?: string; color?: string }): Promise<SocialTag | null>;
    /** Also takes the id off the account's ideas and scripts. */
    deleteSocialTag(accountId: number, tagId: number): Promise<boolean>;
    setSocialTopicTags(accountId: number, topicId: number, tagIds: number[]): Promise<SocialTopic | null>;
    setSocialScriptTags(accountId: number, scriptId: number, tagIds: number[]): Promise<SocialScript | null>;
    listSocialPosts(accountId: number): Promise<SocialPost[]>;
    getSocialPost(accountId: number, postId: number): Promise<SocialPost | null>;
    getSocialPostByPublicId(publicId: string): Promise<SocialPost | null>;
  };
  /** claudeJson (server/aiTextHelper.ts). */
  ai: AiComplete;
  /** Speech to text for a spoken topic (Groq Whisper). language is the account's, e.g. "Portuguese". */
  transcribe(audio: Buffer, mimeType: string, language: string | null): Promise<{ text: string } | { error: string }>;
  /** null when HEYGEN_API_KEY is not set. Read-only: list, get, download. */
  heygen(): HeygenClient | null;
  video: {
    /** upload.receiveVideo: stream to disk, faststart, probe, Reel spec check. Leaves no file on failure. */
    receive(src: NodeJS.ReadableStream, destPath: string, maxBytes: number): Promise<UploadOutcome>;
    /** upload.inspectVideo. null when the file is not there. */
    inspect(path: string): Promise<VideoCheck | null>;
  };
  /** INSTAGRAM_DM_LIVE=1 on the server. */
  dmLiveSwitch(): boolean;
  notifyAgency(n: { type: SocialNotifType; title: string; body: string; accountId: number; link: string }): Promise<void>;
  notifyAccountManagers(accountId: number, n: { type: SocialNotifType; key: "needs_approval" | "published" | "script_review"; vars: Record<string, string>; link: string }): Promise<void>;
}
