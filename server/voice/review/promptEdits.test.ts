import { test } from "node:test";
import assert from "node:assert/strict";
import { applyEdit, cleanCopy, countOccurrences, newMarks, validateProposal } from "./promptEdits";
import type { ProposalInput } from "@shared/voiceReview";

test("applyEdit replaces exactly one occurrence", () => {
  assert.deepEqual(applyEdit("a X b", "X", "Y"), { ok: true, text: "a Y b" });
  assert.deepEqual(applyEdit("X X", "X", "Y"), { ok: false, reason: "ambiguous" });
  assert.deepEqual(applyEdit("abc", "Z", "Y"), { ok: false, reason: "not_found" });
});

test("applyEdit inserts the replacement literally, including dollar patterns", () => {
  assert.deepEqual(applyEdit("price: X", "X", "$& and $1 and $$"), { ok: true, text: "price: $& and $1 and $$" });
  assert.deepEqual(applyEdit("a X b", "X", ""), { ok: true, text: "a  b" });
});

test("applyEdit with an empty find is not found", () => {
  assert.deepEqual(applyEdit("abc", "", "Y"), { ok: false, reason: "not_found" });
});

test("countOccurrences is non-overlapping and an empty find gives 0", () => {
  assert.equal(countOccurrences("aaaa", "aa"), 2);
  assert.equal(countOccurrences("a", ""), 0);
  assert.equal(countOccurrences("abcabc", "bc"), 2);
  assert.equal(countOccurrences("abc", "z"), 0);
});

test("newMarks lists template marks that the full text does not have", () => {
  assert.deepEqual(newMarks("Hi {agent} {?closed} {newthing}", "Je bent {agent}. {?closed}x"), ["{newthing}"]);
  assert.deepEqual(newMarks("Hi {agent} {agent}", "Je bent {agent}."), []);
  assert.deepEqual(newMarks("{!x} and {?y} and {z}", "none"), ["{!x}", "{?y}", "{z}"]);
  assert.deepEqual(newMarks("{b} {b}", ""), ["{b}"]);
  assert.deepEqual(newMarks("plain { text } and {1bad}", ""), []);
});

test("cleanCopy swaps em dashes for commas and trims", () => {
  assert.equal(cleanCopy("Ja \u2014 nee"), "Ja, nee");
  assert.equal(cleanCopy("  Ja\u2014nee  \u2014 oke "), "Ja, nee, oke");
  assert.equal(cleanCopy("  plain  "), "plain");
});

const texts = { nl: "- Zeg nooit X.\n- Je bent {agent}.", en: "- Never say X.\n- You are {agent}." };
const p: ProposalInput = { language: "nl", title: "t", reason: "r", find: "- Zeg nooit X.", replace: "- Als X, dan Y.",
  mirrorFind: "- Never say X.", mirrorReplace: "- If X, then Y.", callIds: [] };

test("validateProposal accepts a clean proposal with a mirror", () => {
  assert.deepEqual(validateProposal(p, texts, []), { ok: true });
});

test("validateProposal accepts a proposal without a mirror even when the other language is missing", () => {
  assert.deepEqual(validateProposal({ ...p, mirrorFind: null }, { nl: texts.nl }, []), { ok: true });
  assert.deepEqual(validateProposal({ ...p, mirrorFind: "" }, { nl: texts.nl }, []), { ok: true });
});

test("validateProposal: empty find or title", () => {
  assert.deepEqual(validateProposal({ ...p, find: "" }, texts, []), { ok: false, reason: "empty" });
  assert.deepEqual(validateProposal({ ...p, title: "" }, texts, []), { ok: false, reason: "empty" });
});

test("validateProposal: no change", () => {
  assert.deepEqual(validateProposal({ ...p, replace: p.find }, texts, []), { ok: false, reason: "no_change" });
});

test("validateProposal: too long", () => {
  const long = "x".repeat(2001);
  assert.deepEqual(validateProposal({ ...p, find: long }, texts, []), { ok: false, reason: "too_long" });
  assert.deepEqual(validateProposal({ ...p, replace: "y".repeat(3001) }, texts, []), { ok: false, reason: "too_long" });
  assert.equal(validateProposal({ ...p, replace: "y".repeat(3000) }, texts, []).ok, true);
});

test("validateProposal: target text missing, find missing or ambiguous", () => {
  assert.deepEqual(validateProposal(p, { en: texts.en }, []), { ok: false, reason: "not_found" });
  assert.deepEqual(validateProposal({ ...p, find: "- Nope." }, texts, []), { ok: false, reason: "not_found" });
  assert.deepEqual(validateProposal({ ...p, find: "- ", replace: "* " }, texts, []), { ok: false, reason: "ambiguous" });
});

test("validateProposal: a new template mark is refused, an existing one is fine", () => {
  assert.deepEqual(validateProposal({ ...p, replace: "{bogus}" }, texts, []), { ok: false, reason: "new_mark" });
  assert.deepEqual(validateProposal({ ...p, replace: "Voor {agent}." }, texts, []), { ok: true });
});

test("validateProposal: mirror problems carry mirror reasons", () => {
  assert.deepEqual(validateProposal({ ...p, mirrorFind: "- Gone." }, texts, []), { ok: false, reason: "mirror_not_found" });
  assert.deepEqual(validateProposal(p, { nl: texts.nl }, []), { ok: false, reason: "mirror_not_found" });
  assert.deepEqual(validateProposal({ ...p, mirrorFind: "- ", mirrorReplace: "* " }, texts, []), { ok: false, reason: "mirror_ambiguous" });
  assert.deepEqual(validateProposal({ ...p, mirrorReplace: "{bogus}" }, texts, []), { ok: false, reason: "mirror_new_mark" });
});

test("validateProposal: a null mirror replace deletes the mirror text", () => {
  assert.deepEqual(validateProposal({ ...p, mirrorReplace: null }, texts, []), { ok: true });
});

test("validateProposal: the mirror of an English proposal is the Dutch text", () => {
  const en: ProposalInput = { ...p, language: "en", find: "- Never say X.", replace: "- If X, then Y.", mirrorFind: "- Zeg nooit X.", mirrorReplace: "- Als X, dan Y." };
  assert.deepEqual(validateProposal(en, texts, []), { ok: true });
  assert.deepEqual(validateProposal({ ...en, mirrorFind: "- Never say X." }, texts, []), { ok: false, reason: "mirror_not_found" });
});

test("validateProposal: a pair rejected before is refused, whitespace differences ignored", () => {
  assert.deepEqual(validateProposal(p, texts, [{ find: "- Zeg  nooit X.", replace: "- Als X,  dan Y." }]), { ok: false, reason: "rejected_before" });
  assert.deepEqual(validateProposal(p, texts, [{ find: "- Zeg nooit X.", replace: "- Something else." }]), { ok: true });
});
