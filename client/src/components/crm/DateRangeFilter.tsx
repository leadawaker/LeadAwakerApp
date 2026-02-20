import React, { useState, useMemo, useCallback } from "react";
import { Calendar as CalendarIcon } from "lucide-react";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { DateRange } from "react-day-picker";

export type DatePreset = "today" | "7d" | "30d" | "custom";

export interface DateRangeValue {
  preset: DatePreset;
  from: Date;
  to: Date;
}

function getPresetRange(preset: Exclude<DatePreset, "custom">): { from: Date; to: Date } {
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

const PRESETS: { label: string; value: Exclude<DatePreset, "custom"> }[] = [
  { label: "Today", value: "today" },
  { label: "7d", value: "7d" },
  { label: "30d", value: "30d" },
];

function formatDateShort(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function getDefaultDateRange(): DateRangeValue {
  const { from, to } = getPresetRange("30d");
  return { preset: "30d", from, to };
}

interface DateRangeFilterProps {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
}

export function DateRangeFilter({ value, onChange }: DateRangeFilterProps) {
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [pendingRange, setPendingRange] = useState<DateRange | undefined>(undefined);

  const handlePresetClick = useCallback(
    (preset: Exclude<DatePreset, "custom">) => {
      const range = getPresetRange(preset);
      onChange({ preset, ...range });
    },
    [onChange]
  );

  const handleCalendarSelect = useCallback(
    (range: DateRange | undefined) => {
      setPendingRange(range);
      if (range?.from && range?.to) {
        // Only close and apply when a real range is selected (two distinct clicks).
        // react-day-picker sets from === to on the first click, then updates
        // to a proper range on the second click. We track via pendingRange:
        // if pendingRange already had a from but no to, or from === to,
        // then this second selection completes the range.
        const rangeIsComplete =
          pendingRange?.from != null &&
          range.from.getTime() !== range.to.getTime();
        // Also allow same-day range if the user explicitly re-clicks the same day
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
      return `${formatDateShort(value.from)} - ${formatDateShort(value.to)}`;
    }
    return null;
  }, [value]);

  return (
    <div
      className="inline-flex items-center gap-1 rounded-xl border border-border bg-muted/20 p-1"
      data-testid="date-range-filter"
    >
      {PRESETS.map((p) => (
        <button
          key={p.value}
          type="button"
          onClick={() => handlePresetClick(p.value)}
          className={cn(
            "h-8 px-3 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap",
            value.preset === p.value
              ? "bg-background shadow-sm text-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
          data-testid={`date-preset-${p.value}`}
          data-active={value.preset === p.value}
        >
          {p.label}
        </button>
      ))}

      <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "h-8 px-3 rounded-lg text-xs font-semibold transition-colors flex items-center gap-1.5 whitespace-nowrap",
              value.preset === "custom"
                ? "bg-background shadow-sm text-foreground"
                : "text-muted-foreground hover:text-foreground"
            )}
            data-testid="date-preset-custom"
            data-active={value.preset === "custom"}
          >
            <CalendarIcon className="w-3.5 h-3.5" />
            {displayLabel || "Custom"}
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="end" sideOffset={8}>
          <Calendar
            mode="range"
            selected={pendingRange || (value.preset === "custom" ? { from: value.from, to: value.to } : undefined)}
            onSelect={handleCalendarSelect}
            numberOfMonths={2}
            disabled={{ after: new Date() }}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}

/**
 * Utility to check if a date string/timestamp falls within a DateRangeValue.
 * Used to filter data client-side based on the selected date range.
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
