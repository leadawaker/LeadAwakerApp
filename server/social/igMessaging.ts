// Instagram messaging for comment-to-DM: the endpoint constants and the only two functions that can
// send anything (a private reply to a comment, a DM inside the 24 h window). Both go through
// assertLiveAllowed first: a real request needs the account's dm_mode "live" AND the server switch
// INSTAGRAM_DM_LIVE=1. Without both, no request is made, whatever the caller does.
//
// Endpoints and rules: Instagram API with Instagram Login, "Private Replies" and "Send API". The
// developers.facebook.com docs do not resolve from the build sandbox; checked 2026-10-20 against
// secondary write-ups of Meta's reference. Re-check against Meta's docs before going live
// (specs/social-studio/action-required.md, "Before live").
import { IG_GRAPH, IgApiError, type IgDeps } from "./instagramApi";
import { dmLiveSwitchOn } from "./dmSafety";

/** POST {IG_GRAPH}/{ig-user-id}/messages with recipient.comment_id (private reply) or recipient.id (DM). */
export const IG_MESSAGES_PATH = (igUserId: string) => `/${igUserId}/messages`;
/** A comment can get one private reply, within 7 days of the comment. */
export const PRIVATE_REPLY_WINDOW_DAYS = 7;
/** After that, more messages only once the person replied, and within 24 h of their latest message. */
export const MESSAGING_WINDOW_HOURS = 24;
/** Granted at connect time already (IG_SCOPES in instagramApi.ts). */
export const DM_SCOPES = ["instagram_business_manage_messages", "instagram_business_manage_comments"] as const;
/** Webhook fields to subscribe in the Meta dashboard. */
export const WEBHOOK_FIELDS = ["comments", "messages"] as const;

export class DmBlockedError extends Error {
  constructor(public reason: "not_live" | "switch_off") {
    super(`Instagram DM blocked: ${reason}`);
    this.name = "DmBlockedError";
  }
}

/** Throws unless both switches allow a real send. Called by every function below before any request. */
export function assertLiveAllowed(accountMode: string | null | undefined, env: NodeJS.ProcessEnv = process.env): void {
  if (accountMode !== "live") throw new DmBlockedError("not_live");
  if (!dmLiveSwitchOn(env)) throw new DmBlockedError("switch_off");
}

async function postJson(deps: Pick<IgDeps, "fetch">, url: string, token: string, body: unknown): Promise<any> {
  let res: Response;
  try {
    res = await deps.fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (e: any) {
    throw new IgApiError(`Instagram request failed: ${e?.name === "TimeoutError" ? "timeout" : "network error"}`, undefined, "network");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  if (!res.ok || data?.error) {
    const err = data?.error;
    throw new IgApiError(String(err?.message ?? `Instagram API error (HTTP ${res.status})`).slice(0, 300), err?.code, "http");
  }
  return data;
}

export interface SendCtx {
  /** The account's dm_mode at the time of sending. */
  accountMode: string;
  igUserId: string;
  token: string;
  deps: Pick<IgDeps, "fetch">;
  env?: NodeJS.ProcessEnv;
}

/** The one private reply to a comment. Returns Meta's message id. */
export async function sendPrivateReply(ctx: SendCtx, commentId: string, text: string): Promise<string | null> {
  assertLiveAllowed(ctx.accountMode, ctx.env);
  const r = await postJson(ctx.deps, `${IG_GRAPH}${IG_MESSAGES_PATH(ctx.igUserId)}`, ctx.token, { recipient: { comment_id: commentId }, message: { text } });
  return r?.message_id ? String(r.message_id) : null;
}

/** A DM to someone who wrote to the account in the last 24 h. Returns Meta's message id. */
export async function sendDirectMessage(ctx: SendCtx, recipientId: string, text: string): Promise<string | null> {
  assertLiveAllowed(ctx.accountMode, ctx.env);
  const r = await postJson(ctx.deps, `${IG_GRAPH}${IG_MESSAGES_PATH(ctx.igUserId)}`, ctx.token, { recipient: { id: recipientId }, message: { text } });
  return r?.message_id ? String(r.message_id) : null;
}

export function withinPrivateReplyWindow(commentAt: Date, now: Date): boolean {
  return now.getTime() - commentAt.getTime() <= PRIVATE_REPLY_WINDOW_DAYS * 86_400_000;
}

export function withinMessagingWindow(lastInboundAt: Date | null, now: Date): boolean {
  return !!lastInboundAt && now.getTime() - lastInboundAt.getTime() <= MESSAGING_WINDOW_HOURS * 3_600_000;
}
