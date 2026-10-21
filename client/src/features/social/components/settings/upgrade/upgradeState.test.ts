// Upgrade versions, their localStorage form, error keys, previews, and the Settings layout rule.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { settingsLayout } from "../settingsLayout";
import {
  MAX_VERSIONS, UPGRADE_REASONS, addVersion, initialVersions, parseStoredVersions, previewText, selectVersion, upgradeErrorKey, versionsStorageKey,
} from "./upgradeState";

test("settingsLayout: three across only when all three fit at 680px, else one column", () => {
  assert.deepEqual(settingsLayout(2072, 3), { columns: 3, editorMinHeight: 780 });
  assert.deepEqual(settingsLayout(2071, 3), { columns: 1, editorMinHeight: 520 });
  assert.deepEqual(settingsLayout(1400, 3), { columns: 1, editorMinHeight: 520 });
  assert.deepEqual(settingsLayout(3000, 1), { columns: 1, editorMinHeight: 520 });
  assert.deepEqual(settingsLayout(0, 3), { columns: 1, editorMinHeight: 520 });
});

test("versions: v0 is the saved text, each upgrade becomes active, selecting stays in range", () => {
  let s = initialVersions("saved");
  s = addVersion(s, "one", ["a"]);
  s = addVersion(s, "two", []);
  assert.equal(s.active, 2);
  assert.deepEqual(s.versions.map((v) => v.text), ["saved", "one", "two"]);
  assert.equal(selectVersion(s, 0).active, 0);
  assert.equal(selectVersion(s, 9).active, 2);
});

test("versions: past the cap the oldest upgrade goes, never the original", () => {
  let s = initialVersions("saved");
  for (let i = 1; i <= MAX_VERSIONS + 3; i++) s = addVersion(s, `v${i}`, []);
  assert.equal(s.versions.length, MAX_VERSIONS);
  assert.equal(s.versions[0].text, "saved");
  assert.equal(s.versions.at(-1)?.text, `v${MAX_VERSIONS + 3}`);
});

test("stored versions survive a round trip, and are dropped when the saved text changed or the data is bad", () => {
  const s = addVersion(initialVersions("saved"), "new", ["x"]);
  assert.deepEqual(parseStoredVersions(JSON.stringify(s), "saved"), s);
  assert.equal(parseStoredVersions(JSON.stringify(s), "saved elsewhere"), null);
  assert.equal(parseStoredVersions("{not json", "saved"), null);
  assert.equal(parseStoredVersions(JSON.stringify(initialVersions("saved")), "saved"), null);
  assert.equal(parseStoredVersions(null, "saved"), null);
  assert.equal(parseStoredVersions(JSON.stringify({ ...s, active: 7 }), "saved")?.active, 1);
  assert.equal(versionsStorageKey(56, "voice_guide"), "la.social.upgrade.56.voice_guide");
});

test("error keys and previews", () => {
  assert.equal(upgradeErrorKey("video_too_long"), "upgrade.errors.video_too_long");
  assert.equal(upgradeErrorKey("rate_limited"), "errors.rate_limited");
  assert.equal(upgradeErrorKey("whatever"), "errors.failed");
  assert.equal(previewText("a  b\n c"), "a b c");
  assert.ok(previewText("x".repeat(500), 20).length <= 20);
});

test("every upgrade error reason has a message in en, nl and pt, with the same upgrade keys", () => {
  const dir = join(import.meta.dirname, "../../../../../locales");
  const load = (l: string) => JSON.parse(readFileSync(join(dir, l, "social.json"), "utf8")).upgrade;
  const en = load("en");
  for (const l of ["en", "nl", "pt"]) {
    const u = load(l);
    for (const r of UPGRADE_REASONS) assert.ok(u.errors?.[r], `${l}:${r}`);
    assert.deepEqual(Object.keys(u).sort(), Object.keys(en).sort(), l);
    assert.ok(!JSON.stringify(u).includes("—"), `${l} has an em dash`);
  }
});
