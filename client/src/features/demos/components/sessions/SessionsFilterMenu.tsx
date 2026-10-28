import { useTranslation } from "react-i18next";
import {
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { SERVICES } from "../../services";
import type { ActivityFilter, SessionFilters } from "../../sessionsView";
import { TOUCH_ROW } from "../../touchTargets";

const ACTIVITIES: ActivityFilter[] = ["all", "opened", "replied", "never"];

const ITEM = `text-[12px] ${TOUCH_ROW}`;
const LABEL = "text-[10px] uppercase tracking-widest text-muted-foreground";

// A pick must not close the menu: filters are usually combined.
const keepOpen = (e: Event) => e.preventDefault();

/** The Filter menu's content: activity, expired, client and demo type. The trigger is the caller's. */
export function SessionsFilterMenu({ filters, onChange, clients }: {
  filters: SessionFilters;
  onChange: (next: SessionFilters) => void;
  clients: { niche: string; label: string }[];
}) {
  const { t } = useTranslation("demos");
  return (
    <DropdownMenuContent align="end" className="w-60">
      <DropdownMenuLabel className={LABEL}>{t("sessions.groups.activity")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={filters.activity} onValueChange={(v) => onChange({ ...filters, activity: v as ActivityFilter })}>
        {ACTIVITIES.map((a) => (
          <DropdownMenuRadioItem key={a} value={a} className={ITEM} onSelect={keepOpen}>
            {t(`sessions.activity.${a}`)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
      <DropdownMenuCheckboxItem
        checked={filters.expired}
        onCheckedChange={(expired) => onChange({ ...filters, expired: expired === true })}
        onSelect={keepOpen}
        className={ITEM}
      >
        {t("sessions.expired")}
      </DropdownMenuCheckboxItem>

      <DropdownMenuSeparator />
      <DropdownMenuLabel className={LABEL}>{t("sessions.groups.client")}</DropdownMenuLabel>
      <div className="max-h-48 overflow-y-auto">
        <DropdownMenuRadioGroup value={filters.client} onValueChange={(client) => onChange({ ...filters, client })}>
          <DropdownMenuRadioItem value="" className={ITEM} onSelect={keepOpen}>
            {t("sessions.anyClient")}
          </DropdownMenuRadioItem>
          {clients.map((c) => (
            <DropdownMenuRadioItem key={c.niche} value={c.niche} className={ITEM} onSelect={keepOpen}>
              <span className="truncate">{c.label}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </div>

      <DropdownMenuSeparator />
      <DropdownMenuLabel className={LABEL}>{t("sessions.groups.type")}</DropdownMenuLabel>
      <DropdownMenuRadioGroup value={filters.service} onValueChange={(service) => onChange({ ...filters, service })}>
        <DropdownMenuRadioItem value="" className={ITEM} onSelect={keepOpen}>
          {t("sessions.anyType")}
        </DropdownMenuRadioItem>
        {SERVICES.map((s) => (
          <DropdownMenuRadioItem key={s.key} value={s.key} className={ITEM} onSelect={keepOpen}>
            {t(s.labelKey)}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  );
}
