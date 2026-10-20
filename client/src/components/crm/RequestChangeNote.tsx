import { useTranslation } from "react-i18next";
import { openFounderChat } from "@/lib/founderChat";

/** Replaces the old read-only banners: says Lead Awaker looks after this, and opens the founder chat with a draft. */
export function RequestChangeNote({ area }: { area: string }) {
  const { t } = useTranslation("crm");
  return (
    <div
      className="neu-inset-super-crisp"
      style={{ borderRadius: "var(--r-surface)", padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}
    >
      <p style={{ margin: 0, fontSize: 12.5, color: "var(--mute)" }}>{t("requestChange.note")}</p>
      <button type="button" className="la-btn la-btn--soft" onClick={() => openFounderChat(t("requestChange.draft", { area }))}>
        {t("requestChange.button")}
      </button>
    </div>
  );
}
