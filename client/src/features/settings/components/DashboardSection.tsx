import { useTranslation } from "react-i18next";
import { useToast } from "@/hooks/use-toast";
import { useDashboardRefreshInterval, REFRESH_INTERVAL_OPTIONS } from "@/hooks/useDashboardRefreshInterval";
import { cn } from "@/lib/utils";

export function DashboardSection() {
  const { t } = useTranslation("settings");
  const { toast } = useToast();
  const { intervalSeconds, setIntervalSeconds, labelForInterval } = useDashboardRefreshInterval();

  return (
    <div className="space-y-6" data-testid="section-dashboard">
      <p className="text-sm text-muted-foreground">
        {t("dashboard.description")}
      </p>

      <div className="rounded-xl bg-muted/60 p-5 space-y-4">
        <div>
          <div className="text-sm font-semibold">{t("dashboard.autoRefresh")}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {t("dashboard.current")} <span className="font-semibold text-foreground" data-testid="text-current-interval">{labelForInterval}</span>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2" data-testid="refresh-interval-options">
          {REFRESH_INTERVAL_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => {
                setIntervalSeconds(option.value);
                toast({
                  variant: "success",
                  title: t("dashboard.refreshUpdated"),
                  description: option.value === 0 ? t("dashboard.autoRefreshDisabled") : t("dashboard.refreshEvery", { interval: option.label }),
                });
              }}
              className={cn(
                "h-10 rounded-full text-[13px] font-semibold transition-colors duration-150",
                intervalSeconds === option.value
                  ? "border-2 border-[#FCB803] bg-[#FCB803]/15 text-foreground"
                  : "bg-background border border-black/[0.125] hover:bg-card text-muted-foreground"
              )}
              data-testid={`refresh-interval-option-${option.value}`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
