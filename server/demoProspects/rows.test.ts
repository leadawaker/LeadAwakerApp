import { test } from "node:test";
import assert from "node:assert/strict";
import type { DemoProspectRow } from "@shared/schema";
import { normalizeSettings, prospectDto, settingsFromLeads, tokensInGroup } from "./rows";

const leads = [
  { channelIdentifier: "wa-demo:aaaa1111", firstName: "Johan", language: "nl", demoNiche: JSON.stringify({ prospect_group: "g1", company_name: "Meure" }) },
  { channelIdentifier: "web-demo:aaaa1111", firstName: "Johan", language: "nl", demoNiche: JSON.stringify({ prospect_group: "g1", company_name: "Meure Auto" }) },
  { channelIdentifier: "wa-demo:bbbb2222", firstName: "Anna", language: "en", demoNiche: "{}" },
  { channelIdentifier: "wa-demo:cccc3333", firstName: "X", language: "en", demoNiche: "not json" },
];

test("tokensInGroup: a group's tokens, once each, in input order", () => {
  assert.deepEqual(tokensInGroup(leads, "g1"), ["aaaa1111"]);
  assert.deepEqual(tokensInGroup(leads, "nope"), []);
});

test("tokensInGroup: a legacy ungrouped token is addressed as token:<token>", () => {
  assert.deepEqual(tokensInGroup(leads, "token:bbbb2222"), ["bbbb2222"]);
  assert.deepEqual(tokensInGroup(leads, "token:cccc3333"), ["cccc3333"]);
});

test("tokensInGroup: rows without a demo channel identifier are skipped", () => {
  const odd = [
    { channelIdentifier: null, demoNiche: JSON.stringify({ prospect_group: "g1" }) },
    { channelIdentifier: "other:zzzz9999", demoNiche: JSON.stringify({ prospect_group: "g1" }) },
  ];
  assert.deepEqual(tokensInGroup(odd, "g1"), []);
});

test("settingsFromLeads: the browser row's values come first", () => {
  assert.equal(settingsFromLeads(leads.slice(0, 2)).companyName, "Meure Auto");
  assert.equal(settingsFromLeads(leads.slice(0, 2).reverse()).companyName, "Meure Auto");
});

test("settingsFromLeads: first non-empty value, language defaults to en", () => {
  const s = settingsFromLeads([
    { channelIdentifier: "wa-demo:dddd4444", firstName: "", language: null, demoNiche: JSON.stringify({ client_niche: "Kitchens", ai_disclosure: "opener", market: "uk" }) },
    { channelIdentifier: "wa-demo:eeee5555", firstName: "Sam", language: "", demoNiche: "{}" },
  ]);
  assert.deepEqual(s, { firstName: "Sam", companyName: "", clientNiche: "Kitchens", language: "en", aiDisclosure: "opener", market: "uk" });
  assert.equal(settingsFromLeads([]).language, "en");
});

test("settingsFromLeads: values outside the allowed sets read as unset", () => {
  const s = settingsFromLeads([
    { channelIdentifier: "wa-demo:ffff6666", firstName: "Eva", language: "de", demoNiche: JSON.stringify({ ai_disclosure: "always", market: "de" }) },
  ]);
  assert.equal(s.language, "en");
  assert.equal(s.aiDisclosure, "");
  assert.equal(s.market, "");
});

test("normalizeSettings: market only survives for English, strings are trimmed", () => {
  assert.equal(normalizeSettings({ firstName: " A ", companyName: "", clientNiche: "", language: "nl", aiDisclosure: "", market: "uk" }).market, "");
  const en = normalizeSettings({ firstName: " A ", companyName: " Co ", clientNiche: " Kitchens ", language: "en", aiDisclosure: "", market: "uk" });
  assert.deepEqual(en, { firstName: "A", companyName: "Co", clientNiche: "Kitchens", language: "en", aiDisclosure: "", market: "uk" });
});

const row = (over: Partial<DemoProspectRow> = {}): DemoProspectRow => ({
  id: 1,
  prospectGroup: "g1",
  firstName: "Johan",
  companyName: "Meure",
  clientNiche: "Car dealers",
  language: "nl",
  aiDisclosure: "",
  market: "",
  notes: "Called back Tuesday",
  websiteUrl: "",
  createdAt: new Date("2026-10-20T08:00:00Z"),
  updatedAt: new Date("2026-10-21T09:30:00Z"),
  ...over,
});

test("prospectDto: the row's website wins, else the Client's; the screenshot is the Client's", () => {
  const client = { screenshotPath: "meure.png", websiteUrl: "https://client.example" };
  assert.equal(prospectDto(row({ websiteUrl: "https://row.example" }), client).websiteUrl, "https://row.example");
  assert.equal(prospectDto(row(), client).websiteUrl, "https://client.example");
  assert.equal(prospectDto(row(), client).screenshot, "meure.png");
});

test("prospectDto: no Client reads as empty strings, dates are ISO", () => {
  const dto = prospectDto(row(), null);
  assert.equal(dto.websiteUrl, "");
  assert.equal(dto.screenshot, "");
  assert.equal(dto.createdAt, "2026-10-20T08:00:00.000Z");
  assert.equal(dto.updatedAt, "2026-10-21T09:30:00.000Z");
  assert.equal(dto.prospectGroup, "g1");
  assert.equal(dto.notes, "Called back Tuesday");
  assert.equal(prospectDto(row({ createdAt: null as unknown as Date }), null).createdAt, null);
  assert.equal(prospectDto(row(), { screenshotPath: null, websiteUrl: null }).screenshot, "");
});
