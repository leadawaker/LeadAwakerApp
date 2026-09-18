import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, CalendarCheck } from "lucide-react";
import { MonoLabel, VoiceAvatar } from "@/features/voice/components/atoms";
import { useVoiceCall, type VoiceCallDetail as Detail } from "../api/voiceCallsApi";
import { formatBooked, formatDateTime, formatDuration } from "../format";
import { BookedPill, Panel, callerInitials } from "./bits";
import { CallRecording } from "./CallRecording";
import { CallTranscript } from "./CallTranscript";

function Block({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <MonoLabel>{label}</MonoLabel>
      {children}
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
      <MonoLabel>{label}</MonoLabel>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

const sep = <span style={{ color: "var(--line-strong)" }}>·</span>;

function DetailHeader({ call }: { call: Detail }) {
  const { t, i18n } = useTranslation("voiceCalls");
  return (
    <div style={{ flexShrink: 0, padding: "16px 22px", borderBottom: "1px solid var(--line)", display: "flex", alignItems: "center", gap: 14 }}>
      <VoiceAvatar ini={callerInitials(call.callerName, t("webCaller"))} size={44} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: "var(--serif)", fontSize: 22, color: "var(--ink)", lineHeight: 1.1, marginBottom: 3 }}>
          {call.callerName || t("webCaller")}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--mute)", letterSpacing: "0.06em", textTransform: "uppercase" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5, color: "var(--wine)" }}>
            <AudioLines size={11} />{t("voiceCall")}
          </span>
          {sep}
          <span>{formatDateTime(call.startedAt, i18n.language)}</span>
          {sep}
          <span>{formatDuration(call.durationSeconds)}</span>
          {sep}
          <span>{t("turns", { count: call.turnCount })}</span>
          {call.language && <>{sep}<span>{call.language}</span></>}
        </div>
      </div>
      {call.bookedSlot && <BookedPill />}
    </div>
  );
}

export function VoiceCallDetail({ callId }: { callId: string }) {
  const { t, i18n } = useTranslation("voiceCalls");
  const { data: call, isLoading } = useVoiceCall(callId);

  if (isLoading) return null;
  if (!call) {
    return (
      <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <MonoLabel>{t("notFound")}</MonoLabel>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
      <DetailHeader call={call} />
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "20px 22px", display: "flex", flexDirection: "column", gap: 22 }}>
        {call.bookedSlot && (
          <Block label={t("sections.booked")}>
            <Panel>
              <div style={{ display: "flex", alignItems: "center", gap: 10, color: "var(--ink)" }}>
                <CalendarCheck size={16} style={{ color: "var(--good)", flexShrink: 0 }} />
                <span style={{ fontFamily: "var(--serif)", fontSize: 17 }}>
                  {call.bookedIso ? formatBooked(call.bookedIso, i18n.language) : call.bookedSlot}
                </span>
              </div>
              {call.bookedIso && (
                <p style={{ margin: "6px 0 0 26px", fontSize: 12, color: "var(--mute)" }}>
                  {t("spokenAs")}: {call.bookedSlot}
                </p>
              )}
            </Panel>
          </Block>
        )}

        {(!call.summary || call.summary.outcome) && (
          <Block label={t("sections.outcome")}>
            <Panel>
              <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: call.summary?.outcome ? "var(--ink-soft)" : "var(--mute)" }}>
                {call.summary?.outcome || t("noSummary")}
              </p>
            </Panel>
          </Block>
        )}

        {call.summary && call.summary.items.length > 0 && (
          <Block label={t("sections.summary")}>
            {call.summary.items.map((item, i) => (
              <Panel key={i}>
                <span style={{ display: "inline-flex", fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", padding: "3px 9px", borderRadius: "var(--r-pill)", color: "var(--wine)", background: "var(--wine-tint)", marginBottom: 8 }}>
                  {t(`intents.${item.intent}`, { defaultValue: item.intent })}
                </span>
                {item.interest && (
                  <p style={{ margin: "0 0 4px", fontSize: 13, lineHeight: 1.55, color: "var(--ink-soft)" }}>
                    <span style={{ color: "var(--mute)" }}>{t("interest")}: </span>{item.interest}
                  </p>
                )}
                {item.notes && (
                  <p style={{ margin: 0, fontSize: 13, lineHeight: 1.55, color: "var(--ink-soft)" }}>
                    <span style={{ color: "var(--mute)" }}>{t("notes")}: </span>{item.notes}
                  </p>
                )}
              </Panel>
            ))}
          </Block>
        )}

        <Block label={t("sections.recording")}>
          <CallRecording key={call.callId} sessionId={call.sessionId} fallbackSeconds={call.durationSeconds} />
        </Block>

        {call.turns.length > 0 && (
          <>
            <Divider label={t("sections.transcript")} />
            <CallTranscript turns={call.turns} />
          </>
        )}
      </div>
    </div>
  );
}
