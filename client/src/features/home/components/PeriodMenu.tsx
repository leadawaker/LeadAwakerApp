import { useTranslation } from "react-i18next";
import { CalendarRange, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HOME_PERIODS, type HomePeriod } from "@shared/homeTypes";

/** The Home page's one period picker: it drives the cards and every panel. */
export function PeriodMenu({ value, onChange }: { value: HomePeriod; onChange: (p: HomePeriod) => void }) {
  const { t } = useTranslation("home");
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" className="la-btn la-btn--soft shrink-0" aria-label={`${t("period.label")}: ${t(`period.${value}`)}`}
          data-testid="home-period" style={{ minHeight: 34 }}>
          <CalendarRange size={14} aria-hidden />
          {t(`period.${value}`)}
          <ChevronDown size={14} aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuRadioGroup value={value} onValueChange={(v) => onChange(v as HomePeriod)}>
          {HOME_PERIODS.map((p) => (
            <DropdownMenuRadioItem key={p} value={p} className="min-h-9 text-[13px]" data-testid={`home-period-${p}`}>
              {t(`period.${p}`)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
