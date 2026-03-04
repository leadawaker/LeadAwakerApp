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
  return <Skeleton className={cn("h-4 w-4 rounded", className)} {...props} />
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
 * Conversation thread (chat panel) loading skeleton.
 * Mimics a mix of inbound and outbound chat bubbles to match the final layout.
 */
function SkeletonChatThread({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  // Alternating left/right bubble layout with varying widths
  const bubbles = [
    { side: "left", width: "w-48", lines: 1 },
    { side: "right", width: "w-56", lines: 2 },
    { side: "left", width: "w-40", lines: 1 },
    { side: "right", width: "w-64", lines: 1 },
    { side: "left", width: "w-52", lines: 2 },
    { side: "right", width: "w-44", lines: 1 },
  ] as const;

  return (
    <div className={cn("p-4 space-y-4", className)} {...props}>
      {bubbles.map((b, i) => (
        <div key={i} className={cn("flex flex-col", b.side === "right" ? "items-end" : "items-start")}>
          {/* Sender label skeleton */}
          <Skeleton className="h-4 w-12 rounded-full mb-1" />
          {/* Bubble skeleton */}
          <Skeleton className={cn("rounded-2xl px-3 py-2 space-y-1.5", b.width)}>
            {Array.from({ length: b.lines }).map((_, j) => (
              <Skeleton
                key={j}
                className={cn(
                  "h-3 rounded bg-primary/5",
                  j === b.lines - 1 && b.lines > 1 ? "w-3/4" : "w-full",
                )}
              />
            ))}
            {/* Timestamp skeleton */}
            <Skeleton className="h-2.5 w-20 rounded bg-primary/5 mt-1" />
          </Skeleton>
        </div>
      ))}
    </div>
  );
}

/**
 * Lead context panel (ContactSidebar) loading skeleton.
 * Mimics the avatar, score card, pipeline stage, contact info, and tags sections.
 */
function SkeletonContactPanel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-4 space-y-4", className)} {...props}>
      {/* Lead identity: avatar + name */}
      <div className="flex items-start gap-3">
        <SkeletonAvatar className="h-10 w-10 shrink-0" />
        <div className="flex-1 space-y-2 pt-0.5">
          <SkeletonText className="h-4 w-3/4" />
          <SkeletonText className="h-3 w-1/2" />
        </div>
      </div>

      {/* Lead score card skeleton */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
        <div className="flex items-center justify-between">
          <SkeletonText className="h-3 w-20" />
          <SkeletonText className="h-5 w-12 rounded" />
        </div>
        {/* Score bar */}
        <Skeleton className="h-1.5 w-full rounded-full" />
      </div>

      {/* Pipeline stage card skeleton */}
      <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-2">
        <SkeletonText className="h-3 w-24" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-20 rounded-full" />
          <SkeletonText className="h-3 w-24" />
        </div>
        {/* Progress dots */}
        <div className="flex items-center gap-1 mt-1">
          {[1, 2, 3].map((n) => (
            <Skeleton key={n} className="h-1.5 flex-1 rounded-full" />
          ))}
        </div>
      </div>

      {/* Contact info card skeleton */}
      <div className="space-y-2">
        <SkeletonText className="h-3 w-20" />
        <div className="rounded-xl border border-border bg-muted/10 p-3 space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-3.5 w-3.5 rounded shrink-0 mt-0.5" />
              <div className="flex-1 space-y-1">
                <SkeletonText className="h-2.5 w-8" />
                <SkeletonText className="h-4 w-3/4" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tags skeleton */}
      <div className="space-y-2">
        <SkeletonText className="h-3 w-8" />
        <div className="flex flex-wrap gap-1.5">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-6 w-16 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
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

/**
 * Right-panel detail skeleton for Campaigns split-pane view.
 * Mirrors CampaignDetailView layout: toolbar, tab bar, 3×2 card grid.
 */
function SkeletonCampaignPanel() {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white dark:from-card to-amber-50/30 dark:to-transparent rounded-lg overflow-hidden">
      {/* Toolbar row */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-black/[0.06] shrink-0">
        <div className="flex items-center gap-1.5">
          {[64, 32, 32, 32, 32].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {[32, 32, 32].map((_, i) => (
            <Skeleton key={i} className="h-9 w-9 rounded-full bg-primary/10" />
          ))}
        </div>
      </div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-black/[0.06] shrink-0">
        {[80, 110, 60].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
        ))}
      </div>
      {/* 3×2 card grid */}
      <div className="flex-1 min-h-0 p-3 grid grid-cols-3 grid-rows-2 gap-[3px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-6 flex flex-col gap-3">
            <Skeleton className="h-4 w-2/3 rounded bg-primary/10" />
            <Skeleton className="h-8 w-1/2 rounded bg-primary/10" />
            <Skeleton className="h-3 w-full rounded bg-primary/10" />
            <Skeleton className="h-3 w-4/5 rounded bg-primary/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Right-panel detail skeleton for Leads split-pane view.
 * Mirrors LeadDetailPanel layout: toolbar, identity row, pipeline tube, content lines.
 */
function SkeletonLeadPanel() {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white dark:from-card to-amber-50/30 dark:to-transparent rounded-lg overflow-hidden">
      {/* Toolbar row */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-black/[0.06] shrink-0">
        {[80, 80, 80].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
        ))}
      </div>
      {/* Identity row */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.06] shrink-0">
        <Skeleton className="h-[65px] w-[65px] rounded-full bg-primary/10 shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-[27px] w-48 rounded bg-primary/10" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-6 w-20 rounded-full bg-primary/10" />
            <Skeleton className="h-6 w-16 rounded-full bg-primary/10" />
          </div>
        </div>
      </div>
      {/* Pipeline tube */}
      <div className="px-5 py-3 border-b border-black/[0.06] shrink-0">
        <div className="relative h-[46px] bg-black/[0.06] rounded-full w-full overflow-visible">
          <div className="absolute inset-0 flex items-center justify-around px-3">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-7 rounded-full bg-primary/10 shrink-0" />
            ))}
          </div>
        </div>
      </div>
      {/* Content lines */}
      <div className="flex-1 min-h-0 px-5 py-4 flex flex-col gap-4 overflow-hidden">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded bg-primary/10" />
          {[100, 80, 90].map((pct, i) => (
            <Skeleton key={i} className="h-4 rounded bg-primary/10" style={{ width: `${pct}%` }} />
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <Skeleton className="h-3 w-24 rounded bg-primary/10" />
          {[100, 70].map((pct, i) => (
            <Skeleton key={i} className="h-4 rounded bg-primary/10" style={{ width: `${pct}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Right-panel detail skeleton for Accounts split-pane view.
 * Mirrors AccountDetailView layout: toolbar, identity row, 3×2 card grid.
 */
function SkeletonAccountPanel() {
  return (
    <div className="flex flex-col h-full bg-gradient-to-b from-white dark:from-card to-amber-50/30 dark:to-transparent rounded-lg overflow-hidden">
      {/* Toolbar row */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-black/[0.06] shrink-0">
        {[80, 60, 60].map((w, i) => (
          <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
        ))}
      </div>
      {/* Identity row */}
      <div className="flex items-center gap-4 px-5 py-4 border-b border-black/[0.06] shrink-0">
        <Skeleton className="h-[72px] w-[72px] rounded-full bg-primary/10 shrink-0" />
        <div className="flex flex-col gap-2 flex-1">
          <Skeleton className="h-6 w-40 rounded bg-primary/10" />
          <div className="flex items-center gap-1.5">
            <Skeleton className="h-5 w-16 rounded-full bg-primary/10" />
            <Skeleton className="h-5 w-20 rounded-full bg-primary/10" />
          </div>
        </div>
      </div>
      {/* 3×2 card grid */}
      <div className="flex-1 min-h-0 p-3 grid grid-cols-3 grid-rows-2 gap-[3px]">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="bg-white/60 dark:bg-white/[0.10] rounded-xl p-5 flex flex-col gap-3">
            <Skeleton className="h-3 w-2/3 rounded bg-primary/10" />
            <Skeleton className="h-7 w-1/2 rounded bg-primary/10" />
            <Skeleton className="h-3 w-full rounded bg-primary/10" />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Settings section skeleton — mimics a form with labelled fields + save button.
 */
function SkeletonSettingsSection({
  rows = 3,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement> & { rows?: number }) {
  return (
    <div className={cn("space-y-5", className)} {...props}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="space-y-1.5" style={{ animationDelay: `${i * 60}ms` }}>
          <Skeleton className="h-3 w-24 rounded" style={{ animationDelay: `${i * 60}ms` }} />
          <Skeleton className="h-9 w-full rounded-lg" style={{ animationDelay: `${20 + i * 60}ms` }} />
        </div>
      ))}
      <Skeleton className="h-9 w-28 rounded-full mt-2" style={{ animationDelay: `${rows * 60}ms` }} />
    </div>
  );
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
  SkeletonCardGrid,
  SkeletonList,
  SkeletonChatThread,
  SkeletonContactPanel,
  SkeletonLeadDetail,
  SkeletonCampaignPanel,
  SkeletonLeadPanel,
  SkeletonAccountPanel,
  SkeletonSettingsSection,
}
