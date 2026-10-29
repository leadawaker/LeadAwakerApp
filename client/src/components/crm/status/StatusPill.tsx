import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives";
import { STATUS_TONE, type StatusKey } from "./statusPill";

export * from "./statusPill";

/**
 * The one status pill for calls, people and chats. A light wash of the stage
 * colour with a faint ring; the quiet statuses (hung up) sit recessed instead.
 * `detail` rides inside the pill ("Booked · Thu 14:30"). `bare`: no dot and
 * smaller text, for dense list cards (the Calls list).
 */
export function StatusPill({ status, detail, small, prefix, bare }: { status: StatusKey; detail?: string | null; small?: boolean; prefix?: string; bare?: boolean }) {
  const { t } = useTranslation("crm");
  const tone = STATUS_TONE[status];
  const text = tone ? `color-mix(in srgb, ${tone} 78%, var(--ink))` : "var(--mute)";
  return (
    <Pill
      data-testid="status-pill"
      data-status={status}
      style={{
        gap: bare ? 4 : 6, flexShrink: 0,
        background: tone ? `color-mix(in srgb, ${tone} 13%, transparent)` : "var(--bg)",
        color: text,
        boxShadow: tone ? `inset 0 0 0 1px color-mix(in srgb, ${tone} 35%, transparent)` : "var(--sh-inset-super-crisp)",
        fontFamily: "var(--mono)", fontSize: bare ? 8 : small ? 9 : 10, fontWeight: 700,
        letterSpacing: bare ? "0.08em" : "0.1em", textTransform: "uppercase",
        padding: bare ? "3px 7px" : small ? "4px 8px" : "5px 10px",
      }}
    >
      {!bare && <span style={{ width: 6, height: 6, borderRadius: "50%", background: text, flexShrink: 0 }} />}
      {prefix && <span>{`${prefix} ·`}</span>}
      {t(`statusPill.${status}`)}
      {detail && <span style={{ fontWeight: 600, letterSpacing: "0.04em" }}>{`· ${detail}`}</span>}
    </Pill>
  );
}

/** Small wine marker while something waits on the client: a callback asked for, or a chat waiting for a reply. */
export function NeedsYouMarker({ small }: { small?: boolean }) {
  const { t } = useTranslation("crm");
  return (
    <span
      data-testid="needs-you"
      style={{
        display: "inline-flex", alignItems: "center", gap: 5, flexShrink: 0,
        fontFamily: "var(--mono)", fontSize: small ? 9 : 10, fontWeight: 700, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--wine)", whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--wine)", boxShadow: "0 0 0 3px var(--wine-tint)" }} />
      {t("statusPill.needsYou")}
    </span>
  );
}
