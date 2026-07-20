/**
 * Niche row generator — synthesizes a complete Niche_Vocabulary row (5 term
 * groups en+nl, 4 example packs en+nl, 3 business templates) from a niche name
 * and persists it via storage. Claude-first via completeTextLarge (Task 1).
 *
 * The system prompt is loaded from Prompt_Library (useCase "niche_row_generator")
 * so it's editable from the Prompts UI, falling back to the constant below.
 */
import { eq } from "drizzle-orm";
import { db } from "./db";
import { promptLibrary } from "@shared/schema";
import { storage } from "./storage";
import { completeTextLarge, stripFences } from "./aiTextHelper";

type LangPack = { en: string; nl: string };
type Groups = {
  projectTerm: string[]; proposalTerm: string[]; decisionTerm: string[];
  advisorTerm: string[]; visitTerm: string[];
};

const EMPTY_GROUPS = (): Groups => ({
  projectTerm: [], proposalTerm: [], decisionTerm: [], advisorTerm: [], visitTerm: [],
});
const EMPTY_PACK = (): LangPack => ({ en: "", nl: "" });

export const NICHE_ROW_GENERATOR_SYSTEM_FALLBACK = `You generate a complete vocabulary + example row for a lead-reactivation AI, for one business niche.

Return ONE JSON object, no prose, no markdown fences, with EXACTLY these keys:
{
  "nl": { "projectTerm": [], "proposalTerm": [], "decisionTerm": [], "advisorTerm": [], "visitTerm": [] },
  "en": { "projectTerm": [], "proposalTerm": [], "decisionTerm": [], "advisorTerm": [], "visitTerm": [] },
  "companyNameTemplate": { "en": "", "nl": "" },
  "descriptionTemplate": { "en": "", "nl": "" },
  "kbTemplate": { "en": "", "nl": "" },
  "questionBank": { "en": "", "nl": "" },
  "badExamples": { "en": "", "nl": "" },
  "objectionExamples": { "en": "", "nl": "" },
  "scenarioExamples": { "en": "", "nl": "" }
}

Term groups (2-5 natural words/phrases each, lowercase):
- projectTerm: what the customer is buying/doing (e.g. "implant treatment", "kitchen renovation").
- proposalTerm: the offer/quote noun (e.g. "treatment plan", "quote").
- decisionTerm: the customer's decision noun (e.g. "decision", "keuze").
- advisorTerm: who advises the customer (e.g. "dental implant specialist", "kitchen designer").
- visitTerm: the meeting/appointment noun (e.g. "consultation", "afspraak").

"nl" = Dutch, "en" = English. Both languages fully filled.

Templates and packs are short text blocks. They MAY use the placeholders {project_term}, {proposal_term}, {advisor_term}, {visit_term} which are substituted at runtime:
- companyNameTemplate: a realistic sample company name for this niche.
- descriptionTemplate: 1-2 sentence business description.
- kbTemplate: 3-5 short knowledge-base bullet lines (pricing ranges, process, guarantees).
- questionBank: 3-5 qualifying questions the AI could ask a lead in this niche.
- badExamples: 2-3 short lines of phrasing to AVOID in this niche.
- objectionExamples: 2-3 objection/response PAIRS (objection line, then a suggested reframe line).
- scenarioExamples: 2-3 short "if lead says X, do Y" playbook lines.

Be specific to the niche. Never output kitchen/home-improvement content unless the niche is actually that.`;

async function loadSystemPrompt(): Promise<string> {
  try {
    const [row] = await db
      .select({ promptText: promptLibrary.promptText })
      .from(promptLibrary)
      .where(eq(promptLibrary.useCase, "niche_row_generator"))
      .limit(1);
    if (row?.promptText) return row.promptText;
  } catch {
    // fall through to constant
  }
  return NICHE_ROW_GENERATOR_SYSTEM_FALLBACK;
}

function coerceGroups(src: any): Groups {
  const g = EMPTY_GROUPS();
  for (const k of Object.keys(g) as (keyof Groups)[]) {
    const arr = src?.[k];
    g[k] = Array.isArray(arr) ? arr.filter((w: unknown): w is string => typeof w === "string").map((w) => w.trim()).filter(Boolean) : [];
  }
  return g;
}

function coercePack(src: any): LangPack {
  const toStr = (v: unknown) => (Array.isArray(v) ? v.join("\n") : (v ?? "").toString()).trim();
  return { en: toStr(src?.en), nl: toStr(src?.nl) };
}

export async function generateAndSaveNicheRow(niche: string): Promise<{ warnings: string[] } | null> {
  const system = await loadSystemPrompt();
  const raw = await completeTextLarge(`Business niche: ${niche}`, system, { maxTokens: 3500 });
  if (!raw) return null;

  let parsed: any;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return null;
  }

  const nl = coerceGroups(parsed?.nl);
  const en = coerceGroups(parsed?.en);
  // Hard fail if neither language has any advisor/project terms — row is unusable.
  const hasTerms = [...Object.values(nl), ...Object.values(en)].some((a) => a.length > 0);
  if (!hasTerms) return null;

  const templates = {
    companyNameTemplate: coercePack(parsed?.companyNameTemplate),
    descriptionTemplate: coercePack(parsed?.descriptionTemplate),
    kbTemplate: coercePack(parsed?.kbTemplate),
    questionBank: coercePack(parsed?.questionBank),
    badExamples: coercePack(parsed?.badExamples),
    objectionExamples: coercePack(parsed?.objectionExamples),
    scenarioExamples: coercePack(parsed?.scenarioExamples),
  };

  const warnings: string[] = [];
  for (const [key, pack] of Object.entries(templates)) {
    if (!pack.en && !pack.nl) warnings.push(key);
  }

  // Persist: terms via setNicheVocabulary, templates+packs via setNicheTemplate.
  await storage.setNicheVocabulary(niche, { nl, en });
  await storage.setNicheTemplate(niche, templates);

  return { warnings };
}
