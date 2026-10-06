import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { AudioLines } from "lucide-react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useVoiceCalls, useVoiceCapabilities, type VoiceCapabilities, type VoiceScope } from "../api/voiceCallsApi";
import type { AccountOption } from "../components/AccountFilter";
import { StatsStrip } from "../components/StatsStrip";
import { VoiceCallsInbox } from "../components/VoiceCallsInbox";
import { VoiceCallsTopbar } from "../components/VoiceCallsTopbar";
import type { ListOptions } from "../listOptions";
import { readPref, writePref } from "../localPref";
import { usePresenting } from "../usePresenting";

const SCOPE_KEY = "la.voiceCalls.scope";

function initialScope(): VoiceScope | null {
  const saved = readPref(SCOPE_KEY);
  return saved === "live" || saved === "demo" ? saved : null;
}

function VoiceCallsContent({ capabilities }: { capabilities: VoiceCapabilities }) {
  // The server decides: only an Owner (not impersonating) gets `demo`.
  const isOwner = capabilities.demo;
  const [savedScope, setSavedScope] = useState<VoiceScope | null>(initialScope);
  const scope: VoiceScope = isOwner ? savedScope ?? "demo" : "live";
  const [accountPick, setAccountPick] = useState<number | undefined>(undefined);
  const accountId = scope === "live" ? accountPick : undefined;
  const { masked, toggle } = usePresenting(isOwner);

  const { data: calls = [], isLoading, error } = useVoiceCalls(scope, accountId);
  const [selection, setSelection] = useState<string | null>(null);
  const [options, setOptionsState] = useState<ListOptions>({ query: "", outcomes: [], statuses: [], languages: [], sort: "recent", group: "date" });
  const setOptions = (patch: Partial<ListOptions>) => setOptionsState((o) => ({ ...o, ...patch }));
  const languages = useMemo(() => Array.from(new Set(calls.map((c) => c.language ?? ""))).sort(), [calls]);

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
  };
  const changeAccount = (id: number | undefined) => {
    setAccountPick(id);
    setSelection(null);
  };

  return (
    <div className="la-page" style={{ display: "flex", flexDirection: "column" }}>
      <VoiceCallsTopbar
        scope={scope}
        isOwner={isOwner}
        onScope={changeScope}
        options={options}
        setOptions={setOptions}
        languages={languages}
        accounts={accounts}
        accountId={accountId}
        onAccount={changeAccount}
        masked={masked}
        onTogglePresenting={toggle}
      />

      <StatsStrip scope={scope} accountId={accountId} />

      <div style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
