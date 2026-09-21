// Starter chips for the chat panel: the two or three things a visitor is most
// likely to want, offered once, before they have typed anything.
//
// The intents are fixed (quote, how it works, book) because they are the same
// for every service business. Only the WORDING is per niche, and that wording
// already exists: Niche_Vocabulary.proposal_terms / visit_terms are filled for
// every client because the conversation prompt needs them. So a new niche gets
// correct chips with no extra authoring, and `quick_replies` on either table
// overrides the derivation by hand when a client wants their own words.
//
// The label is short ("Offerte aanvragen"); the text it sends reads like a
// person ("Ik wil graag een offerte aanvragen"), because the model reads the
// text and a bare label would open the conversation like a form submission.

export interface QuickReply {
  label: string;
  text: string;
}

type Lang = "nl" | "en" | "pt";

function lang3(value: string | null | undefined): Lang {
  const short = String(value || "").slice(0, 2).toLowerCase();
  return short === "nl" || short === "pt" ? short : "en";
}

/** Niche_Vocabulary stores these as jsonb arrays, sometimes as an object map,
 *  sometimes empty. Anything that is not a usable word is ignored. */
function firstTerm(value: unknown): string {
  const list = Array.isArray(value) ? value : [];
  for (const entry of list) {
    const word = String(entry ?? "").trim();
    if (word) return word;
  }
  return "";
}

function capitalise(word: string): string {
  return word ? word[0].toUpperCase() + word.slice(1) : word;
}

const HOW_IT_WORKS: Record<Lang, QuickReply> = {
  nl: { label: "Hoe werkt het?", text: "Hoe werkt het precies?" },
  en: { label: "How does it work?", text: "How does it work exactly?" },
  pt: { label: "Como funciona?", text: "Como funciona exatamente?" },
};

const QUOTE_FALLBACK: Record<Lang, string> = { nl: "offerte", en: "quote", pt: "orçamento" };
const VISIT_FALLBACK: Record<Lang, string> = { nl: "afspraak", en: "appointment", pt: "visita" };

function quoteChip(term: string, lang: Lang): QuickReply {
  const word = term || QUOTE_FALLBACK[lang];
  if (lang === "nl") return { label: `${capitalise(word)} aanvragen`, text: `Ik wil graag een ${word} aanvragen.` };
  if (lang === "pt") return { label: `Pedir ${word}`, text: `Gostaria de pedir um ${word}.` };
  return { label: `Request a ${word}`, text: `I'd like to request a ${word}.` };
}

/** `bookingModeCall` decides whether the third chip is a call or a site visit.
 *  A roofer measures on site; a consultancy picks up the phone. */
function bookChip(term: string, lang: Lang, call: boolean): QuickReply {
  if (call) {
    if (lang === "nl") return { label: "Belafspraak inplannen", text: "Ik wil graag een belafspraak inplannen." };
    if (lang === "pt") return { label: "Agendar uma ligação", text: "Gostaria de agendar uma ligação." };
    return { label: "Book a call", text: "I'd like to book a call." };
  }
  const word = term || VISIT_FALLBACK[lang];
  if (lang === "nl") return { label: `${capitalise(word)} inplannen`, text: `Ik wil graag een ${word} inplannen.` };
  if (lang === "pt") return { label: `Agendar ${word}`, text: `Gostaria de agendar uma ${word}.` };
  return { label: `Schedule ${word}`, text: `I'd like to schedule ${word}.` };
}

/** An override read from either table's `quick_replies`. Anything malformed is
 *  dropped rather than rendered, since this lands on a client's own website. */
export function parseOverride(value: unknown): QuickReply[] | null {
  if (!Array.isArray(value)) return null;
  const out: QuickReply[] = [];
  for (const entry of value) {
    if (!entry || typeof entry !== "object") continue;
    const label = String((entry as Record<string, unknown>).label ?? "").trim().slice(0, 40);
    const text = String((entry as Record<string, unknown>).text ?? "").trim().slice(0, 200);
    if (label && text) out.push({ label, text });
  }
  return out.length ? out.slice(0, 3) : null;
}

export interface NicheTerms {
  language: string | null | undefined;
  /** Dutch list; `_en` / `_pt` siblings hold the other two languages. */
  proposalTerms?: unknown;
  proposalTermsEn?: unknown;
  proposalTermsPt?: unknown;
  visitTerms?: unknown;
  visitTermsEn?: unknown;
  visitTermsPt?: unknown;
  bookingModeCall?: boolean | null;
  override?: unknown;
}

export function deriveQuickReplies(input: NicheTerms): QuickReply[] {
  const manual = parseOverride(input.override);
  if (manual) return manual;

  const lang = lang3(input.language);
  const proposal = lang === "nl" ? input.proposalTerms : lang === "pt" ? input.proposalTermsPt : input.proposalTermsEn;
  const visit = lang === "nl" ? input.visitTerms : lang === "pt" ? input.visitTermsPt : input.visitTermsEn;

  return [
    quoteChip(firstTerm(proposal), lang),
    HOW_IT_WORKS[lang],
    bookChip(firstTerm(visit), lang, !!input.bookingModeCall),
  ];
}
