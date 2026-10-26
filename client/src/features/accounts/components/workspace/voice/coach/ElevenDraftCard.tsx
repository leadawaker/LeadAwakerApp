// The shared ElevenLabs prompt, edited as a draft (Voice tab, "Prompt & test", Owner only).
// Typing autosaves to the draft, never to live: calls only hear a change after Save to live,
// which puts the drafts of both languages live at once. Changes shows the draft against live,
// Filled in shows it the way this line's calls get it, History restores an old version into
// the draft. Accepted change cards (Task 10) edit the same draft on the server.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Info, Loader2, RotateCcw, ScrollText, Trash2, Upload } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import type { DraftView, PromptLang } from "@shared/voiceReview";
import { useVoiceT } from "../voiceGender";
import { VoiceCardShell, helpStyle } from "../voiceAtoms";
import { PromptCodeEditor } from "@/features/prompts/components/PromptCodeEditor";
import { useAutosave } from "../useAutosave";
import { flushAllAutosaves } from "../autosaveRegistry";
import { AutosaveBadge, EDITOR_HEIGHT, FilledIn } from "../SharedPromptCard";
import { PromptCounts } from "../PromptCounts";
import { resolvedSegments, type Segment } from "../resolvedSegments";
import { cachedDraft, saveElevenDraft, useDraftActions, useElevenDraft } from "./coachApi";
import { diffCounts, lineDiff } from "./lineDiff";
import { DraftDiff } from "./DraftDiff";
import { DraftVersions } from "./DraftVersions";

const LANGS: PromptLang[] = ["nl", "en"];
const VIEWS = ["edit", "changes", "filled"] as const;
type View = (typeof VIEWS)[number];
const BTN_STYLE = { minHeight: 36 } as const;
const NOTE_STYLE: React.CSSProperties = {
  display: "flex", alignItems: "flex-start", gap: 8, padding: "9px 12px", borderRadius: "var(--r-button)",
  marginBottom: 12, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45,
};

interface Props { accountId: number; lineId?: number; defaultLang: PromptLang }

export function ElevenDraftCard({ accountId, lineId, defaultLang }: Props) {
  const { t } = useVoiceT();
  const { t: tc } = useTranslation("voiceCoach");
  const [lang, setLang] = useState<PromptLang>(defaultLang);
  // Both languages: Save to live and Discard act on the two drafts together.
  const nl = useElevenDraft(accountId, "nl");
  const en = useElevenDraft(accountId, "en");
  const draft = lang === "nl" ? nl : en;
  const other = lang === "nl" ? en : nl;

  const langSwitch = (
    <div className="la-seg la-seg--touch" role="radiogroup" aria-label={tc("draft.language")}>
      {LANGS.map((l) => (
        <button
          key={l} type="button" role="radio" aria-checked={lang === l}
          className={`la-seg-btn${lang === l ? " on" : ""}`} onClick={() => setLang(l)} data-testid={`voice-draft-lang-${l}`}
        >
          {tc(`draft.lang.${l}`)}
        </button>
      ))}
    </div>
  );

  if (!draft.data) {
    return (
      <VoiceCardShell card="promptEleven" icon={<ScrollText size={17} />} title={t("prompt.eleven.title")}>
        <div style={{ marginBottom: 12 }}>{langSwitch}</div>
        {draft.isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <p role={draft.isError ? "alert" : undefined} style={{ ...helpStyle, color: draft.isError ? "var(--stage-lost)" : "var(--mute)" }}>
            {tc(draft.isError ? "common.loadFailed" : "draft.missing")}
          </p>
        )}
      </VoiceCardShell>
    );
  }
  // Keyed by row and language: switching language opens the other draft fresh.
  return (
    <DraftEditor
      key={`${draft.data.promptId}-${lang}`} accountId={accountId} lineId={lineId} lang={lang}
      view={draft.data} other={other.data ?? null} langSwitch={langSwitch}
    />
  );
}

function DraftEditor({ accountId, lineId, lang, view, other, langSwitch }: {
  accountId: number; lineId?: number; lang: PromptLang; view: DraftView;
  /** The other language's draft (not on screen), or null when it has no prompt row or is loading. */
  other: DraftView | null;
  langSwitch: React.ReactNode;
}) {
  const { t } = useVoiceT();
  const { t: tc } = useTranslation("voiceCoach");
  const actions = useDraftActions(accountId);
  const [text, setText] = useState(view.draftText);
  // Bumped when the text is replaced from outside so the uncontrolled editor reopens on it.
  const [rev, setRev] = useState(0);
  const [mode, setMode] = useState<View>("edit");
  const [filled, setFilled] = useState<Segment[] | null>(null);
  const [resolving, setResolving] = useState(false);
  const [resolveError, setResolveError] = useState(false);
  // Which confirm is open, and where: Start over (live moved) asks next to its own button.
  const [confirm, setConfirm] = useState<{ kind: "save" | "discard"; at: "top" | "actions" } | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ text: string; bad: boolean; at: "top" | "actions" } | null>(null);
  // The last text the autosave sent: its own answer is never "a change from outside".
  const sentRef = useRef<string | null>(null);
  const state = useAutosave(text, view.draftText, (next) => {
    sentRef.current = next;
    return saveElevenDraft(accountId, lang, next).then(Boolean);
  });

  // The server draft moves without this editor (a card accepted, a discard, Save to live):
  // follow it unless something was typed here since the last server text. An answer to our
  // own save is skipped: an edit made while that save was in flight (a deletion) must stay.
  const textRef = useRef(text);
  textRef.current = text;
  const seen = useRef(view.draftText);
  useEffect(() => {
    const next = view.draftText;
    if (next !== seen.current && next !== sentRef.current && textRef.current === seen.current) {
      setText(next);
      setRev((r) => r + 1);
    }
    seen.current = next;
  }, [view.draftText]);

  const counts = useMemo(() => diffCounts(lineDiff(view.liveText, text)), [view.liveText, text]);
  const differs = text !== view.liveText;
  const otherLang: PromptLang = lang === "nl" ? "en" : "nl";
  const otherDiffers = !!other && other.draftText !== other.liveText;
  // Unsaved screen text is fine: syncDraft puts it in the draft before saving.
  const canSave = differs || otherDiffers;
  const canDiscard = view.hasDraft || !!other?.hasDraft;
  const langName = (l: PromptLang) => tc(`draft.lang.${l}`);
  const movedLangs = [view.liveMoved && lang, other?.liveMoved && otherLang].filter((l): l is PromptLang => !!l);

  const replaceText = (next: string) => { setText(next); setRev((r) => r + 1); setMode("edit"); };

  // Rendered from the text on screen, saved or not, with this line's own values.
  const showFilled = async () => {
    setMode("filled");
    setFilled(null);
    setResolving(true);
    setResolveError(false);
    try {
      const res = await apiFetch("/api/voice-prompts/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "eleven", accountId, lineId, text }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok || typeof body.text !== "string") throw new Error();
      setFilled(resolvedSegments(text, body.text));
    } catch {
      setResolveError(true);
    } finally {
      setResolving(false);
    }
  };

  // The draft on the server must hold the text on screen before it goes live.
  const syncDraft = async (): Promise<boolean> => {
    await flushAllAutosaves();
    if (cachedDraft(accountId, lang)?.draftText === textRef.current) return true;
    return !!(await saveElevenDraft(accountId, lang, textRef.current));
  };

  const run = async (kind: "save" | "discard", at: "top" | "actions") => {
    setBusy(true);
    setMessage(null);
    try {
      setMessage({ ...(await perform(kind)), at });
    } finally {
      setConfirm(null);
      setBusy(false);
    }
  };

  const perform = async (kind: "save" | "discard"): Promise<{ text: string; bad: boolean }> => {
    let result: { text: string; bad: boolean };
    if (kind === "discard") {
      // No save still in flight may land after the delete and bring the draft back.
      await flushAllAutosaves();
      const ok = await actions.discard();
      const fresh = ok ? cachedDraft(accountId, lang) : null;
      // Unsaved typing is dropped too: the editor shows live again.
      if (fresh) { setText(fresh.draftText); setRev((r) => r + 1); }
      result = { text: tc(ok ? "draft.discarded" : "draft.discardFailed"), bad: !ok };
    } else if (!(await syncDraft())) {
      result = { text: tc("draft.syncFailed"), bad: true };
    } else {
      const r = await actions.saveToLive();
      result = !r.ok ? { text: tc("draft.saveFailed"), bad: true } : { text: tc(r.saved ? "draft.saved" : "draft.savedNone"), bad: false };
    }
    return result;
  };

  const liveMovedNote = (where: "top" | "actions") => movedLangs.length > 0 && (
    <div className="neu-inset-crisp" role={where === "top" ? "alert" : undefined} style={NOTE_STYLE} data-testid={`voice-draft-live-moved-${where}`}>
      <AlertTriangle size={14} style={{ color: "var(--stage-lost)", flexShrink: 0, marginTop: 2 }} />
      <span>{movedLangs.length > 1 ? tc("draft.liveMovedBoth") : tc("draft.liveMoved", { lang: langName(movedLangs[0]) })}</span>
    </div>
  );

  const confirmRow = (kind: "save" | "discard", at: "top" | "actions") => (
    <div role="group" style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
      <span style={{ flex: "1 1 220px", fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }}>
        {tc(kind === "save" ? "draft.saveConfirm" : "draft.discardConfirm")}
      </span>
      <button
        type="button" className={kind === "save" ? "la-btn la-btn--wine" : "la-btn la-btn--soft"} style={BTN_STYLE}
        disabled={busy} onClick={() => void run(kind, at)} data-testid={`voice-draft-confirm-${kind}`}
      >
        {busy && <Loader2 size={13} className="animate-spin" />}
        {tc(kind === "save" ? "draft.saveDo" : "draft.discardDo")}
      </button>
      <button type="button" className="la-btn la-btn--soft" style={BTN_STYLE} disabled={busy} onClick={() => setConfirm(null)}>{tc("common.cancel")}</button>
    </div>
  );
  const ask = (kind: "save" | "discard", at: "top" | "actions") => { setMessage(null); setConfirm({ kind, at }); };

  return (
    <VoiceCardShell card="promptEleven" icon={<ScrollText size={17} />} title={t("prompt.eleven.title")} action={<AutosaveBadge state={state} />}>
      <p style={helpStyle}>{`${t("prompt.eleven.help")} ${t("prompt.eleven.syntax")}`}</p>
      <div className="neu-inset-crisp" style={NOTE_STYLE} data-testid="voice-draft-notice">
        <Info size={14} style={{ color: "var(--mute)", flexShrink: 0, marginTop: 2 }} />
        <span>{tc("draft.notice")}</span>
      </div>
      {movedLangs.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          {liveMovedNote("top")}
          {confirm?.at === "top" ? confirmRow(confirm.kind, "top") : (
            <button type="button" className="la-btn la-btn--soft" style={BTN_STYLE} disabled={busy} onClick={() => ask("discard", "top")} data-testid="voice-draft-start-over">
              <RotateCcw size={13} />{tc("draft.startOver")}
            </button>
          )}
        </div>
      )}
      {/* Outside the block above: a successful Start over clears liveMoved and hides it. */}
      {message?.at === "top" && <p role="status" style={{ ...helpStyle, color: message.bad ? "var(--stage-lost)" : "var(--mute)" }}>{message.text}</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", marginBottom: 10 }}>
        {langSwitch}
        <div className="la-seg la-seg--touch" role="tablist" aria-label={tc("draft.viewLabel")}>
          {VIEWS.map((v) => (
            <button
              key={v} type="button" role="tab" aria-selected={mode === v} className={`la-seg-btn${mode === v ? " on" : ""}`}
              onClick={() => (v === "filled" ? void showFilled() : setMode(v))} data-testid={`voice-draft-view-${v}`}
            >
              {v === "filled" && resolving && <Loader2 size={11} className="animate-spin" />}
              {tc(`draft.view.${v}`)}
            </button>
          ))}
        </div>
        <span data-testid="voice-draft-status" style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", color: differs ? "var(--wine)" : "var(--mute)" }}>
          {differs ? tc("draft.status.changed", { added: counts.added, removed: counts.removed }) : tc("draft.status.same")}
        </span>
      </div>

      <DraftVersions promptId={view.promptId} onRestore={replaceText} />

      {mode === "edit" && (
        <div className="neu-inset-crisp" style={{ height: EDITOR_HEIGHT, borderRadius: "var(--r-card)", overflow: "hidden" }}>
          <PromptCodeEditor key={`${view.promptId}-${lang}-${rev}`} initialValue={text} fontSize={13} onChange={setText} />
        </div>
      )}
      {mode === "changes" && <DraftDiff before={view.liveText} after={text} />}
      {mode === "filled" && (
        resolveError ? <p role="alert" style={{ ...helpStyle, color: "var(--stage-lost)" }}>{t("prompt.resolve.failed")}</p>
          : filled ? <FilledIn segments={filled} />
            : <div style={{ display: "flex", justifyContent: "center", padding: 24, color: "var(--mute)" }}><Loader2 className="h-5 w-5 animate-spin" /></div>
      )}
      <PromptCounts text={text} resolve={{ kind: "eleven", accountId, lineId }} approx />

      <div style={{ marginTop: 14 }} data-testid="voice-draft-actions">
        {/* Save overwrites a live text that changed since the draft started: say so right here too. */}
        {liveMovedNote("actions")}
        {otherDiffers && (
          <p style={{ ...helpStyle, margin: "0 0 8px" }} data-testid="voice-draft-other-changed">{tc("draft.otherChanged", { lang: langName(otherLang) })}</p>
        )}
        {confirm?.at === "actions" ? confirmRow(confirm.kind, "actions") : (
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <button
              type="button" className="la-btn la-btn--wine" style={BTN_STYLE} disabled={!canSave || busy}
              onClick={() => ask("save", "actions")} data-testid="voice-draft-save-live"
            >
              <Upload size={13} />{tc("draft.saveToLive")}
            </button>
            <button
              type="button" className="la-btn la-btn--soft" style={BTN_STYLE} disabled={!canDiscard || busy}
              onClick={() => ask("discard", "actions")} data-testid="voice-draft-discard"
            >
              <Trash2 size={13} />{tc("draft.discard")}
            </button>
          </div>
        )}
        {message?.at === "actions" && <p role="status" style={{ ...helpStyle, margin: "8px 0 0", color: message.bad ? "var(--stage-lost)" : "var(--mute)" }}>{message.text}</p>}
      </div>
    </VoiceCardShell>
  );
}
