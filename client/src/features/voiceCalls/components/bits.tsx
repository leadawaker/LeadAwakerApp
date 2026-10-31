import { useTranslation } from "react-i18next";
import { useIsMobile } from "@/hooks/useIsMobile";
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

/** A flat round icon action (the lead panel's header). */
export const ROUND_ACTION: React.CSSProperties = { width: 36, height: 36, padding: 0, borderRadius: "50%", background: "var(--bg)", boxShadow: "none" };

/** WhatsApp's own mark: `lucide-react` has none. */
export function WhatsAppIcon({ size = 16 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

/** List-row type scale (Calls and Chats rows, WhatsApp-like): 40px avatar (46px on phones), bold sans name, readable meta. */
export const ROW_AVATAR = 40;
export const ROW_AVATAR_MOBILE = 46;

/** The Calls row avatar size for this screen: ROW_AVATAR on desktop, ROW_AVATAR_MOBILE on phones. */
export function useRowAvatar(): number {
  return useIsMobile(768) ? ROW_AVATAR_MOBILE : ROW_AVATAR;
}
export const ROW_NAME: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 15.5, fontWeight: 700, color: "var(--ink)", letterSpacing: "-0.005em" };
export const ROW_META: React.CSSProperties = { fontSize: 13.5, lineHeight: 1.4, color: "var(--mute)" };
export const ROW_TIME: React.CSSProperties = { fontFamily: "var(--sans)", fontSize: 12, color: "var(--mute-2)", fontVariantNumeric: "tabular-nums" };

// Neumorphic depth turned down: on the bone ground the full-strength cast
// reads too dark and the highlight disappears (Gabriel, 2026-10-15).
export const SOFT_RAISED = { "--light-strength": 0.55 } as React.CSSProperties;
