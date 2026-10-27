/**
 * Translate a persona's copy from one language slot into another, for the
 * Personas editor's "Translate" button. Pure: no db, no model call. The route
 * (server/routes/demoPersonas.ts) runs the prompt through runJson and hands the
 * answer back to the editor, which fills the empty slot. Nothing is saved here.
 */
import { normalizeProducts, type DemoProduct } from "@shared/demoProducts";
import type { ClientTextField, DemoLang, EditableDemoClient, TermGroup } from "./demo-clients";

/** The slots of one language: the long text fields, the term lists and the products. */
export interface TranslateSource {
  text: Partial<Record<ClientTextField, string>>;
  terms: Partial<Record<TermGroup, string[]>>;
  products: DemoProduct[];
}
export interface TranslateResult extends TranslateSource {}

// Typed as Records so a field added to demo-clients.ts is a type error here
// until it is listed, instead of a field the translation silently skips.
const TEXT_FIELDS: Record<ClientTextField, true> = {
  nicheLabel: true,
  companyNameTemplate: true,
  serviceName: true,
  usp: true,
  descriptionTemplate: true,
  kbTemplate: true,
  nicheQuestion: true,
  enquiryContext: true,
  quoteContext: true,
  quoteSubject: true,
  quoteWhen: true,
  scopingLadder: true,
  openerPhrase: true,
  firstMessage: true,
  questionBank: true,
  objectionExamples: true,
  whenLabel: true,
};
const TERM_GROUP_KEYS: Record<TermGroup, true> = { project: true, proposal: true, decision: true, advisor: true, visit: true };

const TEXT_FIELD_LIST = Object.keys(TEXT_FIELDS) as ClientTextField[];
const TERM_GROUP_LIST = Object.keys(TERM_GROUP_KEYS) as TermGroup[];

const LANGUAGE_NAME: Record<DemoLang, string> = {
  en: "English",
  nl: "Dutch",
  pt: "Brazilian Portuguese",
};

const isRecord = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

/** Unique, trimmed, non-empty strings. */
function cleanList(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const out = raw.map((w) => (typeof w === "string" ? w.trim() : "")).filter(Boolean);
  return Array.from(new Set(out));
}

/** What the `from` slot holds: only its non-empty text fields, term lists and products. */
export function translateSource(
  editable: Pick<EditableDemoClient, "text" | "terms" | "products">,
  from: "en" | "nl",
): TranslateSource {
  const text: TranslateSource["text"] = {};
  for (const field of TEXT_FIELD_LIST) {
    const value = (editable.text?.[field]?.[from] ?? "").trim();
    if (value) text[field] = value;
  }
  const terms: TranslateSource["terms"] = {};
  for (const group of TERM_GROUP_LIST) {
    const list = cleanList(editable.terms?.[group]?.[from]);
    if (list.length > 0) terms[group] = list;
  }
  return { text, terms, products: normalizeProducts(editable.products?.[from]) };
}

/** True when there is nothing to translate. */
export function isSourceEmpty(src: TranslateSource): boolean {
  return Object.keys(src.text).length === 0 && Object.keys(src.terms).length === 0 && src.products.length === 0;
}

export function buildTranslatePrompt(
  src: TranslateSource,
  from: "en" | "nl",
  to: DemoLang,
): { system: string; user: string } {
  const toName = LANGUAGE_NAME[to];
  const register =
    to === "nl"
      ? "\n- Write Dutch the way a small business talks to a customer: informal \"je\", never \"u\"."
      : to === "pt"
        ? "\n- Write Brazilian Portuguese (você), never European Portuguese."
        : "";
  const system = `You translate a demo persona for an AI receptionist from ${LANGUAGE_NAME[from]} into ${toName}. The persona is a small business: its texts, the words it uses for its customers' requests, and the products it sells.
Return ONLY a JSON object with the same keys as the input:
- "text": the same field names, each value translated into ${toName}. Keep the meaning, the tone and the layout of each text (line breaks, lists).
- "terms": the same group names, each a list of words a customer or the business would naturally use in ${toName} for the same idea (a natural equivalent, not a literal one).
- "products": the same number of items in the same order, each with "name", "detail" and "price". Translate the detail. Keep the name where it is a brand or a model name, and translate it where it is a plain description.
Rules:
- Keep proper nouns, brand names, model names, prices, numbers and URLs exactly as written.
- Keep every {placeholder} in curly braces exactly as written, with the same spelling.${register}`;
  const user = `Translate this persona from ${LANGUAGE_NAME[from]} into ${toName}:\n${JSON.stringify(src)}`;
  return { system, user };
}

const PLACEHOLDER = /\{[A-Za-z0-9_]+\}/g;

/**
 * A validator for runJson: null when the answer has every key the source had
 * (text fields as non-empty strings that keep the source's {placeholders},
 * term groups as non-empty string lists, as many products as the source with a
 * string name) and nothing else, else what is wrong.
 */
export function validateTranslation(src: TranslateSource): (data: any) => string | null {
  return (data) => {
    if (!isRecord(data)) return "answer is not an object";
    const { text, terms, products } = data;
    if (!isRecord(text)) return "text is not an object";
    if (!isRecord(terms)) return "terms is not an object";
    if (!Array.isArray(products)) return "products is not a list";

    for (const field of Object.keys(src.text) as ClientTextField[]) {
      const value = text[field];
      if (typeof value !== "string" || !value.trim()) return `text.${field} is missing`;
      for (const token of src.text[field]!.match(PLACEHOLDER) ?? []) {
        if (!value.includes(token)) return `text.${field} lost ${token}`;
      }
    }
    for (const key of Object.keys(text)) {
      if (!(key in src.text)) return `text.${key} was not in the source`;
    }

    for (const group of Object.keys(src.terms) as TermGroup[]) {
      const list = terms[group];
      if (!Array.isArray(list) || !list.every((w) => typeof w === "string")) return `terms.${group} is not a list of strings`;
      if (cleanList(list).length === 0) return `terms.${group} is empty`;
    }
    for (const key of Object.keys(terms)) {
      if (!(key in src.terms)) return `terms.${key} was not in the source`;
    }

    if (products.length !== src.products.length) {
      return `products has ${products.length} items, expected ${src.products.length}`;
    }
    for (let i = 0; i < products.length; i++) {
      const p = products[i];
      if (!isRecord(p) || typeof p.name !== "string" || !p.name.trim()) return `products[${i}] has no name`;
    }
    return null;
  };
}

/**
 * The answer in the shape the editor takes: known fields only, trimmed, term
 * lists de-duplicated, products through normalizeProducts. With `src`, each
 * product keeps the source's price (a price is not translated, so the model's
 * reformatting never reaches the editor).
 */
export function coerceTranslation(data: any, src?: TranslateSource): TranslateResult {
  const text: TranslateResult["text"] = {};
  const rawText = isRecord(data?.text) ? data.text : {};
  for (const field of TEXT_FIELD_LIST) {
    const value = rawText[field];
    if (typeof value === "string" && value.trim()) text[field] = value.trim();
  }
  const terms: TranslateResult["terms"] = {};
  const rawTerms = isRecord(data?.terms) ? data.terms : {};
  for (const group of TERM_GROUP_LIST) {
    const list = cleanList(rawTerms[group]);
    if (list.length > 0) terms[group] = list;
  }
  const products = normalizeProducts(data?.products);
  if (src && products.length === src.products.length) {
    products.forEach((p, i) => {
      p.price = src.products[i].price;
    });
  }
  return { text, terms, products };
}
