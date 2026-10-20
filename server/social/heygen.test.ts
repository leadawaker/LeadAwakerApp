// HeyGen client against a fake fetch: parsing, paging, errors, and the guarantees that matter most:
// GET only, the key never reaches the storage host, and nothing logged carries a presigned query string.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createHeygenClient, HeygenError, parseVideo, parseVideoList, redactUrl } from "./heygen";

type Call = { url: string; init?: RequestInit };

function fakeFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>) {
  const calls: Call[] = [];
  const f = (async (url: any, init?: RequestInit) => { calls.push({ url: String(url), init }); return handler(String(url), init); }) as typeof fetch;
  return { f, calls };
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

const item = {
  id: "v1", title: "01 Perder peso", status: "completed", duration: 58.4, created_at: 1760900000,
  thumbnail_url: "https://cdn.example/t.jpg", video_page_url: "https://app.heygen.com/videos/v1",
  video_url: "https://files.example/v1.mp4?X-Amz-Signature=secret&X-Amz-Expires=600",
};

test("parses a video: seconds become ISO, status lower case, missing id is dropped", () => {
  const v = parseVideo(item)!;
  assert.equal(v.id, "v1");
  assert.equal(v.durationS, 58.4);
  assert.equal(v.createdAt, new Date(1760900000 * 1000).toISOString());
  assert.equal(parseVideo({ title: "x" }), null);
  assert.equal(parseVideo({ video_id: "v2", status: "PROCESSING", created_at: "2026-10-20T10:00:00Z" })?.status, "processing");
});

test("parses list shapes and paging", () => {
  assert.deepEqual(parseVideoList({ data: [item], next_token: "n2", has_more: true }).nextToken, "n2");
  assert.equal(parseVideoList({ data: [item], next_token: "n2", has_more: false }).nextToken, null);
  assert.equal(parseVideoList({ data: { videos: [item, { nope: 1 }], token: "t" } }).videos.length, 1);
  assert.deepEqual(parseVideoList(null), { videos: [], nextToken: null });
});

test("listVideos and getVideo send GET with the key header to api.heygen.com only", async () => {
  const { f, calls } = fakeFetch((url) => (url.includes("/v3/videos/v1") ? json({ data: item }) : json({ data: [item], next_token: "abc", has_more: true })));
  const hg = createHeygenClient("KEY123", f);
  const page = await hg.listVideos({ limit: 500, token: "tok" });
  assert.equal(page.videos.length, 1);
  assert.equal(page.nextToken, "abc");
  assert.match(calls[0].url, /^https:\/\/api\.heygen\.com\/v3\/videos\?limit=50&token=tok$/);
  const v = await hg.getVideo("v1");
  assert.equal(v?.id, "v1");
  for (const c of calls) {
    assert.equal(c.init?.method, "GET");
    assert.equal((c.init?.headers as Record<string, string>)["X-Api-Key"], "KEY123");
  }
});

test("getVideo: 404 is null, a bad id never reaches the network, other errors throw without the key", async () => {
  const { f, calls } = fakeFetch(() => json({ error: { message: "nope" } }, 404));
  const hg = createHeygenClient("KEY123", f);
  assert.equal(await hg.getVideo("v1"), null);
  assert.equal(await hg.getVideo("../users/me"), null);
  assert.equal(calls.length, 1);
  const boom = createHeygenClient("KEY123", fakeFetch(() => json({ message: "server sad" }, 500)).f);
  await assert.rejects(boom.getVideo("v1"), (e: any) => e instanceof HeygenError && e.kind === "http" && !e.message.includes("KEY123"));
});

test("download: GET without the API key, expired links are recognised, errors carry no signature", async () => {
  const ok = fakeFetch(() => new Response(new Uint8Array([1, 2, 3]), { status: 200 }));
  const stream = await createHeygenClient("KEY123", ok.f).downloadVideo(item.video_url);
  const chunks: Buffer[] = [];
  for await (const c of stream as AsyncIterable<Buffer>) chunks.push(Buffer.from(c));
  assert.equal(Buffer.concat(chunks).length, 3);
  assert.equal(ok.calls[0].init?.method, "GET");
  assert.equal(ok.calls[0].init?.headers, undefined, "the key stays with api.heygen.com");

  const expired = createHeygenClient("KEY123", fakeFetch(() => new Response("AccessDenied", { status: 403 })).f);
  await assert.rejects(expired.downloadVideo(item.video_url), (e: any) => e.kind === "expired" && !e.message.includes("Signature") && !e.message.includes("secret"));
});

test("redactUrl strips the query string", () => {
  assert.equal(redactUrl(item.video_url), "https://files.example/v1.mp4");
  assert.equal(redactUrl("not a url"), "(invalid url)");
});

test("the module has no write call: no POST, PUT, PATCH or DELETE anywhere in its source", () => {
  const src = readFileSync(join(import.meta.dirname, "heygen.ts"), "utf8");
  assert.doesNotMatch(src, /method:\s*"(POST|PUT|PATCH|DELETE)"/);
  for (const m of src.matchAll(/method:\s*"(\w+)"/g)) assert.equal(m[1], "GET");
});
