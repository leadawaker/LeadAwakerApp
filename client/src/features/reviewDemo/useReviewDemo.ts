import { useCallback, useEffect, useRef, useState } from "react";
import * as api from "./api";
import type { DemoMessage, ManagerEvent, ReviewDemoState } from "./types";

const FAST_POLL_MS = 1500;
const IDLE_POLL_MS = 5000;

/**
 * One demo session: polls the engine's web-demo state (post-then-poll, like
 * the /demo page), sends visitor turns, and derives the manager phone's
 * events. The alert comes from the engine (a rating of 4 or less); the review
 * and draft banners come from the popup, which only exists on this page.
 */
export function useReviewDemo(token: string) {
  const [state, setState] = useState<ReviewDemoState | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState<DemoMessage[]>([]);
  const [localEvents, setLocalEvents] = useState<ManagerEvent[]>([]);
  const [busy, setBusy] = useState(false);
  const waiting = useRef(false);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getState(token);
      setState(s);
      setError("");
      const last = s.messages[s.messages.length - 1];
      // After the customer accepts the callback the lead is handed to a human
      // (manual_takeover), so the AI will not answer again: stop the dots.
      if (last?.role === "ai" || s.reputation?.outcome === "callback_requested") waiting.current = false;
      setPending((p) => p.filter((m) => !s.messages.some((x) => x.role === "visitor" && x.text === m.text)));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [token]);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const loop = async () => {
      await refresh();
      if (alive) timer = setTimeout(loop, waiting.current ? FAST_POLL_MS : IDLE_POLL_MS);
    };
    void loop();
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [token, refresh]);

  const send = useCallback(
    async (text: string) => {
      const t = text.trim();
      if (!t) return;
      setPending((p) => [...p, { id: -Date.now(), role: "visitor", text: t, at: null }]);
      waiting.current = true;
      try {
        await api.sendMessage(token, t);
        await refresh();
      } catch (e) {
        setError((e as Error).message);
        waiting.current = false;
      }
    },
    [token, refresh],
  );

  const postReview = useCallback(
    async (stars: number, text: string) => {
      setLocalEvents((ev) => [
        ...ev,
        { id: `review-${Date.now()}`, kind: "review", stars, text },
      ]);
      const draftId = `draft-${Date.now()}`;
      setLocalEvents((ev) => [...ev, { id: draftId, kind: "draft", draft: null }]);
      try {
        const { draft } = await api.reviewDraft(token, stars, text);
        setLocalEvents((ev) => ev.map((e) => (e.id === draftId ? { ...e, draft } : e)));
      } catch {
        setLocalEvents((ev) => ev.map((e) => (e.id === draftId ? { ...e, draft: "" } : e)));
      }
    },
    [token],
  );

  const replay = useCallback(async () => {
    setBusy(true);
    try {
      await api.restart(token);
      setLocalEvents([]);
      setPending([]);
      waiting.current = false;
      await refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }, [token, refresh]);

  const messages = [...(state?.messages ?? []), ...pending];
  const last = messages[messages.length - 1];
  const typing = waiting.current && last?.role === "visitor";

  const rep = state?.reputation;
  const lastVisitor = [...(state?.messages ?? [])].reverse().find((m) => m.role === "visitor");
  const alert: ManagerEvent[] =
    rep?.managerAlerted && rep.rating
      ? [{ id: "alert", kind: "alert", stars: rep.rating, quote: lastVisitor?.text ?? "" }]
      : [];

  return {
    state: state ? { ...state, messages } : null,
    error,
    typing,
    send,
    events: [...alert, ...localEvents],
    reviewPosted: localEvents.some((e) => e.kind === "review"),
    postReview,
    replay,
    busy,
  };
}
