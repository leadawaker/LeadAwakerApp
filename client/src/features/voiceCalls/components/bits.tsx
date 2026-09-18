import { useTranslation } from "react-i18next";

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

/** Raised card used for the Booked / Conclusion / Summary blocks. */
export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="neu-raised"
      style={{ borderRadius: "var(--r-surface)", background: "var(--card)", padding: "12px 14px" }}
    >
      {children}
    </div>
  );
}
