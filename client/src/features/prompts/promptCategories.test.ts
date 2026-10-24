import { test } from "node:test";
import assert from "node:assert/strict";
import { categoryFromUseCase, isDemoPrompt, isPromptListTab, isVoiceUseCase, promptCategory } from "./promptCategories";
import { buildPreviewSections, escapeHtml } from "./components/PromptPreviewSections";

test("use_case fallback matches the backfill mapping", () => {
  const cases: Record<string, string> = {
    conversation: "chat",
    "customer-support": "chat",
    universal_demo_recap_summary: "chat",
    "voice_layer_en-GB": "voice",
    voice_receptionist_demo_nl: "voice",
    voice_public_demo_closing: "voice",
    eleven_layer_nl: "voice",
    "system:ai-bump": "crm",
    "campaign-summary": "crm",
    lead_summary: "crm",
    "prospect-enrichment": "crm",
    channel_fallback_email: "crm",
    universal_demo_niche_generator: "crm",
    Test: "test",
    Whatsap: "test",
    "review-reply": "reputation",
    reputation_conversation: "reputation",
  };
  for (const [uc, cat] of Object.entries(cases)) assert.equal(categoryFromUseCase(uc), cat, uc);
});

test("a saved category wins over the use_case, an unknown one falls back", () => {
  assert.equal(promptCategory({ category: "social", useCase: "conversation" }), "social");
  assert.equal(promptCategory({ category: "nonsense", use_case: "eleven_layer_en" }), "voice");
  assert.equal(promptCategory({ useCase: null }), "crm");
});

test("voice filter includes the ElevenLabs rows", () => {
  assert.ok(isVoiceUseCase("eleven_layer_en"));
  assert.ok(isVoiceUseCase("voice_greeting_nl"));
  assert.ok(!isVoiceUseCase("conversation"));
  assert.ok(!isVoiceUseCase(null));
});

test("demo flag reads both key styles; old tab ids are not valid tabs", () => {
  assert.ok(isDemoPrompt({ isDemo: true }));
  assert.ok(isDemoPrompt({ is_demo: true }));
  assert.ok(!isDemoPrompt({ isDemo: null }));
  assert.ok(isPromptListTab("niche"));
  assert.ok(isPromptListTab("reputation"));
  assert.ok(!isPromptListTab("campaign"));
  assert.ok(!isPromptListTab("system"));
});

test("preview sections split at headings and escape plain text", () => {
  const sections = buildPreviewSections("intro\n# One\nbody <b>\n## Two\nmore", escapeHtml, (h) => h.split("\n"));
  assert.equal(sections.length, 3);
  assert.equal(sections[0]!.headingLineIndex, null);
  assert.equal(sections[1]!.headingLevel, 1);
  assert.equal(sections[1]!.bodyLines[0]!.htmlLine, "body &lt;b&gt;");
  assert.equal(sections[2]!.headingLevel, 2);
  assert.equal(sections[2]!.headingLineIndex, 3);
});
