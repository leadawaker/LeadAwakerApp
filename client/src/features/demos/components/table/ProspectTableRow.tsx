import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { ProspectRow } from "../../prospectRows";
import { SERVICES } from "../../services";
import { formatSent, LINK_COLUMNS } from "../../tableColumns";
import { DbrQuoteCell } from "./DbrQuoteCell";
import { LinkCell } from "./LinkCell";
import { OtherCell } from "./OtherCell";
import { SiteThumb } from "./SiteThumb";

const HIGHLIGHT_MS = 4000;
const HIGHLIGHT_BG = "color-mix(in srgb, var(--wine) 8%, transparent)";

/** A name that opens the prospect's detail panel. */
function NameButton({ onClick, title, style, children }: { onClick: () => void; title: string; style: React.CSSProperties; children: React.ReactNode }) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className="block w-full truncate rounded px-1 py-0.5 text-left hover:bg-[var(--wine-tint)] max-md:min-h-11"
      style={{ ...style, transition: "background-color 150ms" }}
    >
      {children}
    </button>
  );
}

export function ProspectTableRow({ row, highlighted, showOther = false, onOpenRow }: {
  row: ProspectRow;
  highlighted: boolean;
  /** The table has an Other column (some row holds a link that fits no service column). */
  showOther?: boolean;
  onOpenRow: (key: string) => void;
}) {
  const { t, i18n } = useTranslation("demos");
  const ref = useRef<HTMLTableRowElement>(null);
  const [faded, setFaded] = useState(false);

  // A row the user just added or changed: scroll it into view and tint it for a few seconds.
  useEffect(() => {
    if (!highlighted) {
      setFaded(false);
      return;
    }
    ref.current?.scrollIntoView({ block: "nearest" });
    const id = window.setTimeout(() => setFaded(true), HIGHLIGHT_MS);
    return () => window.clearTimeout(id);
  }, [highlighted]);

  const none = t("table.none");
  const dated = (iso: string | null) => (iso ? formatSent(iso, new Date(), i18n.language) || none : none);

  return (
    <tr
      ref={ref}
      className="la-lead-row h-[56px] scroll-mt-10"
      style={{ transition: "background-color 400ms", ...(highlighted && !faded ? { background: HIGHLIGHT_BG } : {}) }}
    >
      <td className="pl-2 pr-0 py-1">
        <SiteThumb row={row} />
      </td>
      <td className="px-2 py-1">
        <NameButton title={row.firstName} onClick={() => onOpenRow(row.key)} style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>
          {row.firstName || none}
        </NameButton>
      </td>
      <td className="truncate px-3 py-1" title={row.companyName} style={{ fontSize: 12.5, color: "var(--ink)" }}>
        {row.companyName || none}
      </td>
      {LINK_COLUMNS.map((col) => {
        const svc = SERVICES.find((s) => s.key === col.services[0]);
        return (
          <td key={col.key} className="px-2 py-1">
            {col.key === "dbrQuote" ? (
              <DbrQuoteCell row={row} />
            ) : svc ? (
              <LinkCell row={row} svc={svc} session={row.byService[svc.key]} />
            ) : null}
          </td>
        );
      })}
      {showOther && (
        <td className="px-2 py-1">
          <OtherCell sessions={row.extra} />
        </td>
      )}
      <td className="px-3 py-1" style={{ fontSize: 12, color: "var(--mute)" }}>
        {dated(row.lastActivityAt)}
      </td>
      <td className="px-3 py-1" style={{ fontSize: 12, color: "var(--mute)" }}>
        {row.tokens.length ? dated(row.createdAt) : none}
      </td>
    </tr>
  );
}
