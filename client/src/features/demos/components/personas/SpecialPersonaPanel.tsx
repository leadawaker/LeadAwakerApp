import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Globe, UserX, X } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { WEBSITE_KEY, type SpecialKey } from "../../personaDemos";
import "@/features/automation/automation.css";
import "@/features/campaigns/components/clients/clients.css";

/**
 * The right-hand panel of the No persona and Website visitors cards: the header of a persona
 * panel (ClientPanelHeader) without a persona, and a body that holds the Demos table alone.
 * The back arrow and the close button do the same thing; clients.css shows one of them.
 */
export function SpecialPersonaPanel({ kind, onBack, children }: { kind: SpecialKey; onBack: () => void; children: ReactNode }) {
  const { t } = useTranslation("demos");
  const { t: tc } = useTranslation("campaigns");
  const website = kind === WEBSITE_KEY;
  const Icon = website ? Globe : UserX;

  return (
    <>
      <div className="dp-panel-head">
        <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
          <IconBtn className="dp-back" onClick={onBack} title={tc("clients.back")} aria-label={tc("clients.back")}>
            <ArrowLeft className="h-4 w-4" />
          </IconBtn>
          <span className="am-icon-tile dp-head-tile" aria-hidden>
            <Icon className="h-4 w-4" />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="dp-title-line" style={{ flexWrap: "wrap", rowGap: 4 }}>
              <span className="serif dp-panel-title">{t(website ? "merge.special.website" : "merge.special.noPersona")}</span>
            </div>
            <div className="dp-panel-sub">{t(website ? "merge.special.websiteSub" : "merge.special.noPersonaSub")}</div>
          </div>
          <IconBtn className="dp-close" onClick={onBack} title={tc("clients.close")} aria-label={tc("clients.close")}>
            <X className="h-4 w-4" />
          </IconBtn>
        </div>
      </div>
      <div className="dp-panel-body">
        <div className="dp-panel-inner dp-panel-inner--wide">{children}</div>
      </div>
    </>
  );
}
