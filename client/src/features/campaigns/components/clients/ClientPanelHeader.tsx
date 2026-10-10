import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, UserRound, X } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { clientNames } from "./clientDisplay";
import "@/features/automation/automation.css";
import "./clients.css";

type HeaderClient = Pick<DemoClientSummary, "id" | "niche" | "label" | "companyName" | "emoji" | "isLive">;

/**
 * Top of the persona panel, shared by the editor and the read-only live view:
 * who this is, where it is filed, and the way out. The back arrow and the
 * close button do the same thing; CSS shows one or the other depending on
 * whether the list is still visible beside the panel.
 */
export function ClientPanelHeader({ client, category, status, actions, onBack, children }: {
  client: HeaderClient;
  /** Shown in the meta line. Passed separately so the editor can show its unsaved draft value. */
  category?: string | null;
  /** Save state, in the meta line. */
  status?: ReactNode;
  actions?: ReactNode;
  onBack: () => void;
  /** A second row under the title (the editor's section switch). */
  children?: ReactNode;
}) {
  const { t } = useTranslation("campaigns");
  const { title, sub } = clientNames(client);

  return (
    <div className="dp-panel-head">
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <IconBtn className="dp-back" onClick={onBack} title={t("clients.back", "Back")} aria-label={t("clients.back", "Back")}>
          <ArrowLeft className="h-4 w-4" />
        </IconBtn>
        <span className="am-icon-tile dp-head-tile" aria-hidden>
          {client.emoji ? <span className="dp-emoji">{client.emoji}</span> : <UserRound className="h-4 w-4" />}
        </span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="dp-title-line" style={{ flexWrap: "wrap", rowGap: 4 }}>
            <span className="serif dp-panel-title">{title}</span>
            {client.isLive && <span className="dp-live">{t("clients.live.badge")}</span>}
          </div>
          {sub && <div className="dp-panel-sub" title={sub}>{sub}</div>}
          <div className="am-mono" style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px", marginTop: 8, whiteSpace: "normal" }}>
            <span>#{client.id}</span>
            <span>{(category ?? "").trim() || t("clients.noCategory", "Uncategorized")}</span>
            {status}
          </div>
        </div>
        {actions}
        <IconBtn className="dp-close" onClick={onBack} title={t("clients.close", "Close")} aria-label={t("clients.close", "Close")}>
          <X className="h-4 w-4" />
        </IconBtn>
      </div>
      {children}
    </div>
  );
}
