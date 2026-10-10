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
import type { ReactNode } from "react";
import { BookOpenText, ExternalLink, Lock } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { EditableDemoClient } from "../../api/demoClientsApi";
import { ClientPanelHeader } from "./ClientPanelHeader";
import { ClientSection } from "./ClientSection";
import { LANGS } from "./clientDisplay";

const FIELDS = [
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp" },
  { field: "descriptionTemplate", labelKey: "clients.fields.description" },
] as const;

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

export function LiveClientView({ client, onBack, actions }: {
  client: EditableDemoClient;
  onBack: () => void;
  actions?: ReactNode;
}) {
  const { t } = useTranslation("campaigns");
  const openVoice = useOpenAccountVoice(client.accountsId);
  const lang = LANGS.find((l) => FIELDS.some(({ field }) => (client.text[field]?.[l] ?? "").trim())) ?? "en";

  return (
    <>
      <ClientPanelHeader client={client} category={client.category} actions={actions} onBack={onBack} />

      <div className="dp-panel-body" data-testid="live-client-view">
        <div className="dp-panel-inner">
          <SectionCard style={{ padding: "16px 18px", display: "flex", gap: 14, alignItems: "flex-start", flexWrap: "wrap" }}>
            <span className="am-icon-tile"><Lock className="h-4 w-4" /></span>
            <div style={{ flex: 1, minWidth: 220 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--ink)" }}>{t("clients.live.title")}</div>
              <p style={{ fontSize: 12.5, color: "var(--mute)", margin: "3px 0 0", lineHeight: 1.5 }}>{t("clients.live.note")}</p>
            </div>
            <button type="button" className="la-btn la-btn--wine" onClick={openVoice}>
              <ExternalLink size={13} />{t("clients.live.open")}
            </button>
          </SectionCard>

          <ClientSection icon={BookOpenText} title={t("clients.personaTitle", "Persona")}>
            <div className="dp-fields">
              {FIELDS.map(({ field, labelKey }) => (
                <div key={field}>
                  <div className="dp-label">{t(labelKey)}</div>
                  <div style={{ fontSize: 13.5, color: "var(--ink-soft)", lineHeight: 1.5, whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>
                    {client.text[field]?.[lang] || <span style={{ color: "var(--mute-2)" }}>{t("clients.live.blank")}</span>}
                  </div>
                </div>
              ))}
            </div>
          </ClientSection>
        </div>
      </div>
    </>
  );
}
