import { useTranslation } from "react-i18next";
import { Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClientsTopbarActions } from "@/features/campaigns/components/clients/ClientsTopbarActions";
import type { PersonaView } from "@/features/campaigns/components/clients/usePersonaView";
import { TOUCH_ROW } from "../../touchTargets";
import "@/features/campaigns/components/clients/personaRows.css";

/**
 * The Demos page's part of the PageTopbar `right` slot, in order: the Needs follow-up toggle,
 * search and filter (the persona list's own, ClientsTopbarActions), and the wine + New Demo.
 * The Category | Date switch sits in the left group (DemosViewSwitch).
 */
export function DemosTopbarActions({ view, followUp, followUpCount, onFollowUp, onNewDemo }: {
  view: PersonaView;
  followUp: boolean;
  followUpCount: number;
  onFollowUp: (on: boolean) => void;
  onNewDemo: () => void;
}) {
  const { t } = useTranslation("demos");

  return (
    <>
      <button
        type="button"
        aria-pressed={followUp}
        className={cn(`la-btn la-btn--soft h-8 shrink-0 gap-1.5 ${TOUCH_ROW}`, followUp && "on")}
        onClick={() => onFollowUp(!followUp)}
        title={t("merge.followUpHint")}
        data-testid="demos-follow-up"
      >
        <span className="dp-dot dp-dot--reply" aria-hidden />
        {t("merge.followUp", { count: followUpCount })}
      </button>

      <ClientsTopbarActions view={view} />

      <button
        type="button"
        className={`la-btn la-btn--wine h-8 shrink-0 ${TOUCH_ROW}`}
        onClick={onNewDemo}
        data-testid="demos-new-demo"
      >
        <Plus size={14} />
        {t("sessions.newDemo")}
      </button>
    </>
  );
}
