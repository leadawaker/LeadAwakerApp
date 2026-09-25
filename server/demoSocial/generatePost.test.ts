import { test } from "node:test";
import assert from "node:assert/strict";
import { buildSocialPostPrompt, openerNamesBusiness } from "./generatePost";

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
  assert.match(system, /\{agent_name\}\{disclosure_clause\}/);
  assert.match(system, /cta_line/);
});

test("image prompt is always requested in English with no text", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /image_prompt[^\n]*English/);
  assert.match(system, /no text/i);
});

test("prompt tells the model never to name the business in the opener", () => {
  const { system } = buildSocialPostPrompt(input);
  assert.match(system, /Never name the business yourself/);
});

test("an opener that spells out the company is rejected", () => {
  assert.match(openerNamesBusiness({ dm_opener: "Oi, aqui é {agent_name}{disclosure_clause} da Telhados Silva" }, "Telhados Silva") ?? "", /name the business/);
  assert.equal(openerNamesBusiness({ dm_opener: "Oi, aqui é {agent_name}{disclosure_clause}!" }, "Telhados Silva"), null);
});
