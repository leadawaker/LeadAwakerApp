// Instagram API with Instagram Login (graph.instagram.com). Never put tokens or the app secret in errors or logs.

/** Version taken from Meta's content-publishing reference examples (v26.0, checked 2026-10-20). */
export const IG_GRAPH = "https://graph.instagram.com/v26.0";
/** Self-disclosure AI label parameter (Meta changelog 2026-06-22). */
export const AI_LABEL_PARAM = "is_ai_generated";
export const IG_REDIRECT_URI = "https://app.leadawaker.com/api/social/oauth/instagram/callback";
export const IG_SCOPES: readonly string[] = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_messages",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
];

export interface IgDeps { fetch: typeof fetch; appId: string; appSecret: string; redirectUri: string }

export function defaultIgDeps(): IgDeps {
  return {
    fetch,
    appId: process.env.INSTAGRAM_APP_ID ?? "",
    appSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
    redirectUri: IG_REDIRECT_URI,
  };
}

export class IgApiError extends Error {
  constructor(message: string, public code?: number, public kind?: "not_professional" | "http" | "network") {
    super(message);
    this.name = "IgApiError";
  }
}

/** Worth trying again: the request never got an answer, a 5xx, or Meta's "temporary" error codes 1 and 2. */
export function isTransientIgError(err: unknown): boolean {
  if (!(err instanceof IgApiError)) return true;
  return err.kind === "network" || err.code === 1 || err.code === 2;
}

export function stripCodeSuffix(code: string): string {
  return code.replace(/#_$/, "");
}

export function buildAuthorizeUrl(state: string, deps: IgDeps): string {
  const u = new URL("https://www.instagram.com/oauth/authorize");
  u.searchParams.set("enable_fb_login", "false");
  u.searchParams.set("force_authentication", "1");
  u.searchParams.set("client_id", deps.appId);
  u.searchParams.set("redirect_uri", deps.redirectUri);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("scope", IG_SCOPES.join(","));
  u.searchParams.set("state", state);
  return u.toString();
}

async function call(deps: IgDeps, url: string, init?: RequestInit): Promise<any> {
  let res: Response;
  try {
    res = await deps.fetch(url, { ...init, signal: AbortSignal.timeout(20_000) });
  } catch (e: any) {
    throw new IgApiError(`Instagram request failed: ${e?.name === "TimeoutError" ? "timeout" : "network error"}`, undefined, "network");
  }
  let data: any = null;
  try { data = await res.json(); } catch { /* non-JSON body */ }
  if (!res.ok || data?.error) {
    const err = data?.error;
    const kind = res.status >= 500 && !err?.code ? "network" : "http";
    throw new IgApiError(err?.message ?? err?.error_message ?? `Instagram API error (HTTP ${res.status})`, err?.code, kind);
  }
  return data;
}

function post(deps: IgDeps, url: string, params: Record<string, string>) {
  return call(deps, url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(params).toString(),
  });
}

function get(deps: IgDeps, path: string, params: Record<string, string>) {
  const q = Object.entries(params).map(([k, v]) => `${k}=${k === "fields" ? v : encodeURIComponent(v)}`).join("&");
  return call(deps, `${IG_GRAPH}${path}?${q}`);
}

export interface IgConnectResult {
  externalUserId: string; appScopedUserId: string | null; username: string; accountType: string; profilePictureUrl: string | null;
  accessToken: string; expiresAt: Date; scopes: string[];
}

export async function connectWithCode(code: string, deps: IgDeps, now: Date = new Date()): Promise<IgConnectResult> {
  const short = await post(deps, "https://api.instagram.com/oauth/access_token", {
    client_id: deps.appId,
    client_secret: deps.appSecret,
    grant_type: "authorization_code",
    redirect_uri: deps.redirectUri,
    code: stripCodeSuffix(code),
  });
  const long = await get(deps, "/access_token", {
    grant_type: "ig_exchange_token",
    client_secret: deps.appSecret,
    access_token: short.access_token,
  });
  const me = await get(deps, "/me", {
    fields: "user_id,username,account_type,profile_picture_url,id",
    access_token: long.access_token,
  });
  if (me.account_type !== "BUSINESS" && me.account_type !== "MEDIA_CREATOR") {
    throw new IgApiError("Instagram account must be a professional (Business or Creator) account", undefined, "not_professional");
  }
  const perms = Array.isArray(short.permissions) ? short.permissions : [];
  return {
    externalUserId: String(me.user_id ?? short.user_id),
    appScopedUserId: me.id != null ? String(me.id) : null,
    username: String(me.username),
    accountType: String(me.account_type),
    profilePictureUrl: me.profile_picture_url ?? null,
    accessToken: long.access_token,
    expiresAt: new Date(now.getTime() + Number(long.expires_in) * 1000),
    scopes: perms.map(String),
  };
}

export async function refreshLongLivedToken(token: string, deps: IgDeps, now: Date = new Date()) {
  const r = await call(deps, `${IG_GRAPH}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(token)}`);
  return { accessToken: String(r.access_token), expiresAt: new Date(now.getTime() + Number(r.expires_in) * 1000) };
}

export async function createReelContainer(
  igUserId: string, token: string,
  input: { videoUrl: string; coverUrl?: string; caption: string; shareToFeed: boolean; isAiGenerated: boolean },
  deps: IgDeps,
): Promise<string> {
  const params: Record<string, string> = {
    media_type: "REELS",
    video_url: input.videoUrl,
    caption: input.caption,
    share_to_feed: String(input.shareToFeed),
    access_token: token,
  };
  if (input.coverUrl) params.cover_url = input.coverUrl;
  if (input.isAiGenerated) params[AI_LABEL_PARAM] = "true";
  const r = await post(deps, `${IG_GRAPH}/${igUserId}/media`, params);
  return String(r.id);
}

export async function getContainerStatus(containerId: string, token: string, deps: IgDeps) {
  const r = await get(deps, `/${containerId}`, { fields: "status_code,status", access_token: token });
  return { code: r.status_code as "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED", message: (r.status as string) ?? null };
}

export async function publishContainer(igUserId: string, token: string, containerId: string, deps: IgDeps): Promise<string> {
  const r = await post(deps, `${IG_GRAPH}/${igUserId}/media_publish`, { creation_id: containerId, access_token: token });
  return String(r.id);
}

export async function getPermalink(mediaId: string, token: string, deps: IgDeps): Promise<string | null> {
  const r = await get(deps, `/${mediaId}`, { fields: "permalink", access_token: token });
  return r.permalink ?? null;
}

export async function getPublishingQuotaLeft(igUserId: string, token: string, deps: IgDeps): Promise<number | null> {
  const r = await get(deps, `/${igUserId}/content_publishing_limit`, { fields: "quota_usage,config", access_token: token });
  const row = r?.data?.[0];
  const used = Number(row?.quota_usage);
  const total = Number(row?.config?.quota_total);
  if (!Number.isFinite(used) || !Number.isFinite(total)) return null;
  return Math.max(0, total - used);
}
