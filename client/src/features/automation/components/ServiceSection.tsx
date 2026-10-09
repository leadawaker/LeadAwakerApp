import { useTranslation } from "react-i18next";
import { ChevronDown } from "lucide-react";
import { SectionCard } from "@/components/crm/primitives";
import type { AutomationService } from "@shared/automationCatalogue";
import type { OverviewRow } from "@shared/automationTypes";
import { BUCKET_COLOR, SERVICE_ICON, bucketOf } from "../status";
import { AutomationRow } from "./AutomationRow";

/** One service (Reactivation, Bookings, ...) as a card: header with a one-line verdict, rows below. */
export function ServiceSection({ service, rows, selected, onSelect, collapsible = false, open = true, onToggle }: {
  service: AutomationService | "unlisted";
  rows: OverviewRow[];
  selected: string | null;
  onSelect: (id: string) => void;
  collapsible?: boolean;
  open?: boolean;
  onToggle?: () => void;
}) {
  const { t } = useTranslation("automation");
  const Icon = SERVICE_ICON[service];
  const broken = rows.filter((r) => bucketOf(r.health) === "broken").length;
  const attention = rows.filter((r) => bucketOf(r.health) === "attention").length;
  const working = rows.filter((r) => r.counts24h.success + r.counts24h.failed + r.counts24h.skipped > 0).length;

  const verdict = broken > 0
    ? { text: t("section.broken", { count: broken }), color: BUCKET_COLOR.broken }
    : attention > 0
      ? { text: t("section.attention", { count: attention }), color: BUCKET_COLOR.attention }
      : { text: working > 0 ? t("section.allFineBusy", { count: working }) : t("section.allFine"), color: "var(--mute)" };

  const head = (
    <>
      <span className="am-icon-tile"><Icon className="h-4 w-4" /></span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div className="am-section-title">{t(`services.${service}`)}</div>
        <div style={{ fontSize: 12.5, color: "var(--mute)", marginTop: 1 }}>{t(`serviceBlurb.${service}`)}</div>
      </div>
      <span style={{ fontSize: 12.5, color: verdict.color, fontWeight: 600, whiteSpace: "nowrap" }}>{verdict.text}</span>
      <span className="am-mono" style={{ minWidth: 18, textAlign: "right" }}>{rows.length}</span>
      {collapsible && <ChevronDown className="h-4 w-4" style={{ color: "var(--mute)", transform: open ? "rotate(180deg)" : undefined, transition: "transform 200ms ease" }} />}
    </>
  );

  return (
    <SectionCard padded={false} className="overflow-hidden" data-testid={`automation-service-${service}`}>
      {collapsible ? (
        <button type="button" className="am-section-head" onClick={onToggle} aria-expanded={open} style={{ borderBottom: open ? undefined : "none" }}>{head}</button>
      ) : (
        <div className="am-section-head">{head}</div>
      )}
      {open && (
        <div>
          {rows.map((r) => <AutomationRow key={r.id} row={r} selected={selected === r.id} onClick={() => onSelect(r.id)} />)}
        </div>
      )}
    </SectionCard>
  );
}
