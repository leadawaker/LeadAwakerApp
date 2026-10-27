import { test } from "node:test";
import assert from "node:assert/strict";
import { mergeDemoNiche, parseDemoNiche, pickConfigRow, resolveDemoScenario } from "./demoNicheBlob";

test("pickConfigRow prefers the browser row and falls back to the WhatsApp row", () => {
  assert.equal(pickConfigRow([{ channelIdentifier: "wa-demo:x", createdAt: null }])!.channelIdentifier, "wa-demo:x");
  assert.equal(
    pickConfigRow([
      { channelIdentifier: "wa-demo:x", createdAt: null },
      { channelIdentifier: "web-demo:x", createdAt: null },
    ])!.channelIdentifier,
    "web-demo:x",
  );
  assert.equal(
    pickConfigRow([
      { channelIdentifier: "web-demo:x", createdAt: null },
      { channelIdentifier: "wa-demo:x", createdAt: null },
    ])!.channelIdentifier,
    "web-demo:x",
  );
  assert.equal(pickConfigRow([]), undefined);
});

test("resolveDemoScenario reads lead_stage, then scenario, in both vocabularies", () => {
  assert.equal(resolveDemoScenario({ lead_stage: "quoted" }), "deciding");
  assert.equal(resolveDemoScenario({ lead_stage: "Deciding" }), "deciding");
  assert.equal(resolveDemoScenario({ scenario: "decision" }), "deciding");
  assert.equal(resolveDemoScenario({ lead_stage: "inquired", scenario: "deciding" }), "inquired");
  assert.equal(resolveDemoScenario({}), "inquired");
});

test("parseDemoNiche never throws and always returns an object", () => {
  assert.deepEqual(parseDemoNiche("not json"), {});
  assert.deepEqual(parseDemoNiche(null), {});
  assert.deepEqual(parseDemoNiche(undefined), {});
  assert.deepEqual(parseDemoNiche(""), {});
  assert.deepEqual(parseDemoNiche("null"), {});
  assert.deepEqual(parseDemoNiche('{"service":"voice"}'), { service: "voice" });
});

test("mergeDemoNiche merges scalar edits into the row's own blob", () => {
  const own = { service: "voice", company_name: "Old", ai_disclosure: "off", opener_phrase: "hi" };
  assert.deepEqual(mergeDemoNiche(own, { companyName: "New" }), { ...own, company_name: "New" });
  // "" clears the override; it is not "omitted".
  assert.equal(mergeDemoNiche(own, { aiDisclosure: "" }).ai_disclosure, "");
  assert.equal(mergeDemoNiche(own, {}).ai_disclosure, "off");
  assert.equal(own.company_name, "Old"); // the input is not mutated
});

test("mergeDemoNiche replaces the persona but keeps the row's own service and prospect_group", () => {
  const replace = { company_name: "Bakery", client_niche: "bakery", service: "dbr", prospect_group: "web-row-group" };
  const wa = mergeDemoNiche({ service: "voice", prospect_group: "g1", opener_phrase: "stale" }, { replaceNiche: replace });
  assert.equal(wa.service, "voice");
  assert.equal(wa.prospect_group, "g1");
  assert.equal(wa.client_niche, "bakery");
  assert.equal(wa.opener_phrase, undefined);
  // A row with no mint-time tags takes the replacement's.
  const bare = mergeDemoNiche({}, { replaceNiche: replace });
  assert.equal(bare.service, "dbr");
  // Edits in the same patch apply on top of the replacement.
  assert.equal(mergeDemoNiche({}, { replaceNiche: replace, companyName: "Mine" }).company_name, "Mine");
  assert.equal(replace.service, "dbr"); // the shared replacement is not mutated
});

test("mergeDemoNiche keeps a voice link's voice and locale through a Client or language switch", () => {
  const own = { service: "voice", prospect_group: "g1", voice: "abc123", voice_locale: "nl-NL" };
  const out = mergeDemoNiche(own, { replaceNiche: { company_name: "Bakery", voice: "from-client" } });
  assert.equal(out.voice, "abc123");
  assert.equal(out.voice_locale, "nl-NL");
  // A row that never had a voice takes none from the replacement's bookkeeping.
  assert.equal(mergeDemoNiche({ service: "dbr" }, { replaceNiche: { company_name: "Bakery" } }).voice, undefined);
});
