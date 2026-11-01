// The "Preview as" context: one campaign of an account, or a demo Client (a
// Niche_Vocabulary persona) on a persona demo campaign. Pure helpers; the
// fetching lives in components/editor/usePreviewContext.
import { DEFAULT_NICHE_TERMS, type CampaignForPreview } from "./resolveVariables";
import { PERSONA_DEMO_CAMPAIGN_IDS } from "./engineVars";
import type { DemoClientEditable, PackTemplates, VocabRow, WordGroups } from "./variableWrites";
import type { NicheTermGroup } from "./variableRegistry";

/** "c:<campaign id>", "d:<client niche>" or "" (nothing picked). */
export type PreviewContextKey = string;

export const campaignKey = (id: number): PreviewContextKey => `c:${id}`;
export const clientKey = (niche: string): PreviewContextKey => `d:${niche}`;

export function parseContextKey(key: PreviewContextKey): { kind: "campaign"; id: number } | { kind: "client"; niche: string } | null {
  if (key.startsWith("c:")) {
    const id = Number(key.slice(2));
    return Number.isSafeInteger(id) && id > 0 ? { kind: "campaign", id } : null;
  }
  if (key.startsWith("d:") && key.length > 2) return { kind: "client", niche: key.slice(2) };
  return null;
}

/** The first pick: a campaign that runs this prompt (the linked one first), else the linked campaign. */
export function defaultContextKey(servingIds: number[], linkedCampaignId: number): PreviewContextKey {
  if (linkedCampaignId && servingIds.includes(linkedCampaignId)) return campaignKey(linkedCampaignId);
  if (servingIds.length) return campaignKey(servingIds[0]!);
  return linkedCampaignId ? campaignKey(linkedCampaignId) : "";
}

/** The persona demo campaign a demo Client runs on: one that uses this prompt, else campaign 60. */
export function demoBaseCampaign(campaigns: CampaignForPreview[], servingIds: number[]): CampaignForPreview | null {
  const persona = campaigns.filter((c) => PERSONA_DEMO_CAMPAIGN_IDS.includes(c.id));
  return persona.find((c) => servingIds.includes(c.id)) ?? persona.find((c) => c.id === 60) ?? persona[0] ?? null;
}

const GROUPS: [NicheTermGroup, string][] = [
  ["projectTerm", "project_term"], ["proposalTerm", "proposal_term"], ["decisionTerm", "decision_term"],
  ["advisorTerm", "advisor_term"], ["visitTerm", "visit_term"],
];
const PACKS: [keyof PackTemplates, string][] = [
  ["questionBank", "niche_question_bank"], ["badExamples", "niche_bad_examples"],
  ["objectionExamples", "niche_objection_examples"], ["scenarioExamples", "niche_scenario_examples"],
];

export type VocabListRow = VocabRow & PackTemplates;

/** The row the engine reads for a niche (its own, else __default__), as get_niche_terms does. */
export function vocabRowFor(rows: VocabListRow[], niche: string): VocabListRow | null {
  return rows.find((r) => r.niche === niche) ?? rows.find((r) => r.niche === "__default__") ?? null;
}

/** {project_term}, {project_term_list}, ... and the four example packs, the way the engine resolves them. */
export function nicheTermValues(rows: VocabListRow[], niche: string, lang: "en" | "nl"): Record<string, string> {
  const defaults = DEFAULT_NICHE_TERMS[lang];
  const row = vocabRowFor(rows, niche);
  const def = rows.find((r) => r.niche === "__default__") ?? null;
  const out: Record<string, string> = { ...defaults };
  for (const [group, name] of GROUPS) {
    // English falls back to the Dutch list per group (storage getNicheVocabulary).
    const words = (lang === "en" && !(row?.en?.[group]?.length) ? row?.nl?.[group] : row?.[lang]?.[group]) ?? [];
    if (words.length) { out[name] = words[0]!; out[`${name}_list`] = words.join(", "); }
  }
  // Packs fall back per field to __default__ (get_niche_example_packs).
  const pickPack = (t?: { nl?: string; en?: string }) => (lang === "en" ? (t?.en || t?.nl) : t?.nl) || "";
  for (const [field, name] of PACKS) out[name] = pickPack(row?.[field]) || pickPack(def?.[field]);
  return out;
}

/** The vocabulary row a write lands in: the niche's own, or a copy of __default__ that the write will create. */
export function writableVocab(rows: VocabListRow[], niche: string): { row: VocabRow | null; packs: PackTemplates | null } {
  const own = rows.find((r) => r.niche === niche);
  const seed = own ?? rows.find((r) => r.niche === "__default__");
  if (!seed) return { row: null, packs: null };
  const copy = (g: WordGroups): WordGroups => ({ ...g });
  return {
    row: { niche, nl: copy(seed.nl), en: copy(seed.en) },
    // Packs are only written to an existing row (the PATCH never creates one).
    packs: own ? { questionBank: own.questionBank, badExamples: own.badExamples, objectionExamples: own.objectionExamples, scenarioExamples: own.scenarioExamples } : null,
  };
}

type Lang3 = "en" | "nl" | "pt";
const ORDER: Record<Lang3, Lang3[]> = { en: ["en", "nl", "pt"], nl: ["nl", "en", "pt"], pt: ["pt", "en", "nl"] };

const PACK_HEADER: Record<Lang3, string> = {
  en: "Extra examples for this specific niche:",
  nl: "Extra voorbeelden voor deze specifieke niche:",
  pt: "Exemplos extras para este nicho específico:",
};

/** A demo Client's persona as variable values (demoClientToContext + the demo overlay).
 *  `base` holds the campaign niche's packs: a persona's own examples are added to them. */
export function clientValues(client: DemoClientEditable, lang: Lang3, base: Record<string, string>): Record<string, string | undefined> {
  const pick = (field: string) => {
    const t = client.text?.[field] ?? {};
    for (const l of ORDER[lang]) { const v = (t[l] ?? "").trim(); if (v) return v; }
    return "";
  };
  const strict = (field: string) => (client.text?.[field]?.[lang] ?? "").trim();
  const label = pick("nicheLabel") || client.label || client.niche;
  const service = pick("serviceName");
  const withBase = (name: string, extra: string) => {
    const own = (base[name] ?? "").trim();
    return extra && own ? `${own}\n\n${PACK_HEADER[lang]}\n${extra}` : extra || own;
  };
  const out: Record<string, string | undefined> = {
    company_name: pick("companyNameTemplate"),
    business: pick("companyNameTemplate"),
    service, service_name: service,
    usp: pick("usp"),
    business_description: pick("descriptionTemplate"),
    kb: pick("kbTemplate"),
    niche_question: pick("nicheQuestion"),
    niche: label,
    opener_phrase: strict("openerPhrase") || strict("nicheLabel") || client.niche,
    niche_scoping_ladder: pick("scopingLadder"),
    niche_question_bank: withBase("niche_question_bank", pick("questionBank")),
    niche_objection_examples: withBase("niche_objection_examples", pick("objectionExamples")),
    booking_mode: client.bookingModeCall === false ? "direct" : "call",
    first_message: strict("firstMessage"),
    // Set on every demo link by applyDemoDefaults (server/demo-session.ts).
    agent_name: "Sara",
    ai_style: "Practical",
    language: lang === "pt" ? "Brazilian Portuguese" : lang === "nl" ? "Dutch" : "English",
  };
  const termGroups: [string, string][] = [["project", "project_term"], ["proposal", "proposal_term"],
    ["decision", "decision_term"], ["advisor", "advisor_term"], ["visit", "visit_term"]];
  for (const [group, name] of termGroups) {
    const words = client.terms?.[group]?.[lang] ?? [];
    if (words.length) { out[name] = words[0]; out[`${name}_list`] = words.join(", "); }
  }
  if (!out.project_term) out.project_term = label;
  return out;
}
