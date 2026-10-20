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
