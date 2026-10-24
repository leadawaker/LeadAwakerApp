// "What she understood": what the receptionist took from the call, as tags. Live it comes
// from her latest update_call_summary (intent, interest, notes); in the review from the
// call's recap (intents and outcome). Only data the engine already writes: no mood or
// urgency read. Presentational: LiveCallView and CallReviewView pass what they have.
import { useTranslation } from "react-i18next";
import { Lightbulb } from "lucide-react";
import { outcomeColors, OUTCOME_LABEL_KEY } from "@/features/voiceCalls/status";
import type { VoiceOutcome } from "@/features/voiceCalls/api/voiceCallsApi";
import { useVoiceT } from "@/features/accounts/components/workspace/voice/voiceGender";
import { humanizeTool, type UnderstoodItem } from "./toolTags";

export interface UnderstoodData {
  intents: string[];
  interests: string[];
  notes: string[];
  outcome: VoiceOutcome | null;
}

const uniq = (xs: string[]) => Array.from(new Set(xs.filter(Boolean)));

/** The live recap items as the card's data. */
export function understoodData(items: readonly UnderstoodItem[] | null, outcome: VoiceOutcome | null = null): UnderstoodData {
  return {
    intents: uniq((items ?? []).map((x) => x.intent)),
    interests: uniq((items ?? []).map((x) => x.interest)),
    notes: uniq((items ?? []).map((x) => x.notes)),
    outcome,
  };
}

const row = { display: "flex", flexDirection: "column", gap: 4, minWidth: 0 } as const;
const wineTag = {
  display: "inline-flex", alignItems: "center", padding: "2px 9px", borderRadius: "var(--r-pill)", fontSize: 11.5, fontWeight: 600,
  background: "var(--wine-tint)", color: "var(--wine)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--wine) 28%, transparent)",
} as const;
const text = { margin: 0, fontSize: 12.5, lineHeight: 1.45, color: "var(--ink)", overflowWrap: "anywhere" } as const;

export function UnderstoodCard({ data, emptyKey = "empty" }: { data: UnderstoodData; emptyKey?: "empty" | "emptyReview" }) {
  const { t } = useVoiceT();
  const { t: tc } = useTranslation("voiceCalls");
  const { intents, interests, notes } = data;
  // Without a recap the server derives outcome "other": that is no outcome, not a result.
  const hasItems = intents.length > 0 || interests.length > 0 || notes.length > 0;
  const outcome = data.outcome === "other" && !hasItems ? null : data.outcome;
  const nothing = !hasItems && !outcome;
  const colors = outcome ? outcomeColors(outcome) : null;

  return (
    <section style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 0 }} data-testid="voice-test-understood">
      <span className="eyebrow eyebrow-sm" style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <Lightbulb size={12} aria-hidden />
        {t("test.panel.understood.title")}
      </span>
      {nothing ? (
        <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t(`test.panel.understood.${emptyKey}`)}</p>
      ) : (
        <div className="neu-inset-super-crisp" style={{ borderRadius: "var(--r-surface)", padding: "9px 11px", display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
          {(intents.length > 0 || (outcome && colors)) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {intents.map((x) => (
                <span key={x} style={wineTag} data-testid="voice-test-understood-intent">{tc(`intents.${x}`, { defaultValue: humanizeTool(x) })}</span>
              ))}
              {outcome && colors && (
                <span data-testid="voice-test-understood-outcome" title={t("test.panel.understood.outcome")}
                  style={{ ...wineTag, background: colors.bg, color: colors.text, boxShadow: colors.ring ? `inset 0 0 0 1px ${colors.ring}` : "none" }}>
                  {tc(`outcomes.${OUTCOME_LABEL_KEY[outcome]}`)}
                </span>
              )}
            </div>
          )}
          {interests.length > 0 && (
            <div style={row}>
              <span className="eyebrow eyebrow-sm">{t("test.panel.understood.wants")}</span>
              {interests.map((x) => <p key={x} style={text}>{x}</p>)}
            </div>
          )}
          {notes.length > 0 && (
            <div style={row}>
              <span className="eyebrow eyebrow-sm">{t("test.panel.understood.notes")}</span>
              {notes.map((x) => <p key={x} style={{ ...text, color: "var(--ink-soft)" }}>{x}</p>)}
            </div>
          )}
        </div>
      )}
    </section>
  );
}
