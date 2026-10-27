import { test } from "node:test";
import assert from "node:assert/strict";
import { PUBLIC_DEMO_SOURCE } from "@shared/demoTokenTtl";
import {
  executeGate,
  parseCleanupArgs,
  planDeadLinkCleanup,
  tokenFingerprint,
  type CleanupLead,
} from "./cleanupPlan";

const now = Date.parse("2026-10-28T12:00:00Z");
const d = (days: number) => new Date(now - days * 86_400_000);
const CAMPAIGNS = new Set([60, 67, 68, 69, 70]);

let seq = 0;
function lead(ident: string, days: number, over: Partial<CleanupLead> & { blob?: object } = {}): CleanupLead {
  const { blob, ...rest } = over;
  return {
    id: ++seq,
    channelIdentifier: ident,
    firstName: "Dead",
    language: "nl",
    demoNiche: JSON.stringify({ company_name: "Dead Co", ...(blob ?? {}) }),
    demoInvited: true,
    source: "WhatsApp Demo",
    phone: null,
    campaignsId: 60,
    createdAt: d(days),
    conversionStatus: null,
    demoRevokedAt: null,
    inbound: 0,
    ...rest,
  };
}

const leads: CleanupLead[] = [
  lead("wa-demo:dead0001", 9, { blob: { service: "speed" } }),
  lead("wa-demo:repl0001", 9, { blob: { service: "speed" }, inbound: 2 }),
  lead("web-demo:publ0001", 60, { source: PUBLIC_DEMO_SOURCE, phone: "+31600000000" }),
  lead("wa-demo:gone0001", 3, { campaignsId: 999 }),
  lead("web-demo:orph0001", 2),
  lead("wa-demo:voic0001", 10, { blob: { service: "voice" } }),
  lead("wa-demo:revk0001", 1, { demoRevokedAt: d(0.5) }),
];

test("plans exactly the dead tokens and counts what it keeps", () => {
  const plan = planDeadLinkCleanup(leads, CAMPAIGNS, now);
  assert.deepEqual(
    plan.tokens.map((t) => [t.token, t.reason]).sort(),
    [
      ["dead0001", "expired"],
      ["gone0001", "deleted_campaign"],
      ["orph0001", "orphan_web"],
      ["revk0001", "expired"],
    ].sort(),
  );
  assert.deepEqual(plan.kept, { replied: 1, public: 1, live: 1 });
  assert.ok(plan.tokens.every((t) => !t.label.includes(t.token)));
  assert.deepEqual(plan.tokens.find((t) => t.token === "dead0001")!.leadIds.length, 1);
});

test("labels carry the first name and the company", () => {
  const plan = planDeadLinkCleanup(leads, CAMPAIGNS, now);
  assert.equal(plan.tokens.find((t) => t.token === "dead0001")!.label, "Dead (Dead Co)");
  const bare = planDeadLinkCleanup(
    [lead("wa-demo:bare0001", 20, { firstName: null, demoNiche: null })],
    CAMPAIGNS,
    now,
  );
  assert.equal(bare.tokens[0].label, "(unnamed)");
});

test("both rows of a token go together, and a reply on either row keeps the token", () => {
  const wa = lead("wa-demo:pair0001", 20);
  const web = lead("web-demo:pair0001", 19);
  const gone = planDeadLinkCleanup([wa, web], CAMPAIGNS, now);
  assert.deepEqual(gone.tokens[0].leadIds.sort(), [wa.id, web.id].sort());

  const kept = planDeadLinkCleanup([wa, { ...web, inbound: 1 }], CAMPAIGNS, now);
  assert.deepEqual(kept.tokens, []);
  assert.equal(kept.kept.replied, 1);
});

test("a chat link opened inside the window is still live, an old open is not", () => {
  const wa = lead("wa-demo:open0001", 9);
  const recentOpen = planDeadLinkCleanup([wa, lead("web-demo:open0001", 2)], CAMPAIGNS, now);
  assert.deepEqual(recentOpen.tokens, []);
  assert.equal(recentOpen.kept.live, 1);

  const oldOpen = planDeadLinkCleanup([wa, lead("web-demo:open0001", 8)], CAMPAIGNS, now);
  assert.deepEqual(oldOpen.tokens.map((t) => t.reason), ["expired"]);
});

test("a voice link lives 14 days and then goes", () => {
  const plan = planDeadLinkCleanup([lead("wa-demo:voic0002", 15, { blob: { service: "voice" } })], CAMPAIGNS, now);
  assert.deepEqual(plan.tokens.map((t) => t.reason), ["expired"]);
});

test("a row with no campaign is not a deleted campaign, a missing one is", () => {
  const none = planDeadLinkCleanup([lead("wa-demo:nocp0001", 1, { campaignsId: null })], CAMPAIGNS, now);
  assert.deepEqual(none.tokens, []);
  assert.equal(none.kept.live, 1);

  const web = lead("web-demo:cmp20001", 1, { campaignsId: 999 });
  const wa = lead("wa-demo:cmp20001", 1, { campaignsId: 60 });
  const mixed = planDeadLinkCleanup([wa, web], CAMPAIGNS, now);
  assert.deepEqual(mixed.tokens.map((t) => t.reason), ["deleted_campaign"]);
});

test("order of the rules: public, then replied, then orphan, campaign, expiry", () => {
  // A public demo is kept even when it is a lone browser row on a deleted campaign.
  const pub = lead("web-demo:ord10001", 90, { source: PUBLIC_DEMO_SOURCE, campaignsId: 999 });
  // A reply beats a deleted campaign and an old mint.
  const replied = lead("wa-demo:ord20001", 90, { campaignsId: 999, inbound: 3 });
  // A lone browser row on a deleted campaign reads as the orphan, not the campaign.
  const orphan = lead("web-demo:ord30001", 90, { campaignsId: 999 });
  // A deleted campaign beats expiry.
  const camp = lead("wa-demo:ord40001", 90, { campaignsId: 999 });
  const plan = planDeadLinkCleanup([pub, replied, orphan, camp], CAMPAIGNS, now);
  assert.deepEqual(plan.tokens.map((t) => [t.token, t.reason]), [
    ["ord30001", "orphan_web"],
    ["ord40001", "deleted_campaign"],
  ]);
  assert.deepEqual(plan.kept, { replied: 1, public: 1, live: 0 });
});

test("rows that are not demo links are ignored and an empty list plans nothing", () => {
  const plan = planDeadLinkCleanup([lead("other:xyz", 100), lead("wa-demo:", 100)], CAMPAIGNS, now);
  assert.deepEqual(plan, { tokens: [], kept: { replied: 0, public: 0, live: 0 } });
  assert.deepEqual(planDeadLinkCleanup([], CAMPAIGNS, now).tokens, []);
});

test("no flags is the dry run, and only the two known flags parse", () => {
  assert.deepEqual(parseCleanupArgs([]), { execute: false, confirm: null, error: null });
  assert.deepEqual(parseCleanupArgs(["--execute", "--confirm=12"]), { execute: true, confirm: 12, error: null });
  assert.deepEqual(parseCleanupArgs(["--execute"]), { execute: true, confirm: null, error: null });
  assert.match(parseCleanupArgs(["--exec"]).error ?? "", /Unknown argument: --exec/);
  assert.match(parseCleanupArgs(["--confirm=abc", "--execute"]).error ?? "", /Unknown argument/);
  assert.match(parseCleanupArgs(["--confirm=3"]).error ?? "", /only goes with --execute/);
});

test("deleting needs the confirm to equal the planned count", () => {
  assert.deepEqual(executeGate(parseCleanupArgs(["--execute", "--confirm=4"]), 4), { ok: true });
  const missing = executeGate(parseCleanupArgs(["--execute"]), 4);
  assert.equal(missing.ok, false);
  assert.match(missing.ok ? "" : missing.message, /--confirm=4/);
  assert.equal(executeGate(parseCleanupArgs(["--execute", "--confirm=5"]), 4).ok, false);
  assert.equal(executeGate(parseCleanupArgs(["--execute", "--confirm=0"]), 4).ok, false);
});

test("a fingerprint is 4 characters then dots, never the whole token", () => {
  assert.equal(tokenFingerprint("dead0001"), "dead...");
  assert.equal(tokenFingerprint("ab"), "ab...");
});
