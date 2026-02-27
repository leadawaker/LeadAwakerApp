import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";
import { cn } from "@/lib/utils";
import { CalendarCheck, TrendingUp, TrendingDown, Minus } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/* ─── Types ────────────────────────────────────────────────────────────────── */

type BookedCallsKpiProps = {
  variant: "hero" | "compact" | "inline";
  accountId?: number;
  className?: string;
};

type LeadRow = {
  id?: number;
  Id?: number;
  conversion_status?: string;
  Conversion_Status?: string;
  booked_call_date?: string | null;
  Booked_call_date?: string | null;
  updated_at?: string;
  Last_modified_time?: string;
};

/* ─── Date helpers ─────────────────────────────────────────────────────────── */

function getMonthRange(offset: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function getWeekRange(): { start: Date; end: Date } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  // Monday = start of week
  const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - diff);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function isInRange(dateStr: string | null | undefined, start: Date, end: Date): boolean {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;
  return d >= start && d <= end;
}

function isBooked(lead: LeadRow): boolean {
  const status = lead.conversion_status || lead.Conversion_Status || "";
  return status.toLowerCase() === "booked" || status === "Call Booked";
}

function getBookedDate(lead: LeadRow): string | null {
  return lead.booked_call_date || lead.Booked_call_date || lead.updated_at || lead.Last_modified_time || null;
}

/* ─── Component ────────────────────────────────────────────────────────────── */

export function BookedCallsKpi({ variant, accountId, className }: BookedCallsKpiProps) {
  const params = new URLSearchParams();
  if (accountId) params.set("accountId", String(accountId));
  const qs = params.toString();

  const { data: leads = [], isLoading } = useQuery<LeadRow[]>({
    queryKey: ["/api/leads", "booked-kpi", accountId],
    queryFn: async () => {
      const res = await apiFetch(`/api/leads${qs ? `?${qs}` : ""}`);
      if (!res.ok) return [];
      const data = await res.json();
      const list: LeadRow[] = Array.isArray(data) ? data : data?.list || data?.data || [];
      // Only return booked leads to minimize memory usage
      return list.filter(isBooked);
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });

  const { thisMonth, lastMonth, thisWeek, trend } = useMemo(() => {
    const currentRange = getMonthRange(0);
    const prevRange = getMonthRange(-1);
    const weekRange = getWeekRange();

    let thisMonthCount = 0;
    let lastMonthCount = 0;
    let thisWeekCount = 0;

    for (const lead of leads) {
      const dateStr = getBookedDate(lead);
      if (isInRange(dateStr, currentRange.start, currentRange.end)) thisMonthCount++;
      if (isInRange(dateStr, prevRange.start, prevRange.end)) lastMonthCount++;
      if (isInRange(dateStr, weekRange.start, weekRange.end)) thisWeekCount++;
    }

    let trendPct = 0;
    let trendDir: "up" | "down" | "flat" = "flat";
    if (lastMonthCount > 0) {
      trendPct = Math.round(((thisMonthCount - lastMonthCount) / lastMonthCount) * 100);
      trendDir = trendPct > 0 ? "up" : trendPct < 0 ? "down" : "flat";
    } else if (thisMonthCount > 0) {
      trendDir = "up";
      trendPct = 100;
    }

    return {
      thisMonth: thisMonthCount,
      lastMonth: lastMonthCount,
      thisWeek: thisWeekCount,
      trend: { pct: Math.abs(trendPct), dir: trendDir },
    };
  }, [leads]);

  /* ── Hero variant ─────────────────────────────────────────────── */
  if (variant === "hero") {
    return (
      <div
        className={cn(
          "bg-[#FCB803]/10 border border-[#FCB803]/30 rounded-2xl px-5 py-3.5 flex items-center gap-5 shrink-0",
          className
        )}
        data-testid="kpi-booked-calls-hero"
      >
        {/* Icon */}
        <div className="h-12 w-12 rounded-xl bg-[#FCB803]/20 flex items-center justify-center shrink-0">
          <CalendarCheck className="h-6 w-6 text-[#131B49]" />
        </div>

        {/* Monthly stat */}
        <div className="flex flex-col min-w-0">
          <span className="text-sm font-medium text-[#131B49]/70 leading-tight">
            Calls Booked This Month
          </span>
          <div className="flex items-baseline gap-2.5 mt-0.5">
            <span className="text-4xl font-bold text-[#131B49] tabular-nums leading-none">
              {isLoading ? "--" : thisMonth}
            </span>
            {/* Trend badge */}
            {!isLoading && (
              <span
                className={cn(
                  "inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums rounded-full px-2 py-0.5",
                  trend.dir === "up" && "bg-emerald-100 text-emerald-700",
                  trend.dir === "down" && "bg-red-100 text-red-700",
                  trend.dir === "flat" && "bg-zinc-100 text-zinc-500"
                )}
              >
                {trend.dir === "up" && <TrendingUp className="h-3 w-3" />}
                {trend.dir === "down" && <TrendingDown className="h-3 w-3" />}
                {trend.dir === "flat" && <Minus className="h-3 w-3" />}
                {trend.pct}%
              </span>
            )}
          </div>
        </div>

        {/* Divider */}
        <div className="w-px h-10 bg-[#FCB803]/25 shrink-0 hidden sm:block" />

        {/* Weekly stat */}
        <div className="flex flex-col min-w-0 hidden sm:flex">
          <span className="text-sm font-medium text-[#131B49]/70 leading-tight">
            This Week
          </span>
          <span className="text-2xl font-bold text-[#131B49] tabular-nums leading-none mt-0.5">
            {isLoading ? "--" : thisWeek}
          </span>
        </div>

        {/* Last month comparison */}
        <div className="flex flex-col min-w-0 hidden md:flex">
          <span className="text-sm font-medium text-[#131B49]/70 leading-tight">
            Last Month
          </span>
          <span className="text-2xl font-bold text-[#131B49]/50 tabular-nums leading-none mt-0.5">
            {isLoading ? "--" : lastMonth}
          </span>
        </div>
      </div>
    );
  }

  /* ── Inline variant (sits next to page title) ─────────────── */
  if (variant === "inline") {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              className={cn(
                "inline-flex items-center gap-1.5 h-8 px-2.5 rounded-full bg-[#FCB803]/15 cursor-default select-none shrink-0",
                className
              )}
              data-testid="kpi-booked-calls-inline"
            >
              <CalendarCheck className="h-4 w-4 text-[#131B49]" />
              <span className="text-[15px] font-bold tabular-nums text-[#131B49] leading-none">
                {isLoading ? "-" : thisMonth}
              </span>
              {!isLoading && (
                <span
                  className={cn(
                    "inline-flex items-center gap-0.5 text-[10px] font-semibold tabular-nums leading-none",
                    trend.dir === "up" && "text-emerald-600",
                    trend.dir === "down" && "text-red-600",
                    trend.dir === "flat" && "text-zinc-400"
                  )}
                >
                  {trend.dir === "up" && <TrendingUp className="h-3 w-3" />}
                  {trend.dir === "down" && <TrendingDown className="h-3 w-3" />}
                  {trend.dir === "flat" && <Minus className="h-3 w-3" />}
                  {trend.pct}%
                </span>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
            <div className="flex flex-col gap-0.5">
              <span>Calls Booked This Month: {isLoading ? "..." : thisMonth}</span>
              <span className="text-muted-foreground">This Week: {isLoading ? "..." : thisWeek} | Last Month: {isLoading ? "..." : lastMonth}</span>
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  /* ── Compact variant (topbar) ──────────────────────────────── */
  return (
    <TooltipProvider delayDuration={400}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "hidden md:inline-flex items-center gap-1.5 px-2.5 h-10 rounded-full cursor-default select-none",
              className
            )}
            data-testid="kpi-booked-calls-compact"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-[#FCB803] opacity-50 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FCB803]" />
            </span>
            <CalendarCheck className="h-4 w-4 text-[#131B49] dark:text-[#FCB803]" />
            <span className="text-[13px] font-semibold tabular-nums text-foreground">
              {isLoading ? "-" : thisMonth}
            </span>
          </div>
        </TooltipTrigger>
        <TooltipContent className="bg-popover text-popover-foreground border border-border/40 shadow-sm rounded-lg text-xs font-medium">
          Calls Booked This Month: {isLoading ? "..." : thisMonth}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
