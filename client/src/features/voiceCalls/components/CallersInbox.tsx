import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines, Users } from "lucide-react";
import { MonoLabel } from "@/features/voice/components/atoms";
import { CallListSkeleton } from "./VoiceCallsSkeleton";
import { VOICE_OUTCOMES, type VoiceCaller, type VoiceCallListItem, type VoiceScope } from "../api/voiceCallsApi";
import { callerStatus, filterCallers, maskVoiceCaller, type PeopleOptions } from "../callers";
import { normalizeOutcome, OUTCOME_LABEL_KEY } from "../status";
import { dateSections } from "../listOptions";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useListPanelState } from "@/hooks/useListPanelState";
import { callerIni, callerTitle } from "./bits";
import { CallerDetail } from "./CallerDetail";
import { CallerListCard } from "./CallerListCard";
import { CompactCallRail, RAIL_WIDTH, type RailItem } from "./CompactCallRail";
import { ListPanelFooter } from "@/components/crm/ListPanelToggleButton";
import { PeopleSummary } from "./WeekSummary";
import { MobileSheet } from "@/components/crm/mobile/MobileSheet";

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
  options: PeopleOptions;
  scope: VoiceScope;
  masked: boolean;
  isOwner: boolean;
  selection: string | null;
  setSelection: (key: string | null) => void;
  accountId?: number;
  /** All-accounts view (agency): each card names its client account (Live only). */
  showAccount: boolean;
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
export function CallersInbox({ callers, calls, isLoading, error, query, options, scope, masked, isOwner, selection, setSelection, accountId, showAccount, linkedCall }: Props) {
  const { t, i18n } = useTranslation("voiceCalls");
  const { currentAccount } = useWorkspace();
  const cardAccount = showAccount && scope === "live";
  const timeZone = (currentAccount?.timezone as string | undefined) || undefined;
  const [vw, setVw] = useState(typeof window !== "undefined" ? window.innerWidth : 1600);
  useEffect(() => {
    const onR = () => setVw(window.innerWidth);
    window.addEventListener("resize", onR);
    return () => window.removeEventListener("resize", onR);
  }, []);
  const narrow = vw < 920;
  // Phones: the detail rises as a sheet over the list; pull it down to go back (as on Chats).
  const isMobile = vw < 768;
  // Same minimize switch as the Chats list (shared across pages, desktop only).
  const { state: panel } = useListPanelState();
  const compact = !narrow && panel === "compact";
  const hidden = !narrow && panel === "hidden";

  const items = useMemo(() => filterCallers(callers, query, options), [callers, query, options]);
  const railItems: RailItem[] = useMemo(() => items.map((raw) => {
    const c = maskVoiceCaller(raw, masked);
    const who = { callerName: c.name, callerNumber: c.phone };
    return { key: c.key, ini: callerIni(who, t("webCaller")), status: callerStatus(c), title: callerTitle(who, t("webCaller")) };
  }), [items, masked, t]);
  // Date groups use each person's latest call, in the account timezone.
  const sections = useMemo(() => {
    if (options.group === "none") return [{ key: "all", label: "", items }];
    if (options.group === "outcome") {
      return VOICE_OUTCOMES
        .map((o) => ({ key: o, label: t(`outcomes.${OUTCOME_LABEL_KEY[o]}`), items: items.filter((c) => normalizeOutcome(c.bestOutcome) === o) }))
        .filter((g) => g.items.length > 0);
    }
    return dateSections(items, (c) => c.lastCallAt, t, { timeZone, locale: i18n.language });
  }, [items, options.group, t, timeZone, i18n.language]);
  const selected = callers.find((c) => c.key === selection) ?? null;
  // Each person's latest call recap, for the line their row opens on hover.
  const recapByCall = useMemo(() => new Map(calls.map((c) => [c.callId, c.conclusion])), [calls]);

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
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--mute)", maxWidth: 240 }}>{t(scope === "test" ? "emptyTest" : "empty")}</p>
      )}
    </Centered>
  ) : items.length === 0 ? (
    <Centered><MonoLabel>{t("nothingHere")}</MonoLabel></Centered>
  ) : (
    sections.map((sec) => (
      <div key={sec.key}>
        {sec.label && <GroupHeader label={sec.label} count={sec.items.length} />}
        {/* la-cards--flat: WhatsApp-style flat rows; drop the modifier for the raised cards. */}
        <div className="la-cards la-cards--flat">
          {sec.items.map((c) => (
            <CallerListCard key={c.key} caller={c} masked={masked} showAccount={cardAccount} recap={recapByCall.get(c.lastCallId)} active={selection === c.key} onClick={() => setSelection(c.key)} />
          ))}
        </div>
      </div>
    ))
  );

  const renderCard = (key: string) => {
    const c = items.find((x) => x.key === key);
    return c ? <CallerListCard caller={c} masked={masked} showAccount={cardAccount} recap={recapByCall.get(c.lastCallId)} active={selection === key} onClick={() => setSelection(key)} /> : null;
  };

  const listPane = compact ? (
    <div style={{ width: RAIL_WIDTH, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: "1px solid var(--line)", background: "var(--surface)" }}>
      <CompactCallRail items={isLoading || error ? [] : railItems} selection={selection} onSelect={setSelection} renderCard={renderCard} />
      {/* The fold button at the bottom of the rail: expands it back to the full list. */}
      <ListPanelFooter compact />
    </div>
  ) : (
    <div style={{ width: narrow ? "100%" : 348, flexShrink: 0, display: "flex", flexDirection: "column", minHeight: 0, borderRight: narrow ? "none" : "1px solid var(--line)", background: "var(--surface)" }}>
      {/* Panel head: the stats line. */}
      <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: 4, padding: narrow ? "8px 0 0" : "6px 8px 0 0" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {!isLoading && !error && <PeopleSummary count={items.length} />}
        </div>
      </div>
      <div style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "6px 8px 8px", display: "flex", flexDirection: "column" }}>
        {listBody}
      </div>
      {/* Bottom bar: "showing x of y" on the left, the fold button at the right end (desktop, two panes). */}
      <ListPanelFooter>
        {callers.length > 0 && <MonoLabel>{t("showing", { shown: items.length, total: callers.length })}</MonoLabel>}
      </ListPanelFooter>
    </div>
  );

  const rightPane = (
    <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden", background: "var(--bg)" }}>
      {narrow && !isMobile && selected && (
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
      {isMobile ? (
        <>
          {listPane}
          <MobileSheet open={!!selected} onClose={() => setSelection(null)} data-testid="voice-caller-sheet">{rightPane}</MobileSheet>
        </>
      ) : narrow ? (selected ? rightPane : listPane) : <>{!hidden && listPane}{rightPane}</>}
    </div>
  );
}
