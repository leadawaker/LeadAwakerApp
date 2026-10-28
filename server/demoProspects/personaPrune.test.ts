import { test } from "node:test";
import assert from "node:assert/strict";
import { HOME_IMPROVEMENT_CATEGORIES, selectPrunablePersonas, tokensEverByClient } from "./personaPrune";
import type { DemoLeadLite } from "../demoSessionsFold";

const base = { label: "L", isDemoClient: true, isLive: false, websiteUrl: null };
const clients = [
  { ...base, niche: "Floor Experts", category: "Home & Trades" },
  { ...base, niche: "Stone Studio", category: "Kitchens & Interiors" },
  { ...base, niche: "Used Kitchens", category: "Kitchens & Interiors", isDemoClient: false },
  { ...base, niche: "Meure Auto", category: "Automotive" },
  { ...base, niche: "Roofers", category: "Home & Trades", websiteUrl: "https://r.nl" },
  { ...base, niche: "Busy Builders", category: "Home & Trades" },
  { ...base, niche: "Prospected", category: "Home Services" },
];

test("selects idle home-improvement personas and reports the tokens ever minted", () => {
  const out = selectPrunablePersonas(
    clients,
    new Map([["Busy Builders", 1]]),
    new Set(["Prospected"]),
    new Map([["Floor Experts", 3]]),
  );
  assert.deepEqual(out.map((c) => c.niche), ["Floor Experts", "Stone Studio"]);
  assert.equal(out[0].tokensEver, 3);
  assert.equal(out[1].tokensEver, 0);
  assert.equal(out[0].category, "Home & Trades");
});

test("covers all five home-improvement categories", () => {
  const all = HOME_IMPROVEMENT_CATEGORIES.map((category, i) => ({ ...base, niche: `P${i}`, category }));
  assert.equal(selectPrunablePersonas(all, new Map(), new Set(), new Map()).length, 5);
});

test("never selects a live voice persona, a null category or a blank-website lookalike", () => {
  const out = selectPrunablePersonas(
    [
      { ...base, niche: "Live", category: "Home & Trades", isLive: true },
      { ...base, niche: "NoCategory", category: null },
      { ...base, niche: "Blank", category: "Home & Trades", websiteUrl: "   " },
      { ...base, niche: "Spaced", category: " Home & Trades " },
    ],
    new Map(),
    new Set(),
    new Map(),
  );
  assert.deepEqual(out.map((c) => c.niche), ["Blank", "Spaced"]);
});

test("a zero live count does not block, a positive one does", () => {
  const one = [{ ...base, niche: "A", category: "Home Services" }];
  assert.equal(selectPrunablePersonas(one, new Map([["A", 0]]), new Set(), new Map()).length, 1);
  assert.equal(selectPrunablePersonas(one, new Map([["A", 2]]), new Set(), new Map()).length, 0);
});

const at = new Date("2026-10-01T10:00:00Z");
const lead = (ident: string, blob: object | null, id: number): DemoLeadLite => ({
  id,
  channelIdentifier: ident,
  demoNiche: blob === null ? null : JSON.stringify(blob),
  createdAt: at,
  demoRevokedAt: null,
  firstName: null,
  language: "nl",
  demoInvited: true,
  source: "WhatsApp Demo",
  phone: null,
  campaignsId: 67,
  conversionStatus: null,
});

test("tokensEverByClient counts each token once, expired and revoked included", () => {
  const leads = [
    lead("wa-demo:t1", { client_niche: "Floor Experts" }, 1),
    lead("web-demo:t1", { client_niche: "Floor Experts" }, 2),
    lead("wa-demo:t2", { client_niche: "Floor Experts" }, 3),
    lead("wa-demo:t3", { client_niche: "Stone Studio" }, 4),
    lead("wa-demo:t4", null, 5),
    lead("wa-other:t5", { client_niche: "Stone Studio" }, 6),
  ];
  const ever = tokensEverByClient(leads);
  assert.equal(ever.get("Floor Experts"), 2);
  assert.equal(ever.get("Stone Studio"), 1);
  assert.equal(ever.size, 2);
});

test("tokensEverByClient follows a panel switch to the newest row's persona", () => {
  const older = { ...lead("wa-demo:t1", { client_niche: "Old Persona" }, 1), createdAt: new Date("2026-10-01T10:00:00Z") };
  const newer = { ...lead("web-demo:t1", { client_niche: "New Persona" }, 2), createdAt: new Date("2026-10-02T10:00:00Z") };
  const ever = tokensEverByClient([older, newer]);
  assert.equal(ever.get("New Persona"), 1);
  assert.equal(ever.has("Old Persona"), false);
});
