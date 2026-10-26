// The test panel's body while a call connects, runs or ends (VoiceTestPanel): status,
// timer, running cost, the tools as tags, what she understood and the transcript (newest
// line on top, tools and each reply's delay inline). Reads `useVoiceTest().live`; the tools
// come from useLiveTools (GPT Live's hook, or the polled events for ElevenLabs). A Draft pill
// marks a Test draft call (the draft prompt, writes faked).
import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives";
import { useVoiceTest } from "./VoiceTestProvider";
import { useLiveTools } from "./useLiveTools";
import { LiveSection, LiveToolTags, LiveTranscript } from "./LiveCallParts";
import { UnderstoodCard, understoodData } from "@/features/voiceCalls/review/UnderstoodCard";
import { latestUnderstood } from "@/features/voiceCalls/review/toolTags";
import { formatClock, formatCost, runningCost } from "./liveMetrics";

/** A clock that ticks once a second while `on`. */
function useNow(on: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!on) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [on]);
  return now;
}

const stat = { display: "flex", flexDirection: "column", gap: 2, minWidth: 0 } as const;
const draftPill = { fontFamily: "var(--mono)", fontSize: 9.5, letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 } as const;
const statValue = { fontFamily: "var(--mono)", fontSize: 18, color: "var(--ink)", fontVariantNumeric: "tabular-nums" } as const;

export function LiveCallView() {
  const { t } = useTranslation("voiceTab");
  const { t: tc } = useTranslation("voiceCoach");
  const { phase, callEngine, callDraft, live } = useVoiceTest();
  // The clock stops when the call starts ending (the live view stays a moment after).
  const now = useNow(phase === "live" && live.startedAt !== null);
  const tools = useLiveTools();
  const understood = useMemo(() => understoodData(latestUnderstood(tools)), [tools]);

  const elapsed = live.startedAt !== null ? Math.max(0, now - live.startedAt) : null;
  const perMin = live.rates ? (callEngine === "elevenlabs" ? live.rates.elevenPerMin : live.rates.gptLivePerMin) : null;

  return (
    <div className="neu-inset-crisp" style={{ borderRadius: "var(--r-card)", padding: 12, display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}
      aria-live="polite" data-testid="voice-test-live">
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <div style={stat}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span className="eyebrow eyebrow-sm" style={{ display: "flex", alignItems: "center", gap: 6 }} data-testid="voice-test-live-status">
              {phase === "live" ? <span aria-hidden style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--wine)" }} /> : <Loader2 size={12} className="animate-spin" />}
              {t(`test.panel.phase.${phase === "live" || phase === "ending" ? phase : "connecting"}`)}
            </span>
            {callDraft && <Pill color="var(--wine)" style={draftPill} data-testid="voice-test-draft-pill">{tc("testDraft.pill")}</Pill>}
          </div>
          <span style={statValue} data-testid="voice-test-live-timer" aria-label={t("test.panel.live.time")}>{formatClock(elapsed)}</span>
        </div>
        {perMin !== null && (
          <div style={{ ...stat, alignItems: "flex-end" }} title={t("test.panel.live.costHint")}>
            <span className="eyebrow eyebrow-sm">{t("test.panel.live.cost")}</span>
            <span style={statValue} data-testid="voice-test-live-cost">{`≈ ${formatCost(runningCost(elapsed ?? 0, perMin))}`}</span>
          </div>
        )}
      </div>

      <LiveSection title={t("test.panel.live.tools")}>
        <LiveToolTags tools={tools} />
      </LiveSection>

      <UnderstoodCard data={understood} />

      <LiveSection title={t("test.panel.live.transcript")}>
        {live.transcript.length === 0 && tools.length === 0
          ? (phase === "live" && <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("test.panel.liveEmpty")}</p>)
          : <LiveTranscript lines={live.transcript} tools={tools} delaysMs={live.delaysMs} />}
      </LiveSection>
    </div>
  );
}
