/**
 * Live persona helpers for the Account Voice tab (specs/voice-tab).
 *
 * A live persona is a Niche_Vocabulary row owned by one Account (accounts_id +
 * is_live). Its text fields are GENERATED from the account, never hand-edited,
 * and its kb_template stays empty because the engine reads Account_Knowledge_Base
 * directly for client lines.
 */
import { and, eq } from "drizzle-orm";
import type { PgDatabase } from "drizzle-orm/pg-core";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { db } from "../db";
import type * as schema from "@shared/schema";
import {
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

/** One language's text from a {nl,en,pt} slot, falling back en, nl, pt. */
export function pickSlot(slot: unknown, lang: VoiceLang): string {
  if (!slot || typeof slot !== "object") return "";
  const s = slot as NicheText;
  return (s[lang] || s.en || s.nl || s.pt || "").trim();
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
  const usp = (profile?.differentiator ?? "")
    .split("\n").map((l) => l.trim()).filter(Boolean).join("\n");
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
      kbTemplate: { nl: "", en: "" },
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
