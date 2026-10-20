// The Social strings exist in en, nl and pt with the same keys, and none uses an em dash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(import.meta.dirname, "../../../locales");
const load = (lang: string, ns = "accounts") => JSON.parse(readFileSync(join(dir, lang, `${ns}.json`), "utf8"));

function leaves(obj: unknown, prefix = ""): Map<string, string> {
  const out = new Map<string, string>();
  if (typeof obj === "string") out.set(prefix, obj);
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) for (const [kk, vv] of leaves(v, prefix ? `${prefix}.${k}` : k)) out.set(kk, vv);
  return out;
}

const pick = (d: any) => ({
  social: d.social,
  group: d.integrationGroups?.social,
  state: d.integrationGroups?.state?.social,
});

for (const lang of ["nl", "pt"]) {
  test(`${lang} has every Social string en has, and no extra`, () => {
    const en = leaves(pick(load("en")));
    const other = leaves(pick(load(lang)));
    assert.ok(en.size > 20, "en has the Social strings");
    assert.deepEqual([...other.keys()].sort(), [...en.keys()].sort());
    for (const [k, v] of other) assert.ok(v.trim(), `${lang}:${k} is empty`);
  });
}

test("no em dashes in Social copy", () => {
  for (const lang of ["en", "nl", "pt"]) for (const [k, v] of leaves(pick(load(lang)))) assert.ok(!v.includes("—"), `${lang}:${k}`);
});

test("every connect error reason the server sends has a message", () => {
  const reasons = ["access_denied", "missing_code", "invalid_state", "not_professional", "already_connected", "failed"];
  for (const lang of ["en", "nl", "pt"]) for (const r of reasons) assert.ok(load(lang).social?.connect?.errors?.[r], `${lang}:${r}`);
});

test("every post error reason (lib/posts KNOWN_REASONS) and the fallback has a message", async () => {
  const { KNOWN_REASONS } = await import("./posts");
  for (const lang of ["en", "nl", "pt"]) for (const r of [...KNOWN_REASONS, "failed"]) assert.ok(load(lang).social?.posts?.errors?.[r], `${lang}:${r}`);
});

test("the Socials nav item has a label, and the old account tab is gone", () => {
  for (const lang of ["en", "nl", "pt"]) {
    assert.ok(load(lang, "crm").sidebar?.social, lang);
    assert.equal(load(lang).workspace?.tabs?.social, undefined, lang);
  }
});

for (const lang of ["nl", "pt"]) {
  test(`${lang} social namespace has every key en has, and no extra`, () => {
    const en = leaves(load("en", "social"));
    const other = leaves(load(lang, "social"));
    assert.deepEqual([...other.keys()].sort(), [...en.keys()].sort());
    for (const [k, v] of other) assert.ok(v.trim(), `${lang}:${k} is empty`);
  });
}

test("no em dashes in the social namespace", () => {
  for (const lang of ["en", "nl", "pt"]) for (const [k, v] of leaves(load(lang, "social"))) assert.ok(!v.includes("\u2014"), `${lang}:${k}`);
});

test("every studio error reason and the fallback has a message", async () => {
  const { STUDIO_REASONS } = await import("./studio");
  for (const lang of ["en", "nl", "pt"]) for (const r of [...STUDIO_REASONS, "failed"]) assert.ok(load(lang, "social").errors?.[r], `${lang}:${r}`);
});

test("every status, review state, topic state and section has a label", async () => {
  const { SCRIPT_STATUSES, REVIEW_STATUSES, TOPIC_STATUSES } = await import("@shared/socialStudio");
  const { socialSections } = await import("./socialPage");
  const sections = new Set([...socialSections({ isAgency: true, userRole: "Owner" }), ...socialSections({ isAgency: false, userRole: "Manager" })]);
  for (const lang of ["en", "nl", "pt"]) {
    const d = load(lang, "social");
    for (const s of SCRIPT_STATUSES) assert.ok(d.scripts.statuses[s], `${lang}:scripts.statuses.${s}`);
    for (const s of REVIEW_STATUSES) assert.ok(d.scripts.review[s], `${lang}:scripts.review.${s}`);
    for (const s of TOPIC_STATUSES) assert.ok(d.topics.statuses[s], `${lang}:topics.statuses.${s}`);
    for (const s of sections) assert.ok(d.page.tabs[s], `${lang}:page.tabs.${s}`);
  }
});

test("every literal t(\"...\") key in a social-namespace component exists in en", async () => {
  const { readdirSync, statSync } = await import("node:fs");
  const root = join(import.meta.dirname, "..");
  const files: string[] = [];
  const walk = (d: string) => { for (const n of readdirSync(d)) { const p = join(d, n); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".tsx")) files.push(p); } };
  walk(root);
  const en = leaves(load("en", "social"));
  const has = (k: string) => en.has(k) || en.has(`${k}_one`);
  let checked = 0;
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    if (!/const \{ t(, i18n)? \} = useTranslation\("social"\)/.test(src)) continue;
    // t("key") and the keys inside t(cond ? "a" : "b"): any quoted dotted key under a top-level group.
    for (const m of src.matchAll(/"((?:page|captions|settings|about|topics|scripts|heygen|home|calendar|errors|comments|insights)\.[a-zA-Z_.]+)"/g)) {
      checked++;
      assert.ok(has(m[1]), `${f.slice(root.length)}: ${m[1]}`);
    }
  }
  assert.ok(checked > 50, `checked ${checked} keys`);
});

test("comment-to-DM: every mode, log kind, status and engine reason has a label", async () => {
  const { DM_MODES } = await import("@shared/socialStudio");
  const kinds = ["private_reply", "reply", "inbound", "opt_out", "ai_follow_up"];
  const statuses = ["would_send", "sending", "sent", "failed", "skipped", "received"];
  // Reasons dmEngine.ts writes to the log (a Meta error text is shown as it is).
  const reasons = ["opted_out", "window_closed", "hourly_cap", "not_connected", "engine_not_connected", "dm_off"];
  for (const lang of ["en", "nl", "pt"]) {
    const c = load(lang, "social").comments;
    for (const m of DM_MODES) assert.ok(c.modes[m] && c.modeHelp[m], `${lang}:${m}`);
    for (const k of kinds) assert.ok(c.kinds[k], `${lang}:kinds.${k}`);
    for (const s of statuses) assert.ok(c.statuses[s], `${lang}:statuses.${s}`);
    for (const r of reasons) assert.ok(c.reasons[r], `${lang}:reasons.${r}`);
  }
});
