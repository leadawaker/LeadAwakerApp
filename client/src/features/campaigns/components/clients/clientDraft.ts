/**
 * The persona editor's draft: what it holds, how it is seeded from a Client,
 * and how it becomes the PATCH that autosave sends. Kept apart from
 * ClientEditor.tsx so the save logic and the form sections can both read it.
 */
import type { ProductsByLang } from "@shared/demoProducts";
import type {
  ClientTextField,
  ClientTranslation,
  DemoLang,
  DemoClientPatch,
  EditableDemoClient,
} from "../../api/demoClientsApi";
import { TERM_GROUPS, type TermGroup } from "../../api/termGroups";

export type PersonaGroup = "business" | "lead" | "conversation";

export interface TextFieldDef {
  field: ClientTextField;
  labelKey: string;
  /** Textarea height. Absent means a single line. */
  rows?: number;
}

/**
 * Long fields, in the order they read as a persona. `group` only decides
 * which sub-heading a field sits under; the order is the list's own.
 */
export const TEXT_FIELDS: Array<TextFieldDef & { group: PersonaGroup }> = [
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel", group: "business" },
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName", group: "business" },
  { field: "serviceName", labelKey: "clients.fields.serviceName", group: "business" },
  { field: "usp", labelKey: "clients.fields.usp", rows: 2, group: "business" },
  { field: "descriptionTemplate", labelKey: "clients.fields.description", rows: 3, group: "business" },
  { field: "kbTemplate", labelKey: "clients.fields.kb", rows: 6, group: "business" },
  { field: "nicheQuestion", labelKey: "clients.fields.nicheQuestion", rows: 2, group: "lead" },
  { field: "enquiryContext", labelKey: "clients.fields.enquiryContext", rows: 2, group: "lead" },
  { field: "quoteContext", labelKey: "clients.fields.quoteContext", rows: 5, group: "lead" },
  { field: "scopingLadder", labelKey: "clients.fields.scopingLadder", rows: 8, group: "conversation" },
  { field: "questionBank", labelKey: "clients.fields.questionBank", rows: 4, group: "conversation" },
  { field: "objectionExamples", labelKey: "clients.fields.objections", rows: 4, group: "conversation" },
];

/**
 * Fields that ARE substituted verbatim, so they get the per-language treatment.
 *
 * quoteSubject and quoteWhen are the two halves of the QUOTED opener, the one
 * campaign 60 sends to a lead who already has a price ("about the
 * {quote_subject} we quoted {quote_when}"). They belong here and not in
 * TEXT_FIELDS for the usual reason: no model sees them, they are pasted into
 * the sentence as typed. Leaving a slot empty is safe: the engine falls back
 * to the project term, then to the inquiry timeframe.
 */
export const OPENER_FIELDS: TextFieldDef[] = [
  { field: "firstMessage", labelKey: "clients.fields.firstMessage", rows: 3 },
  { field: "openerPhrase", labelKey: "clients.fields.openerPhrase" },
  { field: "whenLabel", labelKey: "clients.fields.whenLabel" },
  { field: "quoteSubject", labelKey: "clients.fields.quoteSubject" },
  { field: "quoteWhen", labelKey: "clients.fields.quoteWhen" },
];

/**
 * Everything ClientEditor autosaves, as one flat draft object. `phone` rides
 * along unseen: the editor does not show it (R8), but the patch must send back
 * what was stored or an autosave would clear it.
 */
export interface Draft {
  text: Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>;
  terms: Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>>;
  category: string;
  products: ProductsByLang;
  stockUrl: string;
  city: string;
  phone: string;
}

const LANG_KEYS: DemoLang[] = ["en", "nl", "pt"];

/** The product lists, copied row by row so editing the draft never touches the loaded Client. */
function copyProducts(products: ProductsByLang | null | undefined): ProductsByLang {
  const out: ProductsByLang = {};
  for (const l of LANG_KEYS) {
    const list = products?.[l];
    if (Array.isArray(list)) out[l] = list.map((p) => ({ ...p }));
  }
  return out;
}

export function buildDraft(client: EditableDemoClient): Draft {
  const terms: Draft["terms"] = {};
  for (const group of TERM_GROUPS) {
    terms[group] = {
      en: (client.terms[group]?.en ?? []).join(", "),
      nl: (client.terms[group]?.nl ?? []).join(", "),
      pt: (client.terms[group]?.pt ?? []).join(", "),
    };
  }
  return {
    text: client.text,
    terms,
    category: client.category ?? "",
    products: copyProducts(client.products),
    stockUrl: client.stockUrl ?? "",
    city: client.city ?? "",
    phone: client.phone ?? "",
  };
}

/** "keuken, keukenproject" -> ["keuken", "keukenproject"]. */
function splitTerms(raw: string | undefined): string[] {
  return (raw ?? "")
    .split(",")
    .map((w) => w.trim())
    .filter(Boolean);
}

export function buildPatch(d: Draft): DemoClientPatch {
  const patch: DemoClientPatch = {
    text: d.text as DemoClientPatch["text"],
    terms: {},
    category: d.category.trim() || null,
    products: d.products,
    stockUrl: d.stockUrl.trim() || null,
    city: d.city.trim() || null,
    phone: d.phone.trim() || null,
  };
  for (const group of TERM_GROUPS) {
    patch.terms![group] = {
      en: splitTerms(d.terms[group]?.en),
      nl: splitTerms(d.terms[group]?.nl),
      pt: splitTerms(d.terms[group]?.pt),
    };
  }
  return patch;
}

export function draftsEqual(a: Draft | null, b: Draft | null): boolean {
  if (!a || !b) return a === b;
  return JSON.stringify(a) === JSON.stringify(b);
}

/** The source languages the translate button can read from. */
const TRANSLATE_FROM: Array<"en" | "nl"> = ["en", "nl"];

/** A language slot holds something: any text field, any term list or any product. */
function slotHasContent(client: Pick<EditableDemoClient, "text" | "terms" | "products">, lang: DemoLang): boolean {
  if (Object.values(client.text ?? {}).some((slot) => (slot?.[lang] ?? "").trim())) return true;
  if (Object.values(client.terms ?? {}).some((group) => (group?.[lang] ?? []).some((w) => w.trim()))) return true;
  return (client.products?.[lang] ?? []).length > 0;
}

/**
 * The languages the server can translate `to` from: English and Dutch, whichever
 * hold content in the saved Client, never the target itself. Empty means there
 * is nothing to translate from, so the button stays away.
 */
export function translateSources(
  client: Pick<EditableDemoClient, "text" | "terms" | "products">,
  to: DemoLang,
): Array<"en" | "nl"> {
  return TRANSLATE_FROM.filter((l) => l !== to && slotHasContent(client, l));
}

/**
 * A translation is slow, so the persona that asked for it may no longer be the
 * open one when it arrives (the tab swaps `niche` in place, no remount). Merging
 * it then would write one persona's copy into another's draft, and that draft's
 * autosave would persist it. Apply it only to the persona that requested it.
 */
export function shouldApplyTranslation(requestedNiche: string, currentNiche: string): boolean {
  return requestedNiche === currentNiche;
}

/**
 * Put a translation into the draft's `to` slots. Only EMPTY slots are filled:
 * what Gabriel already typed (or an earlier translation he kept) is never
 * overwritten. Terms join with ", " as the editor shows them; autosave then
 * persists the result like any other edit.
 */
export function mergeTranslation(d: Draft, to: DemoLang, tr: ClientTranslation): Draft {
  const text: Draft["text"] = { ...d.text };
  for (const [field, value] of Object.entries(tr.text ?? {}) as Array<[ClientTextField, string | undefined]>) {
    const clean = (value ?? "").trim();
    if (!clean || (text[field]?.[to] ?? "").trim()) continue;
    text[field] = { ...(text[field] ?? {}), [to]: clean };
  }
  const terms: Draft["terms"] = { ...d.terms };
  for (const [group, words] of Object.entries(tr.terms ?? {}) as Array<[TermGroup, string[] | undefined]>) {
    const joined = (words ?? []).map((w) => w.trim()).filter(Boolean).join(", ");
    if (!joined || (terms[group]?.[to] ?? "").trim()) continue;
    terms[group] = { ...(terms[group] ?? {}), [to]: joined };
  }
  const incoming = tr.products ?? [];
  const products =
    incoming.length > 0 && (d.products[to] ?? []).length === 0
      ? { ...d.products, [to]: incoming.map((p) => ({ ...p })) }
      : d.products;
  return { ...d, text, terms, products };
}
