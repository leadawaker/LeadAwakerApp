/**
 * Live persona helpers for the Account Voice tab (specs/voice-tab).
 *
 * A live persona is a Niche_Vocabulary row owned by one Account (accounts_id +
 * is_live). Its company, description and usp follow the account (see
 * syncLivePersona); kb_template, question_bank and every other field are only
 * ever set by hand and are never written here. A new row starts with an empty
 * kb_template because the engine reads Account_Knowledge_Base for client lines.
 */
import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { db } from "../db";
import type * as schema from "@shared/schema";
import {
  accountCommunicationProfile,
  nicheVocabulary,
  type Accounts,
  type AccountCommunicationProfile,
  type NicheText,
  type NicheVocabulary,
} from "@shared/schema";

export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];
/** Either the db or a transaction: both are a PgDatabase over the same schema. */
export type DbLike = PgDatabase<NodePgQueryResultHKT, typeof schema>;

export type VoiceLang = "nl" | "en" | "pt";

/** The spoken language of a voice locale ("pt-BR" -> "pt", "en-GB" -> "en"). */
export function localeLanguage(locale: string | null | undefined): VoiceLang {
  const l = (locale ?? "").toLowerCase();
  if (l.startsWith("en")) return "en";
  if (l.startsWith("pt")) return "pt";
  return "nl";
}

/**
 * One language's text from a {nl,en,pt} slot, falling back to en only: the
 * same rule as the engine's `_slot` (voice/number_routing.py), so the Voice
 * tab shows exactly what she says and a cleared field reads as empty instead
 * of another language's leftover text.
 */
export function pickSlot(slot: unknown, lang: VoiceLang): string {
  if (!slot || typeof slot !== "object") return "";
  const s = slot as NicheText;
  return (s[lang] || s.en || "").trim();
}

/** Existing slot with the voice-language slot and the `en` fallback set. */
function withSlots(existing: unknown, lang: VoiceLang, value: string): NicheText {
  const base: NicheText = existing && typeof existing === "object" ? { ...(existing as NicheText) } : {};
  if (!value) return base;
  base[lang] = value;
  base.en = value;
  return base;
}

export async function getLivePersona(exec: DbLike, accountId: number): Promise<NicheVocabulary | undefined> {
  const [row] = await exec
    .select()
    .from(nicheVocabulary)
    .where(and(eq(nicheVocabulary.accountsId, accountId), eq(nicheVocabulary.isLive, true)));
  return row;
}

/**
 * Create the account's live persona, or regenerate its text fields when one
 * exists. Fields come from the account: company name, description
 * (business_description), usp (profile differentiator), service name and niche
 * label (business_niche). Empty source values never wipe an existing slot.
 */
export async function upsertLivePersona(
  tx: Tx,
  account: Pick<Accounts, "id" | "name" | "businessDescription" | "businessNiche">,
  profile: Pick<AccountCommunicationProfile, "differentiator"> | undefined,
  lang: VoiceLang,
): Promise<NicheVocabulary> {
  const accountId = account.id!;
  const company = (account.name ?? "").trim();
  const description = (account.businessDescription ?? "").trim();
  const niche = (account.businessNiche ?? "").trim();
  const usp = normalizeUsp(profile?.differentiator);
  const now = new Date();

  // An account may already own a persona row (created by the tab, or linked by
  // hand): regenerate it in place rather than fight the one-per-account index.
  const [owned] = await tx.select().from(nicheVocabulary).where(eq(nicheVocabulary.accountsId, accountId));
  if (owned) {
    const [row] = await tx.update(nicheVocabulary).set({
      isLive: true,
      companyNameTemplate: withSlots(owned.companyNameTemplate, lang, company) as never,
      descriptionTemplate: withSlots(owned.descriptionTemplate, lang, description) as never,
      usp: withSlots(owned.usp, lang, usp),
      serviceName: withSlots(owned.serviceName, lang, niche),
      nicheLabel: withSlots(owned.nicheLabel, lang, niche),
      // kb_template is hand-made (e.g. row 75): a regenerate never touches it.
      updatedAt: now,
    }).where(eq(nicheVocabulary.id, owned.id)).returning();
    return row;
  }

  // New row. niche is a unique key shared with the demo personas, so a name
  // that is already taken (e.g. a demo persona of the same business) gets a
  // suffix instead of adopting, and so never clobbers the demo.
  const base = company || `Account ${accountId}`;
  let key = base;
  for (const candidate of [base, `${base} (live)`, `${base} (live ${accountId})`]) {
    const [taken] = await tx.select({ id: nicheVocabulary.id }).from(nicheVocabulary).where(eq(nicheVocabulary.niche, candidate));
    if (!taken) { key = candidate; break; }
    key = `${base} (live ${accountId})`;
  }

  const [row] = await tx.insert(nicheVocabulary).values({
    niche: key,
    accountsId: accountId,
    isLive: true,
    companyNameTemplate: withSlots(null, lang, company) as never,
    descriptionTemplate: withSlots(null, lang, description) as never,
    kbTemplate: { nl: "", en: "" },
    usp: withSlots(null, lang, usp),
    serviceName: withSlots(null, lang, niche),
    nicheLabel: withSlots(null, lang, niche),
    createdAt: now,
    updatedAt: now,
  }).returning();
  return row;
}

/** USP lines as the persona stores them: trimmed, empty lines dropped. */
export function normalizeUsp(v: string | null | undefined): string {
  return (v ?? "").split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
}

/** What changed at the source. Only the fields present are written. */
export interface PersonaSourceChange {
  /** The name she says. Written as given (the account name is never renamed from here). */
  company?: string;
  /** Accounts.name was renamed: the persona follows only while it still says the old name. */
  accountRename?: { from: string | null; to: string | null };
  /** Accounts.business_description. */
  description?: string | null;
  /** Profile differentiator. */
  usp?: string | null;
}

/**
 * Bring the account's live persona in step with a source edit (the Voice tab's
 * persona card, account details, the onboarding wizard). Writes only the
 * fields that changed, in the line's voice language slot plus the `en`
 * fallback, the same slots upsertLivePersona fills. kb_template, question_bank,
 * service name and niche label are left alone. No persona: nothing to do.
 */
export async function syncLivePersona(exec: DbLike, accountId: number, change: PersonaSourceChange): Promise<void> {
  const persona = await getLivePersona(exec, accountId);
  if (!persona) return;
  const [profile] = await exec.select({ setup: accountCommunicationProfile.setup }).from(accountCommunicationProfile)
    .where(eq(accountCommunicationProfile.accountsId, accountId));
  const setup = (profile?.setup && typeof profile.setup === "object" ? profile.setup : {}) as Record<string, unknown>;
  const voice = (setup.voice && typeof setup.voice === "object" ? setup.voice : {}) as Record<string, unknown>;
  const lang = localeLanguage(typeof voice.locale === "string" ? voice.locale : null);

  const put = (existing: unknown, value: string): NicheText | null => {
    if (pickSlot(existing, lang) === value) return null;
    const base: NicheText = existing && typeof existing === "object" ? { ...(existing as NicheText) } : {};
    base[lang] = value;
    base.en = value;
    return base;
  };
  const set: Partial<typeof nicheVocabulary.$inferInsert> = {};

  let company = change.company?.trim();
  if (company === undefined && change.accountRename) {
    const from = (change.accountRename.from ?? "").trim();
    const to = (change.accountRename.to ?? "").trim();
    const current = pickSlot(persona.companyNameTemplate, lang);
    if (to && (!current || current === from)) company = to;
  }
  if (company) {
    const v = put(persona.companyNameTemplate, company);
    if (v) set.companyNameTemplate = v as never;
  }
  if (change.description !== undefined) {
    const v = put(persona.descriptionTemplate, (change.description ?? "").trim());
    if (v) set.descriptionTemplate = v as never;
  }
  if (change.usp !== undefined) {
    const v = put(persona.usp, normalizeUsp(change.usp));
    if (v) set.usp = v;
  }
  if (Object.keys(set).length === 0) return;
  await exec.update(nicheVocabulary).set({ ...set, updatedAt: new Date() }).where(eq(nicheVocabulary.id, persona.id));
}
