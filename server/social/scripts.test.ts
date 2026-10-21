import { test } from "node:test";
import assert from "node:assert/strict";
import type { SocialScript } from "@shared/schema";
import { effectiveScriptStatus } from "@shared/socialStudio";
import { buildScriptPrompt, parseScriptDraft, parseScriptEditBody, planReview, planScriptEdit, recentCloses } from "./scripts";

const s = (over: Partial<SocialScript>) => ({ id: 1, body: "", status: "draft", reviewStatus: "none", ...over }) as SocialScript;

test("a linked post decides the shown status; cancelled and failed posts do not", () => {
  assert.equal(effectiveScriptStatus("video_ready", { status: "scheduled" }), "scheduled");
  assert.equal(effectiveScriptStatus("video_ready", { status: "held" }), "scheduled");
  assert.equal(effectiveScriptStatus("scheduled", { status: "published" }), "published");
  assert.equal(effectiveScriptStatus("video_ready", { status: "failed" }), "video_ready");
  assert.equal(effectiveScriptStatus("approved", null), "approved");
});

test("recent closes: last spoken line of the other scripts, no fences, no repeats", () => {
  const closes = recentCloses([
    { id: 1, body: "a\nEntão, se precisar de ajuda, é só entrar em contato." },
    { id: 2, body: "```\nb\nÉ só mandar que eu respondo.\n```" },
    { id: 3, body: "c\nEntão, se precisar de ajuda, é só entrar em contato." },
    { id: 4, body: "" },
  ], 9);
  assert.deepEqual(closes, ["Então, se precisar de ajuda, é só entrar em contato.", "É só mandar que eu respondo."]);
  assert.deepEqual(recentCloses([{ id: 9, body: "x\nmine" }], 9), []);
});

test("an edit after the script was sent drops the review; a body on an idea makes it a draft", () => {
  assert.deepEqual(planScriptEdit(s({ body: "old", reviewStatus: "ok" }), { body: "new" }), { body: "new", reviewStatus: "none", reviewNote: null });
  assert.deepEqual(planScriptEdit(s({ body: "old", reviewStatus: "waiting" }), { body: "new" }), { body: "new", reviewStatus: "none", reviewNote: null });
  assert.deepEqual(planScriptEdit(s({ title: "a", body: "old", reviewStatus: "waiting" }), { title: "b" }), { title: "b", reviewStatus: "none", reviewNote: null });
  assert.deepEqual(planScriptEdit(s({ body: "same", reviewStatus: "ok" }), { body: "same" }), { body: "same" });
  assert.equal(planScriptEdit(s({ status: "idea" }), { body: "texto" }).status, "draft");
  assert.equal(planScriptEdit(s({ status: "idea" }), { title: "t" }).status, undefined);
});

test("the Manager's ok approves a draft, never moves a script back", () => {
  const now = new Date();
  assert.equal(planReview(s({ status: "draft" }), "ok", null, 21, now).status, "approved");
  assert.equal(planReview(s({ status: "video_ready" }), "ok", null, 21, now).status, undefined);
  assert.equal(planReview(s({ status: "draft" }), "changes", "mais curto", 21, now).status, undefined);
  assert.equal(planReview(s({ status: "approved" }), "changes", "mais curto", 21, now).status, "draft");
});

test("edit body: only idea, draft and approved by hand", () => {
  assert.equal(parseScriptEditBody({ status: "approved" }).ok, true);
  assert.equal(parseScriptEditBody({ status: "scheduled" }).ok, false);
  assert.equal(parseScriptEditBody({ title: "" }).ok, false);
  assert.equal(parseScriptEditBody({}).ok, false);
});

test("the draft prompt puts the voice guide first and carries the rules", () => {
  const p = buildScriptPrompt({ voiceGuide: "GUIDE", aboutMe: "CRM", language: "Portuguese", title: "Menopausa", notes: "", currentBody: "", closesUsed: ["Close A"] });
  assert.match(p.system, /^GUIDE/);
  assert.match(p.system, /Brazilian Portuguese/);
  assert.match(p.system, /Never promise results/);
  assert.match(p.user, /Theme: Menopausa/);
  assert.match(p.user, /- Close A/);
  assert.doesNotMatch(p.user, /Notes from the agency/);
});

test("parses the draft answer; an empty or missing body is refused", () => {
  assert.deepEqual(parseScriptDraft('{"title":"T","body":" Então...\\r\\nSegundo "}'), { title: "T", body: "Então...\nSegundo" });
  assert.equal(parseScriptDraft('{"title":"T","body":""}'), null);
  assert.equal(parseScriptDraft("no"), null);
});
