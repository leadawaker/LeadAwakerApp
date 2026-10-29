import { test } from "node:test";
import assert from "node:assert/strict";
import { campaignPromptResolver, campaignsByPrompt } from "./campaignPrompt";

const prompts = [
  { id: 93, campaignsId: 60, useCase: "conversation", status: "active", createdAt: "2026-09-01" },
  { id: 98, campaignsId: 60, useCase: "conversation", status: "archived", createdAt: "2026-10-01" },
  { id: 91, campaignsId: 60, useCase: "universal_demo_niche_generator", status: "active" },
  { id: 108, campaignsId: 67, useCase: "conversation", status: "active" },
  { id: 124, campaignsId: 72, useCase: "conversation", status: "active" },
  { id: 140, campaignsId: null, useCase: "conversation", status: "archived" },
];

test("a picked prompt wins over the campaign's own row", () => {
  const resolve = campaignPromptResolver(prompts, [{ id: 72, prompt_id: 108 }]);
  assert.equal(resolve(72)?.id, 108);
});

test("an inactive pick falls back to the own active row, skipping archived and helper rows", () => {
  const resolve = campaignPromptResolver(prompts, [{ id: 60, prompt_id: 140 }]);
  assert.equal(resolve(60)?.id, 93);
});

test("a campaign without a prompt of its own borrows through prompt_campaign_id", () => {
  const campaigns = [{ id: 67, prompt_id: null }, { id: 68, prompt_campaign_id: 67 }];
  assert.equal(campaignPromptResolver(prompts, campaigns)(68)?.id, 108);
});

test("campaignsByPrompt lists every campaign running a row", () => {
  const campaigns = [{ id: 67, prompt_id: 108 }, { id: 68, prompt_id: 108 }, { id: 72, prompt_id: 124 }, { id: 74 }];
  const map = campaignsByPrompt(prompts, campaigns);
  assert.deepEqual(map.get(108)?.map((c) => c.id), [67, 68]);
  assert.deepEqual(map.get(124)?.map((c) => c.id), [72]);
});
