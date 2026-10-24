import { test } from "node:test";
import assert from "node:assert/strict";
import type { ThumbnailView } from "../api/thumbnailsApi";
import { anyGenerating, applyStyle, aspectOf, emptyForm, failureText, fitWithin, formFromThumbnail, galleryItems, makeItForMe, parseSource, thumbErrorKey, toggleRef, toGenerateInput } from "./thumbnails";

const thumb = (over: Partial<ThumbnailView>): ThumbnailView => ({
  id: 1, batchId: "b", styleId: null, scriptId: null, postId: null, kind: "auto", format: "reel", title: "", prompt: "",
  refIds: [], status: "ready", error: null, starred: false, imageUrl: "/x", createdAt: "2026-10-24T10:00:00Z", ...over,
});

test("error keys: known reasons, else the fallback; API words are shown as they are", () => {
  assert.equal(thumbErrorKey("no_person"), "thumbnails.errors.no_person");
  assert.equal(thumbErrorKey("weird"), "thumbnails.errors.failed");
  assert.deepEqual(failureText("timed_out"), { key: "thumbnails.errors.timed_out" });
  assert.deepEqual(failureText("image API 400: rejected"), { text: "image API 400: rejected" });
  assert.deepEqual(failureText(null), { key: "thumbnails.errors.failed" });
});

test("aspect ratio per format, Post for anything unknown", () => {
  assert.equal(aspectOf("reel"), "1080 / 1920");
  assert.equal(aspectOf("landscape"), "1920 / 1080");
  assert.equal(aspectOf("??"), "1080 / 1350");
});

test("polling and filter", () => {
  assert.equal(anyGenerating([thumb({}), thumb({ status: "generating" })]), true);
  assert.equal(anyGenerating(undefined), false);
  assert.deepEqual(galleryItems([thumb({ id: 1 }), thumb({ id: 2, starred: true })], "starred").map((t) => t.id), [2]);
});

test("form: the default is a Reel cover, 2 variants; a style fills the look but keeps the title", () => {
  const f = { ...emptyForm(), title: "Hello", source: "script:4" };
  assert.equal(emptyForm().format, "post");
  const styled = applyStyle(f, { id: 9, name: "Mia", kind: "presenter", prompt: "warm", format: "post", refIds: [3] });
  assert.deepEqual(styled, { ...f, kind: "presenter", prompt: "warm", format: "post", refIds: [3], styleId: 9 });
  assert.deepEqual(toGenerateInput(styled), { kind: "presenter", format: "post", title: "Hello", prompt: "warm", refIds: [3], styleId: 9, scriptId: 4, postId: null, variants: 2 });
  const auto = makeItForMe(styled);
  assert.equal(auto.kind, "auto");
  assert.equal(auto.styleId, null);
  assert.deepEqual(auto.refIds, [3]);
});

test("use again drops deleted references and keeps the source", () => {
  const f = formFromThumbnail(thumb({ refIds: [1, 2], postId: 5, kind: "collage" }), [{ id: 2, kind: "asset", label: "", imageUrl: "", createdAt: "" }]);
  assert.deepEqual(f.refIds, [2]);
  assert.equal(f.source, "post:5");
  assert.equal(f.kind, "collage");
});

test("toggle refs stops at the request limit; sources parse", () => {
  assert.deepEqual(toggleRef([1, 2], 2), [1]);
  assert.deepEqual(toggleRef([1, 2, 3, 4, 5, 6], 7), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(parseSource("post:12"), { scriptId: null, postId: 12 });
  assert.deepEqual(parseSource(""), { scriptId: null, postId: null });
});

test("references shrink to fit, never grow", () => {
  assert.deepEqual(fitWithin(4000, 3000, 1536), { width: 1536, height: 1152 });
  assert.deepEqual(fitWithin(800, 600, 1536), { width: 800, height: 600 });
});
