// One change card: what to change in the shared ElevenLabs prompt and why, the edit as a
// diff, the calls that show the problem, and Accept / Reject while it is open. Accepting
// puts the edit in the draft (the draft card below follows); nothing goes live from here.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { AlertTriangle, Check, ChevronDown, ChevronRight, Loader2, X } from "lucide-react";
import { Pill } from "@/components/crm/primitives";
import type { PromptLang, SuggestionDto, SuggestionStatus } from "@shared/voiceReview";
import { flushAllAutosaves } from "../autosaveRegistry";
import { useSuggestionActions } from "./coachApi";
import { CallChip } from "./CallChip";
import { DraftDiff } from "./DraftDiff";

const PILL_STYLE = { fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 } as const;
const BTN_STYLE = { minHeight: 36 } as const;
const STATUS_COLOR: Record<SuggestionStatus, string | undefined> = {
  proposed: "var(--wine)", accepted: "var(--good)", live: "var(--good)", rejected: undefined, stale: "var(--warn)",
};
const DIFF_HEIGHT = 220;
const COMPACT_DIFF_HEIGHT = 140;

type Note = "stale" | "decided" | "failed";

export function SuggestionItem({ card, accountId, compact }: { card: SuggestionDto; accountId: number; compact?: boolean }) {
  const { t } = useTranslation("voiceCoach");
  const actions = useSuggestionActions(accountId);
  const [busy, setBusy] = useState<"accept" | "reject" | null>(null);
  // What the last Accept or Reject answered, until the refreshed list says the same (or more).
  const [note, setNote] = useState<Note | null>(null);
  const [mirrorOpen, setMirrorOpen] = useState(false);

  const stale = card.status === "stale" || note === "stale";
  const open = card.status === "proposed" || card.status === "stale";
  const mirrorLang: PromptLang = card.language === "nl" ? "en" : "nl";
  const hasMirror = card.mirrorFind != null && card.mirrorReplace != null;
  const diffHeight = compact ? COMPACT_DIFF_HEIGHT : DIFF_HEIGHT;

  const decide = async (action: "accept" | "reject") => {
    setBusy(action);
    setNote(null);
    try {
      // Unsaved typing in the draft editor goes to the server first: the card is applied to the real draft.
      if (action === "accept") await flushAllAutosaves();
      const result = await actions[action](card.id);
      if (!result.ok) setNote(result.reason === "stale" ? "stale" : result.reason === "not_proposed" ? "decided" : "failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div
      className="neu-inset-crisp"
      style={{ borderRadius: "var(--r-card)", padding: compact ? 12 : 14, display: "flex", flexDirection: "column", gap: compact ? 8 : 10, minWidth: 0 }}
      data-testid="voice-suggestion" data-status={card.status}
    >
      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--ink)", lineHeight: 1.3, overflowWrap: "anywhere" }}>{card.title}</div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <Pill style={PILL_STYLE}>{t(`draft.lang.${card.language}`)}</Pill>
        {!compact && <Pill style={PILL_STYLE}>{t(`cards.source.${card.source}`)}</Pill>}
        <Pill color={STATUS_COLOR[stale ? "stale" : card.status]} style={PILL_STYLE} data-testid="voice-suggestion-status">{t(`cards.status.${stale ? "stale" : card.status}`)}</Pill>
      </div>
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--ink-soft)", overflowWrap: "anywhere" }}>{card.reason}</p>

      <DraftDiff before={card.find} after={card.replace} maxHeight={diffHeight} />
      {hasMirror && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <button
            type="button" onClick={() => setMirrorOpen((v) => !v)} aria-expanded={mirrorOpen} data-testid="voice-suggestion-mirror-toggle"
            style={{ display: "flex", alignItems: "center", gap: 6, padding: 0, minHeight: 28, background: "none", border: 0, cursor: "pointer", color: "var(--mute)", fontSize: 12.5, textAlign: "left" }}
          >
            {mirrorOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
            {t(`cards.alsoIn.${mirrorLang}`)}
          </button>
          {mirrorOpen && <DraftDiff before={card.mirrorFind ?? ""} after={card.mirrorReplace ?? ""} maxHeight={diffHeight} />}
        </div>
      )}

      {card.callIds.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
          <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--mute)" }}>{t("cards.calls")}</span>
          {card.callIds.map((id) => <CallChip key={id} callId={id} />)}
        </div>
      )}

      {card.status === "accepted" && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)", lineHeight: 1.45 }}>{t("cards.inDraft")}</p>}
      {stale && (
        <div role="alert" style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 12.5, color: "var(--ink-soft)", lineHeight: 1.45 }} data-testid="voice-suggestion-stale">
          <AlertTriangle size={14} style={{ color: "var(--warn)", flexShrink: 0, marginTop: 2 }} />
          <span>{t("cards.stale")}</span>
        </div>
      )}
      {note && note !== "stale" && (
        <p role="alert" style={{ margin: 0, fontSize: 12.5, color: "var(--stage-lost)", lineHeight: 1.45 }} data-testid="voice-suggestion-note">{t(`cards.note.${note}`)}</p>
      )}

      {open && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          {!stale && (
            <button
              type="button" className="la-btn la-btn--wine" style={BTN_STYLE} disabled={busy != null}
              onClick={() => void decide("accept")} data-testid="voice-suggestion-accept"
            >
              {busy === "accept" ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}{t("cards.accept")}
            </button>
          )}
          <button
            type="button" className="la-btn la-btn--soft" style={BTN_STYLE} disabled={busy != null}
            onClick={() => void decide("reject")} data-testid="voice-suggestion-reject"
          >
            {busy === "reject" ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}{t("cards.reject")}
          </button>
        </div>
      )}
    </div>
  );
}
