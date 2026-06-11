// Status / priority / sentiment badges + their colour maps for the Lead detail
// panel. Extracted verbatim from LeadDetailPanel.tsx (structural split).
import React from "react";
import { ArrowUpCircle, Smile, Meh, Frown } from "lucide-react";
import { cn } from "@/lib/utils";

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  New: { bg: "bg-gray-500/15", text: "text-gray-600 dark:text-gray-400" },
  Contacted: { bg: "bg-indigo-600/15", text: "text-indigo-600 dark:text-indigo-400" },
  Responded: { bg: "bg-teal-500/15", text: "text-teal-600 dark:text-teal-400" },
  "Multiple Responses": { bg: "bg-green-500/15", text: "text-green-600 dark:text-green-400" },
  Qualified: { bg: "bg-lime-500/15", text: "text-lime-600 dark:text-lime-400" },
  Booked: { bg: "bg-amber-400/20", text: "text-amber-600 dark:text-amber-400" },
  Lost: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400" },
  DND: { bg: "bg-zinc-500/15", text: "text-zinc-600 dark:text-zinc-400" },
};

const PRIORITY_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  High: { bg: "bg-red-500/15", text: "text-red-600 dark:text-red-400", ring: "ring-1 ring-red-500/30" },
  Medium: { bg: "bg-amber-400/20", text: "text-amber-600 dark:text-amber-400", ring: "ring-1 ring-amber-400/30" },
  Low: { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", ring: "ring-1 ring-emerald-500/30" },
};

export function StatusBadge({ label }: { label: string }) {
  const colors = STATUS_COLORS[label] ?? { bg: "bg-muted", text: "text-muted-foreground" };
  return (
    <span
      className={cn(
        "inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold",
        colors.bg,
        colors.text
      )}
    >
      {label}
    </span>
  );
}

export function PriorityBadge({ priority }: { priority: string }) {
  const colors = PRIORITY_COLORS[priority] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    ring: "ring-1 ring-border/30",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold",
        colors.bg,
        colors.text,
        colors.ring
      )}
      data-testid="lead-detail-priority-badge"
      data-priority={priority}
    >
      <ArrowUpCircle className="h-3 w-3 shrink-0" />
      {priority}
    </span>
  );
}

const SENTIMENT_CONFIG: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
  positive: {
    bg: "bg-emerald-500/15",
    text: "text-emerald-600 dark:text-emerald-400",
    icon: <Smile className="h-3 w-3" />,
  },
  negative: {
    bg: "bg-red-500/15",
    text: "text-red-600 dark:text-red-400",
    icon: <Frown className="h-3 w-3" />,
  },
  neutral: {
    bg: "bg-zinc-500/15",
    text: "text-zinc-600 dark:text-zinc-400",
    icon: <Meh className="h-3 w-3" />,
  },
};

export function SentimentBadge({ sentiment }: { sentiment: string }) {
  const key = sentiment?.toLowerCase() ?? "";
  const config = SENTIMENT_CONFIG[key] ?? {
    bg: "bg-muted",
    text: "text-muted-foreground",
    icon: <Meh className="h-3 w-3" />,
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize",
        config.bg,
        config.text
      )}
      data-testid="ai-sentiment-badge"
      data-sentiment={key}
    >
      {config.icon}
      {sentiment}
    </span>
  );
}
