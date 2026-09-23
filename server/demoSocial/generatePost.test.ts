import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSocialPostPrompt } from "./generatePost";

const input = {
  language: "pt" as const,
  companyName: "Telhados Silva",
  serviceName: "conserto de telhado",
  nicheLabel: "Telhados",
  usp: "atendimento em 24h",
  kb: "Atendemos São Paulo capital e ABC.",
  area: "São Paulo",
};

test("prompt names the business, service and language", () => {
  const { system, user } = buildSocialPostPrompt(input);
  assert.match(user, /Telhados Silva/);
  assert.match(user, /conserto de telhado/);
  assert.match(system, /Brazilian Portuguese/);
});

test("prompt demands the opener tokens and a keyword in the CTA", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /\{agent_name\}/);
  assert.match(system, /\{company_name\}/);
  assert.match(system, /cta_line/);
});

test("image prompt is always requested in English with no text", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /image_prompt[^\n]*English/);
  assert.match(system, /no text/i);
});
