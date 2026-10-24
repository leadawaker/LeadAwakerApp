// Recent browser test calls of this account's line, folded under the test panel. A row
// shows when it ran, how long, the engine, the reply delay and (Owner) the cost; opening
// it shows the same review as right after a call, in the test panel (the sticky column
// on wide screens, the panel above this list otherwise). The calls live in the demo
// account (no lead or booking lands in this client's CRM); the engine tags them with
// this account (Voice_Calls.test_account_id).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2, Plus } from "lucide-react";
import { OutcomePill } from "@/features/voiceCalls/components/OutcomePill";
import { formatDateTime, formatDuration } from "@/features/voiceCalls/format";
import { useWorkspace } from "@/hooks/useWorkspace";
import { IconBtn } from "@/components/ui/icon-btn";
import { helpStyle } from "./voiceAtoms";
import { fetchTestCalls, testCallsKey, type TestCallItem } from "./voiceApi";
import { isCallBusy, useVoiceTest } from "./test/VoiceTestProvider";
import { rowCostLabel, rowDelayLabel } from "./test/testCallRow";

/** The latest few first; "+" shows this many more each click (the API sends the latest 50). */
const MAX_SHOWN = 5;

const mono = { fontFamily: "var(--mono)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" } as const;

export function TestCallsList({ accountId, onOpened }: {
  accountId: number;
  /** Called after a row opened its review (the narrow layout scrolls the panel into view). */
  onOpened?: () => void;
}) {
  const { t, i18n } = useTranslation("voiceTab");
  const { isOwner } = useWorkspace();
  const { phase, reviewCallId, openReview } = useVoiceTest();
  const busy = isCallBusy(phase);
  // Folded by default: the prompts are the point of the section, not the call log.
  const [listOpen, setListOpen] = useState(false);
  const [shown, setShown] = useState(MAX_SHOWN);
  const { data: calls = [], isLoading } = useQuery({
    queryKey: testCallsKey(accountId),
    queryFn: () => fetchTestCalls(accountId),
    // A test call ends in another tab: pick it up when the user comes back.
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
  });

  const open = (c: TestCallItem) => {
    if (busy) return;
    openReview(c.callId);
    onOpened?.();
  };

  return (
    <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 10 }} data-testid="voice-test-calls">
      <button
        type="button"
        onClick={() => setListOpen((v) => !v)}
        aria-expanded={listOpen}
        data-testid="voice-test-calls-toggle"
        style={{ display: "flex", alignItems: "center", gap: 6, padding: 0, background: "none", border: 0, cursor: "pointer", color: "var(--mute)" }}
      >
        {listOpen ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
        <span className="eyebrow eyebrow-sm">{t("test.recentTitle")}</span>
        {!isLoading && <span style={{ ...mono, fontSize: 10.5, color: "var(--mute-2)" }}>{calls.length}</span>}
      </button>
      {!listOpen ? null : isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} />
      ) : calls.length === 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>{t("test.recentEmpty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calls.slice(0, shown).map((c) => {
            const when = formatDateTime(c.startedAt, i18n.language);
            const selected = phase === "review" && reviewCallId === c.callId;
            const delay = rowDelayLabel(c.latencyMs);
            return (
              <div key={c.callId} className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)" }}>
                <button
                  type="button"
                  onClick={() => open(c)}
                  disabled={busy}
                  aria-pressed={selected}
                  aria-label={t("test.recentOpen", { when })}
                  data-testid="voice-test-call-row"
                  data-call-id={c.callId}
                  style={{
                    width: "100%", display: "flex", flexWrap: "wrap", alignItems: "center", gap: "4px 12px", padding: "10px 14px",
                    border: 0, textAlign: "left", color: "var(--ink-soft)", borderRadius: "var(--r-card)",
                    background: selected ? "var(--wine-tint)" : "none",
                    boxShadow: selected ? "inset 0 0 0 1px color-mix(in srgb, var(--wine) 40%, transparent)" : "none",
                    cursor: busy ? "default" : "pointer", opacity: busy ? 0.6 : 1,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{when}</span>
                  <span style={{ ...mono, fontSize: 12, color: "var(--mute)" }}>{formatDuration(c.durationSeconds)}</span>
                  {c.engine && <span className="eyebrow eyebrow-sm" data-testid="voice-test-call-engine">{t(`test.panel.engines.${c.engine}`)}</span>}
                  {delay && <span style={{ ...mono, fontSize: 11.5, color: "var(--mute)" }} title={t("test.panel.review.delaysHint")}>{delay}</span>}
                  <span style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 10 }}>
                    {isOwner && (
                      <span style={{ ...mono, fontSize: 12.5, color: "var(--ink)" }} title={t("test.panel.review.cost")} data-testid="voice-test-call-cost">
                        {rowCostLabel(c, t("test.panel.review.unknown"))}
                      </span>
                    )}
                    <OutcomePill outcome={c.outcome} bookedSlot={c.bookedSlot} bookedIso={c.bookedIso} small />
                  </span>
                </button>
              </div>
            );
          })}
          {shown < calls.length && (
            <IconBtn
              onClick={() => setShown((n) => n + MAX_SHOWN)}
              aria-label={t("test.recentMore")}
              title={t("test.recentMore")}
              data-testid="voice-test-calls-more"
              style={{ alignSelf: "center" }}
            >
              <Plus className="h-4 w-4" />
            </IconBtn>
          )}
        </div>
      )}
    </div>
  );
}
