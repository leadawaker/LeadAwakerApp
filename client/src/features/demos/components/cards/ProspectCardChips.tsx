import { useTranslation } from "react-i18next";
import { Pill } from "@/components/crm/primitives/Pill";
import { linkStatus, type ProspectRow } from "../../prospectRows";
import { SERVICES } from "../../services";
import { TOUCH_ROW } from "../../touchTargets";
import { LinkActionsPopover } from "../table/LinkActionsPopover";
import { linkStatusLabel, STATUS_COLOR } from "../table/LinkStatusPill";

/**
 * The chips along the foot of a card: one per link the prospect holds, named by its service and
 * coloured by how far that link got. A chip is the trigger of that link's own menu (open, copy,
 * WhatsApp, new link, delete), the same one the table's status pills open, so a link is handled
 * without opening the detail panel. The chips lift above the card's stretched click area
 * (ProspectCard) with `relative z-10`; the neutral chips below do not, so a click on them still opens the panel.
 */
export function ProspectCardChips({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  const links = SERVICES.filter((svc) => row.byService[svc.key]);

  return (
    <div className="mt-auto flex flex-wrap items-center gap-x-1 gap-y-0.5">
      {links.map((svc) => {
        const session = row.byService[svc.key]!;
        const status = linkStatus(session);
        return (
          <LinkActionsPopover
            key={svc.key}
            row={row}
            svc={svc}
            session={session}
            trigger={
              <button
                type="button"
                title={`${t(svc.labelKey)}: ${linkStatusLabel(t, session)}`}
                aria-label={`${t(svc.labelKey)}: ${t("links.actions")}`}
                className={`relative z-10 inline-flex items-center rounded-[var(--pill-radius)] transition-opacity hover:opacity-80 ${TOUCH_ROW}`}
              >
                <Pill color={STATUS_COLOR[status]} style={status === "expired" ? { opacity: 0.6 } : undefined}>
                  {t(`table.svc.${svc.key}`)}
                </Pill>
              </button>
            }
          />
        );
      })}
      {/* Links in no service line: a neutral chip, since they have no service to name or colour by. They have no menu here. */}
      {row.extra.length > 0 && <Pill title={t("detail.otherLinks")}>{t("folders.otherLinks", { count: row.extra.length })}</Pill>}
      {links.length === 0 && row.extra.length === 0 && (
        <span style={{ fontSize: 11.5, color: "var(--mute-2)" }}>{t("folders.noLinks")}</span>
      )}
    </div>
  );
}
