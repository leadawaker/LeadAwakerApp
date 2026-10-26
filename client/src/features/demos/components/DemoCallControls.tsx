// A minted voice demo, by phone: "Sara calls now" rings the prospect from the
// demo number with Sara on the line; "Call me + prospect" rings Gabriel's phone
// first (Demos settings), then the prospect, and Sara joins on "Bring Sara in".
// Inline (ProspectDemoPanel) or inside a popover (the sessions table): never a Dialog.
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, PhoneCall, PhoneOff, UserMinus, UserPlus, Users } from "lucide-react";
import { Pill } from "@/components/crm/primitives/Pill";
import {
  endDemoCall, isFinished, setSara, startDemoCall, useDemoCall,
  type DemoCall, type DemoCallMode, type DemoLegStatus,
} from "../api/demoCallsApi";

const INPUT: React.CSSProperties = {
  height: 34,
  width: "100%",
  borderRadius: "var(--r-field, 8px)",
  border: "1px solid var(--line)",
  background: "var(--card)",
  color: "var(--ink)",
  padding: "0 9px",
  fontSize: 13,
};

function legColor(s: DemoLegStatus): string | undefined {
  if (s === "answered") return "var(--good)";
  if (s === "dialing") return "var(--warn)";
  if (s === "failed" || s === "busy" || s === "no_answer" || s === "voicemail") return "hsl(var(--destructive))";
  return undefined;
}

export function DemoCallControls({ token, defaultPhone, locale, voice }: {
  token: string;
  /** The lead's phone when known. */
  defaultPhone?: string;
  locale?: string;
  voice?: string;
}) {
  const { t } = useTranslation("demos");
  const [phone, setPhone] = useState(defaultPhone ?? "");
  // Kept per token for this tab, so closing the table's popover mid-call and opening it again finds the call.
  const [callId, setCallIdState] = useState<string | null>(() => {
    try { return sessionStorage.getItem(`demo-call:${token}`); } catch { return null; }
  });
  const setCallId = (id: string | null) => {
    setCallIdState(id);
    try {
      if (id) sessionStorage.setItem(`demo-call:${token}`, id);
      else sessionStorage.removeItem(`demo-call:${token}`);
    } catch { /* private mode: the call still shows while this stays open */ }
  };
  const [busy, setBusy] = useState<"" | DemoCallMode | "sara" | "end">("");
  const [error, setError] = useState("");
  // The start's answer shows until the first poll lands.
  const [started, setStarted] = useState<DemoCall | null>(null);
  const { data: polled, refetch, isError } = useDemoCall(callId);
  // A remembered call the engine no longer knows (restarted, or long over) is simply gone.
  const lost = isError && !polled;
  const call = lost ? null : polled ?? started;
  const active = !!callId && !lost && !isFinished(call?.status);

  const run = async (what: typeof busy, fn: () => Promise<unknown>) => {
    setBusy(what);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message || t("calls.failed"));
    } finally {
      setBusy("");
    }
  };

  const start = (mode: DemoCallMode) =>
    run(mode, async () => {
      const c = await startDemoCall({
        token, toNumber: phone.trim(), mode,
        ...(locale ? { locale } : {}),
        ...(voice ? { voice } : {}),
      });
      setStarted(c);
      setCallId(c.id);
    });

  const legs: { key: "owner" | "prospect" | "ai"; status: DemoLegStatus }[] = call
    ? [
        ...(call.mode === "bridge" ? [{ key: "owner" as const, status: call.legs?.owner ?? "idle" }] : []),
        { key: "prospect", status: call.legs?.prospect ?? "idle" },
        { key: "ai", status: call.legs?.ai ?? "idle" },
      ]
    : [];

  return (
    <div className="flex flex-col gap-2" data-testid="demo-call-controls">
      {!active ? (
        <>
          <label className="block">
            <span className="mb-1 block" style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>
              {t("calls.phone")}
            </span>
            <input
              style={INPUT}
              inputMode="tel"
              value={phone}
              placeholder={t("calls.phonePlaceholder")}
              onChange={(e) => setPhone(e.target.value)}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="la-btn la-btn--primary"
              disabled={!phone.trim() || !!busy}
              onClick={() => void start("sara")}
            >
              {busy === "sara" ? <Loader2 size={13} className="animate-spin" /> : <PhoneCall size={13} />}
              {t("calls.saraCalls")}
            </button>
            <button
              type="button"
              className="la-btn la-btn--soft"
              disabled={!phone.trim() || !!busy}
              onClick={() => void start("bridge")}
            >
              {busy === "bridge" ? <Loader2 size={13} className="animate-spin" /> : <Users size={13} />}
              {t("calls.callMe")}
            </button>
          </div>
          <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("calls.hint")}</span>
        </>
      ) : null}

      {call && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
            {t(`calls.status.${call.status}`, { defaultValue: call.status })}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {legs.map((l) => (
              <Pill key={l.key} color={legColor(l.status)}>
                {t(`calls.legs.${l.key}`)}: {t(`calls.leg.${l.status}`)}
              </Pill>
            ))}
          </div>
          {call.error && <span style={{ fontSize: 11, color: "hsl(var(--destructive))" }}>{call.error}</span>}
          {active ? (
            <div className="flex flex-wrap gap-2">
              {call.mode === "bridge" && (
                <button
                  type="button"
                  className="la-btn la-btn--soft"
                  disabled={!!busy || call.legs?.prospect !== "answered"}
                  onClick={() => void run("sara", async () => {
                    await setSara(call.id, call.sara_in ? "leave" : "join");
                    await refetch();
                  })}
                >
                  {busy === "sara" ? <Loader2 size={13} className="animate-spin" /> : call.sara_in ? <UserMinus size={13} /> : <UserPlus size={13} />}
                  {call.sara_in ? t("calls.saraOut") : t("calls.saraIn")}
                </button>
              )}
              <button
                type="button"
                className="la-btn la-btn--soft"
                style={{ color: "hsl(var(--destructive))" }}
                disabled={busy === "end"}
                onClick={() => void run("end", async () => {
                  await endDemoCall(call.id);
                  await refetch();
                })}
              >
                {busy === "end" ? <Loader2 size={13} className="animate-spin" /> : <PhoneOff size={13} />}
                {t("calls.end")}
              </button>
            </div>
          ) : (
            <button type="button" className="la-btn la-btn--soft" style={{ alignSelf: "flex-start" }} onClick={() => { setCallId(null); setStarted(null); }}>
              {t("calls.again")}
            </button>
          )}
        </div>
      )}

      {error && <span style={{ fontSize: 11, color: "hsl(var(--destructive))" }}>{error}</span>}
    </div>
  );
}
