import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeKeyword, validateSocialPost, coerceSocialPost } from "./validate";

const good = {
  handle: "dakwerk.utrecht",
  caption: "Lekkage na de storm? Wij repareren daken in heel Utrecht.",
  keyword: "DAK",
  cta_line: "Reageer DAK en we sturen je een DM om een afspraak te plannen.",
  dm_opener: "Hoi, bedankt voor je reactie! Met {agent_name}{disclosure_clause}, hoe gaat het?",
  offer: "dakreparatie na stormschade",
  image_prompt: "A roofer on a ladder fixing clay tiles on a Dutch terraced house, daylight",
  likes: 412,
};

test("normalizeKeyword strips accents, case and non-letters", () => {
  assert.equal(normalizeKeyword(" telhádo! "), "TELHADO");
  assert.equal(normalizeKeyword("Keuken"), "KEUKEN");
});

test("a good post validates", () => {
  assert.equal(validateSocialPost(good), null);
});

test("keyword must be 3-10 ASCII letters", () => {
  assert.match(validateSocialPost({ ...good, keyword: "DA" }) ?? "", /keyword/);
  assert.match(validateSocialPost({ ...good, keyword: "DAK1" }) ?? "", /keyword/);
});

test("cta_line must contain the keyword", () => {
  assert.match(validateSocialPost({ ...good, cta_line: "Stuur ons een bericht" }) ?? "", /cta_line/);
});

test("dm_opener must keep the agent and company tokens", () => {
  assert.match(validateSocialPost({ ...good, dm_opener: "Hoi, met Sarah van Dakwerk" }) ?? "", /dm_opener/);
  // The clause already carries the company; a company token before it doubled it.
  assert.match(validateSocialPost({ ...good, dm_opener: "Met {agent_name} van {company_name}{disclosure_clause}!" }) ?? "", /dm_opener/);
});

test("coerce clamps likes and normalizes keyword and handle", () => {
  const p = coerceSocialPost({ ...good, keyword: "dak", handle: "Dakwerk Utrecht", likes: 999999 });
  assert.equal(p.keyword, "DAK");
  assert.equal(p.handle, "dakwerkutrecht");
  assert.equal(p.likes, 5000);
});
