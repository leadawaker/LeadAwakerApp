import { useTranslation } from "react-i18next";
import { ChevronRight, Globe, UserX } from "lucide-react";
import { Pill, SectionCard } from "@/components/crm/primitives";
import type { ListLayout } from "@/features/campaigns/components/clients/personaView";
import { WEBSITE_KEY, prospectSummary, type ActivityDot, type SpecialKey } from "../../personaDemos";
import type { ProspectRow } from "../../prospectRows";
import { PersonaCardMeta } from "./PersonaCardMeta";
import "@/features/automation/automation.css";
import "@/features/campaigns/components/clients/clients.css";
import "@/features/campaigns/components/clients/personaRows.css";
import "@/features/campaigns/components/clients/personaCards.css";

export interface SpecialCard {
  key: SpecialKey;
  rows: ProspectRow[];
  dot: ActivityDot;
}

/**
 * The list's last group: prospects that belong to no persona, and the website's own demos. Same
 * markup as a persona card or row (ClientRow) so the same stylesheets draw it, with a dashed
 * border. Neither can be deleted, and neither has languages or a date.
 */
export function SpecialPersonaCards({ cards, layout, selectedKey, onSelect }: {
  /** Already filtered by the caller; an empty list renders nothing. */
  cards: SpecialCard[];
  layout: ListLayout;
  selectedKey: string | null;
  onSelect: (key: SpecialKey) => void;
}) {
  const { t } = useTranslation("demos");
  if (cards.length === 0) return null;
  const isCards = layout === "cards";

  return (
    <SectionCard padded={false} className="overflow-hidden dp-group" data-testid="persona-group-special">
      <div className="am-section-head">
        <div className="am-section-title" style={{ flex: 1, minWidth: 0 }}>{t("merge.special.groupTitle")}</div>
        <span className="am-mono">{cards.length}</span>
      </div>
      <div className={isCards ? "dp-cards" : undefined}>
        {cards.map(({ key, rows, dot }) => {
          const selected = selectedKey === key;
          const website = key === WEBSITE_KEY;
          const Icon = website ? Globe : UserX;
          const dotLabel = dot ? t(`merge.dot.${dot}`) : undefined;
          return (
            <div
              key={key}
              className={`${isCards ? "dp-card dp-card--special" : "am-row dp-row dp-row--special"}${selected ? " is-selected" : ""}`}
              data-niche={key}
              data-testid={`persona-special-${key}`}
            >
              <span className="dp-thumb-box" aria-hidden>
                <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
              </span>

              <div className="dp-who">
                <div className="dp-title-line">
                  <button type="button" className="dp-open" onClick={() => onSelect(key)} aria-pressed={selected}>
                    <span className="am-name dp-name">{t(website ? "merge.special.website" : "merge.special.noPersona")}</span>
                  </button>
                  {website && <Pill color="var(--wine)" className="shrink-0">{t("table.websitePill")}</Pill>}
                  {dot && <span className={`dp-dot dp-dot--${dot}`} role="img" aria-label={dotLabel} title={dotLabel} />}
                </div>
                <div className="am-desc dp-sub">{t(website ? "merge.special.websiteSub" : "merge.special.noPersonaSub")}</div>
                <div className="dp-meta"><PersonaCardMeta summary={prospectSummary(rows)} /></div>
              </div>

              {/* The row's empty language, date and delete cells keep the chevron in the last column. */}
              {!isCards && (
                <>
                  <div className="dp-col-langs" aria-hidden />
                  <div className="dp-col-when" aria-hidden />
                  <div className="dp-col-del" aria-hidden />
                  <ChevronRight className="am-chev h-4 w-4" />
                </>
              )}
            </div>
          );
        })}
      </div>
    </SectionCard>
  );
}
