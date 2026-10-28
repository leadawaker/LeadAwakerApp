import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import type { DemoSession } from "../../api/demoSessionsApi";
import type { ProspectRow } from "../../prospectRows";
import type { ServiceDef } from "../../services";
import { TOUCH } from "../../touchTargets";
import { LinkActionsPopover } from "./LinkActionsPopover";
import { useMintLink } from "./linkActions";
import { LinkStatusPill, useActivityDate } from "./LinkStatusPill";

/** No link yet: mint one on this row's prospect. Socials need a client persona first. */
function MintButton({ row, svc }: { row: ProspectRow; svc: ServiceDef }) {
  const { t } = useTranslation("demos");
  const { mint, pending } = useMintLink(row, svc);
  const needsClient = !!svc.socialPage && !row.clientNiche;
  const label = needsClient ? t("links.socialsNeedsClient") : t("services.create");
  return (
    // The span carries the hint: a disabled button shows no tooltip of its own in every browser.
    <span title={label} className="inline-flex">
      <IconBtn aria-label={label} disabled={pending || needsClient} className={TOUCH} onClick={() => void mint()}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
      </IconBtn>
    </span>
  );
}

/**
 * A live link: its status pill (which opens the link's actions, copying included) and the date
 * of its last activity. `caption` names the service when the column holds more than one
 * (DBR / Quote), as the pill's tooltip; `pillOnly` leaves the date out.
 */
export function LinkEntry({ row, svc, session, caption, pillOnly = false }: {
  row: ProspectRow;
  svc: ServiceDef;
  session: DemoSession;
  caption?: string;
  pillOnly?: boolean;
}) {
  const { t } = useTranslation("demos");
  const date = useActivityDate(session);
  const title = caption ? `${caption}: ${t("links.actions")}` : t("links.actions");
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-0.5">
      <LinkActionsPopover
        row={row}
        svc={svc}
        session={session}
        trigger={
          <button
            type="button"
            title={title}
            className="inline-flex min-w-0 max-w-full rounded-[var(--pill-radius)] transition-opacity hover:opacity-80 max-md:min-h-11 max-md:items-center"
          >
            <LinkStatusPill session={session} />
          </button>
        }
      />
      {!pillOnly && date && (
        <span className="max-w-full truncate" style={{ fontSize: 10.5, color: "var(--mute)" }} title={date}>
          {date}
        </span>
      )}
    </div>
  );
}

/**
 * One prospect's link for one service: a dash when the service has no campaign
 * (or when the row is a public website demo, which takes no new links), "+" to
 * mint when there is no link yet, else the status pill (which opens the link's
 * actions) and the date. `caption` and `pillOnly` are LinkEntry's.
 */
export function LinkCell({ row, svc, session, caption, pillOnly }: {
  row: ProspectRow;
  svc: ServiceDef;
  session?: DemoSession;
  caption?: string;
  pillOnly?: boolean;
}) {
  const { t } = useTranslation("demos");
  if (svc.campaignId == null) {
    return (
      <span title={t("services.soon")} style={{ fontSize: 12, color: "var(--mute)" }}>
        {t("table.none")}
      </span>
    );
  }
  if (!session) {
    return row.publicDemo ? (
      <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("table.none")}</span>
    ) : (
      <MintButton row={row} svc={svc} />
    );
  }
  return <LinkEntry row={row} svc={svc} session={session} caption={caption} pillOnly={pillOnly} />;
}
