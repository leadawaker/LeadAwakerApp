import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSettingValue, sameSetting, settingText, settingsOf } from "./settingCards";
import { isSettingCardKey, SETTING_CARD_KEYS } from "@shared/voiceSettings";

test("parseSettingValue: greeting and intake take plain text", () => {
  assert.deepEqual(parseSettingValue("greeting", "Goedemiddag, met Frank."), { ok: true, value: "Goedemiddag, met Frank." });
  assert.deepEqual(parseSettingValue("greeting", "x".repeat(501)), { ok: false });
  assert.deepEqual(parseSettingValue("intake", " Kenteken \n\n Kilometerstand "), { ok: true, value: "Kenteken\nKilometerstand" });
  assert.deepEqual(parseSettingValue("intake", "x".repeat(5001)), { ok: false });
});

test("parseSettingValue: afterHours is JSON, one of the modes or null", () => {
  assert.deepEqual(parseSettingValue("afterHours", "\"callback\""), { ok: true, value: "callback" });
  assert.deepEqual(parseSettingValue("afterHours", "\"sometimes\""), { ok: false });
  assert.deepEqual(parseSettingValue("afterHours", "null"), { ok: true, value: null });
  assert.deepEqual(parseSettingValue("afterHours", "callback"), { ok: false });
});

test("parseSettingValue: screening needs the full object", () => {
  assert.deepEqual(parseSettingValue("screening", "{\"sales\":true,\"robocalls\":true}"), { ok: false });
  assert.deepEqual(
    parseSettingValue("screening", "{\"sales\":true,\"robocalls\":false,\"abuse\":true}"),
    { ok: true, value: { sales: true, robocalls: false, abuse: true } },
  );
  assert.deepEqual(parseSettingValue("screening", "{\"sales\":true,\"robocalls\":false,\"abuse\":true,\"x\":1}"), { ok: false });
});

test("parseSettingValue: pronunciation is JSON, at most 50 rows", () => {
  assert.deepEqual(parseSettingValue("pronunciation", JSON.stringify(Array(51).fill({ word: "a", sayAs: "b" }))), { ok: false });
  assert.deepEqual(parseSettingValue("pronunciation", "not json"), { ok: false });
  assert.deepEqual(
    parseSettingValue("pronunciation", JSON.stringify([{ word: "Hoffmann", sayAs: "Hofman" }])),
    { ok: true, value: [{ word: "Hoffmann", sayAs: "Hofman" }] },
  );
  assert.deepEqual(parseSettingValue("pronunciation", JSON.stringify([{ word: "a" }])), { ok: false });
});

test("sameSetting compares canonical JSON and normalised intake", () => {
  assert.equal(sameSetting("screening", { sales: true, robocalls: false, abuse: true }, { abuse: true, robocalls: false, sales: true }), true);
  assert.equal(sameSetting("screening", { sales: true, robocalls: false, abuse: true }, { sales: true, robocalls: true, abuse: true }), false);
  assert.equal(sameSetting("intake", "a\n\nb ", "a\nb"), true);
  assert.equal(sameSetting("intake", "a\nb", "a\nc"), false);
  assert.equal(sameSetting("afterHours", null, null), true);
  assert.equal(sameSetting("afterHours", null, "message"), false);
  assert.equal(sameSetting("greeting", "Hoi", "Hoi "), false);
  assert.equal(sameSetting("pronunciation", [{ word: "a", sayAs: "b" }], [{ sayAs: "b", word: "a" }]), true);
});

test("settingsOf turns nulls into empty values and normalises intake", () => {
  const s = settingsOf({ greeting: null, intake: null, pronunciation: null, afterHours: null, screening: { sales: false, robocalls: true, abuse: true } });
  assert.deepEqual(s.pronunciation, []);
  assert.equal(s.greeting, "");
  assert.equal(s.intake, "");
  assert.equal(s.afterHours, null);
  assert.deepEqual(s.screening, { sales: false, robocalls: true, abuse: true });
  assert.equal(settingsOf({ greeting: "Hoi", intake: " a \n\n b ", pronunciation: [], afterHours: "ringHot", screening: s.screening }).intake, "a\nb");
});

test("settingText gives strings as is and everything else as JSON", () => {
  assert.equal(settingText("hi"), "hi");
  assert.equal(settingText({ a: 1 }), "{\"a\":1}");
  assert.equal(settingText(null), "null");
  assert.equal(settingText([{ word: "a", sayAs: "b" }]), "[{\"word\":\"a\",\"sayAs\":\"b\"}]");
});

test("isSettingCardKey only accepts the whitelist", () => {
  for (const k of SETTING_CARD_KEYS) assert.equal(isSettingCardKey(k), true);
  assert.equal(isSettingCardKey("transferNumber"), false);
  assert.equal(isSettingCardKey(undefined), false);
  assert.equal(isSettingCardKey(5), false);
});
