// "Upgrade with AI": request parsing, caption selection, transcript trimming, prompt and answer parsing,
// and the routes over HTTP with fakes (no model, no ffmpeg, no database).
import { test, after } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import express from "express";
import { TEXT_LIMITS } from "@shared/socialStudio";
import { createRateLimiter } from "./rateLimit";
import {
  MAX_TRANSCRIPTS_TOTAL, MAX_TRANSCRIPT_CHARS, buildUpgradePrompt, hasUpgradeInput, parseUpgradeAnswer, parseUpgradeBody, selectCaptions, trimTranscripts,
} from "./settingsUpgrade";
import { registerSettingsUpgradeRoutes, type UpgradeDeps } from "./settingsUpgradeRoutes";
import { isMediaContentType, joinPieces } from "./videoAudio";

const d = (s: string) => new Date(s);

test("selectCaptions: newest first, deduped, Instagram list wins over the same CRM post, empties skipped", () => {
  const insight = [
    { caption: "Old one", at: d("2026-01-01"), postId: null },
    { caption: "Newest", at: d("2026-10-01"), postId: 5 },
    { caption: "   ", at: d("2026-09-01"), postId: null },
    { caption: "newest ", at: d("2026-08-01"), postId: null },
  ];
  const posts = [{ caption: "Newest but edited in CRM", at: d("2026-10-02"), postId: 5 }, { caption: "Only in CRM", at: d("2026-05-01"), postId: 9 }];
  assert.deepEqual(selectCaptions(insight, posts), ["Newest", "Only in CRM", "Old one"]);
});

test("selectCaptions caps the count and each caption's length", () => {
  const rows = Array.from({ length: 50 }, (_, i) => ({ caption: `c${i} ${"x".repeat(3000)}`, at: d(`2026-01-${String((i % 28) + 1).padStart(2, "0")}`) }));
  const out = selectCaptions(rows, [], 30);
  assert.equal(out.length, 30);
  assert.ok(out.every((c) => c.length <= 2200));
});

test("trimTranscripts drops empties and caps each and the total", () => {
  const out = trimTranscripts(["", "  a  ", "y".repeat(MAX_TRANSCRIPT_CHARS + 50), ...Array(5).fill("z".repeat(MAX_TRANSCRIPT_CHARS))]);
  assert.equal(out[0], "a");
  assert.equal(out[1].length, MAX_TRANSCRIPT_CHARS);
  assert.ok(out.reduce((n, t) => n + t.length, 0) <= MAX_TRANSCRIPTS_TOTAL);
});

test("parseUpgradeBody validates the field and the current text length", () => {
  assert.equal(parseUpgradeBody({ field: "about_me" }).ok, false);
  assert.equal(parseUpgradeBody({ field: "caption_style", currentText: "x".repeat(TEXT_LIMITS.captionStyle + 1) }).ok, false);
  const p = parseUpgradeBody({ field: "voice_guide", currentText: "g", notes: 3, useCaptions: "yes", transcripts: ["t", 4] });
  assert.ok(p.ok);
  if (p.ok) assert.deepEqual([p.input.notes, p.input.useCaptions, p.input.transcripts], ["", false, ["t"]]);
});

test("hasUpgradeInput needs notes, a transcript or a caption", () => {
  assert.equal(hasUpgradeInput({ notes: " ", transcripts: [] }, []), false);
  assert.equal(hasUpgradeInput({ notes: "", transcripts: [] }, ["c"]), true);
});

test("buildUpgradePrompt keeps it a guide, in the guide's language, under the limit, with every source", () => {
  const p = buildUpgradePrompt({
    field: "caption_style", currentText: "Use ganchos curtos.", notes: "Menos emojis", useCaptions: true, transcripts: ["fala do video"],
    uiLanguage: "nl", captions: ["Legenda 1"], aboutMe: "Médico", accountLanguage: "Portuguese",
  });
  assert.match(p.system, /caption style guide/);
  assert.match(p.system, /language the current text is written in/);
  assert.match(p.system, /20,000 characters/);
  assert.match(p.system, /written in Dutch/);
  for (const s of ["Use ganchos curtos.", "Menos emojis", "fala do video", "Legenda 1", "Médico"]) assert.ok(p.user.includes(s), s);
  const empty = buildUpgradePrompt({ field: "voice_guide", currentText: "", notes: "n", useCaptions: false, transcripts: [], uiLanguage: "en", captions: [], aboutMe: "", accountLanguage: "pt-BR" });
  assert.match(empty.system, /empty, write it in Brazilian Portuguese/);
  assert.match(empty.system, /40,000 characters/);
});

test("parseUpgradeAnswer reads fenced JSON, refuses empty and too long", () => {
  const ok = parseUpgradeAnswer('```json\n{"text":" New guide ","changes":["Added hooks", "", 3]}\n```', "voice_guide");
  assert.deepEqual(ok, { ok: true, text: "New guide", changes: ["Added hooks"] });
  assert.deepEqual(parseUpgradeAnswer("nope", "voice_guide"), { ok: false, reason: "no_options" });
  assert.deepEqual(parseUpgradeAnswer(JSON.stringify({ text: "x".repeat(TEXT_LIMITS.captionStyle + 1), changes: [] }), "caption_style"), { ok: false, reason: "too_long" });
});

test("video helpers", () => {
  assert.ok(isMediaContentType("video/quicktime"));
  assert.ok(isMediaContentType("audio/mpeg; x=1"));
  assert.ok(!isMediaContentType("application/json"));
  assert.equal(joinPieces([" a ", "", "b"]), "a\n\nb");
});

// ─── Routes over HTTP ──────────────────────────────────────────────────────────

const AGENCY = { id: 1, role: "Owner", accountsId: 1 };
const MANAGER = { id: 21, role: "Manager", accountsId: 7 };
let user: any = AGENCY;
let aiCalls: any[] = [];
const deps: UpgradeDeps = {
  requireAuth: (req: any, _res, next) => { req.user = user; next(); },
  now: () => new Date("2026-10-21T12:00:00Z"),
  maxUploadBytes: 1000,
  getAccount: async (id) => (id === 7 ? { timezone: "America/Sao_Paulo", language: "Portuguese", socialEnabled: true } : null),
  getAboutMe: async () => "Sobre",
  listInsightCaptions: async () => [{ caption: "Legenda A", at: d("2026-10-01"), postId: null }],
  listPublishedPostCaptions: async () => [],
  ai: async (opts) => { aiCalls.push(opts); return { text: JSON.stringify({ text: "Guia novo", changes: ["Mais curto"] }) }; },
  transcribeVideo: async (src) => { for await (const _ of src as any) { /* drain */ } return { ok: true, text: "transcrito", durationS: 12.4 }; },
};
const app = express();
app.use(express.json());
registerSettingsUpgradeRoutes(app, deps, createRateLimiter({ max: 50, windowMs: 60_000 }));
const server = http.createServer(app).listen(0);
after(() => server.close());
const url = (p: string) => `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/social/accounts/7/settings/upgrade${p}`;
const post = (p: string, body: unknown) => fetch(url(p), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

test("routes: agency only", async () => {
  user = MANAGER;
  assert.equal((await fetch(url("/captions"))).status, 403);
  assert.equal((await post("", { field: "voice_guide", notes: "n" })).status, 403);
  user = AGENCY;
});

test("routes: caption count, upgrade with captions, no input refused, nothing saved", async () => {
  assert.deepEqual(await (await fetch(url("/captions"))).json(), { count: 1 });
  assert.equal((await post("", { field: "caption_style", currentText: "x" })).status, 422);
  aiCalls = [];
  const res = await post("", { field: "caption_style", currentText: "Estilo", useCaptions: true, uiLanguage: "en" });
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { text: "Guia novo", changes: ["Mais curto"], captionsUsed: 1 });
  assert.equal(aiCalls[0].model, "opus");
  assert.ok(aiCalls[0].user.includes("Legenda A"));
});

test("routes: video upload checks the type and size, then returns the transcript", async () => {
  assert.equal((await fetch(url("/video"), { method: "POST", headers: { "Content-Type": "text/plain" }, body: "x" })).status, 415);
  assert.equal((await fetch(url("/video"), { method: "POST", headers: { "Content-Type": "video/mp4" }, body: "x".repeat(2000) })).status, 413);
  const res = await fetch(url("/video"), { method: "POST", headers: { "Content-Type": "video/mp4" }, body: "abc" });
  assert.deepEqual(await res.json(), { text: "transcrito", durationS: 12 });
});

test("transcribeVideoStream: real ffmpeg pulls Opus audio and leaves no temp folder", async () => {
  const { execFileSync } = await import("node:child_process");
  const { mkdtempSync, readdirSync, rmSync, createReadStream } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  const { transcribeVideoStream } = await import("./videoAudio");
  const dir = mkdtempSync(join(tmpdir(), "upgrade-test-"));
  try {
    const file = join(dir, "v.mp4");
    execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "sine=frequency=440:duration=2", "-f", "lavfi", "-i", "color=c=black:s=64x64:d=2", "-shortest", "-c:v", "libx264", "-c:a", "aac", file]);
    const before = readdirSync(tmpdir()).filter((f) => f.startsWith("la-upgrade-")).length;
    const seen: string[] = [];
    const out = await transcribeVideoStream(createReadStream(file), 10_000_000, async (audio, mime) => {
      seen.push(`${mime}:${audio.subarray(0, 4).toString()}`);
      return { text: "ola" };
    });
    assert.deepEqual(out.ok && [out.text, Math.round(out.durationS)], ["ola", 2]);
    assert.deepEqual(seen, ["audio/ogg:OggS"]);
    assert.equal(readdirSync(tmpdir()).filter((f) => f.startsWith("la-upgrade-")).length, before);
    const tooBig = await transcribeVideoStream(createReadStream(file), 100, async () => ({ text: "x" }));
    assert.deepEqual(tooBig, { ok: false, status: 413, reason: "size" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
