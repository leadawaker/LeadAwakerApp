import { useTranslation } from "react-i18next";
import { ArrowRight, Phone } from "lucide-react";
import { callLength, type ThreadCall } from "./threadCalls";

/** One call inside a chat thread: "Call · 2:05 · Open", opening it on the Calls page (C2). */
export function ThreadCallLine({ call, onOpen }: { call: ThreadCall; onOpen: () => void }) {
  const { t } = useTranslation("leads");
  const length = callLength(call);
  const time = call.startedAt ? new Date(call.startedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
  return (
    <div className="flex justify-center my-2" data-testid="thread-call-line">
      <button
        type="button"
        onClick={onOpen}
        className="la-hit inline-flex items-center gap-2"
        style={{
          padding: "6px 12px", borderRadius: "var(--r-pill)", border: "none", cursor: "pointer",
          background: "var(--card)", boxShadow: "var(--sh-raised-crisp)",
          fontSize: 12, color: "var(--ink-soft)",
        }}
      >
        <Phone size={13} style={{ color: "var(--wine)", flexShrink: 0 }} />
        <span style={{ fontWeight: 600, color: "var(--ink)" }}>{t("chat.callLine")}</span>
        {length && <span className="tabular-nums">· {length}</span>}
        {time && <span className="tabular-nums" style={{ color: "var(--mute)" }}>· {time}</span>}
        <span style={{ display: "inline-flex", alignItems: "center", gap: 3, color: "var(--wine)", fontWeight: 600 }}>
          · {t("chat.openCall")}<ArrowRight size={12} />
        </span>
      </button>
    </div>
  );
}
