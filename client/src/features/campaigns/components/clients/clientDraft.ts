/**
 * The persona editor's draft: what it holds, how it is seeded from a Client,
 * and how it becomes the PATCH that autosave sends. Kept apart from
 * ClientEditor.tsx so the save logic and the form sections can both read it.
 */
import {
  TERM_GROUPS,
  type ClientTextField,
  type DemoLang,
  type DemoClientPatch,
  type EditableDemoClient,
  type TermGroup,
} from "../../api/demoClientsApi";

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

/** Everything ClientEditor autosaves, as one flat draft object. */
export interface Draft {
  text: Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>;
  terms: Partial<Record<TermGroup, Partial<Record<DemoLang, string>>>>;
  category: string;
  emoji: string;
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
    emoji: client.emoji ?? "",
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
    emoji: d.emoji.trim() || null,
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
