import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { OPEN_VOICE_CALL_EVENT } from "@/features/home/lib/openCall";
import { useVoiceCall, useVoiceCallers, useVoiceCalls, useVoiceCapabilities, type VoiceCapabilities, type VoiceCaller, type VoiceCallListItem, type VoiceScope } from "../api/voiceCallsApi";
import { AGENCY_TABS, CLIENT_TABS, LAST_TAB_PAGE, type CallsTab } from "../callers";
import type { AccountOption } from "../components/AccountFilter";
import { CallersInbox } from "../components/CallersInbox";
import { VoiceCallsInbox } from "../components/VoiceCallsInbox";
import { VoiceCallsTopbar } from "../components/VoiceCallsTopbar";
import type { ListOptions } from "../listOptions";
import { readPref, writePref } from "../localPref";
import { usePresenting } from "../usePresenting";

const StatsPanel = lazy(() => import("@/features/home/stats/StatsPanel").then((m) => ({ default: m.StatsPanel })));

const SCOPE_KEY = "la.voiceCalls.scope";

function initialScope(): VoiceScope | null {
  const saved = readPref(SCOPE_KEY);
  return saved === "live" || saved === "demo" ? saved : null;
}

/** A call opened from a client alert link (/go/:code) or a Stats row: read once, then cleared. */
function consumeCallDeepLink(): string | null {
  try {
    const id = localStorage.getItem("selected-voice-call-id");
    if (id) localStorage.removeItem("selected-voice-call-id");
    return id;
  } catch {
    return null;
  }
}

/**
 * The People row a call belongs to: its lead's row, or (a call without a lead)
 * the row whose latest call it is. Null while the people list is not loaded.
 */
function callerKeyOf(call: Pick<VoiceCallListItem, "callId" | "leadsId">, callers: VoiceCaller[] | undefined): string | null {
  if (call.leadsId != null) return `lead:${call.leadsId}`;
  return callers?.find((c) => c.lastCallId === call.callId)?.key ?? null;
}

function VoiceCallsContent({ capabilities }: { capabilities: VoiceCapabilities }) {
  const { isAgencyUser } = useWorkspace();
  const [deepLinkCall, setDeepLinkCall] = useState<string | null>(consumeCallDeepLink);
  // The server decides: only an Owner (not impersonating) gets `demo`.
  const isOwner = capabilities.demo;
  const [savedScope, setSavedScope] = useState<VoiceScope | null>(() => (deepLinkCall ? "live" : initialScope()));
  const scope: VoiceScope = isOwner ? savedScope ?? "demo" : "live";
  const [accountPick, setAccountPick] = useState<number | undefined>(undefined);
  const accountId = scope === "live" ? accountPick : undefined;
  const { masked, toggle } = usePresenting(isOwner);

  // Stats · People for everyone, All calls for the agency. First visit opens Stats, then the last tab used.
  const tabs = isAgencyUser ? AGENCY_TABS : CLIENT_TABS;
  // A link to one call opens it: the person (clients) or the call itself (agency).
  const linkTab: CallsTab = isAgencyUser ? "calls" : "people";
  const [view, setView] = useState<CallsTab>(() => (deepLinkCall ? linkTab : readLastTab(LAST_TAB_PAGE, tabs, "stats")));
  const activeView: CallsTab = tabs.includes(view) ? view : "stats";

  const { data: calls = [], isLoading, error } = useVoiceCalls(scope, accountId);
  const [selection, setSelection] = useState<string | null>(deepLinkCall);
  const callersQuery = useVoiceCallers(scope, accountId, activeView === "people");
  const [callerSelection, setCallerSelection] = useState<string | null>(null);
  const [options, setOptionsState] = useState<ListOptions>({ query: "", outcomes: [], statuses: [], languages: [], sort: "recent", group: "date" });
  const setOptions = (patch: Partial<ListOptions>) => setOptionsState((o) => ({ ...o, ...patch }));
  const languages = useMemo(() => Array.from(new Set(calls.map((c) => c.language ?? ""))).sort(), [calls]);

  // A deep-linked call that is not in the loaded list is fetched by id, so its person can be found.
  const loadedLinkCall = deepLinkCall ? calls.find((c) => c.callId === deepLinkCall) ?? null : null;
  const { data: fetchedLinkCall } = useVoiceCall(deepLinkCall && !loadedLinkCall && !isLoading ? deepLinkCall : null);
  const linkCall = loadedLinkCall ?? fetchedLinkCall ?? null;
  // Select the linked person once per link (the people list refetches every minute).
  const [linkKey, setLinkKey] = useState<string | null>(null);
  useEffect(() => {
    if (!linkCall || activeView !== "people" || linkKey) return;
    const key = callerKeyOf(linkCall, callersQuery.data);
    if (key) {
      setLinkKey(key);
      setCallerSelection(key);
    }
  }, [linkCall, activeView, callersQuery.data, linkKey]);

  // Opening a call while the page is already up (a row on the Stats tab).
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      try { localStorage.removeItem("selected-voice-call-id"); } catch { /* ignore */ }
      if (!id) return;
      setDeepLinkCall(id);
      setLinkKey(null);
      setSelection(id);
      setCallerSelection(null);
      setView(linkTab);
    };
    window.addEventListener(OPEN_VOICE_CALL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_VOICE_CALL_EVENT, onOpen);
  }, [linkTab]);

  // Accounts seen so far, so the chip keeps listing every client after one is picked.
  const [known, setKnown] = useState<Map<number, string>>(new Map());
  useEffect(() => {
    const named = calls.filter((c) => c.accountName);
    if (named.every((c) => known.get(c.accountId) === c.accountName)) return;
    setKnown((prev) => {
      const next = new Map(prev);
      named.forEach((c) => next.set(c.accountId, c.accountName as string));
      return next;
    });
  }, [calls, known]);
  const accounts: AccountOption[] = useMemo(
    () => Array.from(known, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name)),
    [known],
  );

  const changeScope = (s: VoiceScope) => {
    setSavedScope(s);
    writePref(SCOPE_KEY, s);
    setSelection(null);
    setCallerSelection(null);
  };
  const changeView = (v: CallsTab) => {
    setView(v);
    writeLastTab(LAST_TAB_PAGE, v);
  };
  const changeAccount = (id: number | undefined) => {
    setAccountPick(id);
    setSelection(null);
    setCallerSelection(null);
  };

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <VoiceCallsTopbar
        scope={scope}
        isOwner={isOwner}
        onScope={changeScope}
        tabs={tabs}
        view={activeView}
        onView={changeView}
        options={options}
        setOptions={setOptions}
        languages={languages}
        accounts={accounts}
        accountId={accountId}
        onAccount={changeAccount}
        masked={masked}
        onTogglePresenting={toggle}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {activeView === "stats" ? (
          <Suspense fallback={<div className="la-page" aria-busy="true" />}>
            <StatsPanel kind="phone" />
          </Suspense>
        ) : activeView === "people" ? (
          <CallersInbox
            callers={callersQuery.data ?? []}
            calls={calls}
            isLoading={callersQuery.isLoading}
            error={callersQuery.error}
            query={options.query}
            scope={scope}
            masked={masked}
            isOwner={isOwner}
            selection={callerSelection}
            setSelection={setCallerSelection}
            accountId={accountId}
            linkedCall={linkKey && deepLinkCall ? { key: linkKey, callId: deepLinkCall } : null}
          />
        ) : (
          <VoiceCallsInbox
            calls={calls}
            isLoading={isLoading}
            error={error}
            options={options}
            scope={scope}
            masked={masked}
            selection={selection}
            setSelection={setSelection}
          />
        )}
      </div>
    </div>
  );
}

/** Waits for capabilities so nothing renders unmasked (or in the wrong tab) first. */
function VoiceCallsGate() {
  const { t } = useTranslation("voiceCalls");
  const { data, isLoading, error } = useVoiceCapabilities();
  if (isLoading) return <div className="la-page" aria-busy="true" />;
  if (error || !data || (!data.live && !data.demo)) {
    return (
      <div className="la-page" style={{ display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12, color: "var(--mute-2)", padding: 40, textAlign: "center" }}>
        <AudioLines size={28} />
        <p style={{ margin: 0, fontSize: 13, lineHeight: 1.5, color: "var(--mute)" }}>
          {error ? t("loadError") : t("emptyLive.hint")}
        </p>
      </div>
    );
  }
  return <VoiceCallsContent capabilities={data} />;
}

export function VoiceCallsPage() {
  return (
    <CrmShell>
      <VoiceCallsGate />
    </CrmShell>
  );
}
