import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/crm/primitives";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { ClientRow } from "./ClientRow";
import { sectionEmoji } from "./categoryEmoji";
import type { PersonaDecoration } from "./personaDecoration";
import type { ListLayout, PersonaGroup } from "./personaView";
import "./personaCards.css";

/** The relative date groups groupByDate can name; anything else is a month with its own label. */
const RELATIVE = new Set(["today", "yesterday", "thisWeek", "lastWeek", "unknown"]);

/**
 * One section of the list, a category or a date, as a card: a title (with an emoji for a
 * category, none for a date), what is filed under it in a line, then its personas, as small
 * cards in a wrapping grid or, with a persona open, as a vertical list.
 */
export function ClientGroupSection({ group, layout, selectedNiche, formatDate, onSelect, onDelete, decorate }: {
  group: PersonaGroup;
  layout: ListLayout;
  selectedNiche: string | null;
  formatDate: (iso: string) => string;
  onSelect: (niche: string) => void;
  onDelete: (niche: string) => void;
  /** The Demos page's per-persona meta line and activity dot. */
  decorate?: (c: DemoClientSummary) => PersonaDecoration | undefined;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { items } = group;

  const isDate = group.kind === "date";
  const label = isDate
    ? group.monthLabel ?? (group.dateKey && RELATIVE.has(group.dateKey) ? td(`personaList.dateGroups.${group.dateKey}`) : group.dateKey ?? "")
    : group.category ?? t("clients.noCategory", "Uncategorized");
  const emoji = sectionEmoji(group);
  const blurb = group.uncategorized
    ? t("clients.uncategorizedBlurb")
    : Array.from(new Set(items.map((c) => (c.label || c.niche).trim()).filter(Boolean))).join(", ");

  return (
    <SectionCard padded={false} className="overflow-hidden dp-group" data-testid={`persona-group-${group.key}`}>
      <div className="am-section-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="am-section-title">
            {emoji && <span className="dp-emoji" aria-hidden>{emoji}</span>}
            {label}
          </div>
          <div className="dp-section-blurb" title={blurb}>{blurb}</div>
        </div>
        <span className="am-mono" title={t("clients.countTitle", { count: items.length })}>{items.length}</span>
      </div>
      <div className={layout === "cards" ? "dp-cards" : undefined}>
        {items.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            layout={layout}
            selected={selectedNiche === c.niche}
            showCategory={isDate}
            formatDate={formatDate}
            onOpen={() => onSelect(c.niche)}
            onDelete={onDelete}
            decoration={decorate?.(c)}
          />
        ))}
      </div>
    </SectionCard>
  );
}
