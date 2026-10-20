import { useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, Sparkles } from "lucide-react";
import { LeadSummaryCard } from "./LeadSummaryCard";

/** The AI summary folded above a conversation (C10): one tap opens it, the chat stays in view. */
export function CollapsedSummary({ lead, status }: { lead: Record<string, any>; status?: string }) {
  const { t } = useTranslation("leads");
  const [open, setOpen] = useState(false);
  return (
    <div style={{ flexShrink: 0, padding: "8px 12px 0" }} data-testid="collapsed-summary">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="la-hit"
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 8, border: "none", cursor: "pointer",
          padding: "8px 12px", borderRadius: "var(--r-surface)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)",
          fontSize: 13, fontWeight: 600, color: "var(--ink)",
        }}
      >
        <Sparkles size={14} style={{ color: "var(--wine)", flexShrink: 0 }} />
        <span style={{ flex: 1, textAlign: "left" }}>{t("chat.aiSummary")}</span>
        {open ? <ChevronDown size={15} style={{ color: "var(--mute)" }} /> : <ChevronRight size={15} style={{ color: "var(--mute)" }} />}
      </button>
      {open && (
        <div style={{ maxHeight: "45vh", overflowY: "auto", marginTop: 8 }}>
          <LeadSummaryCard lead={lead} status={status} hideHeader />
        </div>
      )}
    </div>
  );
}
