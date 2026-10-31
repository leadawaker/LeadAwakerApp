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
 * The Category | Date switch sits at the top of the persona list (ClientsTab).
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
        aria-label={t("merge.followUp", { count: followUpCount })}
        data-testid="demos-follow-up"
      >
        <span className="dp-dot dp-dot--reply" aria-hidden />
        {/* Phones: the dot and the count only, so the crowded bar scrolls less. */}
        <span className="max-md:hidden">{t("merge.followUp", { count: followUpCount })}</span>
        <span className="md:hidden tabular-nums" aria-hidden>{followUpCount}</span>
      </button>

      <ClientsTopbarActions view={view} />

      <button
        type="button"
        className={`la-btn la-btn--wine h-8 shrink-0 ${TOUCH_ROW}`}
        onClick={onNewDemo}
        aria-label={t("sessions.newDemo")}
        data-testid="demos-new-demo"
      >
        <Plus size={14} />
        <span className="max-md:hidden">{t("sessions.newDemo")}</span>
      </button>
    </>
  );
}
