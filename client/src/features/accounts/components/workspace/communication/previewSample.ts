import type { ProfileAnswers } from "./profileConstants";

export type PreviewMessage = { role: "ai" | "lead"; text: string; time: string };

const PERCEPTION_GROUP: Record<string, string> = {
  persoonlijk: "warm",
  betrokken: "warm",
  toegankelijk: "warm",
  deskundig: "expert",
  hoogwaardig: "expert",
  exclusief: "exclusive",
};

// Dutch fallbacks so the WhatsApp demo always reads naturally before the client
// has picked their preferred words.
const DEFAULT_TERMS = { projectTerm: "project", proposalTerm: "voorstel", decisionTerm: "beslissing" };

// The verb that goes with the chosen decision word: "een beslissing/besluit nemen"
// but "een keuze/afweging maken". Defaults to "nemen" (matches "beslissing").
const DECISION_VERB_MAKEN = new Set(["keuze", "afweging", "besluitvorming"]);
function decisionVerbFor(decision: string): string {
  return DECISION_VERB_MAKEN.has(decision.trim().toLowerCase()) ? "maken" : "nemen";
}

function formalityBucket(formality: number | null): "informal" | "neutral" | "formal" {
  if (!formality || formality === 2) return "neutral";
  return formality <= 1 ? "informal" : "formal";
}

export function composeSample(
  answers: ProfileAnswers,
  t: (key: string, opts?: Record<string, string>) => string
): PreviewMessage[] {
  const style = answers.openingStyle ?? "personal";
  const bucket = formalityBucket(answers.formality);
  const perceptionGroup =
    answers.perception.length > 0
      ? (PERCEPTION_GROUP[answers.perception[0]] ?? "default")
      : "default";

  const project = answers.preferredWords.projectTerm ?? DEFAULT_TERMS.projectTerm;
  const proposal = answers.preferredWords.proposalTerm ?? DEFAULT_TERMS.proposalTerm;
  const decision = answers.preferredWords.decisionTerm ?? DEFAULT_TERMS.decisionTerm;
  const you = answers.addressForm === "u" ? "u" : "je";
  const differentiator = answers.differentiator.trim() || t("preview.differentiatorFallback");
  const decisionVerb = decisionVerbFor(decision);

  const vars = { project, proposal, decision, you, differentiator, decisionVerb };

  return [
    // 1. Opener — reuses the chosen Q1 example, so it tracks the AI style.
    { role: "ai",   text: t(`questions.openingStyle.options.${style}.example`),     time: "09:41" },
    // 2. Lead replies in character for that style.
    { role: "lead", text: t(`preview.leadReply.${style}`),                          time: "09:43" },
    // 3. Follow-up — driven by perception (tone) + formality (je/u), mentions the decision term.
    { role: "ai",   text: t(`preview.followup.${perceptionGroup}.${bucket}`, vars), time: "09:44" },
    // 4. Lead raises a competitor/price doubt to set up the differentiator.
    { role: "lead", text: t("preview.objection"),                                   time: "09:46" },
    // 5. Close — leans on the differentiator and weaves in the preferred words.
    { role: "ai",   text: t("preview.close", vars),                                 time: "09:47" },
  ];
}
