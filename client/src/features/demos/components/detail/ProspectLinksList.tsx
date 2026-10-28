import { useTranslation } from "react-i18next";
import type { DemoSession } from "../../api/demoSessionsApi";
import type { ProspectRow } from "../../prospectRows";
import { SERVICES } from "../../services";
import { serviceOf } from "../../serviceOf";
import { formatSent } from "../../tableColumns";
import { LinkCell } from "../table/LinkCell";
import { SectionTitle } from "./SectionTitle";

/** A revoked link: read-only, with when it was sent and how many replies it got. */
function HistoryItem({ session }: { session: DemoSession }) {
  const { t, i18n } = useTranslation("demos");
  const svc = SERVICES.find((s) => s.key === serviceOf(session));
  const Icon = svc?.icon;
  const sent = session.createdAt ? formatSent(session.createdAt, new Date(), i18n.language) : "";
  return (
    <li className="flex items-center gap-2" style={{ fontSize: 12, color: "var(--mute)" }}>
      {Icon && <Icon size={13} className="shrink-0" aria-hidden />}
      <span className="min-w-0 flex-1 truncate">{svc ? t(svc.labelKey) : t("table.other")}</span>
      <span className="shrink-0">{sent || t("table.none")}</span>
      <span className="shrink-0">{t("status.replies", { count: session.browser.replies + session.whatsapp.replies })}</span>
    </li>
  );
}

/**
 * Every service in pitch order with the prospect's link for it: the status pill (which opens the
 * link's actions: open, WhatsApp, copy, re-mint, delete), a copy button, and "+" where there is
 * none yet. Revoked links follow as read-only history. LinkCell is the table's own cell, so a
 * link behaves the same in both places (re-mint is disabled while it runs, a double click mints once).
 */
export function ProspectLinksList({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  return (
    <div className="space-y-4">
      <ul className="flex flex-col gap-1">
        {SERVICES.map((svc) => {
          const Icon = svc.icon;
          return (
            <li key={svc.key} className="flex items-center justify-between gap-3 py-0.5">
              <span className="flex min-w-0 items-center gap-2" style={{ fontSize: 13, color: "var(--ink)" }}>
                <Icon size={14} className="shrink-0" style={{ color: "var(--mute)" }} aria-hidden />
                <span className="truncate">{t(svc.labelKey)}</span>
              </span>
              <div className="w-[148px] shrink-0">
                <LinkCell row={row} svc={svc} session={row.byService[svc.key]} />
              </div>
            </li>
          );
        })}
      </ul>

      {row.history.length > 0 && (
        <div>
          <SectionTitle>{t("detail.history")}</SectionTitle>
          <ul className="flex flex-col gap-1.5">
            {row.history.map((session) => (
              <HistoryItem key={session.token} session={session} />
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
