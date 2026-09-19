import { useTranslation } from "react-i18next";
import { statusColors, type VoiceCallStatus } from "../status";

/** Initials for the list/detail avatar; falls back to the "Web caller" label. */
export function callerInitials(name: string | null, fallback: string): string {
  const words = (name || fallback).trim().split(/\s+/).filter(Boolean);
  const ini = words.slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
  return ini || "?";
}

/** Same shape as the Missed Calls status pill, for the "Booked" state. */
export function BookedPill({ small }: { small?: boolean }) {
  const { t } = useTranslation("voiceCalls");
  return (
    <span
      style={{
        display: "inline-flex", alignItems: "center", gap: 6, flexShrink: 0,
        fontFamily: "var(--mono)", fontSize: small ? 8 : 9, fontWeight: 700,
        letterSpacing: "0.12em", textTransform: "uppercase",
        padding: small ? "2px 7px" : "3px 9px", borderRadius: "var(--r-pill)",
        color: "var(--good)", background: "var(--good-tint)",
      }}
    >
      <span style={{ width: 5, height: 5, borderRadius: "50%", background: "var(--good)" }} />
      {t("booked")}
    </span>
  );
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
