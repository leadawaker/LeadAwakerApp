/**
 * The Account workspace "Voice" tab (specs/voice-tab): one live voice client's
 * number, persona, voice settings and readiness, read and written as one unit.
 *
 * Source of truth per field is in the spec. `saveVoiceLine` is the ONLY writer
 * of the Voice_Numbers mirrors (agent_name, voice, locale, transfer_number), and
 * writes them in the same transaction as the profile `setup`, so they cannot
 * drift. `setup` keys this tab does not own are preserved (merge, never replace).
 */
import { and, asc, desc, eq, isNull, ne, sql } from "drizzle-orm";
import { db } from "../db";
import {
  accounts,
  accountCommunicationProfile,
  voiceNumbers,
  type AccountCommunicationProfile,
  type Accounts,
  type VoiceNumber,
} from "@shared/schema";
import {
  getLivePersona, localeLanguage, pickSlot, upsertLivePersona,
  type DbLike, type Tx,
} from "./voicePersona";

export const VOICE_LOCALES = ["nl", "en-GB", "en-US", "pt-BR"] as const;
export const AFTER_HOURS = ["message", "callback", "ringHot"] as const;
/** What a caller hears while a screened transfer rings the owner. */
export const TRANSFER_WAITING = ["sara", "hold"] as const;

export interface PronunciationRow { word: string; sayAs: string }

export interface VoiceLine {
  accountId: number;
  number: { id: number; phoneNumber: string; enabled: boolean; status: "not_set" | "pending" | "live" } | null;
  persona: { id: number; niche: string; companyName: string; description: string; usp: string; isLive: boolean } | null;
  agentName: string | null;
  agentNameCustom: string | null;
  voice: string | null;
  locale: string | null;
  transferNumber: string | null;
  transferName: string | null;
  transferWaiting: (typeof TRANSFER_WAITING)[number];
  greeting: string;
  pronunciation: PronunciationRow[];
  afterHours: (typeof AFTER_HOURS)[number] | null;
  extraInstructions: string;
  hours: { start: string | null; end: string | null; timezone: string | null };
  kbCount: number;
  readiness: {
    items: { key: "number" | "persona" | "kb" | "voice" | "agent" | "transfer" | "hours"; ok: boolean }[];
    ready: boolean;
  };
}

export interface VoiceLinePatch {
  /** Attach an unassigned row, or null to detach the account's number. */
  numberId?: number | null;
  /** E.164: finds or creates a row and attaches it. */
  phoneNumber?: string;
  createPersona?: boolean;
  agentName?: string | null;
  agentNameCustom?: string | null;
  voice?: string | null;
  locale?: string | null;
  transferNumber?: string | null;
  transferName?: string | null;
  transferWaiting?: (typeof TRANSFER_WAITING)[number];
  greeting?: string;
  pronunciation?: PronunciationRow[];
  afterHours?: (typeof AFTER_HOURS)[number] | null;
  extraInstructions?: string;
  /** Switch the attached number on (answers real calls) or off. On needs every readiness item. */
  live?: boolean;
}

/** A failure the route maps to an HTTP status. */
export class VoiceLineError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export interface UnassignedNumber { id: number; phoneNumber: string; label: string | null; enabled: boolean }

// A real phone number. Browser-test rows ("browser-test:robben") are not one and
// never count as the account's number.
const isRealNumber = sql`${voiceNumbers.phoneNumber} ~ '^[+][0-9]+$'`;

type Obj = Record<string, unknown>;
const obj = (v: unknown): Obj => (v && typeof v === "object" && !Array.isArray(v) ? (v as Obj) : {});
const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** Display name mirrored to Voice_Numbers: a custom name as typed, a preset capitalised. */
function effectiveAgentName(p: Pick<AccountCommunicationProfile, "agentName" | "agentNameCustom"> | undefined): string | null {
  const custom = text(p?.agentNameCustom);
  if (custom) return custom;
  const preset = text(p?.agentName);
  return preset ? preset.charAt(0).toUpperCase() + preset.slice(1) : null;
}

async function loadState(exec: DbLike, accountId: number) {
  const [account] = await exec.select().from(accounts).where(eq(accounts.id, accountId));
  if (!account) return null;
  const [profile] = await exec.select().from(accountCommunicationProfile)
    .where(eq(accountCommunicationProfile.accountsId, accountId));
  const [number] = await exec.select().from(voiceNumbers)
    .where(and(eq(voiceNumbers.accountsId, accountId), isRealNumber))
    .orderBy(desc(voiceNumbers.enabled), asc(voiceNumbers.id))
    .limit(1);
  const persona = await getLivePersona(exec, accountId);
  const kb = await exec.execute(sql`
    SELECT count(*)::int AS n FROM "p2mxx34fvbf3ll6"."Account_Knowledge_Base" WHERE account_id = ${accountId}
  `);
  const kbCount = Number((kb.rows as { n: number }[])[0]?.n ?? 0);
  return { account, profile, number, persona, kbCount };
}

type State = NonNullable<Awaited<ReturnType<typeof loadState>>>;

const hhmm = (t: string | null | undefined) => (t ? String(t).slice(0, 5) : null);

function toVoiceLine(accountId: number, st: State): VoiceLine {
  const { account, profile, number, persona, kbCount } = st;
  const setup = obj(profile?.setup);
  const voiceSetup = obj(setup.voice);
  const handoff = obj(setup.handoff);

  const voice = text(voiceSetup.voice) || null;
  const rawLocale = text(voiceSetup.locale);
  const locale = (VOICE_LOCALES as readonly string[]).includes(rawLocale) ? rawLocale : null;
  const rawAfter = text(voiceSetup.afterHours);
  const afterHours = (AFTER_HOURS as readonly string[]).includes(rawAfter) ? (rawAfter as VoiceLine["afterHours"]) : null;
  const pronunciation = (Array.isArray(voiceSetup.pronunciation) ? voiceSetup.pronunciation : [])
    .map(obj)
    .filter((r) => typeof r.word === "string" && typeof r.sayAs === "string")
    .map((r) => ({ word: r.word as string, sayAs: r.sayAs as string }));
  const transferNumber = text(handoff.number) || null;
  const lang = localeLanguage(locale);
  const agentName = text(profile?.agentName) || null;
  const agentNameCustom = text(profile?.agentNameCustom) || null;
  const hours = {
    start: hhmm(account.businessHoursStart),
    end: hhmm(account.businessHoursEnd),
    timezone: account.timezone ?? null,
  };

  const ok = {
    number: !!number,
    persona: !!persona?.isLive,
    kb: kbCount > 0,
    voice: !!voice && !!locale,
    // A custom name clears agent_name in the wizard, so either counts as set.
    agent: !!agentName || !!agentNameCustom,
    transfer: !!transferNumber,
    hours: !!hours.start && !!hours.end,
  };
  const items = (Object.keys(ok) as (keyof typeof ok)[]).map((key) => ({ key, ok: ok[key] }));

  return {
    accountId,
    number: number
      ? { id: number.id, phoneNumber: number.phoneNumber, enabled: number.enabled, status: number.enabled ? "live" : "pending" }
      : null,
    persona: persona
      ? {
          id: persona.id,
          niche: persona.niche,
          companyName: pickSlot(persona.companyNameTemplate, lang),
          description: pickSlot(persona.descriptionTemplate, lang),
          usp: pickSlot(persona.usp, lang),
          isLive: persona.isLive,
        }
      : null,
    agentName,
    agentNameCustom,
    voice,
    locale,
    transferNumber,
    transferName: text(handoff.name) || null,
    transferWaiting: text(handoff.waiting) === "hold" ? "hold" : "sara",
    greeting: typeof voiceSetup.greeting === "string" ? voiceSetup.greeting : "",
    pronunciation,
    afterHours,
    extraInstructions: typeof voiceSetup.extraInstructions === "string" ? voiceSetup.extraInstructions : "",
    hours,
    kbCount,
    readiness: { items, ready: items.every((i) => i.ok) },
  };
}

async function getVoiceLine(accountId: number): Promise<VoiceLine | null> {
  const st = await loadState(db, accountId);
  return st ? toVoiceLine(accountId, st) : null;
}

/** Rows the tab may offer for attaching: no account yet, and not the agency demo line. */
async function listUnassignedNumbers(): Promise<UnassignedNumber[]> {
  const rows = await db.select({
    id: voiceNumbers.id, phoneNumber: voiceNumbers.phoneNumber, label: voiceNumbers.label, enabled: voiceNumbers.enabled,
  }).from(voiceNumbers)
    .where(and(isNull(voiceNumbers.accountsId), ne(voiceNumbers.costOwner, "agency"), isRealNumber))
    .orderBy(asc(voiceNumbers.id));
  return rows;
}

/** Free the account's real number(s) except `keepId`. A freed row is disabled so it cannot answer as a demo line. */
async function detachNumbers(tx: Tx, accountId: number, keepId: number | null) {
  const cond = and(
    eq(voiceNumbers.accountsId, accountId), isRealNumber,
    keepId != null ? ne(voiceNumbers.id, keepId) : undefined,
  );
  await tx.update(voiceNumbers).set({
    accountsId: null, campaignsId: null, personaId: null, clientNiche: null, enabled: false, updatedAt: new Date(),
  }).where(cond);
}

function assertAttachable(row: VoiceNumber, accountId: number) {
  if (row.accountsId != null && row.accountsId !== accountId) {
    throw new VoiceLineError(409, "That number is already assigned to another account.");
  }
  // The agency account (id 1) may hold its own demo line, so Sara is editable in its Voice tab.
  if (row.costOwner === "agency" && accountId !== 1) {
    throw new VoiceLineError(409, "That is an agency line and cannot be assigned to a client.");
  }
}

/** Attach / detach per the patch. Returns the id of the number now attached, if the patch touched it. */
async function applyNumber(tx: Tx, accountId: number, account: Accounts, patch: VoiceLinePatch) {
  if (patch.numberId === null) {
    await detachNumbers(tx, accountId, null);
    return;
  }
  let row: VoiceNumber | undefined;
  if (patch.numberId !== undefined) {
    [row] = await tx.select().from(voiceNumbers).where(eq(voiceNumbers.id, patch.numberId)).for("update");
    if (!row) throw new VoiceLineError(404, "No such number.");
  } else if (patch.phoneNumber !== undefined) {
    [row] = await tx.select().from(voiceNumbers).where(eq(voiceNumbers.phoneNumber, patch.phoneNumber)).for("update");
  } else {
    return;
  }

  if (row) {
    assertAttachable(row, accountId);
    await detachNumbers(tx, accountId, row.id);
    await tx.update(voiceNumbers).set({ accountsId: accountId, updatedAt: new Date() }).where(eq(voiceNumbers.id, row.id));
    return;
  }
  // A new row starts disabled (pending review): nothing answers on it until the
  // line is switched on, so entering a number here can never take live calls early.
  const now = new Date();
  await detachNumbers(tx, accountId, null);
  await tx.insert(voiceNumbers).values({
    phoneNumber: patch.phoneNumber!,
    label: account.name ?? null,
    accountsId: accountId,
    enabled: false,
    costOwner: "client",
    createdAt: now,
    updatedAt: now,
  });
}

/** Merge the patch into the profile's `setup` and agent name, preserving every other key. */
async function applyProfile(tx: Tx, accountId: number, profile: AccountCommunicationProfile | undefined, patch: VoiceLinePatch) {
  const setup = { ...obj(profile?.setup) };
  const voice = { ...obj(setup.voice) };
  const handoff = { ...obj(setup.handoff) };
  let setupTouched = false;
  const setVoice = (k: string, v: unknown) => { voice[k] = v; setupTouched = true; };
  const setHandoff = (k: string, v: unknown) => { handoff[k] = v; setupTouched = true; };

  if (patch.voice !== undefined) setVoice("voice", patch.voice);
  if (patch.locale !== undefined) setVoice("locale", patch.locale);
  if (patch.greeting !== undefined) setVoice("greeting", patch.greeting);
  if (patch.pronunciation !== undefined) setVoice("pronunciation", patch.pronunciation);
  if (patch.afterHours !== undefined) setVoice("afterHours", patch.afterHours);
  if (patch.extraInstructions !== undefined) setVoice("extraInstructions", patch.extraInstructions);
  if (patch.transferNumber !== undefined) setHandoff("number", patch.transferNumber ?? "");
  if (patch.transferName !== undefined) setHandoff("name", patch.transferName ?? "");
  if (patch.transferWaiting !== undefined) setHandoff("waiting", patch.transferWaiting);

  const set: Partial<typeof accountCommunicationProfile.$inferInsert> = {};
  // Same exclusivity as the wizard: a preset clears the custom name and back.
  if (patch.agentName !== undefined) {
    set.agentName = patch.agentName;
    if (patch.agentName && patch.agentNameCustom === undefined) set.agentNameCustom = null;
  }
  if (patch.agentNameCustom !== undefined) {
    set.agentNameCustom = patch.agentNameCustom;
    if (patch.agentNameCustom && patch.agentName === undefined) set.agentName = null;
  }
  if (setupTouched) {
    setup.voice = voice;
    setup.handoff = handoff;
    set.setup = setup;
  }
  if (Object.keys(set).length === 0) return;

  const now = new Date();
  if (profile) {
    await tx.update(accountCommunicationProfile).set({ ...set, updatedAt: now })
      .where(eq(accountCommunicationProfile.id, profile.id));
  } else {
    await tx.insert(accountCommunicationProfile).values({ ...set, accountsId: accountId, createdAt: now, updatedAt: now });
  }
}

/**
 * Going live is the one switch that lets real callers reach her, so it is
 * checked here and not only in the UI: every readiness item must be green, on
 * the state this same transaction just saved. Going offline is always allowed.
 */
async function applyLive(tx: Tx, accountId: number, live: boolean) {
  const st = await loadState(tx, accountId);
  if (!st?.number) throw new VoiceLineError(409, "Attach a phone number first.");
  if (live) {
    const missing = toVoiceLine(accountId, st).readiness.items.filter((i) => !i.ok).map((i) => i.key);
    if (missing.length) throw new VoiceLineError(409, `Not ready to go live: ${missing.join(", ")} missing.`);
  }
  await tx.update(voiceNumbers).set({ enabled: live, updatedAt: new Date() })
    .where(eq(voiceNumbers.id, st.number.id));
}

async function saveVoiceLine(accountId: number, patch: VoiceLinePatch): Promise<VoiceLine | null> {
  const found = await db.transaction(async (tx) => {
    const [account] = await tx.select().from(accounts).where(eq(accounts.id, accountId));
    if (!account) return false;
    const [profile] = await tx.select().from(accountCommunicationProfile)
      .where(eq(accountCommunicationProfile.accountsId, accountId)).for("update");

    await applyProfile(tx, accountId, profile, patch);
    await applyNumber(tx, accountId, account, patch);

    // Re-read inside the transaction: the persona and mirrors follow the saved state.
    const [fresh] = await tx.select().from(accountCommunicationProfile)
      .where(eq(accountCommunicationProfile.accountsId, accountId));
    const setup = obj(fresh?.setup);
    const locale = text(obj(setup.voice).locale) || null;

    let persona = await getLivePersona(tx, accountId);
    if (patch.createPersona) {
      persona = await upsertLivePersona(tx, account, fresh, localeLanguage(locale));
    }

    // Mirrors onto every row the account owns (its real number and any browser-test row).
    const mirror: Partial<typeof voiceNumbers.$inferInsert> = {
      agentName: effectiveAgentName(fresh),
      voice: text(obj(setup.voice).voice) || null,
      transferNumber: text(obj(setup.handoff).number) || null,
      updatedAt: new Date(),
    };
    if (locale) mirror.locale = locale; // NOT NULL column: only ever overwritten with a value
    if (persona) {
      mirror.personaId = persona.id;
      mirror.clientNiche = persona.niche;
    }
    await tx.update(voiceNumbers).set(mirror).where(eq(voiceNumbers.accountsId, accountId));
    if (patch.live !== undefined) await applyLive(tx, accountId, patch.live);
    return true;
  });
  return found ? getVoiceLine(accountId) : null;
}

export const voiceLinesStorage = {
  getVoiceLine,
  saveVoiceLine,
  listUnassignedNumbers,
};
