import { test } from "node:test";
import assert from "node:assert/strict";
import { markedValues, placeholderValues } from "./voicePlaceholders";
import { VOICE_VARIABLES, variableSource } from "./variableRegistry";

const mark = (name: string, value: string) => `${name}${value}`;

test("reads plain and marked placeholders out of the render", () => {
  const template = "You are {agent}, for {company}.{business_line}\nRules{handoff}\nEnd";
  const rendered = "You are Frank, for Robben.\nWhat the company does: cars.\nRules Offer a callback.\nEnd";
  const marked = `You are ${mark("agent_name", "Frank")}, for ${mark("company_name", "Robben")}.`;
  assert.deepEqual(placeholderValues(template, rendered, marked), {
    agent: "Frank", company: "Robben", business_line: "What the company does: cars.", handoff: "Offer a callback.",
  });
});

test("side-by-side placeholders: a marked value is taken out, the other gets the rest", () => {
  const out = placeholderValues("Help.{intake}{client_rules}\nDone", "Help.\nAsk the budget.\nFor this business: no vans.\nDone",
    mark("client_rules", "\nFor this business: no vans."));
  assert.equal(out.client_rules, "For this business: no vans.");
  assert.equal(out.intake, "Ask the budget.");
});

test("a value at the end stops before today's date and the rules above the knowledge", () => {
  const out = placeholderValues("Top---{knowledge}", "Top---\n\nDetail rules\n\nJe bedrijfskennis (notes):\nOpen 9-5\n\nVandaag is het maandag.");
  assert.equal(out.knowledge, "Je bedrijfskennis (notes):\nOpen 9-5");
});

test("text the engine dropped doesn't stop the walk, and a replaced row gives nothing", () => {
  const out = placeholderValues("A {x}. Area: {city}.\nB {y}.", "A one.\nB two.");
  assert.equal(out.y, "two");
  assert.deepEqual(placeholderValues("Say {disclosure} now", "A client greeting"), {});
});

test("the backend frame's touching parts split at the first section the engine adds", () => {
  const out = placeholderValues("Top\n{task_instructions}{call_details}\n\nEnd", "Top\nDo the job.\n\n## Knowledge base\nOpen 9-5\n\nEnd");
  assert.equal(out.task_instructions, "Do the job.");
  assert.equal(out.call_details, "## Knowledge base\nOpen 9-5");
});

test("a marked value survives a dropped line around it", () => {
  const out = placeholderValues("Is {company_name}. Area: {city}.\nEnd", "Is Acme.\nEnd", mark("company_name", "Acme"));
  assert.equal(out.company_name, "Acme");
  assert.equal(out.city, undefined);
});

test("first mark of each name", () => {
  assert.deepEqual(markedValues(mark("tone", "a") + mark("tone", "b")), { tone: "a" });
});

test("every placeholder the live voice rows use has a voice source", () => {
  const used = ["address", "agent", "agent_name", "business_description", "business_line", "call_details", "city", "client_rules", "company",
    "company_name", "disclosure", "followup", "handoff", "intake", "knowledge", "pronunciation", "service_name", "task_instructions", "tone"];
  for (const name of used) assert.ok(VOICE_VARIABLES[name], name);
  assert.equal(variableSource("project_term", "voice"), undefined);
  assert.equal(variableSource("agent", "campaign"), undefined);
});
