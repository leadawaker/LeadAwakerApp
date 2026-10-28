// The Demos table's link columns and the mint input for an empty cell. Pure.
import type { NewDemoInput } from "./api/demoSessionsApi";
import type { ProspectRow } from "./prospectRows";
import type { ServiceDef } from "./services";

export interface LinkColumn {
  key: "dbrQuote" | "speed" | "widget" | "voice" | "reputation" | "socials";
  /** The service keys whose links sit in this column, in display order. */
  services: string[];
  labelKey: string;
}

const column = (key: LinkColumn["key"], services: string[] = [key]): LinkColumn => ({
  key,
  services,
  labelKey: `table.svc.${key}`,
});

/** DBR and Quote share one column (decision 12); every other service has its own. */
export const LINK_COLUMNS: LinkColumn[] = [
  column("dbrQuote", ["dbr", "quote"]),
  column("speed"),
  column("widget"),
  column("voice"),
  column("reputation"),
  column("socials"),
];

/** What to mint for this service on this prospect's row. */
export function mintInputForRow(row: ProspectRow, svc: ServiceDef): NewDemoInput {
  if (svc.campaignId == null) throw new Error(`Service ${svc.key} has no campaign to mint on`);
  return {
    firstName: row.firstName || "there",
    language: row.language,
    campaignId: svc.campaignId,
    scenario: svc.scenario,
    service: svc.key,
    prospectGroup: row.key,
    ...(row.clientNiche ? { clientNiche: row.clientNiche } : {}),
    ...(row.companyName ? { companyName: row.companyName } : {}),
    ...(row.aiDisclosure ? { aiDisclosure: row.aiDisclosure } : {}),
    // The market only means something for English; nl and pt resolve their own.
    ...(row.language === "en" && row.market ? { market: row.market } : {}),
  };
}

/** "27 Oct", with the year ("3 Mar 2025") when it is not the current one. */
export function formatSent(iso: string, now: Date, locale: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : locale, {
    day: "numeric",
    month: "short",
    ...(d.getFullYear() === now.getFullYear() ? {} : { year: "numeric" }),
  }).format(d);
}
