import { useTranslation } from "react-i18next";
import { ChevronRight, Layers } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import { FALLBACK_NICHE } from "@/features/campaigns/components/clients/clientDraft";
import type { ListLayout } from "@/features/campaigns/components/clients/personaView";
import "@/features/automation/automation.css";
import "@/features/campaigns/components/clients/clients.css";
import "@/features/campaigns/components/clients/personaRows.css";
import "@/features/campaigns/components/clients/personaCards.css";

/**
 * The Niche library's last card: the `__default__` row, the words and example packs every
 * niche without its own falls back to. Not a persona, so it is not in the persona list; it
 * shows only while the Niche library filter is on. Same markup as SpecialPersonaCards.
 */
export function FallbackNicheCard({ layout, selected, onSelect }: {
  layout: ListLayout;
  selected: boolean;
  onSelect: (key: string) => void;
}) {
  const { t } = useTranslation("demos");
  const isCards = layout === "cards";

  return (
    <SectionCard padded={false} className="overflow-hidden dp-group" data-testid="persona-group-fallback">
      <div className="am-section-head">
        <div className="am-section-title" style={{ flex: 1, minWidth: 0 }}>{t("merge.fallback.groupTitle")}</div>
        <span className="am-mono">1</span>
      </div>
      <div className={isCards ? "dp-cards" : undefined}>
        <div
          className={`${isCards ? "dp-card dp-card--special" : "am-row dp-row dp-row--special"}${selected ? " is-selected" : ""}`}
          data-niche={FALLBACK_NICHE}
          data-testid="persona-fallback"
        >
          <span className="dp-thumb-box" aria-hidden>
            <span className="am-icon-tile"><Layers className="h-4 w-4" /></span>
          </span>
          <div className="dp-who">
            <div className="dp-title-line">
              <button type="button" className="dp-open" onClick={() => onSelect(FALLBACK_NICHE)} aria-pressed={selected}>
                <span className="am-name dp-name">{t("merge.fallback.title")}</span>
              </button>
            </div>
            <div className="am-desc dp-sub">{t("merge.fallback.sub")}</div>
          </div>
          {!isCards && (
            <>
              <div className="dp-col-langs" aria-hidden />
              <div className="dp-col-when" aria-hidden />
              <div className="dp-col-del" aria-hidden />
              <ChevronRight className="am-chev h-4 w-4" />
            </>
          )}
        </div>
      </div>
    </SectionCard>
  );
}
