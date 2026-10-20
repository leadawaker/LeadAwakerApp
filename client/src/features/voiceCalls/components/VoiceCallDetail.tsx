import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { MonoLabel } from "@/features/voice/components/atoms";
import { Switch } from "@/components/ui/switch";
import { useSetCallTest, useVoiceCall, useVoiceCapabilities, type VoiceCallDetail as Detail } from "../api/voiceCallsApi";
import { maskSpoken } from "../maskIdentity";
import { maskCaller } from "./bits";
import { CallHeader } from "./CallHeader";
import { CallConversation } from "./CallConversation";
import { CallerHistory, CallSidebar, type CallerContext } from "./CallSidebar";
import { useMarkVisited } from "@/features/home/onboarding/useOnboarding";
import { CallDetailSkeleton, DETAIL_MAX_WIDTH, SIDEBAR_WIDTH } from "./VoiceCallsSkeleton";

function useNarrow(): boolean {
  const [narrow, setNarrow] = useState(typeof window !== "undefined" && window.innerWidth < 1100);
  useEffect(() => {
    const onR = () => setNarrow(window.innerWidth < 1100);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  return narrow;
}

/** Presenting mode for the whole call: header via maskCaller, plus the name and
 * numbers the caller says in the transcript and recap notes. Audio stays as is. */
function maskDetail(call: Detail, masked: boolean): Detail {
  if (!masked) return call;
  const name = call.callerName;
  const spoken = (text: string | null) => (text ? maskSpoken(text, name) : text);
  return {
    ...maskCaller(call, true),
    turns: call.turns.map((turn) => ({ ...turn, content: spoken(turn.content) })),
    summary: call.summary && {
      ...call.summary,
      name: maskCaller(call, true).callerName,
      items: call.summary.items.map((item) => ({ ...item, interest: spoken(item.interest), notes: spoken(item.notes) })),
    },
  };
}

interface Props {
  callId: string;
  masked: boolean;
  /** Callers view: adds the caller actions to the header and the call history to the sidebar. */
  caller?: CallerContext;
}

/**
 * Loading / error / not-found pane. In the Callers view the person's call history
 * (from the callers list, not the single-call query) stays up beside it.
 */
function StatusPane({ caller, narrow, children }: { caller?: CallerContext; narrow: boolean; children: React.ReactNode }) {
  const center = <div style={{ flex: 1, minHeight: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>{children}</div>;
  if (!caller || caller.calls.length === 0) return center;
  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: narrow ? "column" : "row", gap: 14, overflow: "hidden" }}>
      {center}
      <div
        className="neu-raised"
        style={{ width: narrow ? "auto" : SIDEBAR_WIDTH, flexShrink: 0, minHeight: 0, borderRadius: "var(--r-card)", background: "var(--card)", overflowX: "hidden", overflowY: "auto" }}
      >
        <CallerHistory ctx={caller} divider={false} />
      </div>
    </div>
  );
}

/**
 * Laid out like the Chats page: one header, the booking, summary and details
 * panel on the left, the conversation with its audio player on the right,
 * all in a centered column capped at DETAIL_MAX_WIDTH (the Chats width) so
 * nothing stretches on a wide screen. Below 1100px the whole pane scrolls as
 * one column instead (panel first).
 */
export function VoiceCallDetail({ callId, masked, caller }: Props) {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading, isError } = useVoiceCall(callId);
  // Never render a call other than the selected one.
  const rawCall = data && data.callId === callId ? data : data === null ? null : undefined;
  const call = useMemo(() => (rawCall ? maskDetail(rawCall, masked) : rawCall), [rawCall, masked]);
  const narrow = useNarrow();
  // The server grants `demo` only to the Owner who is not impersonating.
  const isOwner = useVoiceCapabilities().data?.demo === true;
  const setTest = useSetCallTest();
  useMarkVisited("call"); // Getting-started checklist (clients only)

  if (isError && !call) {
    return <StatusPane caller={caller} narrow={narrow}><MonoLabel>{t("callLoadError")}</MonoLabel></StatusPane>;
  }
  if (isLoading || call === undefined) {
    // The Callers view keeps the person's real call list up while the next call loads.
    const history = caller && caller.calls.length > 0 ? <CallerHistory ctx={caller} divider={false} /> : undefined;
    return <CallDetailSkeleton narrow={narrow} sidebar={history} />;
  }
  if (!call) {
    return <StatusPane caller={caller} narrow={narrow}><MonoLabel>{t("notFound")}</MonoLabel></StatusPane>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: "column", overflowY: narrow ? "auto" : "hidden", overflowX: "hidden" }}>
      <div style={{ width: "100%", maxWidth: DETAIL_MAX_WIDTH, margin: "0 auto", flex: narrow ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 14 }}>
        {isOwner && (
          <label className="flex items-center gap-2 self-end text-[12px] text-muted-foreground" data-testid="voice-test-toggle">
            <span>{t("testData.label")}</span>
            <Switch
              checked={call.isTest}
              disabled={setTest.isPending}
              onCheckedChange={(isTest) => setTest.mutate({ callId: call.callId, isTest })}
              aria-label={t("testData.label")}
            />
          </label>
        )}
        <CallHeader call={call} narrow={narrow} caller={caller} />
        <div style={{ flex: narrow ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 14 }}>
          <CallSidebar call={call} narrow={narrow} caller={caller} />
          <div style={{ flex: narrow ? "0 0 auto" : 1, minWidth: 0, minHeight: narrow ? 760 : 0, display: "flex", flexDirection: "column", order: narrow ? 2 : 0 }}>
            <CallConversation key={call.callId} call={call} />
          </div>
        </div>
      </div>
    </div>
  );
}
