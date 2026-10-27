import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Plus } from "lucide-react";
import { IconBtn } from "@/components/ui/icon-btn";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { ProspectRow } from "../../prospectRows";
import { SERVICES, type ServiceDef } from "../../services";
import { LINK_COLUMNS } from "../../tableColumns";
import { LinkCell } from "./LinkCell";
import { useMintLink } from "./linkActions";

const TOUCH = "max-md:h-11 max-md:w-11";

const DBR_QUOTE: ServiceDef[] = (LINK_COLUMNS.find((c) => c.key === "dbrQuote")?.services ?? []).flatMap((key) =>
  SERVICES.filter((s) => s.key === key),
);

/** One service to mint from the picker. */
function PickRow({ row, svc, onDone }: { row: ProspectRow; svc: ServiceDef; onDone: () => void }) {
  const { t } = useTranslation("demos");
  const { mint, pending } = useMintLink(row, svc);
  const Icon = svc.icon;
  return (
    <div
      role="presentation"
      className="flex cursor-pointer items-center gap-2 rounded-[var(--r-button)] pr-2 hover:bg-[var(--wine-tint)] max-md:min-h-11"
      onClick={() => {
        if (pending) return;
        void mint().then((ok) => ok && onDone());
      }}
    >
      <IconBtn aria-label={t(svc.labelKey)} disabled={pending} className={TOUCH}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Icon className="h-4 w-4" />}
      </IconBtn>
      <span className="min-w-0 flex-1 truncate" style={{ fontSize: 13, color: "var(--ink)" }}>
        {t(svc.labelKey)}
      </span>
    </div>
  );
}

/** "+" for a prospect that is missing a DBR or a Quote link: pick which one to mint. */
function PickerButton({ row, missing }: { row: ProspectRow; missing: ServiceDef[] }) {
  const { t } = useTranslation("demos");
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <IconBtn title={t("links.pickDbrQuote")} aria-label={t("links.pickDbrQuote")} className={TOUCH}>
          <Plus className="h-4 w-4" />
        </IconBtn>
      </PopoverTrigger>
      <PopoverContent align="start" className="flex w-[min(260px,calc(100vw-32px))] flex-col gap-0.5 p-2">
        {missing.map((svc) => (
          <PickRow key={svc.key} row={row} svc={svc} onDone={() => setOpen(false)} />
        ))}
      </PopoverContent>
    </Popover>
  );
}

/** DBR and Quote share a column: the links the prospect has, stacked, and a "+" for the missing one(s). */
export function DbrQuoteCell({ row }: { row: ProspectRow }) {
  const { t } = useTranslation("demos");
  const present = DBR_QUOTE.filter((s) => row.byService[s.key]);
  // A service with no campaign cannot be minted, so it is never offered.
  const missing = DBR_QUOTE.filter((s) => !row.byService[s.key] && s.campaignId != null);
  if (!present.length && !missing.length) return <span style={{ fontSize: 12, color: "var(--mute)" }}>{t("table.none")}</span>;
  return (
    <div className="flex flex-col items-start gap-1">
      {present.map((svc) => (
        <LinkCell key={svc.key} row={row} svc={svc} session={row.byService[svc.key]} caption={t(`table.svc.${svc.key}`)} />
      ))}
      {missing.length > 0 && <PickerButton row={row} missing={missing} />}
    </div>
  );
}
