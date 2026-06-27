import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { SpeedToLeadListCard } from "./SpeedToLeadListCard";
import type { SpeedToLeadCampaign } from "../data/mockMetrics";

/** Left toolbar listing the mock Speed-to-Lead campaigns. */
export function SpeedToLeadListPanel({
  campaigns,
  selectedId,
  onSelect,
}: {
  campaigns: SpeedToLeadCampaign[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { t } = useTranslation("speedToLead");

  return (
    <div className="flex flex-col h-full bg-panel-list-bg overflow-hidden border-r border-[var(--line)] min-h-0 w-full lg:w-[var(--toolbar-w)] lg:shrink-0">
      <div className="flex-1 overflow-y-auto la-list-area">
        {campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4 gap-2" style={{ color: "var(--mute-2)" }}>
            <Send className="h-5 w-5" />
            <span style={{ fontSize: 12 }}>{t("list.empty")}</span>
          </div>
        ) : (
          <div className="la-cards">
            {campaigns.map((c, idx) => (
              <div key={c.id} className={idx < 15 ? "animate-card-enter" : undefined} style={idx < 15 ? { animationDelay: `${idx * 30}ms` } : undefined}>
                <SpeedToLeadListCard
                  campaign={c}
                  isActive={selectedId === c.id}
                  onClick={() => onSelect(c.id)}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
