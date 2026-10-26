// Client side of the voice call review and prompt coach (Owner only): the ElevenLabs
// prompt draft, the change cards, the call reviews and the coach chat.
// Server: server/routes/voicePromptDrafts.ts, voiceReviews.ts, voiceCoach.ts.
// Every mutation updates or invalidates the query keys it changes.
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { queryClient as qc } from "@/lib/queryClient";
import type { CallLabelDto, CoachMessageDto, DraftView, PromptLang, ReviewDto, SuggestionDto } from "@shared/voiceReview";

const base = (accountId: number) => ["/api/accounts", accountId, "voice"] as const;

export const draftKey = (accountId: number, lang: PromptLang) => [...base(accountId), "eleven-draft", lang] as const;
export const suggestionsKey = (accountId: number) => [...base(accountId), "suggestions"] as const;
export const reviewsKey = (accountId: number) => [...base(accountId), "reviews"] as const;
export const coachKey = (accountId: number) => [...base(accountId), "coach"] as const;
export const callLabelsKey = (accountId: number) => [...base(accountId), "call-labels"] as const;

const LANGS: PromptLang[] = ["nl", "en"];
/** The app default never refetches a list on its own: the cards and reviews can change without this page. */
const LIST_STALE_MS = 30_000;
const draftUrl = (accountId: number) => `/api/accounts/${accountId}/voice/eleven-draft`;
const JSON_HEADERS = { "Content-Type": "application/json" };

/** The prompt language a line's locale uses: Dutch for nl-*, English for everything else. */
export function promptLangOf(locale: string | null): PromptLang {
  return locale?.toLowerCase().startsWith("nl") ? "nl" : "en";
}

async function getJson<T>(url: string): Promise<T> {
  const res = await apiFetch(url);
  if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
  return res.json();
}

/**
 * The drafts are per prompt row, shared by every account in that language, while the cache is
 * keyed per account: a change marks every account's cached draft stale (`exceptAccount` keeps
 * the one just set from the server's answer).
 */
const invalidateDrafts = (exceptAccount?: number) =>
  qc.invalidateQueries({
    queryKey: ["/api/accounts"],
    predicate: (q) => q.queryKey[2] === "voice" && q.queryKey[3] === "eleven-draft" && q.queryKey[1] !== exceptAccount,
  });

// ─── Draft ───────────────────────────────────────────────────────────────────

/** The draft of one language's shared ElevenLabs prompt; null when there is no prompt row for it. */
export function useElevenDraft(accountId: number, lang: PromptLang) {
  return useQuery({
    queryKey: draftKey(accountId, lang),
    queryFn: async (): Promise<DraftView | null> => {
      const res = await apiFetch(`${draftUrl(accountId)}?lang=${lang}`);
      if (res.status === 404) return null;
      if (!res.ok) throw new Error("Failed to load the draft");
      return res.json();
    },
    enabled: accountId > 0,
    // Autosave owns the text once loaded: a background refetch must not replace what is being typed.
    staleTime: Infinity,
    refetchOnWindowFocus: false,
  });
}

/** The draft view in the cache right now (what the server last answered), or null. */
export const cachedDraft = (accountId: number, lang: PromptLang): DraftView | null =>
  qc.getQueryData<DraftView | null>(draftKey(accountId, lang)) ?? null;

/** Saves the draft text (autosave). The answer replaces the cached view; null on failure. */
export async function saveElevenDraft(accountId: number, lang: PromptLang, text: string): Promise<DraftView | null> {
  const res = await apiFetch(draftUrl(accountId), {
    method: "PUT", headers: JSON_HEADERS, body: JSON.stringify({ lang, text }),
  }).catch(() => null);
  if (!res?.ok) return null;
  const view: DraftView = await res.json();
  qc.setQueryData(draftKey(accountId, lang), view);
  void invalidateDrafts(accountId);
  return view;
}

export function useDraftActions(accountId: number) {
  return {
    /** Drops the draft in BOTH languages; their accepted cards go back to proposed. */
    discard: async (): Promise<boolean> => {
      const res = await apiFetch(draftUrl(accountId), { method: "DELETE" }).catch(() => null);
      if (!res?.ok) return false;
      const views: Record<PromptLang, DraftView | null> = await res.json();
      for (const lang of LANGS) qc.setQueryData(draftKey(accountId, lang), views[lang] ?? null);
      void invalidateDrafts(accountId);
      void qc.invalidateQueries({ queryKey: suggestionsKey(accountId) });
      return true;
    },
    /** Puts both languages' drafts live (the only path that changes what calls say). */
    saveToLive: async (): Promise<{ ok: boolean; saved: number }> => {
      const res = await apiFetch(`${draftUrl(accountId)}/save`, { method: "POST" }).catch(() => null);
      if (!res?.ok) return { ok: false, saved: 0 };
      const body: { saved: unknown[]; liveCardIds: number[] } = await res.json();
      await invalidateDrafts();
      void qc.invalidateQueries({ queryKey: suggestionsKey(accountId) });
      // Every account in that language reads the same rows: their cached prompt texts are stale now.
      void qc.invalidateQueries({ queryKey: ["/api/accounts"], predicate: (q) => q.queryKey[2] === "voice" && q.queryKey[3] === "prompts" });
      return { ok: true, saved: body.saved?.length ?? 0 };
    },
  };
}

// ─── Change cards ────────────────────────────────────────────────────────────

export function useSuggestions(accountId: number) {
  return useQuery({
    queryKey: suggestionsKey(accountId),
    queryFn: () => getJson<SuggestionDto[]>(`/api/accounts/${accountId}/voice/suggestions`),
    enabled: accountId > 0,
    // The weekly run adds cards while the page sits open: reopening the section looks again.
    staleTime: LIST_STALE_MS,
  });
}

type Decision = { ok: true } | { ok: false; reason: string };

export function useSuggestionActions(accountId: number) {
  const decide = async (id: number, action: "accept" | "reject"): Promise<Decision> => {
    const res = await apiFetch(`/api/accounts/${accountId}/voice/suggestions/${id}/${action}`, { method: "POST" }).catch(() => null);
    void qc.invalidateQueries({ queryKey: suggestionsKey(accountId) });
    if (!res) return { ok: false, reason: "network" };
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return { ok: false, reason: typeof body.reason === "string" ? body.reason : "failed" };
    }
    // An accepted card edits the draft (both languages for a mirror card).
    if (action === "accept") await invalidateDrafts();
    return { ok: true };
  };
  return {
    accept: (id: number) => decide(id, "accept"),
    reject: (id: number) => decide(id, "reject"),
  };
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

export function useReviews(accountId: number) {
  return useQuery({
    queryKey: reviewsKey(accountId),
    queryFn: () => getJson<ReviewDto[]>(`/api/accounts/${accountId}/voice/reviews`),
    enabled: accountId > 0,
    staleTime: LIST_STALE_MS,
    // A review takes minutes: poll while one is running.
    refetchInterval: (q) => ((q.state.data as ReviewDto[] | undefined)?.some((r) => r.status === "running") ? 5_000 : false),
  });
}

/** Starts a review of the picked days (YYYY-MM-DD, both included), browser tests counted on `withTests`; `busy` when one is already running. */
export async function runReviewNow(
  accountId: number, range: { from: string; to: string; withTests: boolean },
): Promise<{ ok: true } | { ok: false; busy: boolean; badRange: boolean }> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/reviews/run`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify(range),
  }).catch(() => null);
  void qc.invalidateQueries({ queryKey: reviewsKey(accountId) });
  if (res?.ok) return { ok: true };
  return { ok: false, busy: res?.status === 409, badRange: res?.status === 400 };
}

/** Who each recent call was with, by call id: the call chips name the caller instead of the id. */
export function useCallLabels(accountId: number) {
  return useQuery({
    queryKey: callLabelsKey(accountId),
    queryFn: async () => new Map<string, CallLabelDto>((await getJson<CallLabelDto[]>(`/api/accounts/${accountId}/voice/call-labels`)).map((c) => [c.callId, c])),
    enabled: accountId > 0,
    staleTime: LIST_STALE_MS,
  });
}

// ─── Coach ───────────────────────────────────────────────────────────────────

export function useCoachMessages(accountId: number) {
  return useQuery({
    queryKey: coachKey(accountId),
    queryFn: async () => (await getJson<{ messages: CoachMessageDto[] }>(`/api/accounts/${accountId}/voice/coach`)).messages,
    enabled: accountId > 0,
  });
}

/** One coach turn (up to 3 minutes). `status` 0 is a network failure, 429 a turn already running. */
export async function sendCoachMessage(accountId: number, lang: PromptLang, message: string): Promise<{ ok: true } | { ok: false; status: number }> {
  const res = await apiFetch(`/api/accounts/${accountId}/voice/coach`, {
    method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ lang, message }),
  }).catch(() => null);
  void qc.invalidateQueries({ queryKey: coachKey(accountId) });
  void qc.invalidateQueries({ queryKey: suggestionsKey(accountId) });
  if (res?.ok) return { ok: true };
  return { ok: false, status: res?.status ?? 0 };
}
