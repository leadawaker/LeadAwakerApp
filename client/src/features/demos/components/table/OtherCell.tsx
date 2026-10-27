import { useTranslation } from "react-i18next";
import { Copy, ExternalLink } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { toast } from "@/hooks/use-toast";
import { demoOpenUrl, type DemoSession } from "../../api/demoSessionsApi";
import { serviceOf } from "../../serviceOf";
import { SERVICES, serviceCopyUrl, serviceOpenUrl } from "../../services";
import { copyText } from "./linkActions";

const TOUCH = "max-md:h-11 max-md:w-11";

/** Links with no service column to sit in: an older duplicate, or a link on a campaign that is not one of the services. Rare, and never dropped. */
export function OtherCell({ sessions }: { sessions: DemoSession[] }) {
  const { t } = useTranslation("demos");
  if (!sessions.length) return <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("table.none")}</span>;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {sessions.map((s) => {
        const svc = SERVICES.find((d) => d.key === serviceOf(s));
        const copy = async () => {
          const ok = await copyText(svc ? serviceCopyUrl(svc, s) : s.demoUrl);
          toast(ok ? { variant: "success", title: t("links.copied") } : { variant: "destructive", title: t("links.actionFailed") });
        };
        return (
          <span key={s.token} className="flex items-center gap-1">
            <IconBtn aria-label={t("links.copy")} title={t("links.copy")} className={TOUCH} onClick={() => void copy()}>
              <Copy className="h-4 w-4" />
            </IconBtn>
            <IconBtn
              aria-label={t("links.open")}
              title={t("links.open")}
              className={TOUCH}
              onClick={() => window.open(svc ? serviceOpenUrl(svc, s) : demoOpenUrl(s.demoUrl), "_blank", "noopener,noreferrer")}
            >
              <ExternalLink className="h-4 w-4" />
            </IconBtn>
          </span>
        );
      })}
    </div>
  );
}
