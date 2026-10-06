import { useTranslation } from "react-i18next";
import { maskName, maskNumber } from "../maskIdentity";
import { statusColors, type VoiceCallStatus } from "../status";

/** Initials for the list/detail avatar; falls back to the "Web caller" label. */
export function callerInitials(name: string | null, fallback: string): string {
  const words = (name || fallback).trim().split(/\s+/).filter(Boolean);
  const ini = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return ini || "?";
}

type Caller = { callerName: string | null; callerNumber: string | null };

/**
 * Presenting mode, applied once at the render edge: the same call with the
 * caller's name and number masked, so title, initials and number chips all stay
 * consistent. Not masked: transcript text and audio (documented on the toggle).
 */
export function maskCaller<T extends Caller>(call: T, masked: boolean): T {
  if (!masked) return call;
  return { ...call, callerName: maskName(call.callerName), callerNumber: maskNumber(call.callerNumber) };
}

/** Who called: the name they gave, else the number they rang from. */
export function callerTitle(call: Caller, fallback: string): string {
  return call.callerName || call.callerNumber || fallback;
}

/** Avatar text: initials of the name, else the number's last two digits. */
export function callerIni(call: Caller, fallback: string): string {
  if (call.callerName) return callerInitials(call.callerName, fallback);
  const tail = (call.callerNumber || "").replace(/\D/g, "").slice(-2);
  return tail || callerInitials(null, fallback);
}

/** Caller avatar tinted by what the call amounted to, in the Chats palette. */
export function CallAvatar({ ini, status, size = 38, radius }: { ini: string; status: VoiceCallStatus; size?: number; radius?: number }) {
  const { t } = useTranslation("voiceCalls");
  const c = statusColors(status);
  return (
    <div
      title={t(`status.${status}`)}
      style={{ width: size, height: size, borderRadius: radius ?? Math.round(size * 0.28), flexShrink: 0, background: c.bg, color: c.text, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--mono)", fontWeight: 700, fontSize: Math.round(size * 0.34), boxShadow: "var(--sh-raised-crisp)" }}
    >
      {ini}
    </div>
  );
}
