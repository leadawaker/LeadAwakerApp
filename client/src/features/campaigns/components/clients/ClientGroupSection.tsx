import { useTranslation } from "react-i18next";
import { SectionCard } from "@/components/crm/primitives";
import type { DemoClientSummary } from "../../api/demoClientsApi";
import { ClientRow } from "./ClientRow";
import { DATE_EMOJI, categoryEmoji } from "./categoryEmoji";
import type { PersonaGroup } from "./personaView";

/** The relative date groups groupByDate can name; anything else is a month with its own label. */
const RELATIVE = new Set(["today", "yesterday", "thisWeek", "lastWeek", "unknown"]);

/** One section of the list, a category or a date, as a card: an emoji and title, what is filed under it in a line, then its personas. */
export function ClientGroupSection({ group, selectedNiche, formatDate, onSelect, onDelete }: {
  group: PersonaGroup;
  selectedNiche: string | null;
  formatDate: (iso: string) => string;
  onSelect: (niche: string) => void;
  onDelete: (niche: string) => void;
}) {
  const { t } = useTranslation("campaigns");
  const { t: td } = useTranslation("demos");
  const { items } = group;

  const isDate = group.kind === "date";
  const label = isDate
    ? group.monthLabel ?? (group.dateKey && RELATIVE.has(group.dateKey) ? td(`personaList.dateGroups.${group.dateKey}`) : group.dateKey ?? "")
    : group.category ?? t("clients.noCategory", "Uncategorized");
  const emoji = isDate ? DATE_EMOJI : categoryEmoji(group.category);
  const blurb = group.uncategorized
    ? t("clients.uncategorizedBlurb")
    : Array.from(new Set(items.map((c) => (c.label || c.niche).trim()).filter(Boolean))).join(", ");

  return (
    <SectionCard padded={false} className="overflow-hidden" data-testid={`persona-group-${group.key}`}>
      <div className="am-section-head">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="am-section-title">
            <span className="dp-emoji" aria-hidden>{emoji}</span>
            {label}
          </div>
          <div className="dp-section-blurb" title={blurb}>{blurb}</div>
        </div>
        <span className="am-mono" title={t("clients.countTitle", { count: items.length })}>{items.length}</span>
      </div>
      <div>
        {items.map((c) => (
          <ClientRow
            key={c.id}
            client={c}
            selected={selectedNiche === c.niche}
            showCategory={isDate}
            formatDate={formatDate}
            onOpen={() => onSelect(c.niche)}
            onDelete={onDelete}
          />
        ))}
      </div>
    </SectionCard>
  );
}
