/**
 * The Clients library — phase 1 of specs/demo-persona-library/plan.md.
 *
 * A generated demo persona used to be written to `leads.demo_niche` and die
 * there: mint a link for a prospect, and the company, vocabulary, scoping
 * ladder and opener existed only for that one lead. This module gives the
 * persona somewhere to live, so it can be picked again for the next prospect
 * in the same niche.
 *
 * A "Client" IS a `Niche_Vocabulary` row. That table was already the persona
 * library in everything but name (17 rows, per-niche terms, templates and
 * example packs), so this adds REUSE rather than a second store. The company
 * name on the row is a DEFAULT: a single demo overrides it per lead without
 * writing back, which is what lets one saved "Ferragens" Client serve both
 * Hoffman Puxadores and the next hardware firm.
 *
 * ── Durable vs per-run ────────────────────────────────────────────────────
 * Only the persona is stored. The per-run half (scenario, ai_disclosure,
 * lead_stage, inquiry_timeframe, first_touch, ai_style, the lead's first name
 * and the company override) is deliberately NOT persisted: it comes from the
 * run controls at mint time and is re-applied by applyDemoDefaults() on
 * re-pick. Storing it would freeze a jurisdiction and a scenario into a row
 * that is meant to be reusable across both.
 */
import { db } from "./db";
import { nicheVocabulary, type NicheText } from "@shared/schema";
import { eq, ne, asc } from "drizzle-orm";
import {
  applyDemoDefaults,
  buildGenericScopingLadder,
  type NicheContext,
  type DemoScenario,
} from "./demo-session";

/** Languages a demo can run in. Mirrors the demo route's zod enum. */
export type DemoLang = "en" | "nl" | "pt";

const DEMO_LANGS: readonly DemoLang[] = ["en", "nl", "pt"];

/** Narrows a caller-supplied key before it is used to pick a column. */
function isDemoLang(value: string): value is DemoLang {
  return (DEMO_LANGS as readonly string[]).includes(value);
}

/** The fallback row. Never a selectable Client. */
const DEFAULT_NICHE = "__default__";

type ClientRow = typeof nicheVocabulary.$inferSelect;

/**
 * Read one language slot, falling back the way the rest of the app does:
 * pt → en → nl → any non-empty slot. The last step matters because a Client
 * generated in Dutch is still worth re-picking for an English demo, where a
 * Dutch scoping ladder beats campaign 60's Solar Panels one.
 *
 * ONLY for fields the MODEL READS (description, kb, quote_context, the scoping
 * ladder, the question bank, ...). That is the rule the Clients tab already
 * encodes — see the header of ClientEditor.tsx, "A Client is ENGLISH, except
 * its terms" — and it is why the fallback is safe here: the model is handed
 * English source material and writes its reply in the demo's language, so a
 * cross-language slot never reaches the prospect verbatim.
 *
 * Fields that ARE substituted verbatim must use pickStrict instead.
 */
function pick(text: NicheText | null | undefined, lang: DemoLang): string {
  if (!text) return "";
  const order: DemoLang[] = lang === "pt" ? ["pt", "en", "nl"] : lang === "nl" ? ["nl", "en", "pt"] : ["en", "nl", "pt"];
  for (const key of order) {
    const v = (text[key] ?? "").trim();
    if (v) return v;
  }
  return "";
}

/**
 * Read one language slot with NO cross-language fallback.
 *
 * For the fields that land in the prospect's message verbatim, with no model in
 * between: the opener, the opener phrase, the when-label, and the two halves of
 * the quoted opener ({quote_subject} / {quote_when}). pick()'s fallback would
 * splice one language into a sentence written in another — a Portuguese
 * quote_subject inside an English opener, which is what a Client that exists in
 * only one language used to produce.
 *
 * Empty is the correct degraded result: every consumer of these fields already
 * has a same-language fallback of its own (personalize_message falls back to
 * project_term then inquiry_timeframe for {quote_subject}, and the engine's
 * overlay skips empty values so the campaign's own copy stands). A blank that
 * falls through beats a foreign phrase that does not.
 *
 * Belt and braces: clientLanguages() + the route guard should stop a Client
 * ever being run in a language it has no opener for. This is the braces.
 */
function pickStrict(text: NicheText | null | undefined, lang: DemoLang): string {
  return (text?.[lang] ?? "").trim();
}

/**
 * Write one language slot without disturbing the others.
 *
 * `value` is typed as string but is read straight off a NicheContext, where an
 * optional field can be absent. Guarding it matters more than it looks:
 * saveDemoClient builds all fourteen slots before it writes and swallows its
 * own errors, so one undefined field used to throw past every other slot and
 * lose the entire Client with nothing but a log line.
 */
function put(text: NicheText | null | undefined, lang: DemoLang, value: string | undefined): NicheText {
  const next: NicheText = { ...(text ?? {}) };
  const v = (value ?? "").trim();
  if (v) next[lang] = v;
  return next;
}

/** The term columns, per language. `nl` is the bare column, the others suffixed. */
const TERM_COLUMNS = {
  nl: ["projectTerms", "proposalTerms", "decisionTerms", "advisorTerms", "visitTerms"],
  en: ["projectTermsEn", "proposalTermsEn", "decisionTermsEn", "advisorTermsEn", "visitTermsEn"],
  pt: ["projectTermsPt", "proposalTermsPt", "decisionTermsPt", "advisorTermsPt", "visitTermsPt"],
} as const;

/** Column name for a term group in a given language. */
function termColumn(group: 0 | 1 | 2 | 3 | 4, lang: DemoLang): string {
  return TERM_COLUMNS[lang][group];
}

/**
 * First entry of a term list for `lang`. The engine wants a single term per
 * variable ({advisor_term}); the table stores lists because the onboarding
 * wizard lets people add synonyms.
 *
 * No cross-language fallback, for the same reason as pickStrict: these five
 * words are substituted into the opener verbatim, so falling back turned an
 * English demo on a Dutch-only Client into "your keuken project". Empty is
 * handled downstream — the engine's overlay skips empty values, leaving the
 * campaign's own term in place.
 */
function firstTerm(row: ClientRow, group: 0 | 1 | 2 | 3 | 4, lang: DemoLang): string {
  const list = (row as Record<string, unknown>)[termColumn(group, lang)] as string[] | null | undefined;
  return (list ?? []).map((s) => String(s).trim()).find(Boolean) ?? "";
}

/**
 * Add a generated term to a saved list without dropping what is there.
 *
 * Union, not replace: the curated rows (Kitchens, Solar Panels, ...) carry
 * hand-written synonym lists that the onboarding wizard depends on, and one
 * generated demo must not flatten them to a single word.
 */
function mergeTerm(existing: unknown, term: string): string[] {
  const list = Array.isArray(existing) ? existing.map((s) => String(s).trim()).filter(Boolean) : [];
  const t = term.trim();
  if (t && !list.some((w) => w.toLowerCase() === t.toLowerCase())) list.push(t);
  return list;
}

/**
 * The languages a Client can actually be demoed in.
 *
 * Keyed on `first_message` alone, because that is the one field sent to the
 * prospect verbatim and unedited: it IS the demo's first impression, and there
 * is no fallback that could rescue it. Everything else either has a
 * same-language fallback or is read by the model, which translates as it writes
 * (see pick() above).
 *
 * An EMPTY result means "unrestricted", not "unusable". The sixteen curated
 * niche packs (Kitchens, Bathrooms, ...) carry word lists and a description but
 * no opener in any language, so there is nothing to splice and nothing to gate;
 * they keep behaving exactly as they did. Only a Client that HAS openers is
 * held to the languages it has them in.
 */
export function clientLanguages(row: ClientRow): DemoLang[] {
  const opener = row.firstMessage as NicheText | null;
  return DEMO_LANGS.filter((l) => ((opener?.[l] ?? "").trim() !== ""));
}

/** Summary shape for the Clients tab and the re-pick picker. */
export interface DemoClientSummary {
  id: number;
  niche: string;
  label: string;
  companyName: string;
  /** Null until set by hand or by the generator's category preference. */
  category: string | null;
  /** Null until set by hand or by the generator. */
  emoji: string | null;
  /** Languages this Client has content for, so the picker can warn on a gap. */
  languages: DemoLang[];
  /** False for the curated niche packs, which the tab lists but cannot delete. */
  isDemoClient: boolean;
  updatedAt: Date | null;
}

/**
 * Every saved Client, newest first. Excludes `__default__`, which is a fallback
 * row rather than a persona anyone would demo.
 */
export async function listDemoClients(): Promise<DemoClientSummary[]> {
  const rows = await db
    .select()
    .from(nicheVocabulary)
    .where(ne(nicheVocabulary.niche, DEFAULT_NICHE))
    .orderBy(asc(nicheVocabulary.niche));

  return rows.map((r) => {
    // The same helper the create-link guard uses, so the badge can never
    // promise a language the guard then refuses. Raw slots, NOT pick(): pick
    // falls back across languages, which would report every Client as
    // trilingual and make the badge worthless.
    const languages = clientLanguages(r);
    return {
      id: r.id,
      niche: r.niche,
      label: pick(r.nicheLabel as NicheText, "en") || r.niche,
      companyName: pick(r.companyNameTemplate as NicheText, "en"),
      category: r.category ?? null,
      emoji: r.emoji ?? null,
      languages,
      isDemoClient: r.isDemoClient ?? false,
      updatedAt: r.updatedAt ?? null,
    };
  });
}

/** One Client by niche key. */
export async function getDemoClient(niche: string): Promise<ClientRow | undefined> {
  const [row] = await db.select().from(nicheVocabulary).where(eq(nicheVocabulary.niche, niche));
  return row;
}

/**
 * Persist a generated persona as a Client, keyed on the free-text niche.
 *
 * Upsert semantics, chosen deliberately:
 *  - Only the generating language's slots are written. Generating a Portuguese
 *    demo for a niche that already has English content adds pt and leaves en
 *    alone, so one row serves every language it has ever been demoed in.
 *  - Term lists are unioned (see mergeTerm), never replaced.
 *  - `company_name` is stored as the row's DEFAULT. The per-demo override that
 *    create-link applies on top is NOT saved: it belongs to one prospect.
 *
 * Never throws into the caller's path: a demo link that works is worth more
 * than a library write, so failures are logged and swallowed. The caller has
 * already generated the context and put it on the lead by the time this runs.
 */
export async function saveDemoClient(
  niche: string,
  language: DemoLang,
  ctx: NicheContext,
): Promise<{ saved: boolean; niche: string }> {
  const key = niche.trim();
  if (!key || key === DEFAULT_NICHE) return { saved: false, niche: key };

  try {
    const existing = await getDemoClient(key);

    // Text slots: merge this language into whatever is already there.
    const text = {
      nicheLabel: put(existing?.nicheLabel as NicheText, language, ctx.niche_label),
      companyNameTemplate: put(existing?.companyNameTemplate as NicheText, language, ctx.company_name),
      descriptionTemplate: put(existing?.descriptionTemplate as NicheText, language, ctx.business_description),
      kbTemplate: put(existing?.kbTemplate as NicheText, language, ctx.kb),
      questionBank: put(existing?.questionBank as NicheText, language, ctx.niche_question_bank),
      objectionExamples: put(existing?.objectionExamples as NicheText, language, ctx.niche_objection_examples),
      scopingLadder: put(existing?.scopingLadder as NicheText, language, ctx.scoping_ladder),
      openerPhrase: put(existing?.openerPhrase as NicheText, language, ctx.opener_phrase),
      serviceName: put(existing?.serviceName as NicheText, language, ctx.service_name),
      usp: put(existing?.usp as NicheText, language, ctx.usp),
      nicheQuestion: put(existing?.nicheQuestion as NicheText, language, ctx.niche_question),
      firstMessage: put(existing?.firstMessage as NicheText, language, ctx.first_message),
      enquiryContext: put(existing?.enquiryContext as NicheText, language, ctx.enquiry_context),
      quoteContext: put(existing?.quoteContext as NicheText, language, ctx.quote_context),
      quoteSubject: put(existing?.quoteSubject as NicheText, language, ctx.quote_subject),
      quoteWhen: put(existing?.quoteWhen as NicheText, language, ctx.quote_when),
      whenLabel: put(existing?.whenLabel as NicheText, language, ctx.when_label),
    };

    // Term lists for this language only.
    const terms: Record<string, string[]> = {};
    const generated = [ctx.project_term, ctx.proposal_term, ctx.decision_term, ctx.advisor_term, ctx.visit_term];
    for (let group = 0; group < 5; group++) {
      const col = termColumn(group as 0 | 1 | 2 | 3 | 4, language);
      terms[col] = mergeTerm((existing as Record<string, unknown> | undefined)?.[col], generated[group] ?? "");
    }

    const values: Record<string, unknown> = {
      ...text,
      ...terms,
      bookingModeCall: ctx.booking_mode_call,
      updatedAt: new Date(),
    };
    // Written once, never clobbered: a human editing the Clients tab, or a
    // second demo minted later for the same niche, must win over whatever a
    // fresh generation returns.
    if (!existing?.category && ctx.category) values.category = ctx.category.trim();
    if (!existing?.emoji && ctx.emoji) values.emoji = ctx.emoji.trim();

    if (existing) {
      // isDemoClient is deliberately NOT set here. Minting a demo whose niche
      // happens to match a curated pack (which is how "Kitchens" ended up with
      // a demo company name) writes persona content onto that shared row, but
      // it does not make the row disposable: the engine still reads its word
      // lists for real campaigns. Only a row this feature CREATED is deletable.
      await db.update(nicheVocabulary).set(values).where(eq(nicheVocabulary.id, existing.id));
    } else {
      await db
        .insert(nicheVocabulary)
        .values({ niche: key, createdAt: new Date(), isDemoClient: true, ...values });
    }
    return { saved: true, niche: key };
  } catch (err) {
    // Deliberately non-fatal: see the doc comment.
    console.error(`[demo-clients] failed to save Client "${key}":`, err);
    return { saved: false, niche: key };
  }
}

/** The text fields the Clients tab edits, mapped to their columns. */
export const CLIENT_TEXT_FIELDS = {
  nicheLabel: "niche_label",
  companyNameTemplate: "company_name_template",
  serviceName: "service_name",
  usp: "usp",
  descriptionTemplate: "description_template",
  kbTemplate: "kb_template",
  nicheQuestion: "niche_question",
  enquiryContext: "enquiry_context",
  quoteContext: "quote_context",
  quoteSubject: "quote_subject",
  quoteWhen: "quote_when",
  scopingLadder: "scoping_ladder",
  openerPhrase: "opener_phrase",
  firstMessage: "first_message",
  questionBank: "question_bank",
  objectionExamples: "objection_examples",
  whenLabel: "when_label",
} as const;

export type ClientTextField = keyof typeof CLIENT_TEXT_FIELDS;

/** The five term groups, in the order the columns are declared. */
export const TERM_GROUPS = ["project", "proposal", "decision", "advisor", "visit"] as const;
export type TermGroup = (typeof TERM_GROUPS)[number];

export interface ClientPatch {
  /** Text slots to merge, per field, per language. */
  text?: Partial<Record<ClientTextField, Partial<Record<DemoLang, string>>>>;
  /** Term lists to REPLACE, per group, per language. */
  terms?: Partial<Record<TermGroup, Partial<Record<DemoLang, string[]>>>>;
  bookingModeCall?: boolean;
  /** Empty/whitespace collapses to null, same as clearing any other field. */
  category?: string | null;
  emoji?: string | null;
}

/**
 * Apply an edit from the Clients tab.
 *
 * Text slots merge (sending only `{ en: "..." }` leaves nl and pt alone), while
 * term lists REPLACE for the language sent, because the editor shows the whole
 * list and removing a word has to be possible. That asymmetry is deliberate:
 * saveDemoClient unions terms because it is adding one generated word to a
 * curated list, whereas this is a human editing the list itself.
 */
export async function updateDemoClient(niche: string, patch: ClientPatch): Promise<boolean> {
  const existing = await getDemoClient(niche);
  if (!existing) return false;

  const values: Record<string, unknown> = { updatedAt: new Date() };

  // Both loops key straight into a Drizzle .set(), so an unknown field name or
  // language would become a column write. `text: { niche: {...} }` would put a
  // JS object in the unique key column; an unknown language would index
  // TERM_COLUMNS to undefined. The route's schema is z.record(z.record(...)),
  // which validates the VALUES and nothing about the keys, so the whitelist has
  // to live here, next to the write.
  for (const [field, slots] of Object.entries(patch.text ?? {})) {
    if (!(field in CLIENT_TEXT_FIELDS)) continue;
    let next: NicheText = { ...((existing as Record<string, unknown>)[field] as NicheText | null ?? {}) };
    for (const [lang, value] of Object.entries(slots ?? {})) {
      if (!isDemoLang(lang)) continue;
      const v = (value ?? "").trim();
      if (v) next[lang] = v;
      else delete next[lang];
    }
    values[field] = next;
  }

  for (const [group, byLang] of Object.entries(patch.terms ?? {})) {
    const index = TERM_GROUPS.indexOf(group as TermGroup) as 0 | 1 | 2 | 3 | 4;
    if (index < 0) continue;
    for (const [lang, list] of Object.entries(byLang ?? {})) {
      if (!isDemoLang(lang)) continue;
      const col = termColumn(index, lang);
      values[col] = Array.from(
        new Set((list ?? []).map((w) => String(w).trim()).filter(Boolean)),
      );
    }
  }

  if (patch.bookingModeCall !== undefined) values.bookingModeCall = patch.bookingModeCall;
  if (patch.category !== undefined) values.category = (patch.category ?? "").trim() || null;
  if (patch.emoji !== undefined) values.emoji = (patch.emoji ?? "").trim() || null;

  await db.update(nicheVocabulary).set(values).where(eq(nicheVocabulary.id, existing.id));
  return true;
}

/** Delete a Client. `__default__` is never deletable: it is the fallback row. */
export async function deleteDemoClient(
  niche: string,
): Promise<"deleted" | "missing" | "curated"> {
  if (niche === DEFAULT_NICHE) return "curated";
  const row = await getDemoClient(niche);
  if (!row) return "missing";

  // The Clients tab lists every Niche_Vocabulary row, which includes the
  // curated niche packs that predate this feature and that the engine merges
  // into REAL campaigns (word lists, question banks, objection examples).
  // Those are not personas anyone minted, and deleting one silently degrades a
  // live campaign. Only the flag decides: all 16 curated rows carry a
  // description_template from the campaign business-profile pre-fill, so any
  // content-based test would wave every one of them through.
  if (!row.isDemoClient) return "curated";

  const rows = await db.delete(nicheVocabulary).where(eq(nicheVocabulary.niche, niche)).returning();
  return rows.length > 0 ? "deleted" : "missing";
}

/**
 * Copy a Client under a new niche key. Always creates a saved (deletable)
 * Client, even when the source is one of the curated packs the engine reads
 * for real campaigns — duplicating a curated niche is exactly how you get an
 * editable, deletable copy of it without touching the shared original.
 */
export async function duplicateDemoClient(
  sourceNiche: string,
  newNiche: string,
): Promise<{ ok: true; row: ClientRow } | { ok: false; reason: "missing" | "conflict" }> {
  const source = await getDemoClient(sourceNiche);
  if (!source) return { ok: false, reason: "missing" };

  const key = newNiche.trim();
  const conflict = await getDemoClient(key);
  if (conflict) return { ok: false, reason: "conflict" };

  const { id: _id, niche: _niche, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = source;
  const [row] = await db
    .insert(nicheVocabulary)
    .values({
      ...(rest as typeof nicheVocabulary.$inferInsert),
      niche: key,
      createdAt: new Date(),
      updatedAt: new Date(),
      isDemoClient: true,
    })
    .returning();
  return { ok: true, row };
}

/**
 * One Client in the shape the editor wants: every text field as a full
 * {en,nl,pt} object and every term group as three lists, with no fallback
 * applied. The editor must show what is actually stored, not what a reader
 * would resolve to, or saving would write the fallback into the empty slot.
 */
export function demoClientToEditable(row: ClientRow) {
  const text = {} as Record<ClientTextField, NicheText>;
  for (const field of Object.keys(CLIENT_TEXT_FIELDS) as ClientTextField[]) {
    text[field] = ((row as Record<string, unknown>)[field] as NicheText | null) ?? {};
  }
  const terms = {} as Record<TermGroup, Record<DemoLang, string[]>>;
  TERM_GROUPS.forEach((group, i) => {
    terms[group] = {
      en: ((row as Record<string, unknown>)[termColumn(i as 0 | 1 | 2 | 3 | 4, "en")] as string[]) ?? [],
      nl: ((row as Record<string, unknown>)[termColumn(i as 0 | 1 | 2 | 3 | 4, "nl")] as string[]) ?? [],
      pt: ((row as Record<string, unknown>)[termColumn(i as 0 | 1 | 2 | 3 | 4, "pt")] as string[]) ?? [],
    };
  });
  return {
    id: row.id,
    label: pick(row.nicheLabel as NicheText, "en") || row.niche,
    companyName: pick(row.companyNameTemplate as NicheText, "en"),
    category: row.category ?? null,
    emoji: row.emoji ?? null,
    niche: row.niche,
    bookingModeCall: row.bookingModeCall ?? false,
    isDemoClient: row.isDemoClient ?? false,
    updatedAt: row.updatedAt ?? null,
    text,
    terms,
  };
}

export type EditableDemoClient = ReturnType<typeof demoClientToEditable>;

/**
 * Rebuild a full NicheContext from a saved Client, for a specific run.
 *
 * The inverse of saveDemoClient, plus the per-run half applied on top by
 * applyDemoDefaults (scenario, disclosure, ai_style, timeframe, first touch).
 * The result is indistinguishable from a fresh generation, which is the point:
 * re-picking must not produce a second-class demo.
 *
 * Returns null when the row carries no usable content in any language, so the
 * caller can fall back to generating rather than mint a hollow demo.
 */
export function demoClientToContext(
  row: ClientRow,
  language: DemoLang,
  scenario: DemoScenario,
): NicheContext | null {
  const label = pick(row.nicheLabel as NicheText, language) || row.niche;
  const description = pick(row.descriptionTemplate as NicheText, language);
  // Strict: the opener is sent verbatim, so a Client with no opener in
  // `language` must yield an empty one rather than one in whatever language
  // happened to be filled in first. Note this does NOT make the guard below
  // fire: `description` keeps its fallback (by design — the model reads it),
  // so a language-less Client still returns a context. Refusing that pairing
  // is the route guard's job, via clientLanguages().
  const firstMessage = pickStrict(row.firstMessage as NicheText, language);
  // A row with neither a description nor an opener is a vocabulary-only niche
  // (the pre-existing curated rows are like this). Generating gives a better
  // demo than dressing those five word lists up as a persona.
  if (!description && !firstMessage) return null;

  const visitTerm = firstTerm(row, 4, language);
  const ctx: NicheContext = {
    raw: row.niche,
    niche_label: label,
    company_name: pick(row.companyNameTemplate as NicheText, language),
    service_name: pick(row.serviceName as NicheText, language),
    usp: pick(row.usp as NicheText, language),
    business_description: description,
    booking_mode_call: row.bookingModeCall ?? false,
    // Overwritten by applyDemoDefaults from the scenario; present so the object
    // is a complete NicheContext even if that call is ever skipped.
    what_lead_did: "",
    when_label: pickStrict(row.whenLabel as NicheText, language),
    niche_question: pick(row.nicheQuestion as NicheText, language),
    first_message: firstMessage,
    opener_phrase: pickStrict(row.openerPhrase as NicheText, language) || label,
    // Never allowed to be empty: an empty ladder does not fall through to a
    // neutral default, it inherits campaign 60's Solar Panels ladder and asks a
    // dental prospect about roof faces. Same guard the generator uses.
    scoping_ladder:
      pick(row.scopingLadder as NicheText, language) || buildGenericScopingLadder(label, language),
    enquiry_context: pick(row.enquiryContext as NicheText, language),
    quote_context: pick(row.quoteContext as NicheText, language),
    // Strict: these two are substituted straight into campaign 60's
    // first_message_quoted ("about the {quote_subject} we quoted {quote_when}"),
    // so a fallback lands a foreign noun phrase mid-sentence.
    quote_subject: pickStrict(row.quoteSubject as NicheText, language),
    quote_when: pickStrict(row.quoteWhen as NicheText, language),
    kb: pick(row.kbTemplate as NicheText, language),
    advisor_term: firstTerm(row, 3, language),
    project_term: firstTerm(row, 0, language) || label,
    proposal_term: firstTerm(row, 1, language),
    visit_term: visitTerm,
    decision_term: firstTerm(row, 2, language),
    niche_question_bank: pick(row.questionBank as NicheText, language),
    niche_objection_examples: pick(row.objectionExamples as NicheText, language),
    lead_stage: scenario,
    inquiry_timeframe: "",
    first_touch: "",
    ai_style: "",
    // Placeholder: applyDemoDefaults below owns this field and blanks it, so
    // the campaign column (or an explicit per-link override) decides.
    ai_disclosure: "",
  };

  return applyDemoDefaults(ctx, language, scenario);
}
