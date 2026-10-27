import { test } from "node:test";
import assert from "node:assert/strict";
import { foldDemoLeads, type DemoLeadLite } from "./demoSessionsFold";

const lead = (over: Partial<DemoLeadLite> & { id: number }): DemoLeadLite => ({
  channelIdentifier: null,
  firstName: "Sam",
  language: "en",
  demoNiche: null,
  demoInvited: false,
  source: null,
  phone: null,
  campaignsId: null,
  createdAt: null,
  conversionStatus: null,
  demoRevokedAt: null,
  ...over,
});

const opts = {
  now: Date.parse("2026-10-27T12:00:00Z"),
  linksFor: (t: string) => ({ demoUrl: `u/${t}`, whatsappUrl: `w/${t}` }),
};

const leads: DemoLeadLite[] = [
  lead({
    id: 4,
    channelIdentifier: "web-demo:abcd1234",
    createdAt: new Date("2026-10-12T09:00:00Z"),
    demoNiche: JSON.stringify({ ai_disclosure: "opener" }),
  }),
  lead({
    id: 3,
    channelIdentifier: "wa-demo:abcd1234",
    createdAt: new Date("2026-10-10T09:00:00Z"),
    demoNiche: JSON.stringify({
      service: "voice",
      prospect_group: "g1",
      ai_disclosure: "off",
      market: "uk",
      company_name: "Garage",
    }),
  }),
  lead({
    id: 2,
    channelIdentifier: "wa-demo:ffff0000",
    createdAt: new Date("2026-10-26T09:00:00Z"),
    demoRevokedAt: new Date("2026-10-27T08:00:00Z"),
  }),
  lead({
    id: 1,
    channelIdentifier: "wa-demo:11112222",
    createdAt: new Date("2026-10-27T09:00:00Z"),
    source: "Public Website Demo",
    phone: null,
  }),
];

test("foldDemoLeads folds both surfaces into one row per token and skips unverified public demos", () => {
  const rows = foldDemoLeads(leads, new Map(), opts);
  assert.equal(rows.length, 2);
  const a = rows.find((r) => r.token === "abcd1234")!;
  assert.equal(a.aiDisclosure, "opener"); // browser row wins
  assert.equal(a.market, "uk"); // browser row has none, so the WhatsApp row's stands
  assert.equal(a.expired, true); // voice minted 17 days ago
  assert.equal(a.revokedAt, null);
  assert.equal(a.prospectGroup, "g1");
  assert.equal(a.service, "voice");
  assert.equal(a.companyName, "Garage");
  assert.equal(a.demoUrl, "u/abcd1234");
  assert.equal(a.whatsappUrl, "w/abcd1234");
  const b = rows.find((r) => r.token === "ffff0000")!;
  assert.ok(b.revokedAt);
  assert.equal(b.expired, true);
});

test("foldDemoLeads lists the newest mint first", () => {
  const rows = foldDemoLeads(leads, new Map(), opts);
  assert.deepEqual(rows.map((r) => r.token), ["ffff0000", "abcd1234"]);
});

test("a chat link is live inside seven days and when opened inside seven days", () => {
  const wa = (token: string, createdAt: string) =>
    lead({ id: 10, channelIdentifier: `wa-demo:${token}`, createdAt: new Date(createdAt), demoNiche: "{}" });
  const web = (token: string, createdAt: string) =>
    lead({ id: 11, channelIdentifier: `web-demo:${token}`, createdAt: new Date(createdAt), demoNiche: "{}" });
  // Minted 10 days ago, never opened: expired.
  assert.equal(foldDemoLeads([wa("aaaaaaaa", "2026-10-17T12:00:00Z")], new Map(), opts)[0].expired, true);
  // Minted 10 days ago, opened 2 days ago: live.
  assert.equal(
    foldDemoLeads([wa("bbbbbbbb", "2026-10-17T12:00:00Z"), web("bbbbbbbb", "2026-10-25T12:00:00Z")], new Map(), opts)[0].expired,
    false,
  );
  // Minted 3 days ago: live.
  assert.equal(foldDemoLeads([wa("cccccccc", "2026-10-24T12:00:00Z")], new Map(), opts)[0].expired, false);
});

test("a voice link is live for 14 days: ten days old and never opened is not expired", () => {
  const voice = (token: string, createdAt: string) =>
    lead({ id: 30, channelIdentifier: `wa-demo:${token}`, createdAt: new Date(createdAt), demoNiche: JSON.stringify({ service: "voice" }) });
  // Same age as the chat link above that expired, but the service reaches isLinkExpired.
  assert.equal(foldDemoLeads([voice("ffffffff", "2026-10-17T12:00:00Z")], new Map(), opts)[0].expired, false);
  assert.equal(foldDemoLeads([voice("99999999", "2026-10-12T12:00:00Z")], new Map(), opts)[0].expired, true);
});

test("a lone browser row counts its first open as the mint (older than seven days is expired)", () => {
  const only = lead({
    id: 12,
    channelIdentifier: "web-demo:dddddddd",
    createdAt: new Date("2026-10-01T12:00:00Z"),
    demoNiche: "{}",
  });
  assert.equal(foldDemoLeads([only], new Map(), opts)[0].expired, true);
});

test("revoked on either row is revoked and expired", () => {
  const rows = foldDemoLeads(
    [
      lead({ id: 21, channelIdentifier: "web-demo:eeeeeeee", createdAt: new Date("2026-10-26T12:00:00Z"), demoNiche: "{}", demoRevokedAt: new Date("2026-10-27T01:00:00Z") }),
      lead({ id: 20, channelIdentifier: "wa-demo:eeeeeeee", createdAt: new Date("2026-10-26T10:00:00Z"), demoNiche: "{}" }),
    ],
    new Map(),
    opts,
  );
  assert.equal(rows.length, 1);
  assert.ok(rows[0].revokedAt);
  assert.equal(rows[0].expired, true);
});

test("reply counts land on the right surface", () => {
  const replies = new Map([[3, { n: 2, first: new Date("2026-10-11T09:00:00Z"), last: new Date("2026-10-12T09:00:00Z") }]]);
  const a = foldDemoLeads(leads, replies, opts).find((r) => r.token === "abcd1234")!;
  assert.equal(a.whatsapp.opened, true);
  assert.equal(a.whatsapp.replies, 2);
  assert.equal(a.browser.opened, true);
  assert.equal(a.browser.replies, 0);
});
