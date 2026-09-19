import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import type { VoiceCallListItem } from "../api/voiceCallsApi";
import { filterCalls, groupCalls, sortCalls, type ListOptions } from "../listOptions";
import { VoiceCallListCard } from "./VoiceCallListCard";
import { VoiceCallDetail } from "./VoiceCallDetail";

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 5px" }}>
      <MonoLabel>{label}</MonoLabel>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{count}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--mute-2)", padding: 40, textAlign: "center" }}>
      {children}
    </div>
  );
}

interface Props {
  calls: VoiceCallListItem[];
  isLoading: boolean;
  error: unknown;
  options: ListOptions;
  selection: string | null;
  setSelection: (id: string | null) => void;
}

export function VoiceCallsInbox({ calls, isLoading, error, options, selection, setSelection }: Props) {
  const { t } = useTranslation("voiceCalls");
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const narrow = vw < 920;

  const items = useMemo(() => sortCalls(filterCalls(calls, options), options.sort), [calls, options]);
  const sections = useMemo(() => groupCalls(items, options.group, t), [items, options.group, t]);

  // Open onto the first call, desktop only.
  useEffect(() => {
    if (narrow || selection || items.length === 0) return;
    setSelection(items[0].callId);
  }, [narrow, selection, items, setSelection]);

  const listBody = isLoading ? null : error ? (
    <Centered><MonoLabel>{t("loadError")}</MonoLabel></Centered>
  ) : calls.length === 0 ? (
    <Centered>
      <AudioLines size={28} />
      <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--mute)", maxWidth: 240 }}>{t("empty")}</p>
    </Centered>
  ) : items.length === 0 ? (
    <Centered><MonoLabel>{t("nothingHere")}</MonoLabel></Centered>
  ) : (
    sections.map((sec) => (
      <div key={sec.key}>
        {sec.label && <GroupHeader label={sec.label} count={sec.items.length} />}
        <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
          {sec.items.map((c) => (
            <VoiceCallListCard key={c.callId} call={c} active={selection === c.callId} onClick={() => setSelection(c.callId)} />
          ))}
        </div>
      </div>
    ))
  );

  const listPane = (
    <div style={{ width: narrow ? "100%" : 348, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: narrow ? "none" : "1px solid var(--line)", background: "var(--surface)" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 10px 8px", display: "flex", flexDirection: "column" }}>
        {listBody}
      </div>
      {calls.length > 0 && (
        <div style={{ flexShrink: 0, padding: "8px 16px", borderTop: "1px solid var(--line)" }}>
          <MonoLabel>{t("showing", { shown: items.length, total: calls.length })}</MonoLabel>
        </div>
      )}
    </div>
  );

  const rightPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {narrow && selection && (
        <button onClick={() => setSelection(null)} className="la-btn la-btn--soft" style={{ margin: "12px 0 0 14px", alignSelf: "flex-start" }}>
          ‹ {t("back")}
        </button>
      )}
      {selection ? (
        <VoiceCallDetail callId={selection} />
      ) : (
        <Centered><AudioLines size={28} /><MonoLabel>{t("selectCall")}</MonoLabel></Centered>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      {narrow ? (selection ? rightPane : listPane) : <>{listPane}{rightPane}</>}
    </div>
  );
}
