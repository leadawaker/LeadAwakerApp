// Recent browser test calls of this account's line, each opening into the same
// transcript, recording and recap the Voice Calls page shows. The calls live in
// the demo account (no lead or booking lands in this client's CRM); the engine
// tags them with this account (Voice_Calls.test_account_id).
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Loader2 } from "lucide-react";
import { useVoiceCall } from "@/features/voiceCalls/api/voiceCallsApi";
import { CallConversation } from "@/features/voiceCalls/components/CallConversation";
import { CallRecap } from "@/features/voiceCalls/components/CallRecap";
import { OutcomePill } from "@/features/voiceCalls/components/OutcomePill";
import { formatDateTime, formatDuration } from "@/features/voiceCalls/format";
import { FieldLabel, helpStyle } from "./voiceAtoms";
import { fetchTestCalls, testCallsKey } from "./voiceApi";

export function TestCallsList({ accountId }: { accountId: number }) {
  const { t, i18n } = useTranslation("voiceTab");
  const [open, setOpen] = useState<string | null>(null);
  const { data: calls = [], isLoading } = useQuery({
    queryKey: testCallsKey(accountId),
    queryFn: () => fetchTestCalls(accountId),
    // A test call ends in another tab: pick it up when the user comes back.
    refetchOnWindowFocus: true,
    staleTime: 10 * 1000,
  });

  return (
    <div style={{ marginTop: 20 }} data-testid="voice-test-calls">
      <FieldLabel>{t("test.recentTitle")}</FieldLabel>
      {isLoading ? (
        <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} />
      ) : calls.length === 0 ? (
        <p style={{ ...helpStyle, margin: 0 }}>{t("test.recentEmpty")}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {calls.map((c) => {
            const isOpen = open === c.callId;
            return (
              <div key={c.callId} className="neu-inset" style={{ borderRadius: "var(--r-card)" }}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : c.callId)}
                  aria-expanded={isOpen}
                  style={{
                    width: "100%", display: "flex", alignItems: "center", gap: 12, padding: "10px 14px",
                    background: "none", border: 0, cursor: "pointer", textAlign: "left", color: "var(--ink-soft)",
                  }}
                >
                  {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{formatDateTime(c.startedAt, i18n.language)}</span>
                  <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--mute)" }}>{formatDuration(c.durationSeconds)}</span>
                  <span style={{ marginLeft: "auto" }}>
                    <OutcomePill outcome={c.outcome} bookedSlot={c.bookedSlot} bookedIso={c.bookedIso} small />
                  </span>
                </button>
                {isOpen && <TestCallDetail callId={c.callId} />}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function TestCallDetail({ callId }: { callId: string }) {
  const { t } = useTranslation("voiceTab");
  const { data: call, isLoading } = useVoiceCall(callId);
  if (isLoading) {
    return <div style={{ padding: 14 }}><Loader2 size={14} className="animate-spin" style={{ color: "var(--mute)" }} /></div>;
  }
  if (!call) return <p style={{ ...helpStyle, padding: "0 14px 14px", margin: 0 }}>{t("test.callFailed")}</p>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 14, padding: "0 14px 14px" }}>
      <div style={{ flex: "1 1 380px", minWidth: 0, height: 520, display: "flex" }}>
        <CallConversation key={call.callId} call={call} />
      </div>
      <div style={{ flex: "1 1 260px", minWidth: 0, maxHeight: 520, display: "flex" }}>
        <CallRecap call={call} />
      </div>
    </div>
  );
}
