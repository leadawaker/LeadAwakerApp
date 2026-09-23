import { test } from "node:test";
import assert from "node:assert/strict";
import { socialContextFields } from "./context";

const post = {
  handle: "dakwerk.utrecht", caption: "Lekkage na de storm?", keyword: "DAK",
  cta_line: "Reageer DAK en we sturen je een DM.", dm_opener: "Hoi! Met {agent_name} van {company_name}.",
  offer: "dakreparatie", image_prompt: "SECRET PROMPT", likes: 300,
};

test("public post hides the image prompt and opener", () => {
  const f = socialContextFields(post);
  assert.equal("image_prompt" in f.social_post, false);
  assert.equal("dm_opener" in f.social_post, false);
  assert.equal(f.social_post.keyword, "DAK");
});

test("engine keys are flat and carry the post", () => {
  const f = socialContextFields(post);
  assert.equal(f.lead_source, "social_comment");
  assert.equal(f.social_dm_opener, post.dm_opener);
  assert.match(f.social_context, /DAK/);
  assert.match(f.social_context, /Lekkage na de storm/);
  assert.match(f.social_context, /dakreparatie/);
  assert.match(f.enquiry_context, /DAK/);
});
