import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ListCard } from "@/components/crm/primitives/ListCard";
import { apiAsset } from "../../api/demoSettingsApi";
import type { ProspectRow } from "../../prospectRows";
import { ProspectCardChips } from "./ProspectCardChips";

const HIGHLIGHT_BG = "color-mix(in srgb, var(--wine) 8%, transparent)";

// A plain image: the body is a button, and a button cannot hold SiteThumb's preview button.
function Thumb({ row }: { row: ProspectRow }) {
  const box = "h-20 w-full rounded border";
  if (!row.screenshot) return <span className={`block ${box}`} style={{ borderColor: "var(--line)", background: "var(--paper)" }} aria-hidden />;
  return (
    <img
      src={apiAsset(`/api/site-shot/${row.screenshot}`)}
      alt=""
      loading="lazy"
      className={`${box} object-cover object-top`}
      style={{ borderColor: "var(--line)" }}
    />
  );
}

/**
 * One prospect as a small outlined card: the site, who they are, the client, and a chip per link
 * (ProspectCardChips). Pressing the card opens the detail panel; pressing a chip opens that
 * link's menu instead. Valid markup, no button inside a button: the card is a div, its body is the
 * one button, and that button's `::after` stretches over the whole card so any press on the card
 * reaches it, while the chips sit above that layer as siblings. The raised surface is the
 * wrapper's on a desktop; on a phone the list card brings its own. Both carry the outline.
 */
export function ProspectCard({ row, onOpen, highlighted }: { row: ProspectRow; onOpen: () => void; highlighted: boolean }) {
  const { t } = useTranslation("demos");
  const ref = useRef<HTMLDivElement>(null);

  // A card the user just added or changed: scroll it into view; the tint lasts as long as `highlighted` does.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  // A visitor's own website demo has no Client; say where it came from instead of leaving the line empty.
  const client = row.clientNiche || (row.publicDemo ? t("table.websitePill") : "");

  return (
    <div ref={ref} className="min-w-0 scroll-mt-10 rounded-[var(--list-card-radius)] md:[background:var(--surface)] md:[box-shadow:var(--sh-raised-crisp)]">
      <ListCard
        as="div"
        className="h-full"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 8,
          border: "1px solid var(--line-strong)",
          ...(highlighted ? { background: HIGHLIGHT_BG } : null),
        }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="block w-full min-w-0 text-left outline-none after:absolute after:inset-0 after:rounded-[var(--list-card-radius)] focus-visible:outline-none focus-visible:after:[outline-offset:2px] focus-visible:after:[outline:2px_solid_hsl(var(--ring))]"
        >
          <span className="flex w-full min-w-0 flex-col gap-2">
            <Thumb row={row} />
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
                {row.firstName || t("table.none")}
              </span>
              {row.companyName && (
                <span className="truncate" style={{ fontSize: 12, color: "var(--ink)" }}>
                  {row.companyName}
                </span>
              )}
              {client && (
                <span className="truncate" style={{ fontSize: 11.5, color: "var(--mute)" }}>
                  {client}
                </span>
              )}
            </span>
          </span>
        </button>
        <ProspectCardChips row={row} />
      </ListCard>
    </div>
  );
}
