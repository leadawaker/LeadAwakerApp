/**
 * Read-only view of a LIVE persona (specs/voice-tab).
 *
 * A live persona belongs to a real client's phone line and is generated from
 * that account, so it is edited in Calls > Settings, never here. Showing it
 * read-only (instead of hiding it) lets Gabriel see which personas are live
 * without a demo edit being able to change a client's calls.
 */
import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { receptionistSettingsHref } from "@/features/accounts/components/workspace/receptionist/settingsLink";
import { BookOpenText, ExternalLink, Lock } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { EditableDemoClient } from "../../api/demoClientsApi";
import { ClientPanelHeader } from "./ClientPanelHeader";
import { EditorViewSwitch } from "./EditorViewSwitch";
import { ClientSection } from "./ClientSection";
import { LANGS } from "./clientDisplay";

const FIELDS = [
  { field: "companyNameTemplate", labelKey: "clients.fields.companyName" },
  { field: "nicheLabel", labelKey: "clients.fields.nicheLabel" },
  { field: "serviceName", labelKey: "clients.fields.serviceName" },
  { field: "usp", labelKey: "clients.fields.usp" },
  { field: "descriptionTemplate", labelKey: "clients.fields.description" },
] as const;

/** Opens Calls > Settings (the phone receptionist's settings) on the persona's account when it is known. */
export function useOpenAccountVoice(accountsId?: number | null) {
  const [, navigate] = useLocation();
  return () => navigate(receptionistSettingsHref("voice", { accountId: accountsId ?? undefined }));
}

export function LiveClientView({ client, onBack, actions, leadingView }: {
  client: EditableDemoClient;
  onBack: () => void;
  actions?: ReactNode;
  /** A first view before the read-only persona (the Demos page's "Demos" tab). Selected whenever a persona opens. */
  leadingView?: { label: string; content: ReactNode };
}) {
  const { t } = useTranslation("campaigns");
  const [view, setView] = useState<"lead" | "persona">(leadingView ? "lead" : "persona");
  useEffect(() => { if (leadingView) setView("lead"); }, [client.niche]);
  const openVoice = useOpenAccountVoice(client.accountsId);
  const lang = LANGS.find((l) => FIELDS.some(({ field }) => (client.text[field]?.[l] ?? "").trim())) ?? "en";

  return (
    <>
      <ClientPanelHeader client={client} category={client.category} actions={actions} onBack={onBack}>
        {leadingView && (
          <EditorViewSwitch
            views={[{ id: "lead" as const, label: leadingView.label }, { id: "persona" as const, label: t("clients.views.persona") }]}
            value={view}
            onChange={setView}
            label={t("clients.viewsLabel")}
          />
        )}
      </ClientPanelHeader>

      <div className="dp-panel-body" data-testid="live-client-view">
        {leadingView && <div className="dp-panel-inner dp-panel-inner--wide" hidden={view !== "lead"}>{leadingView.content}</div>}
        <div className="dp-panel-inner" hidden={!!leadingView && view !== "persona"}>
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
