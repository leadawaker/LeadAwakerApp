import { test } from "node:test";
import assert from "node:assert/strict";
import { BOOKKEEPING_KEYS, needsRebuild, planTokenRewrites, rewriteBlob, settingsChanged } from "./personaRewrite";

const prev = { firstName: "Johan", companyName: "Meure", clientNiche: "Meure Auto", language: "nl", aiDisclosure: "", market: "" } as const;

test("settingsChanged and needsRebuild tell a name edit from a persona edit", () => {
  assert.equal(settingsChanged(prev, { ...prev }), false);
  assert.equal(settingsChanged(prev, { ...prev, firstName: "Jo" }), true);
  assert.equal(needsRebuild(prev, { ...prev, firstName: "Jo" }), false);
  assert.equal(needsRebuild(prev, { ...prev, language: "en" }), true);
  assert.equal(needsRebuild(prev, { ...prev, clientNiche: "Other" }), true);
  assert.equal(needsRebuild({ ...prev, language: "en" }, { ...prev, language: "en", market: "uk" }), true);
  // Without a Client there is nothing to rebuild from.
  assert.equal(needsRebuild({ ...prev, clientNiche: "" }, { ...prev, clientNiche: "", language: "en" }), false);
});

test("rewriteBlob keeps the persona on a plain edit and swaps it on a rebuild", () => {
  const blob = { service: "voice", prospect_group: "g1", voice: "abc", voice_locale: "nl-NL", company_name: "Meure", kb: "old", ai_disclosure: "off" };
  const kept = rewriteBlob(blob, { ...prev, aiDisclosure: "opener" }, null);
  assert.equal(kept.kb, "old");
  assert.equal(kept.ai_disclosure, "opener");
  assert.equal(kept.service, "voice");

  const rebuilt = rewriteBlob(blob, { ...prev, language: "en" }, { kb: "new", company_name: "Meure Auto BV" });
  assert.equal(rebuilt.kb, "new");
  assert.equal(rebuilt.voice, "abc");
  assert.equal(rebuilt.voice_locale, "nl-NL");
  assert.equal(rebuilt.prospect_group, "g1");
  assert.equal(rebuilt.company_name, "Meure");
  assert.equal(rebuilt.client_niche, "Meure Auto");
  assert.equal(rewriteBlob(blob, { ...prev, companyName: "" }, { company_name: "Client Co" }).company_name, "Client Co");
  assert.equal(blob.kb, "old"); // the input blob is not mutated
});

test("rewriteBlob writes the disclosure even when it is cleared, and the market always", () => {
  const out = rewriteBlob({ ai_disclosure: "off", market: "uk" }, { ...prev, language: "en", market: "us" }, null);
  assert.equal(out.market, "us");
  assert.equal(rewriteBlob({ ai_disclosure: "off" }, { ...prev, aiDisclosure: "" }, null).ai_disclosure, "");
  assert.equal(rewriteBlob({ company_name: "Mine" }, { ...prev, companyName: "" }, null).company_name, "Mine");
});

test("BOOKKEEPING_KEYS names what a link keeps through a rebuild", () => {
  assert.deepEqual([...BOOKKEEPING_KEYS], ["service", "prospect_group", "voice", "voice_locale"]);
});

test("planTokenRewrites: both rows when both exist, one when only one exists", () => {
  const leads = [
    { id: 1, channelIdentifier: "wa-demo:t1", demoNiche: "{}" },
    { id: 2, channelIdentifier: "web-demo:t1", demoNiche: "{}" },
    { id: 3, channelIdentifier: "wa-demo:t2", demoNiche: "{}" },
  ];
  assert.deepEqual(planTokenRewrites(leads, ["t1", "t2"], { ...prev }, () => null).map((r) => r.leadId), [1, 2, 3]);
  assert.equal(planTokenRewrites(leads, ["t2"], { ...prev, firstName: "Jo" }, () => null)[0].firstName, "Jo");
  // A token outside the list is left alone.
  assert.deepEqual(planTokenRewrites(leads, ["t2"], { ...prev }, () => null).map((r) => r.leadId), [3]);
});

test("planTokenRewrites: each row is rewritten from its own blob", () => {
  const leads = [
    { id: 1, channelIdentifier: "wa-demo:t1", demoNiche: JSON.stringify({ service: "dbr", prospect_group: "g1" }) },
    { id: 2, channelIdentifier: "web-demo:t1", demoNiche: "not json" },
  ];
  const plan = planTokenRewrites(leads, ["t1"], { ...prev, language: "en" }, (blob) => ({ opener: blob.service ?? "none" }));
  assert.equal(plan[0].token, "t1");
  assert.equal(plan[0].language, "en");
  const wa = JSON.parse(plan[0].demoNiche);
  assert.equal(wa.opener, "dbr");
  assert.equal(wa.prospect_group, "g1");
  assert.equal(JSON.parse(plan[1].demoNiche).opener, "none");
});
