import { test } from "node:test";
import assert from "node:assert/strict";
import { loadPromptRules, resetPromptRulesCache } from "./promptRules";

test("rules load, are cached and carry every required section", () => {
  resetPromptRulesCache();
  const a = loadPromptRules();
  assert.equal(loadPromptRules(), a);
  for (const h of ["## How our prompt is built", "## Structure", "## Spoken style", "## Tools", "## Silence, interruptions and ending",
    "## Guardrails", "## How to change the prompt", "## Diagnosing a call", "## What not to propose"]) {
    assert.ok(a.includes(h), h);
  }
  assert.ok(a.length > 4000 && a.length < 30000, String(a.length));
});

test("no em dashes and the template marks are explained", () => {
  const a = loadPromptRules();
  assert.equal(a.includes("\u2014"), false);
  assert.ok(a.includes("{?") && a.includes("eleven_layer_nl") && a.includes("eleven_layer_en"));
});
