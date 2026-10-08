/**
 * Read-only view of a LIVE persona (specs/voice-tab).
 *
 * A live persona belongs to a real client's phone line and is generated from
 * that account, so it is edited in Account > Voice, never here. Showing it
 * read-only (instead of hiding it) lets Gabriel see which personas are live
 * without a demo edit being able to change a client's calls.
 */
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { ArrowLeft, ExternalLink, Lock } from "lucide-react";
import { formatClientTitle, type DemoLang, type EditableDemoClient } from "../../api/demoClientsApi";

const FIELDS = [
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp" },
  { field: "descriptionTemplate", labelKey: "clients.fields.description" },
] as const;

const LANGS: DemoLang[] = ["en", "nl", "pt"];
const ACCOUNT_SELECTION_KEY = "selected-account-id";

/** Opens Account > Voice, pre-selecting the persona's account when it is known. */
export function useOpenAccountVoice(accountsId?: number | null) {
  const [, navigate] = useLocation();
  return () => {
    if (accountsId) {
      try { localStorage.setItem(ACCOUNT_SELECTION_KEY, String(accountsId)); } catch { /* storage blocked */ }
    }
    navigate("/platform/accounts?tab=voice");
  };
}

export function LiveClientView({ client, onBack }: { client: EditableDemoClient; onBack: () => void }) {
  const { t } = useTranslation("campaigns");
  const openVoice = useOpenAccountVoice(client.accountsId);
  const lang = LANGS.find((l) => FIELDS.some(({ field }) => (client.text[field]?.[l] ?? "").trim())) ?? "en";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22, paddingBottom: 40 }} data-testid="live-client-view">
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <button className="la-btn la-btn--soft la-btn--icon" onClick={onBack} title={t("clients.back", "Back")}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div style={{ flex: 1, minWidth: 180 }}>
          <div className="eyebrow wine">{t("clients.editing", "Persona")}</div>
          <div className="serif italic" style={{ fontSize: 26, color: "var(--ink)", lineHeight: 1.25 }}>
            {formatClientTitle(client)}
          </div>
        </div>
      </div>

      <div className="neu-inset" style={{ borderRadius: "var(--r-card)", padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
        <span style={{ color: "var(--wine)", display: "flex", marginTop: 2 }}><Lock size={17} /></span>
        <div style={{ flex: 1, minWidth: 220 }}>
          <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--ink-soft)" }}>{t("clients.live.title")}</div>
          <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "4px 0 0", lineHeight: 1.5 }}>{t("clients.live.note")}</p>
        </div>
        <button type="button" className="la-btn la-btn--wine" onClick={openVoice}>
          <ExternalLink size={13} />{t("clients.live.open")}
        </button>
      </div>

      <section className="neu-raised" style={{ padding: 22, borderRadius: "var(--r-card)" }}>
        <div className="eyebrow wine" style={{ marginBottom: 14 }}>{t("clients.personaTitle", "Persona")}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {FIELDS.map(({ field, labelKey }) => (
            <div key={field}>
              <div className="eyebrow eyebrow-sm" style={{ marginBottom: 6 }}>{t(labelKey)}</div>
              <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                {client.text[field]?.[lang] || <span style={{ color: "var(--mute-2)" }}>{"—"}</span>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
