import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import {
  applyVoicePick, createLinkVoiceFields, DEFAULT_OWNER_PHONE, DEFAULT_OWNER_PHONE_BACKUP,
  normaliseVoicePhones, ownerNumberFrom, voiceSettingsSchema,
} from "./demoVoiceSchemas";

test("voice settings: the new demo fields pass", () => {
  const r = voiceSettingsSchema.safeParse({
    engines: { nl: "elevenlabs", "en-GB": "gpt-live", "pt-BR": "gpt-live" },
    elevenVoices: { nl: "PWSsuWP2rj5xoCLT1qsQ", "en-GB": "", "pt-BR": "RGymW84CSmfVugnA5tvA" },
    ownerPhone: "+31684446349",
    ownerPhoneBackup: null,
    ownerPhoneUse: "backup",
  });
  assert.equal(r.success, true);
});

test("voice settings: engine and locale keys are whitelisted", () => {
  assert.equal(voiceSettingsSchema.safeParse({ engines: { nl: "xai" } }).success, false);
  assert.equal(voiceSettingsSchema.safeParse({ engines: { "pt-PT": "gpt-live" } }).success, false);
  assert.equal(voiceSettingsSchema.safeParse({ elevenVoices: { "pt-PT": "x" } }).success, false);
  assert.equal(voiceSettingsSchema.safeParse({ ownerPhoneUse: "both" }).success, false);
});

test("voice settings: unknown keys are dropped", () => {
  const r = voiceSettingsSchema.safeParse({ demoEngine: "gpt-live", secret: 1 });
  assert.equal(r.success && ("secret" in r.data || "demoEngine" in r.data), false);
});

test("phones: owner numbers become E.164, empty clears, bad ones are named", () => {
  const ok = normaliseVoicePhones({ ownerPhone: "06 84446349", ownerPhoneBackup: "" });
  assert.ok("data" in ok);
  assert.equal(ok.data.ownerPhone, "+31684446349");
  assert.equal(ok.data.ownerPhoneBackup, null);
  const bad = normaliseVoicePhones({ ownerPhone: "hello" });
  assert.deepEqual(bad, { bad: ["hello"] });
});

test("phones: forget numbers and engine tests still normalise", () => {
  const r = normaliseVoicePhones({ forgetNumbers: ["0612345678", "+31612345678"], engineTests: [{ number: "0612345678", engine: "elevenlabs" }] });
  assert.ok("data" in r);
  assert.deepEqual(r.data.forgetNumbers, ["+31612345678"]);
  assert.equal(r.data.engineTests![0].number, "+31612345678");
});

test("owner number: setting pick, then defaults", () => {
  assert.equal(ownerNumberFrom(undefined), DEFAULT_OWNER_PHONE);
  assert.equal(ownerNumberFrom({ ownerPhoneUse: "backup" }), DEFAULT_OWNER_PHONE_BACKUP);
  assert.equal(ownerNumberFrom({ ownerPhone: "+447700900123" }), "+447700900123");
  assert.equal(ownerNumberFrom({ ownerPhoneBackup: "+5511999998888", ownerPhoneUse: "backup" }), "+5511999998888");
});

test("ownerNumberFrom falls back to the other configured phone before the defaults", () => {
  // Backup chosen but only the primary is set: ring the primary, not the hardcoded backup.
  assert.equal(ownerNumberFrom({ ownerPhone: "+447700900123", ownerPhoneUse: "backup" }), "+447700900123");
  // Primary chosen but only the backup is set: ring the backup.
  assert.equal(ownerNumberFrom({ ownerPhoneBackup: "+5511999998888", ownerPhoneUse: "primary" }), "+5511999998888");
  assert.equal(ownerNumberFrom({ ownerPhoneBackup: "+5511999998888" }), "+5511999998888");
  // Both set: the chosen one wins.
  assert.equal(ownerNumberFrom({ ownerPhone: "+447700900123", ownerPhoneBackup: "+5511999998888", ownerPhoneUse: "backup" }), "+5511999998888");
  // Cleared (null) phones count as not set.
  assert.equal(ownerNumberFrom({ ownerPhone: null, ownerPhoneBackup: null, ownerPhoneUse: "backup" }), DEFAULT_OWNER_PHONE_BACKUP);
});

test("create-link voice fields and persona stamp", () => {
  const schema = z.object(createLinkVoiceFields);
  assert.equal(schema.safeParse({ voice: "abc", voiceLocale: "en-US" }).success, true);
  assert.equal(schema.safeParse({ voiceLocale: "fr" }).success, false);
  assert.equal(schema.safeParse({ voice: "x".repeat(41) }).success, false);
  assert.deepEqual(applyVoicePick({ service: "voice" }, { voice: "abc", voiceLocale: "nl" }),
    { service: "voice", voice: "abc", voice_locale: "nl" });
  assert.deepEqual(applyVoicePick({ a: 1 }, {}), { a: 1 });
});
