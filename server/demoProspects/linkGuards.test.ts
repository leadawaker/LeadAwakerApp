import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_DEMO_SOURCE } from "@shared/demoTokenTtl";
import type { DemoLeadLite } from "../demoSessionsFold";
import { editsPublicDemoSettings, groupHoldsPublicDemo, holdsPublicDemo, remintRefusal } from "./linkGuards";

const row = (over: Partial<DemoLeadLite>): DemoLeadLite => ({
  id: 1,
  channelIdentifier: "wa-demo:aaaa1111",
  firstName: "Johan",
  language: "nl",
  demoNiche: "{}",
  demoInvited: true,
  source: "WhatsApp Demo",
  phone: null,
  campaignsId: 7,
  createdAt: new Date("2026-10-20T10:00:00Z"),
  conversionStatus: null,
  demoRevokedAt: null,
  ...over,
});

const prev = { firstName: "Johan", companyName: "Meure", clientNiche: "Meure Auto", language: "nl", aiDisclosure: "", market: "" } as const;

test("holdsPublicDemo: any row from the public website makes the set public", () => {
  assert.equal(holdsPublicDemo([row({}), row({ id: 2, channelIdentifier: "web-demo:aaaa1111", source: "Web Demo" })]), false);
  assert.equal(holdsPublicDemo([row({ source: PUBLIC_DEMO_SOURCE })]), true);
  assert.equal(holdsPublicDemo([]), false);
});

test("groupHoldsPublicDemo: only the tokens of that group count", () => {
  const leads = [
    row({ id: 1, channelIdentifier: "wa-demo:aaaa1111", demoNiche: JSON.stringify({ prospect_group: "g1" }) }),
    row({ id: 2, channelIdentifier: "wa-demo:bbbb2222", demoNiche: "{}", source: PUBLIC_DEMO_SOURCE }),
  ];
  assert.equal(groupHoldsPublicDemo(leads, "g1"), false);
  // An unstamped public demo is addressed as token:<token>, the key its row has on the page.
  assert.equal(groupHoldsPublicDemo(leads, "token:bbbb2222"), true);
  assert.equal(groupHoldsPublicDemo(leads, "nope"), false);
  // A group that also holds a public token is refused whichever row carries the source.
  const mixed = [
    row({ id: 3, channelIdentifier: "wa-demo:cccc3333", demoNiche: JSON.stringify({ prospect_group: "g2" }) }),
    row({ id: 4, channelIdentifier: "wa-demo:dddd4444", demoNiche: JSON.stringify({ prospect_group: "g2" }), source: PUBLIC_DEMO_SOURCE }),
  ];
  assert.equal(groupHoldsPublicDemo(mixed, "g2"), true);
});

test("editsPublicDemoSettings: notes alone are not a settings edit", () => {
  assert.equal(editsPublicDemoSettings(prev, {}, ""), false);
  assert.equal(editsPublicDemoSettings(prev, { notes: "call back friday" }, ""), false);
});

test("editsPublicDemoSettings: each of the six settings and the website counts when it differs", () => {
  assert.equal(editsPublicDemoSettings(prev, { firstName: "Jo" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { companyName: "Other" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { clientNiche: "Other" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { language: "en" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { aiDisclosure: "opener" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { market: "uk" }, ""), true);
  assert.equal(editsPublicDemoSettings(prev, { websiteUrl: "https://new.example" }, ""), true);
});

test("editsPublicDemoSettings: repeating the current value changes nothing", () => {
  assert.equal(editsPublicDemoSettings(prev, { firstName: "Johan", language: "nl", notes: "x" }, ""), false);
  assert.equal(editsPublicDemoSettings(prev, { websiteUrl: "https://same.example" }, "https://same.example"), false);
});

test("remintRefusal: a public demo, a revoked link, and a link with no rows are refused; a live link is not", () => {
  const wa = row({});
  const web = row({ id: 2, channelIdentifier: "web-demo:aaaa1111", source: "Web Demo" });
  assert.equal(remintRefusal([wa, web]), null);
  assert.equal(remintRefusal([]), "missing");
  assert.equal(remintRefusal([row({ source: PUBLIC_DEMO_SOURCE }), web]), "public_demo");
  assert.equal(remintRefusal([row({ demoRevokedAt: new Date("2026-10-25T00:00:00Z") }), web]), "revoked");
});

test("remintRefusal: one revoked row is enough, and a public demo is named before a revoked one", () => {
  const wa = row({});
  const revokedWeb = row({ id: 2, channelIdentifier: "web-demo:aaaa1111", source: "Web Demo", demoRevokedAt: new Date("2026-10-25T00:00:00Z") });
  assert.equal(remintRefusal([wa, revokedWeb]), "revoked");
  assert.equal(remintRefusal([row({ source: PUBLIC_DEMO_SOURCE, demoRevokedAt: new Date("2026-10-25T00:00:00Z") }), revokedWeb]), "public_demo");
});
