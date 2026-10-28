import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Trash2 } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { toast } from "@/hooks/use-toast";
import { useDeleteLink } from "../../api/demoProspectsApi";
import type { DemoSession } from "../../api/demoSessionsApi";
import type { ProspectRow } from "../../prospectRows";
import { serviceOf } from "../../serviceOf";
import { SERVICES } from "../../services";
import { formatSent } from "../../tableColumns";
import { TOUCH } from "../../touchTargets";
import { DeleteConfirmDialog } from "../DeleteConfirmDialog";
import { LinkEntry } from "../table/LinkCell";
import { OtherCell } from "../table/OtherCell";

/** A link on no service campaign: copy and open (OtherCell's pair), and delete, which is all it can be asked to do. */
function UnplacedActions({ session }: { session: DemoSession }) {
  const { t } = useTranslation("demos");
  const del = useDeleteLink();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const doDelete = async () => {
    try {
      await del.mutateAsync({ token: session.token });
      setConfirmOpen(false);
      toast({ variant: "success", title: t("links.deleted") });
    } catch {
      setConfirmOpen(false);
      toast({ variant: "destructive", title: t("links.actionFailed") });
    }
  };

  return (
    <>
      <div className="flex items-center gap-1">
        <OtherCell sessions={[session]} />
        <IconBtn
          aria-label={t("links.delete")}
          title={t("links.delete")}
          className={TOUCH}
          style={{ color: "hsl(var(--destructive))" }}
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
        </IconBtn>
      </div>
      <DeleteConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t("links.deleteTitle")}
        body={t("links.deleteBody")}
        confirmLabel={t("links.delete")}
        onConfirm={() => void doDelete()}
        pending={del.isPending}
      />
    </>
  );
}

/**
 * The prospect's live links that sit in no service line of the list above: an older duplicate of
 * a service (full actions, like the line it duplicates) or a link on a campaign that is not one
 * of the services (copy, open, delete). Nothing a prospect was sent may be unreachable here, and
 * on a phone this panel is the only way to reach a link.
 */
export function OtherLinks({ row }: { row: ProspectRow }) {
  const { t, i18n } = useTranslation("demos");
  return (
    <ul className="flex flex-col gap-1">
      {row.extra.map((session) => {
        const svc = SERVICES.find((s) => s.key === serviceOf(session));
        const Icon = svc?.icon;
        const sent = session.createdAt ? formatSent(session.createdAt, new Date(), i18n.language) : "";
        return (
          <li key={session.token} className="flex items-center justify-between gap-3 py-0.5">
            <span className="flex min-w-0 flex-col" style={{ color: "var(--ink)" }}>
              <span className="flex min-w-0 items-center gap-2" style={{ fontSize: 13 }}>
                {Icon && <Icon size={14} className="shrink-0" style={{ color: "var(--mute)" }} aria-hidden />}
                <span className="truncate">{svc ? t(svc.labelKey) : t("table.other")}</span>
              </span>
              {sent && (
                <span className="truncate" style={{ fontSize: 11, color: "var(--mute)" }}>
                  {t("table.sent")} {sent}
                </span>
              )}
            </span>
            {svc ? (
              <div className="w-[148px] shrink-0">
                <LinkEntry row={row} svc={svc} session={session} />
              </div>
            ) : (
              <div className="shrink-0">
                <UnplacedActions session={session} />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
