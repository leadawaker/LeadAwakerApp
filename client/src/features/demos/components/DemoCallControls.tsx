// A minted voice demo, by phone: "Sara calls now" rings the prospect from the
// demo number with Sara on the line; "Call me + prospect" rings Gabriel's phone
// first (Demos settings), then the prospect. In its handoff style (the default)
// "Hand to Sara" swaps him for Sara and "Take the call back" swaps back; in a
// three-way style Sara joins on "Bring Sara in". Sara's conversation shows live.
// "Call me" can ring this browser instead of the phone (lib/browserPhone.ts).
// Inside a popover (the sessions table link actions): never a Dialog.
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { Loader2, Mic, MicOff, PhoneCall, PhoneOff, UserMinus, UserPlus, Users } from "lucide-react";
import { Pill } from "@/components/crm/primitives/Pill";
import {
  endDemoCall, isCallGone, isFinished, setSara, startDemoCall, useDemoCall,
  type DemoCall, type DemoCallMode, type DemoCallRing, type DemoLegStatus, type DemoTurn,
} from "../api/demoCallsApi";
import { hangUpBrowserPhone, readyBrowserPhone, toggleBrowserMute, useBrowserPhone } from "../lib/browserPhone";
import { Seg } from "./engineControls";

const RING_KEY = "demo-call:ring";

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

/** The engine's error code as a sentence; unknown codes get the generic line. */
function errorText(t: TFunction, has: (key: string) => boolean, code: string): string {
  if (has(`calls.errors.${code}`)) return t(`calls.errors.${code}`);
  // Leg codes the engine builds as `${leg}_${outcome}` (prospect_failed, owner_busy, owner_dial_failed, ...).
  const leg = /^(owner|prospect|sara)_(dial_failed|join_failed|failed|busy|no_answer)$/.exec(code);
  if (leg) return t(`calls.errors.leg_${leg[2]}`, { who: t(`calls.legs.${leg[1] === "sara" ? "ai" : leg[1]}`) });
  return t("calls.errors.generic");
}

function legColor(s: DemoLegStatus): string | undefined {
  if (s === "answered") return "var(--good)";
  if (s === "dialing") return "var(--warn)";
  if (s === "failed" || s === "busy" || s === "no_answer" || s === "voicemail") return "hsl(var(--destructive))";
  return undefined;
}

/** Sara's conversation as it happens, newest at the bottom (kept in view while it grows). */
function LiveTranscript({ turns, live }: { turns: DemoTurn[]; live: boolean }) {
  const { t } = useTranslation("demos");
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [turns.length]);
  return (
    <div className="flex flex-col gap-1">
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("calls.transcript")}</span>
      <div
        ref={box}
        className="neu-inset flex flex-col gap-1.5"
        style={{ maxHeight: 220, overflowY: "auto", borderRadius: "var(--r-field, 8px)", padding: "8px 10px" }}
        aria-live={live ? "polite" : "off"}
      >
        {turns.length === 0 ? (
          <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("calls.transcriptEmpty")}</span>
        ) : turns.map((turn, i) => (
          <p key={i} style={{ margin: 0, fontSize: 12, lineHeight: 1.45, color: "var(--ink)" }}>
            <span style={{ fontWeight: 600, color: turn.who === "sara" ? "var(--wine)" : "var(--mute)" }}>
              {t(`calls.legs.${turn.who === "sara" ? "ai" : "prospect"}`)}:
            </span>{" "}
            {turn.text}
          </p>
        ))}
      </div>
    </div>
  );
}

export function DemoCallControls({ token, defaultPhone, locale, voice }: {
  token: string;
  /** The lead's phone when known. */
  defaultPhone?: string;
  locale?: string;
  voice?: string;
}) {
  const { t, i18n } = useTranslation("demos");
  const hasKey = (key: string) => i18n.exists(key, { ns: "demos" });
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
  // Where "Call me" rings, remembered for this browser.
  const [ring, setRingState] = useState<DemoCallRing>(() => {
    try { return localStorage.getItem(RING_KEY) === "browser" ? "browser" : "phone"; } catch { return "phone"; }
  });
  const setRing = (r: DemoCallRing) => {
    setRingState(r);
    try { localStorage.setItem(RING_KEY, r); } catch { /* not remembered: still used for this call */ }
  };
  const browser = useBrowserPhone();
  const [error, setError] = useState("");
  // The start's answer shows until the first poll lands.
  const [started, setStarted] = useState<DemoCall | null>(null);
  // Set when the engine forgot the call (a 404): the start form shows again with a note.
  const [gone, setGone] = useState(false);
  const { data: polled, refetch, isError, error: pollError } = useDemoCall(callId);
  // React-query keeps the last data after an error, so a 404 must clear the call
  // itself, or the stale "live" state (and the stored id) would stay forever.
  const forget = () => { setCallId(null); setStarted(null); setGone(true); };
  useEffect(() => {
    if (callId && isCallGone(pollError)) forget();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pollError, callId]);
  // Any other failure before the first answer: nothing to show yet.
  const lost = isError && !polled;
  const call = lost ? null : polled ?? started;
  const active = !!callId && !lost && !isFinished(call?.status);
  // The call is over (or forgotten): this browser's line goes with it.
  useEffect(() => {
    if (!active && browser.state !== "idle" && busy !== "bridge") hangUpBrowserPhone();
  }, [active, browser.state, busy]);

  const run = async (what: typeof busy, fn: () => Promise<unknown>) => {
    setBusy(what);
    setError("");
    try {
      await fn();
    } catch (e) {
      // End or Sara on a call the engine forgot: the call is over, not an error.
      // (A start's 404 is an unknown demo token and stays an error.)
      if (active && isCallGone(e)) forget();
      else setError((e as Error).message || t("calls.failed"));
    } finally {
      setBusy("");
    }
  };

  const start = (mode: DemoCallMode) =>
    run(mode, async () => {
      const inBrowser = mode === "bridge" && ring === "browser";
      if (inBrowser) await readyBrowserPhone({ mic: t("calls.browser.micDenied"), login: t("calls.browser.loginFailed") });
      let c: DemoCall;
      try {
        c = await startDemoCall({
          token, toNumber: phone.trim(), mode,
          ...(inBrowser ? { ring: "browser" as const } : {}),
          ...(locale ? { locale } : {}),
          ...(voice ? { voice } : {}),
        });
      } catch (e) {
        if (inBrowser) hangUpBrowserPhone();
        throw e;
      }
      setGone(false);
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
          <div className="flex flex-col gap-1">
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--mute)" }}>{t("calls.ring.label")}</span>
            <Seg<DemoCallRing>
              value={ring}
              options={["phone", "browser"]}
              label={(o) => t(`calls.ring.${o}`)}
              ariaLabel={t("calls.ring.label")}
              onChange={setRing}
            />
          </div>
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
          {gone && <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("calls.gone")}</span>}
          <span style={{ fontSize: 11, color: "var(--mute)" }}>{t("calls.hint")}</span>
        </>
      ) : null}

      {call && (
        <div className="flex flex-col gap-2" aria-live="polite">
          <span style={{ fontSize: 12, fontWeight: 600, color: "var(--ink)" }}>
            {t(`calls.status.${call.status}`, { defaultValue: call.status })}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {legs.map((l) => {
              const onHold = l.key === "owner" && !!call.owner_on_hold && l.status === "answered";
              return (
                <Pill key={l.key} color={onHold ? "var(--warn)" : legColor(l.status)}>
                  {t(`calls.legs.${l.key}`)}: {t(`calls.leg.${onHold ? "on_hold" : l.status}`)}
                </Pill>
              );
            })}
          </div>
          {call.ring === "browser" && active && (
            <div className="flex flex-wrap items-center gap-2">
              <Pill color={browser.state === "active" ? "var(--good)" : browser.state === "idle" ? "hsl(var(--destructive))" : "var(--warn)"}>
                {t("calls.browser.label")}: {t(`calls.browser.state.${browser.state}`)}
              </Pill>
              {browser.state === "active" && (
                <button type="button" className="la-btn la-btn--soft" onClick={toggleBrowserMute} aria-pressed={browser.muted}>
                  {browser.muted ? <MicOff size={13} /> : <Mic size={13} />}
                  {browser.muted ? t("calls.browser.unmute") : t("calls.browser.mute")}
                </button>
              )}
            </div>
          )}
          {call.error && <span style={{ fontSize: 11, color: "hsl(var(--destructive))" }}>{errorText(t, hasKey, call.error)}</span>}
          {(call.sara_in || (call.transcript?.length ?? 0) > 0) && (
            <LiveTranscript turns={call.transcript ?? []} live={active} />
          )}
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
                  {call.style === "handoff"
                    ? (call.sara_in ? t("calls.takeBack") : t("calls.handTo"))
                    : (call.sara_in ? t("calls.saraOut") : t("calls.saraIn"))}
                </button>
              )}
              <button
                type="button"
                className="la-btn la-btn--soft"
                style={{ color: "hsl(var(--destructive))" }}
                disabled={busy === "end"}
                onClick={() => void run("end", async () => {
                  hangUpBrowserPhone();
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
