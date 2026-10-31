import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { useIsMobile } from "@/hooks/useIsMobile";
import { readLastTab, writeLastTab } from "@/lib/lastTab";
import { OPEN_VOICE_CALL_EVENT } from "@/features/home/lib/openCall";
import { useVoiceCall, useVoiceCallers, useVoiceCalls, useVoiceCapabilities, type VoiceCapabilities, type VoiceCaller, type VoiceCallListItem, type VoiceScope } from "../api/voiceCallsApi";
import { CALLS_TABS, DEFAULT_PEOPLE_OPTIONS, LAST_LIST_PAGE, LAST_TAB_PAGE, type CallsTab, type PeopleOptions } from "../callers";
import type { AccountOption } from "../components/AccountFilter";
import type { CallsPageView } from "../components/callsTabs";
import { readSettingsParams } from "@/features/accounts/components/workspace/receptionist/settingsLink";
import { CallsListTabs } from "../components/CallsPageTabs";
import { CallersInbox } from "../components/CallersInbox";
import { VoiceCallsInbox } from "../components/VoiceCallsInbox";
import { VoiceCallsTopbar } from "../components/VoiceCallsTopbar";
import type { ListOptions } from "../listOptions";
import { readPref, writePref } from "../localPref";
import { usePresenting } from "../usePresenting";

const ReceptionistSettings = lazy(() => import("@/features/accounts/components/workspace/receptionist/ReceptionistSettings").then((m) => ({ default: m.ReceptionistSettings })));

const SCOPE_KEY = "la.voiceCalls.scope";

function initialScope(): VoiceScope | null {
  const saved = readPref(SCOPE_KEY);
  return saved === "live" || saved === "demo" || saved === "test" ? saved : null;
}

/** A call opened from a client alert link (/go/:code) or a row on the Stats page: read once, then cleared. */
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
  const { isAgencyUser, currentAccountId, accounts: workspaceAccounts } = useWorkspace();
  const [deepLinkCall, setDeepLinkCall] = useState<string | null>(consumeCallDeepLink);
  // The server decides: only an Owner (not impersonating) gets `demo`.
  const isOwner = capabilities.demo;
  // Agency users (Owner, Admin) get the Tests tab.
  const canTest = capabilities.test === true;
  const [savedScope, setSavedScope] = useState<VoiceScope | null>(() => (deepLinkCall ? "live" : initialScope()));
  const scope: VoiceScope = isOwner ? savedScope ?? "demo" : canTest && savedScope === "test" ? "test" : "live";
  // The page follows the sidebar's account picker (agency; 0 = all accounts). The Owner's
  // Filter > Account can narrow it on this page only; a sidebar switch takes over again.
  const sidebarAccount = isAgencyUser && currentAccountId > 0 ? currentAccountId : undefined;
  const [accountPick, setAccountPick] = useState<number | undefined>(sidebarAccount);
  const accountId = scope === "live" ? accountPick : undefined;
  const { masked, toggle } = usePresenting(isOwner);

  // People and All calls for everyone. First visit opens People, then the last tab used.
  // The old Stats tab moved to the Stats page: a remembered "stats" is not allowed, so it falls back to the last list.
  const tabs = CALLS_TABS;
  // A link to one call opens it: the person (clients) or the call itself (agency).
  const linkTab: CallsTab = isAgencyUser ? "calls" : "people";
  const [view, setView] = useState<CallsTab>(() => (deepLinkCall ? linkTab : readLastTab(LAST_TAB_PAGE, tabs, readLastTab(LAST_LIST_PAGE, tabs, "people"))));
  const activeView: CallsTab = tabs.includes(view) ? view : "people";
  // The list tab the "Calls" back button returns to from Settings.
  const [lastList, setLastList] = useState<CallsTab>(() => view);
  const listView: CallsTab = tabs.includes(lastList) ? lastList : "people";
  // Settings only from a link (?view=settings): the page always opens on the list otherwise. A link to a call wins.
  const [settingsOpen, setSettingsOpen] = useState(() => !deepLinkCall && readSettingsParams(window.location.search).open);
  // Settings: the spot in the topbar, right after the tabs, where the account picker goes.
  const [pickerSlot, setPickerSlot] = useState<HTMLElement | null>(null);
  // Phones: no slot in the header, so the picker keeps its own row above the sections (as on Chats).
  const isPhone = useIsMobile(768);
  const pageView: CallsPageView = settingsOpen ? "settings" : activeView;

  const { data: calls = [], isLoading, error } = useVoiceCalls(scope, accountId);
  const [selection, setSelection] = useState<string | null>(deepLinkCall);
  const callersQuery = useVoiceCallers(scope, accountId, !settingsOpen && activeView === "people");
  const [callerSelection, setCallerSelection] = useState<string | null>(null);
  // A sidebar account switch refreshes the page at once (adjusted during render, so no stale frame).
  const [seenSidebarAccount, setSeenSidebarAccount] = useState(sidebarAccount);
  if (seenSidebarAccount !== sidebarAccount) {
    setSeenSidebarAccount(sidebarAccount);
    setAccountPick(sidebarAccount);
    setSelection(null);
    setCallerSelection(null);
  }
  const [options, setOptionsState] = useState<ListOptions>({ query: "", outcomes: [], statuses: [], languages: [], sort: "recent", group: "date" });
  const setOptions = (patch: Partial<ListOptions>) => setOptionsState((o) => ({ ...o, ...patch }));
  const [peopleOptions, setPeopleOptionsState] = useState<PeopleOptions>(DEFAULT_PEOPLE_OPTIONS);
  const setPeopleOptions = (patch: Partial<PeopleOptions>) => setPeopleOptionsState((o) => ({ ...o, ...patch }));
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

  // Opening a call while the page is already up.
  useEffect(() => {
    const onOpen = (e: Event) => {
      const id = (e as CustomEvent<string>).detail;
      try { localStorage.removeItem("selected-voice-call-id"); } catch { /* ignore */ }
      if (!id) return;
      setDeepLinkCall(id);
      setLinkKey(null);
      setSelection(id);
      setCallerSelection(null);
      setSettingsOpen(false);
      setView(linkTab);
      setLastList(linkTab);
      writeLastTab(LAST_TAB_PAGE, linkTab);
    };
    window.addEventListener(OPEN_VOICE_CALL_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_VOICE_CALL_EVENT, onOpen);
  }, [linkTab]);

  // Accounts seen so far, so the Account filter keeps listing every client after one is picked.
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
  const accounts: AccountOption[] = useMemo(() => {
    const all = new Map(known);
    // An account picked in the sidebar is listed even before its calls have loaded.
    const picked = accountPick != null && !all.has(accountPick) ? workspaceAccounts.find((a) => a.id === accountPick) : undefined;
    if (picked?.name) all.set(picked.id, picked.name);
    return Array.from(all, ([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [known, accountPick, workspaceAccounts]);
  // Account names on the cards only in the all-accounts view.
  const showAccount = isAgencyUser && accountId == null;

  const changeScope = (s: VoiceScope) => {
    setSavedScope(s);
    writePref(SCOPE_KEY, s);
    setSelection(null);
    setCallerSelection(null);
  };
  const changeView = (v: CallsPageView) => {
    if (v === "settings") { setSettingsOpen(true); return; }
    setSettingsOpen(false);
    setView(v);
    writeLastTab(LAST_TAB_PAGE, v);
    setLastList(v);
    writeLastTab(LAST_LIST_PAGE, v);
  };
  const changeAccount = (id: number | undefined) => {
    setAccountPick(id);
    setSelection(null);
    setCallerSelection(null);
  };

  // Desktop: the list's own filters head the list panel. Phones keep them in the topbar.
  const listHead = isPhone ? null : (
    <div className="la-list-head">
      <CallsListTabs tabs={tabs} view={listView} onView={changeView} soft />
    </div>
  );

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <VoiceCallsTopbar
        scope={scope}
        isOwner={isOwner}
        canTest={canTest}
        onScope={changeScope}
        tabs={tabs}
        view={pageView}
        listView={listView}
        onView={changeView}
        options={options}
        setOptions={setOptions}
        peopleOptions={peopleOptions}
        setPeopleOptions={setPeopleOptions}
        languages={languages}
        accounts={accounts}
        accountId={accountId}
        onAccount={changeAccount}
        masked={masked}
        onTogglePresenting={toggle}
        onPickerSlot={setPickerSlot}
      />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {settingsOpen ? (
          <Suspense fallback={<div className="la-page" aria-busy="true" />}>
            {/* The agency's account: the Owner's account filter (Live), else the nav bar's, else a chooser. */}
            <ReceptionistSettings channel="voice" fallbackAccountId={accountId} pickerSlot={isPhone ? undefined : pickerSlot} />
          </Suspense>
        ) : activeView === "people" ? (
          <CallersInbox
            callers={callersQuery.data ?? []}
            calls={calls}
            isLoading={callersQuery.isLoading}
            error={callersQuery.error}
            query={options.query}
            options={peopleOptions}
            scope={scope}
            masked={masked}
            isOwner={isOwner}
            selection={callerSelection}
            setSelection={setCallerSelection}
            accountId={accountId}
            showAccount={showAccount}
            linkedCall={linkKey && deepLinkCall ? { key: linkKey, callId: deepLinkCall } : null}
            head={listHead}
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
            accountId={accountId}
            showAccount={showAccount}
            head={listHead}
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
