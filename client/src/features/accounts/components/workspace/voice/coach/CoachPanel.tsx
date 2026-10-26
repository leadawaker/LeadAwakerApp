// The prompt coach (Voice tab, Prompt & test, Owner only): a chat under the ElevenLabs draft,
// folded to its title. The chat mounts when the row is opened, so it scrolls to the newest message.
// Ask about the calls or the prompt; the coach answers and may attach change cards to its
// answer, shown inline. It never edits the prompt: a card changes the draft only when
// Accept is pressed on it (SuggestionItem), and nothing goes live except Save to live.
// Server: server/routes/voiceCoach.ts (one turn takes up to 3 minutes; the question is
// kept even when the answer fails).
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, MessagesSquare, Send } from "lucide-react";
import type { CoachMessageDto, PromptLang, SuggestionDto } from "@shared/voiceReview";
import { helpStyle, inputStyle } from "../voiceAtoms";
import { sendCoachMessage, useCoachMessages, useSuggestions } from "./coachApi";
import { Fold } from "./Fold";
import { SuggestionItem } from "./SuggestionItem";

const MESSAGE_MAX = 4000;
/** The counter only shows when the limit is near: a chat box does not need it before. */
const COUNTER_FROM = 3500;
const THREAD_MAX_HEIGHT = 520;
const BTN_STYLE = { minHeight: 36 } as const;
const BUBBLE_TEXT: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.5, color: "var(--ink)", whiteSpace: "pre-wrap", overflowWrap: "anywhere" };

type SendError = "busy" | "failed" | "generic";

function errorOf(status: number): SendError {
  return status === 429 ? "busy" : status === 502 ? "failed" : "generic";
}

function UserBubble({ text }: { text: string }) {
  return (
    <div
      style={{ ...BUBBLE_TEXT, alignSelf: "flex-end", maxWidth: "88%", padding: "9px 13px", borderRadius: "var(--r-surface)", background: "var(--wine-tint)" }}
      data-testid="voice-coach-message" data-role="user"
    >
      {text}
    </div>
  );
}

function AssistantMessage({ message, cards, accountId }: { message: CoachMessageDto; cards: SuggestionDto[]; accountId: number }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }} data-testid="voice-coach-message" data-role="assistant">
      <div className="neu-inset-crisp" style={{ ...BUBBLE_TEXT, alignSelf: "flex-start", maxWidth: "92%", padding: "9px 13px", borderRadius: "var(--r-surface)" }}>
        {message.content}
      </div>
      {cards.map((card) => <SuggestionItem key={card.id} card={card} accountId={accountId} compact />)}
    </div>
  );
}

function CoachChat({ accountId, lang }: { accountId: number; lang: PromptLang }) {
  const { t } = useTranslation("voiceCoach");
  const coach = useCoachMessages(accountId);
  const suggestions = useSuggestions(accountId);
  const [text, setText] = useState("");
  // The question being answered, shown at once; `base` is how many messages the thread had, so
  // the question is drawn from here only until the stored thread (which then holds it) arrives.
  const [pending, setPending] = useState<{ text: string; base: number } | null>(null);
  const [error, setError] = useState<SendError | null>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // The input was in use when sent: it is disabled while waiting, so give the focus back after.
  const refocus = useRef(false);

  const messages = coach.data ?? [];
  const cardsById = useMemo(() => new Map((suggestions.data ?? []).map((c) => [c.id, c])), [suggestions.data]);
  const waiting = pending !== null;
  const cardsLoaded = suggestions.data !== undefined;

  // The newest message stays in view: the box scrolls, never the page.
  useLayoutEffect(() => {
    const box = boxRef.current;
    if (box) box.scrollTop = box.scrollHeight;
  }, [messages.length, waiting, cardsLoaded]);

  useEffect(() => {
    if (!waiting && refocus.current) {
      refocus.current = false;
      inputRef.current?.focus({ preventScroll: true });
    }
  }, [waiting]);

  const send = async () => {
    const message = text.trim();
    if (!message || waiting) return;
    refocus.current = document.activeElement === inputRef.current;
    setPending({ text: message, base: messages.length });
    setText("");
    setError(null);
    try {
      const result = await sendCoachMessage(accountId, lang, message);
      // The stored thread (question and answer) replaces the pending question in one step.
      await coach.refetch();
      if (!result.ok) {
        setError(errorOf(result.status));
        // A turn already running never stored this question: put it back to send again.
        if (result.status === 429) setText((cur) => cur || message);
      }
    } finally {
      setPending(null);
    }
  };

  const showThread = messages.length > 0 || waiting;

  return (
    <>
      <p style={helpStyle}>{t("coach.help")}</p>

      {coach.isLoading && (
        <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      {coach.isError && !coach.data && <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("coach.loadFailed")}</p>}
      {coach.data && !showThread && <p style={helpStyle} data-testid="voice-coach-empty">{t("coach.empty")}</p>}

      {showThread && (
        <div
          ref={boxRef} role="log" aria-live="polite" aria-label={t("coach.threadLabel")} tabIndex={0} data-testid="voice-coach-thread"
          style={{ maxHeight: THREAD_MAX_HEIGHT, overflowY: "auto", display: "flex", flexDirection: "column", gap: 12, padding: 4, marginBottom: 12, minWidth: 0 }}
        >
          {messages.map((m) => m.role === "user"
            ? <UserBubble key={m.id} text={m.content} />
            : (
              <AssistantMessage
                key={m.id} message={m} accountId={accountId}
                cards={m.suggestionIds.flatMap((id) => cardsById.get(id) ?? [])}
              />
            ))}
          {pending !== null && messages.length <= pending.base && <UserBubble text={pending.text} />}
          {waiting && (
            <div
              className="neu-inset-crisp" role="status" data-testid="voice-coach-thinking"
              style={{ alignSelf: "flex-start", display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "9px 13px", borderRadius: "var(--r-surface)", fontSize: 13, color: "var(--mute)" }}
            >
              <Loader2 size={14} className="animate-spin" />
              <span style={{ color: "var(--ink-soft)", fontWeight: 600 }}>{t("coach.thinking")}</span>
              <span>{t("coach.thinkingHint")}</span>
            </div>
          )}
        </div>
      )}

      {error && <p role="alert" style={{ ...helpStyle, margin: "0 0 10px", color: "var(--stage-lost)" }} data-testid="voice-coach-error">{t(`coach.error.${error}`)}</p>}

      <textarea
        ref={inputRef} value={text} rows={3} maxLength={MESSAGE_MAX} disabled={waiting}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          // Enter sends; Shift+Enter is a new line. Enter that confirms an IME word is not a send.
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            void send();
          }
        }}
        className="neu-inset-crisp" style={{ ...inputStyle, padding: "11px 13px", resize: "vertical", lineHeight: 1.5 }}
        aria-label={t("coach.inputLabel")} placeholder={t("coach.placeholder")} data-testid="voice-coach-input"
      />
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginTop: 8 }}>
        <span style={{ fontSize: 12, color: "var(--mute)", lineHeight: 1.4 }}>
          {t("coach.hint")}
          {text.length >= COUNTER_FROM && (
            <span style={{ marginLeft: 8, fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", color: text.length >= MESSAGE_MAX ? "var(--stage-lost)" : "var(--mute)" }}>
              {text.length} / {MESSAGE_MAX}
            </span>
          )}
        </span>
        <button
          type="button" className="la-btn la-btn--wine" style={BTN_STYLE} disabled={waiting || !text.trim()}
          onClick={() => void send()} data-testid="voice-coach-send"
        >
          {waiting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {t("coach.send")}
        </button>
      </div>
    </>
  );
}

export function CoachPanel({ accountId, lang }: { accountId: number; lang: PromptLang }) {
  const { t } = useTranslation("voiceCoach");
  return (
    <Fold title={t("coach.title")} icon={<MessagesSquare size={15} />} rememberAs={`coach-${accountId}`} testId="voice-coach">
      <CoachChat accountId={accountId} lang={lang} />
    </Fold>
  );
}
