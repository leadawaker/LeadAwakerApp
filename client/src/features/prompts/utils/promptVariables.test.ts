import { test } from "node:test";
import assert from "node:assert/strict";
import { detectPromptVariables, readHeadings } from "./promptVariables";
import { buildMap } from "./resolveVariables";
import { deriveConversationMode, deriveLeadStage, normalizeAiDisclosure } from "./engineVars";

test("detects variables and conditions from the text, in order, without {{else}}", () => {
  const text = 'Hi {first_name}\n{{#if lead_stage == "quoted"}}{project_term}{{else}}{usp}{{/if}}\n{{#if lead_stage != "owner"}}x{{/if}}{First_Name}';
  const { names, conditions } = detectPromptVariables(text);
  assert.deepEqual(names, ["first_name", "lead_stage", "project_term", "usp"]);
  assert.deepEqual(conditions, [{ name: "lead_stage", values: ["quoted", "owner"] }]);
});

test("positioning and voice_mode only appear when the text uses them", () => {
  const { conditions } = detectPromptVariables('{{#if ai_disclosure == "off"}}a{{/if}}', "");
  assert.deepEqual(conditions.map((c) => c.name), ["ai_disclosure"]);
});

test("merges the system message and ignores an empty one", () => {
  assert.deepEqual(detectPromptVariables("{a}", null, "{b} {a}").names, ["a", "b"]);
});

test("reads markdown headings with their line index", () => {
  assert.deepEqual(readHeadings("# One\ntext\n## Two"), [
    { level: 1, text: "One", lineIndex: 0 },
    { level: 2, text: "Two", lineIndex: 2 },
  ]);
});

test("the engine's lead stage, mode and disclosure rules", () => {
  assert.equal(deriveLeadStage("Received a quote"), "quoted");
  assert.equal(deriveLeadStage("Inquired about a quote"), "inquired");
  assert.equal(deriveLeadStage(""), "");
  assert.equal(deriveConversationMode("quoted"), "decision");
  assert.equal(deriveConversationMode(""), "scoping");
  assert.equal(deriveConversationMode("quoted", "scoping"), "scoping");
  assert.equal(normalizeAiDisclosure("on"), "opener");
  assert.equal(normalizeAiDisclosure("nonsense"), "off");
});

test("buildMap falls back to the account the way the engine does", () => {
  const campaign = { id: 1, name: "C", aiModel: "" };
  const account = { defaultAiName: "Ana", defaultAiRole: "advisor", defaultTypoFrequency: "Common", businessDescription: "Tiles" };
  const map = buildMap(campaign, null, account, "en");
  assert.equal(map.agent_name, "Ana");
  assert.equal(map.ai_role, "advisor");
  assert.equal(map.typo_frequency, "Common");
  assert.equal(map.business_description, "Tiles");
  assert.equal(map.positioning, "premium");
  assert.equal(map.company_name, "C");
});

test("a demo Client's values replace the campaign's, and picks win over both", () => {
  const campaign = { id: 60, name: "Demo", aiModel: "", companyName: "Own", positioning: "premium" };
  const map = buildMap(campaign, null, null, "en", {
    extra: { company_name: "Persona BV" },
    overrides: { positioning: "mid_market" },
  });
  assert.equal(map.company_name, "Persona BV");
  assert.equal(map.positioning, "mid_market");
});
