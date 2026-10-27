import { test } from "node:test";
import assert from "node:assert/strict";
import { clientSource, liveTokensByClient } from "./clientUsage";
import type { DemoLeadLite } from "../demoSessionsFold";

const now = Date.parse("2026-10-27T12:00:00Z");
const d = (n: number) => new Date(now - n * 86_400_000);
let seq = 0;
const lead = (
  ident: string,
  blob: object | null,
  created: Date,
  revoked: Date | null = null,
  over: Partial<DemoLeadLite> = {},
): DemoLeadLite => ({
  id: ++seq,
  channelIdentifier: ident,
  demoNiche: blob === null ? null : JSON.stringify(blob),
  createdAt: created,
  demoRevokedAt: revoked,
  firstName: null,
  language: "nl",
  demoInvited: true,
  source: "WhatsApp Demo",
  phone: null,
  campaignsId: 67,
  conversionStatus: null,
  ...over,
});

test("liveTokensByClient counts the live links per client", () => {
  const m = liveTokensByClient(
    [
      lead("wa-demo:a", { client_niche: "Meure", service: "speed" }, d(2)),
      lead("wa-demo:b", { client_niche: "Meure", service: "speed" }, d(9)),
      lead("wa-demo:c", { client_niche: "Meure", service: "voice" }, d(10)),
      lead("wa-demo:e", { client_niche: "Meure" }, d(1), d(0)),
    ],
    now,
  );
  // a (2 days) and c (voice, 10 days) are live; b is expired; e is revoked.
  assert.equal(m.get("Meure"), 2);
});

test("a token with both rows is one link: a recent browser open keeps an old mint live", () => {
  const m = liveTokensByClient(
    [
      lead("wa-demo:a", { client_niche: "Meure", service: "speed" }, d(9)),
      lead("web-demo:a", { client_niche: "Meure" }, d(3)),
      lead("wa-demo:b", { client_niche: "Meure", service: "speed" }, d(9)),
      lead("web-demo:b", { client_niche: "Meure" }, d(8)),
    ],
    now,
  );
  assert.equal(m.get("Meure"), 1);
});

test("the newest row names the client, so a panel switch moves the link to the new client", () => {
  const m = liveTokensByClient(
    [
      lead("wa-demo:a", { client_niche: "Old Client", service: "speed" }, d(2)),
      lead("web-demo:a", { client_niche: "New Client" }, d(1)),
    ],
    now,
  );
  assert.equal(m.get("Old Client"), undefined);
  assert.equal(m.get("New Client"), 1);
});

test("a revoked marker on either row ends the link", () => {
  const m = liveTokensByClient(
    [
      lead("wa-demo:a", { client_niche: "Meure", service: "speed" }, d(2)),
      lead("web-demo:a", { client_niche: "Meure" }, d(1), d(0)),
    ],
    now,
  );
  assert.equal(m.get("Meure"), undefined);
});

test("rows without a token, a client or a readable blob are ignored", () => {
  const m = liveTokensByClient(
    [
      lead("wa-demo:", { client_niche: "Meure" }, d(1)),
      lead("wa-demo:x", null, d(1)),
      lead("wa-demo:y", { company_name: "No client" }, d(1)),
      lead("other:z", { client_niche: "Meure" }, d(1)),
      lead("wa-demo:w", { client_niche: "Meure", service: "speed" }, d(1), null, { demoNiche: "{not json" }),
    ],
    now,
  );
  assert.equal(m.size, 0);
});

test("clientSource is website when the persona came from a site, else manual", () => {
  assert.equal(clientSource({ websiteUrl: "https://x.nl" }), "website");
  assert.equal(clientSource({ websiteUrl: null }), "manual");
  assert.equal(clientSource({ websiteUrl: "  " }), "manual");
});
