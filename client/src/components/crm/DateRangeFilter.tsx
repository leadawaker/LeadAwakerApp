import React, { useState, useMemo, useCallback } from "react";
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayButtonProps } from "react-day-picker";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DatePreset = "today" | "7d" | "30d" | "all" | "custom";

export interface DateRangeValue {
  preset: DatePreset;
  from: Date;
  to: Date;
}

function getPresetRange(preset: Exclude<DatePreset, "custom" | "all">): { from: Date; to: Date } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

  switch (preset) {
    case "today": {
      const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      return { from, to };
    }
    case "7d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 6);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
    case "30d": {
      const from = new Date(to);
      from.setDate(from.getDate() - 29);
      from.setHours(0, 0, 0, 0);
      return { from, to };
    }
  }
}

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getDefaultDateRange(): DateRangeValue {
  const { from, to } = getPresetRange("30d");
  return { preset: "30d", from, to };
}

// ── Custom Day Button ─────────────────────────────────────────────────────────

function CampaignDayButton({ day, modifiers, onClick, onKeyDown, onMouseEnter, onMouseLeave, tabIndex, "aria-label": ariaLabel }: DayButtonProps) {
  const isWeekend = day.date.getDay() === 0 || day.date.getDay() === 6;
  const isSelected = modifiers.range_start || modifiers.range_end;
  const isMiddle = modifiers.range_middle;
  const isToday = modifiers.today;
  const isDisabled = modifiers.disabled;
  const isOutside = modifiers.outside;

  return (
    <button
      type="button"
      onClick={onClick}
      onKeyDown={onKeyDown}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      tabIndex={tabIndex}
      aria-label={ariaLabel}
      disabled={isDisabled}
      className={cn(
        "flex h-8 w-8 items-center justify-center rounded-lg text-[13px] select-none mx-auto",
        "hover:bg-orange-100/60 transition-colors",
        isDisabled && "opacity-25 pointer-events-none",
        isOutside && "opacity-0 pointer-events-none",
        // Order matters — more specific wins
        (isSelected || isMiddle) && "text-orange-500 font-bold hover:bg-orange-100/60",
        !isSelected && !isMiddle && isToday && "text-blue-500 font-bold",
        !isSelected && !isMiddle && !isToday && isWeekend && "text-foreground/35 font-normal",
        !isSelected && !isMiddle && !isToday && !isWeekend && "text-foreground font-normal",
      )}
    >
      {day.date.getDate()}
    </button>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** If provided, enables an "All" button showing data from this date to now. */
  allFrom?: Date;
}

const PRESET_LABELS: Array<{ label: string; value: Exclude<DatePreset, "all" | "custom"> }> = [
  { label: "1D",  value: "today" },
  { label: "7D",  value: "7d"   },
  { label: "1M",  value: "30d"  },
];

export function DateRangeFilter({ value, onChange, allFrom }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  const handlePresetClick = useCallback(
    (preset: Exclude<DatePreset, "custom" | "all">) => {
      const range = getPresetRange(preset);
      onChange({ preset, ...range });
    },
    [onChange]
  );

  const handleAllClick = useCallback(() => {
    if (!allFrom) return;
    const to = new Date();
    to.setHours(23, 59, 59, 999);
    onChange({ preset: "all", from: allFrom, to });
  }, [allFrom, onChange]);

  const handleCalendarSelect = useCallback(
    (range: DateRange | undefined) => {
      setPendingRange(range);
      if (range?.from && range?.to) {
        const rangeIsComplete =
          pendingRange?.from != null &&
          range.from.getTime() !== range.to.getTime();
        const isSameDayReclick =
          pendingRange?.from != null &&
          pendingRange?.to != null &&
          pendingRange.from.getTime() === pendingRange.to.getTime() &&
          range.from.getTime() === range.to.getTime() &&
          range.from.getTime() !== pendingRange.from.getTime();

        if (rangeIsComplete || isSameDayReclick) {
          const from = new Date(range.from);
          from.setHours(0, 0, 0, 0);
          const to = new Date(range.to);
          to.setHours(23, 59, 59, 999);
          onChange({ preset: "custom", from, to });
          setCalendarOpen(false);
          setPendingRange(undefined);
        }
      }
    },
    [onChange, pendingRange]
  );

  const displayLabel = useMemo(() => {
    if (value.preset === "custom") {
      return `${formatDateShort(value.from)} – ${formatDateShort(value.to)}`;
    }
    return null;
  }, [value]);

  const btnBase = "h-8 px-2.5 text-[11px] font-semibold transition-colors whitespace-nowrap rounded-full";
  const btnActive = "bg-brand-indigo/15 text-brand-indigo";
  const btnInactive = "text-foreground/40 hover:text-foreground/70";

  return (
    <div className="inline-flex items-center gap-0.5 rounded-full border border-border/40 bg-card/70 px-1 py-0.5" data-testid="date-range-filter">
      {PRESET_LABELS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => handlePresetClick(p.value)}
          className={cn(btnBase, value.preset === p.value ? btnActive : btnInactive)}
          data-testid={`date-preset-${p.value}`}
          data-active={value.preset === p.value}
        >
          {p.label}
        </button>
      ))}

      {allFrom && (
        <button
          type="button"
          onClick={handleAllClick}
          className={cn(btnBase, value.preset === "all" ? btnActive : btnInactive)}
          data-testid="date-preset-all"
          data-active={value.preset === "all"}
        >
          All
        </button>
      )}

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              btnBase,
              "flex items-center gap-1",
              value.preset === "custom" ? btnActive : btnInactive
            )}
            data-testid="date-preset-custom"
            data-active={value.preset === "custom"}
          >
            <CalendarIcon className="w-3 h-3" />
            {displayLabel || "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent
          className="w-auto p-4 rounded-2xl border border-border/20 shadow-[0_8px_40px_rgba(0,0,0,0.10)]"
          align="end"
          sideOffset={10}
        >
          <DayPicker
            mode="range"
            numberOfMonths={1}
            showOutsideDays={false}
            selected={pendingRange || (value.preset === "custom" ? { from: value.from, to: value.to } : undefined)}
            onSelect={handleCalendarSelect}
            disabled={{ after: new Date() }}
            formatters={{
              formatWeekdayName: (date) => ["S","M","T","W","T","F","S"][date.getDay()],
              formatMonthCaption: (date) =>
                date.toLocaleString("default", { month: "short", year: "numeric" }),
            }}
            components={{
              DayButton: CampaignDayButton,
              Nav: ({ onPreviousClick, onNextClick }) => (
                <div className="flex items-center justify-between mb-3">
                  <button
                    type="button"
                    onClick={onPreviousClick}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/50 text-foreground/50 hover:text-foreground transition-colors"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={onNextClick}
                    className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-muted/50 text-foreground/50 hover:text-foreground transition-colors"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              ),
            }}
            classNames={{
              root: "w-[260px]",
              months: "flex flex-col",
              month: "flex flex-col",
              month_caption: "flex justify-center mb-2",
              caption_label: "text-[13px] font-semibold text-foreground",
              nav: "",
              table: "w-full border-collapse",
              weekdays: "flex",
              weekday: "flex-1 text-center text-[11px] font-medium text-foreground/30 pb-2",
              week: "flex w-full mt-1",
              day: "flex-1 flex items-center justify-center",
              range_start: "",
              range_middle: "",
              range_end: "",
              today: "",
              outside: "",
              disabled: "",
              hidden: "invisible",
            }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Utility to check if a date string/timestamp falls within a DateRangeValue.
 */
export function isWithinDateRange(
  dateStr: string | number | null | undefined,
  range: DateRangeValue
): boolean {
  if (!dateStr) return false;
  const date = typeof dateStr === "string" ? new Date(dateStr) : new Date(dateStr);
  if (isNaN(date.getTime())) return false;
  return date >= range.from && date <= range.to;
}
