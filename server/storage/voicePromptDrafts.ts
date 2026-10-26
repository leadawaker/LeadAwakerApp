/**
 * The shared ElevenLabs prompt's draft and the change cards (voice call review and
 * prompt coach). The draft is where accepted cards and hand edits land;
 * `saveElevenDraftsToLive` is the ONLY writer of the live Prompt_Library rows and
 * always snapshots the text it replaces into Prompt_Versions first.
 *
 * Every transaction that reads a draft and writes it back takes one advisory lock,
 * so two quick "Accept" clicks cannot overwrite each other's edit on the draft.
 * The pure decisions (what a card writes, what saving does) are in
 * server/voice/review/draftPlans.ts.
 */
import { and, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { db } from "../db";
import {
  promptLibrary, promptVersions, voicePromptDrafts, voicePromptSuggestions,
  type VoicePromptDraftRow, type VoicePromptSuggestionRow,
} from "@shared/schema";
import type { DraftView, PromptLang, ProposalInput, SuggestionDto, SuggestionStatus } from "@shared/voiceReview";
import { planAccept, planSaveToLive, staleTransitions, STALE_NOTE, type CardEdit, type DraftRowState } from "../voice/review/draftPlans";
import { elevenPromptRow, type VoicePromptRow } from "./voiceAccountPrompts";
import type { DbLike, Tx } from "./voicePersona";

const LANGS: PromptLang[] = ["nl", "en"];
const DRAFT_LOCK_KEY = 4_217_001;
const DAY_MS = 24 * 60 * 60 * 1000;

const iso = (d: Date | string | null | undefined): string | null => (d ? new Date(d).toISOString() : null);

/** Today in Europe/Amsterdam as YYYY-MM-DD (en-CA formats dates that way). */
const amsterdamToday = (): string => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Amsterdam" }).format(new Date());

// ─── Row to DTO ──────────────────────────────────────────────────────────────

function toDraftView(language: PromptLang, live: VoicePromptRow, draft: VoicePromptDraftRow | null | undefined): DraftView {
  return {
    promptId: live.id,
    useCase: live.useCase,
    language,
    liveText: live.promptText,
    liveUpdatedAt: live.updatedAt,
    draftText: draft ? draft.draftText : live.promptText,
    hasDraft: !!draft,
    liveMoved: !!draft && draft.baseText !== live.promptText,
    acceptedIds: draft?.acceptedIds ?? [],
    updatedAt: draft ? iso(draft.updatedAt) : null,
  };
}

function toSuggestionDto(r: VoicePromptSuggestionRow): SuggestionDto {
  return {
    id: r.id,
    accountId: r.accountsId,
    source: r.source as SuggestionDto["source"],
    reviewId: r.reviewId,
    promptId: r.promptsId,
    language: r.language as PromptLang,
    title: r.title,
    reason: r.reason,
    find: r.findText,
    replace: r.replaceText,
    mirrorPromptId: r.mirrorPromptsId,
    mirrorFind: r.mirrorFindText,
    mirrorReplace: r.mirrorReplaceText,
    callIds: r.evidenceCallIds ?? [],
    status: r.status as SuggestionStatus,
    statusNote: r.statusNote,
    createdAt: new Date(r.createdAt).toISOString(),
    decidedAt: iso(r.decidedAt),
  };
}

const cardEditOf = (r: VoicePromptSuggestionRow): CardEdit => ({
  id: r.id,
  promptId: r.promptsId,
  find: r.findText,
  replace: r.replaceText,
  mirrorPromptId: r.mirrorPromptsId,
  mirrorFind: r.mirrorFindText,
  mirrorReplace: r.mirrorReplaceText,
});

// ─── Shared reads ────────────────────────────────────────────────────────────

/** Runs `fn` in a transaction that holds the draft lock until it commits. */
async function inDraftTx<T>(fn: (tx: Tx) => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(${DRAFT_LOCK_KEY})`);
    return fn(tx);
  });
}

interface LiveSnapshot { promptId: number; liveText: string; version: string | null; systemMessage: string | null }

/**
 * Both eleven rows with their drafts, as the pure plans want them. With `lock` the
 * Prompt_Library rows are `FOR UPDATE`, so the live text read here is the text a
 * save then replaces.
 */
async function loadElevenState(exec: DbLike, lock = false): Promise<{ rows: DraftRowState[]; current: LiveSnapshot[] }> {
  const found: { language: PromptLang; id: number }[] = [];
  for (const language of LANGS) {
    const r = await elevenPromptRow(language, exec);
    if (r) found.push({ language, id: r.id });
  }
  if (!found.length) return { rows: [], current: [] };
  const ids = found.map((f) => f.id);
  const liveQuery = exec.select().from(promptLibrary).where(inArray(promptLibrary.id, ids));
  const live = await (lock ? liveQuery.for("update") : liveQuery);
  const drafts = await exec.select().from(voicePromptDrafts).where(inArray(voicePromptDrafts.promptsId, ids));

  const rows: DraftRowState[] = [];
  const current: LiveSnapshot[] = [];
  for (const { language, id } of found) {
    const l = live.find((r) => r.id === id);
    if (!l) continue;
    const d = drafts.find((x) => x.promptsId === id);
    rows.push({
      promptId: id,
      useCase: l.useCase ?? `eleven_layer_${language}`,
      language,
      liveText: l.promptText ?? "",
      draft: d ? { draftText: d.draftText, baseText: d.baseText, acceptedIds: d.acceptedIds ?? [] } : null,
    });
    current.push({ promptId: id, liveText: l.promptText ?? "", version: l.version ?? null, systemMessage: l.systemMessage ?? null });
  }
  return { rows, current };
}

async function readDraftView(exec: DbLike, lang: PromptLang): Promise<DraftView | null> {
  const live = await elevenPromptRow(lang, exec);
  if (!live) return null;
  const [draft] = await exec.select().from(voicePromptDrafts).where(eq(voicePromptDrafts.promptsId, live.id)).limit(1);
  return toDraftView(lang, live, draft);
}

// ─── Drafts ──────────────────────────────────────────────────────────────────

async function getElevenDraftView(lang: PromptLang): Promise<DraftView | null> {
  return readDraftView(db, lang);
}

/** Save the draft text (hand edit). A new draft starts from the live text it will replace. */
async function saveElevenDraftText(lang: PromptLang, text: string, by: string | null): Promise<DraftView | null> {
  return inDraftTx(async (tx) => {
    const live = await elevenPromptRow(lang, tx);
    if (!live) return null;
    const [draft] = await tx.insert(voicePromptDrafts)
      .values({ promptsId: live.id, useCase: live.useCase, draftText: text, baseText: live.promptText, acceptedIds: [], updatedBy: by })
      .onConflictDoUpdate({ target: voicePromptDrafts.promptsId, set: { draftText: text, updatedBy: by, updatedAt: new Date() } })
      .returning();
    return toDraftView(lang, live, draft);
  });
}

/**
 * Drop both drafts together: they are one unit, because an accepted card can carry
 * an edit on each language (mirror). Every card either draft had accepted that is
 * still `accepted` becomes a proposal again.
 */
async function discardElevenDrafts(): Promise<{ nl: DraftView | null; en: DraftView | null }> {
  return inDraftTx(async (tx) => {
    const views: Record<PromptLang, DraftView | null> = { nl: null, en: null };
    const acceptedIds = new Set<number>();
    for (const lang of LANGS) {
      const live = await elevenPromptRow(lang, tx);
      if (!live) continue;
      const [draft] = await tx.delete(voicePromptDrafts).where(eq(voicePromptDrafts.promptsId, live.id)).returning();
      for (const id of draft?.acceptedIds ?? []) acceptedIds.add(id);
      views[lang] = toDraftView(lang, live, null);
    }
    if (acceptedIds.size) {
      await tx.update(voicePromptSuggestions)
        .set({ status: "proposed", statusNote: null, decidedBy: null, decidedAt: null, updatedAt: new Date() })
        .where(and(inArray(voicePromptSuggestions.id, [...acceptedIds]), eq(voicePromptSuggestions.status, "accepted")));
    }
    return views;
  });
}

/**
 * Save to live: the one path that writes Prompt_Library. For each eleven row with a
 * draft that differs from the live text, the live text goes to Prompt_Versions, then
 * the draft text replaces it. Drafts are dropped and their accepted cards marked live
 * (`liveCardIds` are the cards promoted). The live text is read here, in the same
 * transaction as the writes.
 */
async function saveElevenDraftsToLive(by: string | null): Promise<{ saved: { promptId: number; language: PromptLang }[]; liveCardIds: number[] }> {
  return inDraftTx(async (tx) => {
    const { rows, current } = await loadElevenState(tx, true);
    const plan = planSaveToLive(rows, current, amsterdamToday());
    const now = new Date();
    for (const v of plan.versions) {
      await tx.insert(promptVersions).values({
        promptsId: v.promptId,
        versionNumber: v.versionNumber,
        promptText: v.promptText,
        systemMessage: v.systemMessage,
        label: v.label,
        savedAt: now,
        savedBy: by,
      });
    }
    for (const u of plan.updates) {
      await tx.update(promptLibrary).set({ promptText: u.promptText, updatedAt: now }).where(eq(promptLibrary.id, u.promptId));
    }
    let liveCardIds: number[] = [];
    if (plan.liveCardIds.length) {
      // Only accepted cards are promoted: a card decided otherwise since (rejected) keeps its status.
      const promoted = await tx.update(voicePromptSuggestions).set({ status: "live", statusNote: null, updatedAt: now })
        .where(and(inArray(voicePromptSuggestions.id, plan.liveCardIds), eq(voicePromptSuggestions.status, "accepted")))
        .returning({ id: voicePromptSuggestions.id });
      liveCardIds = plan.liveCardIds.filter((id) => promoted.some((p) => p.id === id));
    }
    if (plan.deleteDraftPromptIds.length) {
      await tx.delete(voicePromptDrafts).where(inArray(voicePromptDrafts.promptsId, plan.deleteDraftPromptIds));
    }
    const saved = plan.updates.flatMap((u) => {
      const row = rows.find((r) => r.promptId === u.promptId);
      return row ? [{ promptId: u.promptId, language: row.language }] : [];
    });
    return { saved, liveCardIds };
  });
}

// ─── Change cards ────────────────────────────────────────────────────────────

export interface NewSuggestion {
  accountId: number;
  source: "review" | "chat";
  reviewId: number | null;
  coachMessageId: number | null;
  promptId: number;
  mirrorPromptId: number | null;
  proposal: ProposalInput;
}

export type SuggestionDecision =
  | { status: 200; card: SuggestionDto }
  | { status: 404 | 409; reason: "not_found" | "not_proposed" | "stale" };

async function insertVoiceSuggestions(rows: NewSuggestion[]): Promise<number[]> {
  if (!rows.length) return [];
  const inserted = await db.insert(voicePromptSuggestions).values(rows.map((r) => ({
    accountsId: r.accountId,
    source: r.source,
    reviewId: r.reviewId,
    coachMessageId: r.coachMessageId,
    promptsId: r.promptId,
    language: r.proposal.language,
    title: r.proposal.title,
    reason: r.proposal.reason,
    findText: r.proposal.find,
    replaceText: r.proposal.replace,
    mirrorPromptsId: r.mirrorPromptId,
    mirrorFindText: r.proposal.mirrorFind,
    mirrorReplaceText: r.proposal.mirrorReplace,
    evidenceCallIds: r.proposal.callIds,
  }))).returning({ id: voicePromptSuggestions.id });
  return inserted.map((r) => r.id);
}

/**
 * Newest first. Open cards are re-judged against the current draft first: a proposed card whose edit no
 * longer applies goes stale, and a card that went stale only because its text was gone goes back to
 * proposed once the text is back (a draft discarded or restored).
 */
async function listVoiceSuggestions(accountId: number, limit = 100): Promise<SuggestionDto[]> {
  const open = await db.select().from(voicePromptSuggestions)
    .where(and(eq(voicePromptSuggestions.accountsId, accountId), inArray(voicePromptSuggestions.status, ["proposed", "stale"])));
  if (open.length) {
    const { rows } = await loadElevenState(db);
    const { toStale, toProposed } = staleTransitions(open.map((c) => ({ ...cardEditOf(c), status: c.status, statusNote: c.statusNote })), rows);
    const now = new Date();
    if (toStale.length) {
      await db.update(voicePromptSuggestions).set({ status: "stale", statusNote: STALE_NOTE, updatedAt: now })
        .where(and(inArray(voicePromptSuggestions.id, toStale), eq(voicePromptSuggestions.status, "proposed")));
    }
    if (toProposed.length) {
      await db.update(voicePromptSuggestions).set({ status: "proposed", statusNote: null, updatedAt: now })
        .where(and(inArray(voicePromptSuggestions.id, toProposed), eq(voicePromptSuggestions.status, "stale"), eq(voicePromptSuggestions.statusNote, STALE_NOTE)));
    }
  }
  const list = await db.select().from(voicePromptSuggestions)
    .where(eq(voicePromptSuggestions.accountsId, accountId))
    .orderBy(desc(voicePromptSuggestions.createdAt), desc(voicePromptSuggestions.id))
    .limit(limit);
  return list.map(toSuggestionDto);
}

/** Accept a proposed card: its edit goes onto the draft (a draft is created from live if there is none). */
async function acceptVoiceSuggestion(accountId: number, id: number, by: string | null): Promise<SuggestionDecision> {
  return inDraftTx<SuggestionDecision>(async (tx) => {
    const [card] = await tx.select().from(voicePromptSuggestions)
      .where(and(eq(voicePromptSuggestions.id, id), eq(voicePromptSuggestions.accountsId, accountId)))
      .for("update");
    if (!card) return { status: 404, reason: "not_found" };
    if (card.status !== "proposed") return { status: 409, reason: "not_proposed" };

    const { rows } = await loadElevenState(tx);
    const plan = planAccept(cardEditOf(card), rows);
    const now = new Date();
    if (!plan.ok) {
      await tx.update(voicePromptSuggestions).set({ status: "stale", statusNote: STALE_NOTE, updatedAt: now })
        .where(eq(voicePromptSuggestions.id, id));
      return { status: 409, reason: "stale" };
    }
    for (const w of plan.writes) {
      await tx.insert(voicePromptDrafts)
        .values({ promptsId: w.promptId, useCase: w.useCase, draftText: w.draftText, baseText: w.baseText, acceptedIds: w.acceptedIds, updatedBy: by })
        .onConflictDoUpdate({
          target: voicePromptDrafts.promptsId,
          set: { draftText: w.draftText, acceptedIds: w.acceptedIds, updatedBy: by, updatedAt: now },
        });
    }
    const [updated] = await tx.update(voicePromptSuggestions)
      .set({ status: "accepted", decidedBy: by, decidedAt: now, updatedAt: now })
      .where(eq(voicePromptSuggestions.id, id))
      .returning();
    return { status: 200, card: toSuggestionDto(updated) };
  });
}

/** Reject a card that is proposed or stale. */
async function rejectVoiceSuggestion(accountId: number, id: number, by: string | null): Promise<SuggestionDecision> {
  const now = new Date();
  const [updated] = await db.update(voicePromptSuggestions)
    .set({ status: "rejected", decidedBy: by, decidedAt: now, updatedAt: now })
    .where(and(
      eq(voicePromptSuggestions.id, id),
      eq(voicePromptSuggestions.accountsId, accountId),
      inArray(voicePromptSuggestions.status, ["proposed", "stale"]),
    ))
    .returning();
  if (updated) return { status: 200, card: toSuggestionDto(updated) };
  const [exists] = await db.select({ id: voicePromptSuggestions.id }).from(voicePromptSuggestions)
    .where(and(eq(voicePromptSuggestions.id, id), eq(voicePromptSuggestions.accountsId, accountId)));
  return exists ? { status: 409, reason: "not_proposed" } : { status: 404, reason: "not_found" };
}

/**
 * Removes the cards a review made that nobody decided on (proposed or stale). A review that is run again
 * after a failure (a weekly retry) calls this first, so the same edits are never on the list twice.
 */
async function clearReviewSuggestions(reviewId: number): Promise<void> {
  await db.delete(voicePromptSuggestions).where(and(
    eq(voicePromptSuggestions.reviewId, reviewId),
    inArray(voicePromptSuggestions.status, ["proposed", "stale"]),
  ));
}

/** The edits Gabriel rejected recently, newest first, so reviews and the coach do not propose them again. */
async function recentRejectedSuggestions(accountId: number, days = 60): Promise<{ find: string; replace: string }[]> {
  const since = new Date(Date.now() - days * DAY_MS);
  return db.select({ find: voicePromptSuggestions.findText, replace: voicePromptSuggestions.replaceText })
    .from(voicePromptSuggestions)
    .where(and(
      eq(voicePromptSuggestions.accountsId, accountId),
      eq(voicePromptSuggestions.status, "rejected"),
      gte(voicePromptSuggestions.decidedAt, since),
    ))
    .orderBy(desc(voicePromptSuggestions.decidedAt));
}

export const voicePromptDraftsStorage = {
  getElevenDraftView,
  saveElevenDraftText,
  discardElevenDrafts,
  saveElevenDraftsToLive,
  listVoiceSuggestions,
  acceptVoiceSuggestion,
  rejectVoiceSuggestion,
  insertVoiceSuggestions,
  clearReviewSuggestions,
  recentRejectedSuggestions,
};
