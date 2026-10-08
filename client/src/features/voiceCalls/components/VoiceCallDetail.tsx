import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2 } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import { useVoiceCall, type VoiceCallDetail as Detail } from "../api/voiceCallsApi";
import { maskSpoken } from "../maskIdentity";
import { maskCaller } from "./bits";
import { CallHeader } from "./CallHeader";
import { CallConversation } from "./CallConversation";
import { CallerHistory, CallSidebar, type CallerContext } from "./CallSidebar";

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
        style={{ width: narrow ? "auto" : 310, flexShrink: 0, minHeight: 0, borderRadius: "var(--r-card)", background: "var(--card)", overflowX: "hidden", overflowY: "auto" }}
      >
        <CallerHistory ctx={caller} />
      </div>
    </div>
  );
}

/**
 * One header, the transcript filling the middle, a sidebar on the right.
 * Below 1100px the whole pane scrolls as one column instead.
 */
export function VoiceCallDetail({ callId, masked, caller }: Props) {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading, isError } = useVoiceCall(callId);
  // Never render a call other than the selected one.
  const rawCall = data && data.callId === callId ? data : data === null ? null : undefined;
  const call = useMemo(() => (rawCall ? maskDetail(rawCall, masked) : rawCall), [rawCall, masked]);
  const narrow = useNarrow();

  if (isError && !call) {
    return <StatusPane caller={caller} narrow={narrow}><MonoLabel>{t("callLoadError")}</MonoLabel></StatusPane>;
  }
  if (isLoading || call === undefined) {
    return (
      <StatusPane caller={caller} narrow={narrow}>
        <Loader2 size={18} className="animate-spin" style={{ color: "var(--mute)" }} />
      </StatusPane>
    );
  }
  if (!call) {
    return <StatusPane caller={caller} narrow={narrow}><MonoLabel>{t("notFound")}</MonoLabel></StatusPane>;
  }

  return (
    <div style={{ flex: 1, minHeight: 0, padding: 14, display: "flex", flexDirection: "column", gap: 14, overflowY: narrow ? "auto" : "hidden", overflowX: "hidden" }}>
      <CallHeader call={call} narrow={narrow} caller={caller} />
      <div style={{ flex: narrow ? "0 0 auto" : 1, minHeight: 0, display: "flex", flexDirection: narrow ? "column" : "row", gap: 14 }}>
        <div style={{ flex: narrow ? "0 0 auto" : 1, minWidth: 0, minHeight: narrow ? 760 : 0, display: "flex", overflow: "hidden", order: narrow ? 2 : 0 }}>
          <CallConversation key={call.callId} call={call} />
        </div>
        <CallSidebar call={call} narrow={narrow} caller={caller} />
      </div>
    </div>
  );
}
