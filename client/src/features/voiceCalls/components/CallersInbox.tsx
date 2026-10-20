import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Users } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import { CallListSkeleton } from "./VoiceCallsSkeleton";
import type { VoiceCaller, VoiceCallListItem, VoiceScope } from "../api/voiceCallsApi";
import { filterCallers } from "../callers";
import { dateSections } from "../listOptions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { CallerDetail } from "./CallerDetail";
import { CallerListCard } from "./CallerListCard";

function Centered({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--mute-2)", padding: 40, textAlign: "center" }}>
      {children}
    </div>
  );
}

interface Props {
  callers: VoiceCaller[];
  /** The already-loaded calls list, used for each caller's call history. */
  calls: VoiceCallListItem[];
  isLoading: boolean;
  error: unknown;
  query: string;
  scope: VoiceScope;
  masked: boolean;
  isOwner: boolean;
  selection: string | null;
  setSelection: (key: string | null) => void;
  accountId?: number;
  /** A call handed over by a link: that person opens with this call expanded. */
  linkedCall?: { key: string; callId: string } | null;
}

function GroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "12px 8px 5px" }}>
      <MonoLabel>{label}</MonoLabel>
      <span style={{ fontFamily: "var(--mono)", fontSize: 9, fontWeight: 700, color: "var(--mute-2)" }}>{count}</span>
      <span style={{ flex: 1, height: 1, background: "var(--line)" }} />
    </div>
  );
}

/** Same split as VoiceCallsInbox: 348px list of people, the chosen person on the right. */
export function CallersInbox({ callers, calls, isLoading, error, query, scope, masked, isOwner, selection, setSelection, accountId, linkedCall }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const { currentAccount } = useWorkspace();
  const timeZone = (currentAccount?.timezone as string | undefined) || undefined;
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const narrow = vw < 920;

  const items = useMemo(() => filterCallers(callers, query), [callers, query]);
  // Grouped by each person's latest call, in the account timezone.
  const sections = useMemo(
    () => dateSections(items, (c) => c.lastCallAt, t, { timeZone, locale: i18n.language }),
    [items, t, timeZone, i18n.language],
  );
  const selected = callers.find((c) => c.key === selection) ?? null;

  // Open onto the first caller, desktop only.
  useEffect(() => {
    if (narrow || selected || items.length === 0) return;
    setSelection(items[0].key);
  }, [narrow, selected, items, setSelection]);

  const listBody = isLoading ? <CallListSkeleton /> : error ? (
    <Centered><MonoLabel>{t("loadError")}</MonoLabel></Centered>
  ) : callers.length === 0 ? (
    <Centered>
      <Users size={28} />
      {scope === "live" ? (
        <>
          <p style={{ margin: 0, fontFamily: "var(--serif)", fontSize: 18, color: "var(--ink)" }}>{t("emptyLive.title")}</p>
          <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--mute)", maxWidth: 240 }}>{t("emptyLive.hint")}</p>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--mute)", maxWidth: 240 }}>{t("empty")}</p>
      )}
    </Centered>
  ) : items.length === 0 ? (
    <Centered><MonoLabel>{t("nothingHere")}</MonoLabel></Centered>
  ) : (
    sections.map((sec) => (
      <div key={sec.key}>
        <GroupHeader label={sec.label} count={sec.items.length} />
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {sec.items.map((c) => (
            <CallerListCard key={c.key} caller={c} masked={masked} showAccount={scope === "live"} active={selection === c.key} onClick={() => setSelection(c.key)} />
          ))}
        </div>
      </div>
    ))
  );

  const listPane = (
    <div style={{ width: narrow ? "100%" : 348, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: narrow ? "none" : "1px solid var(--line)", background: "var(--surface)" }}>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "10px 10px 8px", display: "flex", flexDirection: "column" }}>
        {listBody}
      </div>
      {callers.length > 0 && (
        <div style={{ flexShrink: 0, padding: "8px 16px", borderTop: "1px solid var(--line)" }}>
          <MonoLabel>{t("showing", { shown: items.length, total: callers.length })}</MonoLabel>
        </div>
      )}
    </div>
  );

  const rightPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {narrow && selected && (
        <button onClick={() => setSelection(null)} className="la-btn la-btn--soft" style={{ margin: "12px 0 0 14px", alignSelf: "flex-start", flexShrink: 0 }}>
          ‹ {t("callers.back")}
        </button>
      )}
      {selected ? (
        <CallerDetail key={selected.key} caller={selected} calls={calls} masked={masked} isOwner={isOwner} scope={scope} accountId={accountId} initialCallId={linkedCall?.key === selected.key ? linkedCall.callId : null} />
      ) : (
        <Centered><AudioLines size={28} />{callers.length > 0 && <MonoLabel>{t("callers.empty")}</MonoLabel>}</Centered>
      )}
    </div>
  );

  return (
    <div style={{ flex: 1, minHeight: 0, display: "flex", overflow: "hidden", background: "var(--bg)" }}>
      {narrow ? (selected ? rightPane : listPane) : <>{listPane}{rightPane}</>}
    </div>
  );
}
