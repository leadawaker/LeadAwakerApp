import { cn } from "@/lib/utils"

/**
 * Base Skeleton component - a pulsing placeholder that matches content shape.
 * Used to build all loading state skeletons across the app.
 */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("animate-pulse rounded-md bg-primary/10", className)}
      {...props}
    />
  )
}

/* ─── Variant helpers ─── */

/** Single line of text (default height ~14px) */
function SkeletonText({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-3.5 rounded", className)} {...props} />
}

/** Circular avatar placeholder */
function SkeletonAvatar({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-9 w-9 rounded-full shrink-0", className)} {...props} />
}

/** Rectangular badge placeholder */
function SkeletonBadge({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-5 w-16 rounded-full", className)} {...props} />
}

/** Icon-sized square placeholder */
function SkeletonIcon({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <Skeleton className={cn("h-5 w-5 rounded", className)} {...props} />
}

/** Card placeholder with header, body lines, and optional footer */
function SkeletonCard({ className, lines = 3, ...props }: React.HTMLAttributes<HTMLDivElement> & { lines?: number }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm space-y-3", className)} {...props}>
      <SkeletonText className="h-4 w-3/5" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <SkeletonText
            key={i}
            className={cn("h-3", i === lines - 1 ? "w-2/5" : "w-full")}
          />
        ))}
      </div>
    </div>
  )
}

/**
 * Table row skeleton that mimics a real data row.
 * Renders a configurable number of "cell" skeletons.
 */
function SkeletonTableRow({
  columns = 5,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { columns?: number }) {
  // Vary widths to look natural
  const widths = ["w-3/4", "w-1/2", "w-2/3", "w-1/3", "w-4/5", "w-2/5", "w-3/5"];
  return (
    <div
      className={cn("flex items-center gap-4 px-4 py-3 border-b border-border/40", className)}
      {...props}
    >
      {/* Checkbox placeholder */}
      <Skeleton className="h-4 w-4 rounded shrink-0" />
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} className="flex-1 min-w-0">
          <SkeletonText className={cn(widths[i % widths.length])} />
        </div>
      ))}
    </div>
  )
}

/**
 * Full table skeleton with header + N rows.
 * Matches the DataTable layout shape.
 */
function SkeletonTable({
  rows = 8,
  columns = 5,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number; columns?: number }) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card shadow-sm overflow-hidden", className)} {...props}>
      {/* Header skeleton */}
      <div className="flex items-center gap-4 px-4 py-3 bg-muted/50 border-b border-border">
        <Skeleton className="h-4 w-4 rounded shrink-0" />
        {Array.from({ length: columns }).map((_, i) => (
          <div key={i} className="flex-1">
            <SkeletonText className="h-3 w-20" />
          </div>
        ))}
      </div>
      {/* Row skeletons */}
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonTableRow key={i} columns={columns} />
      ))}
    </div>
  )
}

/**
 * Dashboard metric card skeleton.
 * Matches the KPI stat card shape with icon + value + label.
 */
function SkeletonMetricCard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("rounded-2xl border border-border bg-card p-4 shadow-sm flex items-center gap-3", className)} {...props}>
      <Skeleton className="h-10 w-10 rounded-xl shrink-0" />
      <div className="min-w-0 flex-1 space-y-2">
        <SkeletonText className="h-4 w-2/3" />
        <SkeletonText className="h-3 w-1/3" />
      </div>
    </div>
  )
}

/**
 * Full-page loading skeleton for dashboard.
 * Renders quick-jump cards + metric cards + chart area.
 */
function SkeletonDashboard({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-6", className)} {...props}>
      {/* Quick Jump Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <SkeletonMetricCard key={i} />
        ))}
      </div>
      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
        {Array.from({ length: 7 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-2xl" />
        ))}
      </div>
      {/* Chart area */}
      <Skeleton className="h-64 rounded-2xl" />
    </div>
  )
}

/**
 * Grid of card skeletons (for Prompt Library, etc.)
 */
function SkeletonCardGrid({
  count = 6,
  columns = "grid-cols-1 md:grid-cols-2 xl:grid-cols-3",
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { count?: number; columns?: string }) {
  return (
    <div className={cn("grid gap-4", columns, className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} lines={2} />
      ))}
    </div>
  )
}

/**
 * List skeleton for conversation threads, etc.
 */
function SkeletonList({
  count = 6,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { count?: number }) {
  return (
    <div className={cn("space-y-1", className)} {...props}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 px-3 py-3 rounded-lg">
          <SkeletonAvatar />
          <div className="flex-1 min-w-0 space-y-2">
            <SkeletonText className="h-3.5 w-1/3" />
            <SkeletonText className="h-3 w-2/3" />
          </div>
          <SkeletonText className="h-3 w-10 shrink-0" />
        </div>
      ))}
    </div>
  )
}

/**
 * Lead detail page skeleton
 */
function SkeletonLeadDetail({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-6 px-6 py-6", className)} {...props}>
      {/* Header */}
      <div className="flex items-center gap-4">
        <SkeletonAvatar className="h-14 w-14" />
        <div className="space-y-2 flex-1">
          <SkeletonText className="h-5 w-48" />
          <SkeletonText className="h-3 w-32" />
        </div>
        <Skeleton className="h-9 w-24 rounded-lg" />
      </div>
      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SkeletonCard lines={4} />
        <SkeletonCard lines={4} />
      </div>
      {/* Timeline */}
      <div className="space-y-3">
        <SkeletonText className="h-4 w-32" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <Skeleton className="h-3 w-3 rounded-full mt-1 shrink-0" />
            <div className="flex-1 space-y-2">
              <SkeletonText className="h-3.5 w-3/4" />
              <SkeletonText className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export {
  Skeleton,
  SkeletonText,
  SkeletonAvatar,
  SkeletonBadge,
  SkeletonIcon,
  SkeletonCard,
  SkeletonTableRow,
  SkeletonTable,
  SkeletonMetricCard,
  SkeletonDashboard,
  SkeletonCardGrid,
  SkeletonList,
  SkeletonLeadDetail,
}
