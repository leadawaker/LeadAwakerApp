import { test } from "node:test";
import assert from "node:assert/strict";
import {
  AI_LABEL_PARAM, IgApiError, IG_REDIRECT_URI, IG_SCOPES, buildAuthorizeUrl, connectWithCode,
  createReelContainer, getContainerStatus, refreshLongLivedToken, stripCodeSuffix, type IgDeps,
} from "./instagramApi";

type Call = { url: string; init?: RequestInit };
type Route = [RegExp, object, number?];

function fake(routes: Route[]) {
  const calls: Call[] = [];
  const f = (async (url: any, init?: RequestInit) => {
    const u = String(url);
    calls.push({ url: u, init });
    const hit = routes.find(([re]) => re.test(u));
    if (!hit) return new Response(JSON.stringify({ error: { message: "no route", code: 1 } }), { status: 404 });
    return new Response(JSON.stringify(hit[1]), { status: hit[2] ?? 200 });
  }) as unknown as typeof fetch;
  const deps: IgDeps = { fetch: f, appId: "123", appSecret: "sec", redirectUri: IG_REDIRECT_URI };
  return { deps, calls };
}

const connectRoutes = (accountType: string): Route[] => [
  [/api\.instagram\.com\/oauth\/access_token/, { access_token: "short", user_id: 42, permissions: [...IG_SCOPES] }],
  [/graph\.instagram\.com\/.*access_token\?.*grant_type=ig_exchange_token/, { access_token: "long", expires_in: 5184000 }],
  [/graph\.instagram\.com\/.*\/me\?.*fields=user_id,username,account_type,profile_picture_url,id(&|$)/, {
    user_id: "1784", username: "dr.augusto", account_type: accountType, profile_picture_url: "https://x/p.jpg", id: "app-77",
  }],
];

test("stripCodeSuffix removes trailing #_", () => {
  assert.equal(stripCodeSuffix("abc#_"), "abc");
  assert.equal(stripCodeSuffix("abc"), "abc");
});

test("authorize URL carries client id, exact redirect, five scopes, state, no FB login", () => {
  const { deps } = fake([]);
  const u = new URL(buildAuthorizeUrl("st8", { ...deps }));
  assert.equal(u.origin + u.pathname, "https://www.instagram.com/oauth/authorize");
  assert.equal(u.searchParams.get("client_id"), "123");
  assert.equal(u.searchParams.get("redirect_uri"), "https://app.leadawaker.com/api/social/oauth/instagram/callback");
  assert.equal(u.searchParams.get("response_type"), "code");
  assert.equal(u.searchParams.get("scope"), "instagram_business_basic,instagram_business_content_publish,instagram_business_manage_messages,instagram_business_manage_comments,instagram_business_manage_insights");
  assert.equal(u.searchParams.get("state"), "st8");
  assert.equal(u.searchParams.get("enable_fb_login"), "false");
});

test("connectWithCode: code -> short token -> long token -> profile", async () => {
  const { deps, calls } = fake(connectRoutes("MEDIA_CREATOR"));
  const r = await connectWithCode("abc#_", deps, new Date("2026-10-19T00:00:00Z"));
  assert.equal(r.accessToken, "long");
  assert.equal(r.externalUserId, "1784");
  assert.equal(r.appScopedUserId, "app-77");
  assert.equal(r.username, "dr.augusto");
  assert.equal(r.expiresAt.toISOString(), "2026-12-18T00:00:00.000Z");
  assert.equal(r.scopes.length, 5);
  assert.match(String(calls[0].init?.body), /code=abc(&|$)/);
  assert.match(String(calls[0].init?.body), /client_secret=sec/);
  assert.match(String(calls[0].init?.body), /redirect_uri=/);
});

test("connectWithCode rejects non-professional accounts", async () => {
  const { deps: deps2 } = fake(connectRoutes("PERSONAL"));
  await assert.rejects(connectWithCode("abc", deps2), (e: any) => e instanceof IgApiError && e.kind === "not_professional");
});

test("Graph error body becomes IgApiError with message and code", async () => {
  const { deps: deps3 } = fake([[/\/media$/, { error: { message: "Invalid video", code: 9004 } }, 400]]);
  await assert.rejects(createReelContainer("1784", "t", { videoUrl: "https://m/v.mp4", caption: "c", shareToFeed: true, isAiGenerated: true }, deps3),
    (e: any) => e instanceof IgApiError && e.code === 9004 && /Invalid video/.test(e.message));
});

test("createReelContainer posts REELS with video_url, caption, share_to_feed and AI label", async () => {
  const { deps: deps4, calls } = fake([[/\/1784\/media$/, { id: "c1" }]]);
  const id = await createReelContainer("1784", "t", { videoUrl: "https://m/v.mp4", caption: "olá", shareToFeed: true, isAiGenerated: true }, deps4);
  assert.equal(id, "c1");
  const body = new URLSearchParams(String(calls[0].init?.body));
  assert.equal(body.get("media_type"), "REELS");
  assert.equal(body.get("video_url"), "https://m/v.mp4");
  assert.equal(body.get("caption"), "olá");
  assert.equal(body.get("share_to_feed"), "true");
  assert.equal(body.get(AI_LABEL_PARAM), "true");
});

test("getContainerStatus maps status_code and status message", async () => {
  const { deps: deps5 } = fake([[/\/c1\?.*fields=status_code,status/, { status_code: "ERROR", status: "Error: video too long" }]]);
  assert.deepEqual(await getContainerStatus("c1", "t", deps5), { code: "ERROR", message: "Error: video too long" });
});

test("refreshLongLivedToken uses ig_refresh_token", async () => {
  const { deps: deps6, calls } = fake([[/refresh_access_token/, { access_token: "new", expires_in: 5184000 }]]);
  const r = await refreshLongLivedToken("old", deps6, new Date("2026-10-19T00:00:00Z"));
  assert.match(calls[0].url, /refresh_access_token\?grant_type=ig_refresh_token&access_token=old/);
  assert.equal(r.accessToken, "new");
});

test("error messages never contain the token", async () => {
  const { deps } = fake([[/refresh_access_token/, { error: { message: "bad", code: 190 } }, 400]]);
  await assert.rejects(refreshLongLivedToken("SECRETTOKEN", deps), (e: any) => !String(e.message).includes("SECRETTOKEN"));
});
