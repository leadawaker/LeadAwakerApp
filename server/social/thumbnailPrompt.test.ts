import { test } from "node:test";
import assert from "node:assert/strict";
import { buildThumbnailPrompt, cropFilter, generationPlan } from "./thumbnailPrompt";
import { decodeDataUrl, sniffImage } from "./thumbnailImage";
import { parseGenerateBody, pickRequestRefs } from "./thumbnails";
import type { SocialThumbnailRef } from "@shared/schema";

const input = { kind: "auto" as const, format: "reel" as const, title: "", extra: "", context: "", about: "", refs: [] };

test("plan: each format asks the closest model size and comes out at the Instagram size", () => {
  assert.deepEqual(generationPlan("reel"), { size: "1024x1536", out: { width: 1080, height: 1920 } });
  assert.deepEqual(generationPlan("post"), { size: "1024x1536", out: { width: 1080, height: 1350 } });
  assert.deepEqual(generationPlan("square"), { size: "1024x1024", out: { width: 1080, height: 1080 } });
  assert.deepEqual(generationPlan("landscape"), { size: "1536x1024", out: { width: 1920, height: 1080 } });
  assert.equal(cropFilter(generationPlan("reel")), "crop='min(iw,ih*1080/1920)':'min(ih,iw*1920/1080)',scale=1080:1920:flags=lanczos,setsar=1");
});

test("prompt: a Reel cover keeps the title and faces in the grid-safe middle", () => {
  const p = buildThumbnailPrompt({ ...input, title: "Stop doing this" });
  assert.match(p, /Instagram Reel cover/);
  assert.match(p, /"Stop doing this"/);
  assert.match(p, /middle 3:4/);
});

test("prompt: no title means no text; refs are described in order with labels", () => {
  const p = buildThumbnailPrompt({ ...input, kind: "presenter", format: "square", refs: [{ kind: "person", label: "Mia" }, { kind: "asset", label: "" }] });
  assert.match(p, /Do not add any text/);
  assert.match(p, /image 1 is a photo of the person to feature \(Mia\); image 2 is an image to use in the design\./);
  assert.match(p, /exact likeness/);
  assert.doesNotMatch(p, /middle 3:4/);
});

test("prompt: long context is clipped, whitespace collapsed", () => {
  const p = buildThumbnailPrompt({ ...input, context: "word\n\n".repeat(1000) });
  const line = p.split("\n").find((l) => l.startsWith("The post is about:"))!;
  assert.ok(line.length < 1_250);
  assert.ok(line.endsWith("…"));
});

test("sniff and decode: PNG, JPEG, WebP by their bytes; junk is refused", () => {
  assert.equal(sniffImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]))?.mimeType, "image/png");
  assert.equal(sniffImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))?.ext, "jpg");
  assert.equal(sniffImage(Buffer.from("RIFF1234WEBPVP8 "))?.mimeType, "image/webp");
  assert.equal(sniffImage(Buffer.from("GIF89a")), null);
  assert.equal(decodeDataUrl("data:image/png;base64,aGk=")?.toString(), "hi");
  assert.equal(decodeDataUrl("not base64!"), null);
  assert.equal(decodeDataUrl(42), null);
});

test("generate body: defaults, limits, and script or post but not both", () => {
  const ok = parseGenerateBody({});
  assert.ok(ok.ok && ok.value.kind === "auto" && ok.value.format === "portrait" && ok.value.variants === 1);
  assert.equal(parseGenerateBody({ refIds: [1, 2, 3, 4, 5, 6, 7] }).ok, false);
  assert.equal(parseGenerateBody({ scriptId: 1, postId: 2 }).ok, false);
  assert.equal(parseGenerateBody({ format: "tiktok" }).ok, false);
  const dedup = parseGenerateBody({ refIds: [3, 3, 4] });
  assert.ok(dedup.ok && dedup.value.refIds.join() === "3,4");
});

test("request refs: every look but title-only adds the account's person photos when none is picked", () => {
  const ref = (id: number, kind: string) => ({ id, kind } as SocialThumbnailRef);
  const all = [ref(1, "person"), ref(2, "person"), ref(3, "style")];
  assert.deepEqual(pickRequestRefs("presenter", [ref(3, "style")], all).map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(pickRequestRefs("presenter", [ref(2, "person")], all).map((r) => r.id), [2]);
  assert.deepEqual(pickRequestRefs("auto", [], all).map((r) => r.id), [1, 2]);
  assert.deepEqual(pickRequestRefs("collage", [ref(3, "style")], all).map((r) => r.id), [1, 2, 3]);
  assert.deepEqual(pickRequestRefs("auto", [ref(2, "person")], all).map((r) => r.id), [2]);
  assert.deepEqual(pickRequestRefs("title", [], all), []);
});

test("OpenAI provider: generations without references, edits (multipart, image[]) with them", async () => {
  const { openAiImageProvider } = await import("./thumbnailImage");
  const calls: Array<{ url: string; init: RequestInit }> = [];
  const fetchFn = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("png").toString("base64") }] }), { status: 200 });
  }) as unknown as typeof fetch;
  const provider = openAiImageProvider("sk-test", { model: "gpt-image-x", fetchFn });

  const plain = await provider.generate({ prompt: "p", size: "1024x1536", n: 1, references: [] });
  assert.equal(plain.model, "gpt-image-x");
  assert.equal(plain.images[0].toString(), "png");
  assert.equal(calls[0].url, "https://api.openai.com/v1/images/generations");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { model: "gpt-image-x", prompt: "p", size: "1024x1536", quality: "high", n: 1 });

  await provider.generate({ prompt: "p", size: "1024x1024", n: 2, references: [{ data: Buffer.from("a"), mimeType: "image/png", name: "a.png" }] });
  assert.equal(calls[1].url, "https://api.openai.com/v1/images/edits");
  const form = calls[1].init.body as FormData;
  assert.equal(form.getAll("image[]").length, 1);
  assert.equal(form.get("n"), "2");
  assert.equal((calls[1].init.headers as Record<string, string>).authorization, "Bearer sk-test");
});

test("OpenAI provider: an error answer becomes a short ImageProviderError with the API's message", async () => {
  const { openAiImageProvider, ImageProviderError } = await import("./thumbnailImage");
  const fetchFn = (async () => new Response(JSON.stringify({ error: { message: "Your request was rejected" } }), { status: 400 })) as unknown as typeof fetch;
  await assert.rejects(
    openAiImageProvider("k", { model: "m", fetchFn }).generate({ prompt: "p", size: "1024x1024", n: 1, references: [] }),
    (err: Error) => err instanceof ImageProviderError && err.message === "image API 400: Your request was rejected",
  );
});
