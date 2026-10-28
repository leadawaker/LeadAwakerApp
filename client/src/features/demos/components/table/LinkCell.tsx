import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Copy, Loader2, Plus } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { toast } from "@/hooks/use-toast";
import type { DemoSession } from "../../api/demoSessionsApi";
import type { ProspectRow } from "../../prospectRows";
import { serviceCopyUrl, type ServiceDef } from "../../services";
import { TOUCH } from "../../touchTargets";
import { LinkActionsPopover } from "./LinkActionsPopover";
import { copyText, useMintLink } from "./linkActions";
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

/** A live link: its status pill (which opens the link's actions), the date, and a copy button. */
export function LinkEntry({ row, svc, session, caption }: { row: ProspectRow; svc: ServiceDef; session: DemoSession; caption?: string }) {
  const { t } = useTranslation("demos");
  const date = useActivityDate(session);
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    if (!(await copyText(serviceCopyUrl(svc, session)))) {
      toast({ variant: "destructive", title: t("links.actionFailed") });
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1500);
  };

  const meta = [caption, date].filter(Boolean).join(" · ");
  return (
    <div className="flex w-full min-w-0 flex-col items-start gap-0.5">
      <LinkActionsPopover
        row={row}
        svc={svc}
        session={session}
        trigger={
          <button
            type="button"
            title={t("links.actions")}
            className="inline-flex min-w-0 max-w-full rounded-[var(--pill-radius)] transition-opacity hover:opacity-80 max-md:min-h-11 max-md:items-center"
          >
            <LinkStatusPill session={session} />
          </button>
        }
      />
      <div className="flex w-full min-w-0 items-center justify-between gap-1">
        <span className="min-w-0 truncate" style={{ fontSize: 10.5, color: "var(--mute)" }} title={meta}>
          {meta}
        </span>
        <IconBtn
          aria-label={copied ? t("links.copied") : t("links.copy")}
          title={copied ? t("links.copied") : t("links.copy")}
          className={TOUCH}
          onClick={() => void copy()}
        >
          {copied ? <Check className="h-4 w-4" style={{ color: "var(--good)" }} /> : <Copy className="h-4 w-4" />}
        </IconBtn>
      </div>
    </div>
  );
}

/**
 * One prospect's link for one service: a dash when the service has no campaign,
 * "+" to mint when there is no link yet, else the status pill (which opens the
 * link's actions) and a copy button. `caption` names the service when the
 * column holds more than one (DBR / Quote).
 */
export function LinkCell({ row, svc, session, caption }: { row: ProspectRow; svc: ServiceDef; session?: DemoSession; caption?: string }) {
  const { t } = useTranslation("demos");
  if (svc.campaignId == null) {
    return (
      <span title={t("services.soon")} style={{ fontSize: 12, color: "var(--mute)" }}>
        {t("table.none")}
      </span>
    );
  }
  if (!session) return <MintButton row={row} svc={svc} />;
  return <LinkEntry row={row} svc={svc} session={session} caption={caption} />;
}
