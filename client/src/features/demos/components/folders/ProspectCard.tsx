import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ListCard } from "@/components/crm/primitives/ListCard";
import { Pill } from "@/components/crm/primitives/Pill";
import { apiAsset } from "../../api/demoSettingsApi";
import { linkStatus, type ProspectRow } from "../../prospectRows";
import { SERVICES } from "../../services";
import { linkStatusLabel, STATUS_COLOR } from "../table/LinkStatusPill";

const HIGHLIGHT_BG = "color-mix(in srgb, var(--wine) 8%, transparent)";

// A plain image: the card is itself a button, and a button cannot hold SiteThumb's preview button.
function Thumb({ row }: { row: ProspectRow }) {
  const box = "h-9 w-14 shrink-0 rounded border";
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
 * One prospect in the folder view: the site, who they are, and a chip per link they hold (the
 * service, coloured by how far that link got). Opens the detail panel. The list card's own
 * minimum height is already above the 44px touch size, so no phone override is needed.
 */
export function ProspectCard({ row, onOpen, highlighted }: { row: ProspectRow; onOpen: () => void; highlighted: boolean }) {
  const { t } = useTranslation("demos");
  const ref = useRef<HTMLElement>(null);

  // A card the user just added or changed: scroll it into view; the tint lasts as long as `highlighted` does.
  useEffect(() => {
    if (highlighted) ref.current?.scrollIntoView({ block: "nearest" });
  }, [highlighted]);

  const links = SERVICES.filter((svc) => row.byService[svc.key]);
  // A visitor's own website demo has no Client; say where it came from instead of leaving the line empty.
  const client = row.clientNiche || (row.publicDemo ? t("table.websitePill") : "");

  return (
    <ListCard
      as="button"
      ref={ref}
      onClick={onOpen}
      className="w-full scroll-mt-10 text-left"
      style={highlighted ? { background: HIGHLIGHT_BG } : undefined}
    >
      <span className="flex items-start gap-3">
        <Thumb row={row} />
        <span className="flex min-w-0 flex-1 flex-col gap-1">
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
          <span className="flex flex-wrap gap-1 pt-0.5">
            {links.map((svc) => {
              const session = row.byService[svc.key]!;
              const status = linkStatus(session);
              return (
                <Pill
                  key={svc.key}
                  color={STATUS_COLOR[status]}
                  title={`${t(svc.labelKey)}: ${linkStatusLabel(t, session)}`}
                  style={status === "expired" ? { opacity: 0.6 } : undefined}
                >
                  {t(`table.svc.${svc.key}`)}
                </Pill>
              );
            })}
            {/* Links in no service line: a neutral chip, since they have no service to name or colour by. */}
            {row.extra.length > 0 && <Pill title={t("detail.otherLinks")}>{t("folders.otherLinks", { count: row.extra.length })}</Pill>}
            {links.length === 0 && row.extra.length === 0 && (
              <span style={{ fontSize: 11.5, color: "var(--mute-2)" }}>{t("folders.noLinks")}</span>
            )}
          </span>
        </span>
      </span>
    </ListCard>
  );
}
