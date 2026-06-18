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
 * Panel-surface placeholder that mirrors PanelShell's variants so the skeleton
 * reflects whether the real panel is raised (white card + shadow), inset
 * (recessed beige) or flat (transparent), and uses that panel's base colour.
 */
function PanelSkel({
  variant = "raised",
  className,
  style,
  children,
}: {
  variant?: "raised" | "inset" | "flat-beige" | "flat";
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const surfaceStyle: React.CSSProperties =
    variant === "inset"
      ? { background: "var(--bg)", boxShadow: "var(--sh-inset-crisp), inset 0 0 0 1px rgba(0,0,0,0.07)" }
      : variant === "flat-beige"
      ? { background: "var(--surface)" }
      : {};
  return (
    <div
      className={cn(
        "w-full h-full rounded-[var(--r-card,16px)] p-5 flex flex-col gap-3",
        variant === "raised" && "bg-card shadow-[var(--card-glow)]",
        className,
      )}
      style={{ ...surfaceStyle, ...style }}
    >
      {children}
    </div>
  );
}

/** Title + chart-block + lines content used inside a summary panel skeleton. */
function PanelSkelContent({ chartH = 24, lines = 2 }: { chartH?: number; lines?: number }) {
  return (
    <>
      <Skeleton className="h-4 w-2/3 rounded bg-primary/10" />
      <Skeleton className="w-full rounded-lg bg-primary/10" style={{ height: chartH * 4 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} className={cn("h-3 rounded bg-primary/10", i === lines - 1 ? "w-4/5" : "w-full")} />
      ))}
    </>
  );
}

/**
 * Summary-tab body skeleton — mirrors CampaignMetricsPanel. Reuses the real
 * `.summary-*` layout classes (so widths/gaps/margins match) AND each panel's
 * real surface: AI strip = flat, Performance = inset, Pipeline = flat,
 * AI Activity = flat beige, Next = raised white, Bumps = inset, A/B = flat.
 */
function CampaignSummaryBodySkeleton() {
  return (
    <div className="summary-root w-full flex flex-col">
      {/* AI Read strip — flat row, no card */}
      <div className="px-1 py-2 flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-[var(--r-surface,10px)] bg-primary/10 shrink-0" />
        <Skeleton className="h-3.5 w-[60%] rounded bg-primary/10" />
      </div>

      {/* Performance (inset, top) + the three panels row */}
      <div className="summary-grid">
        <div className="summary-perf">
          <PanelSkel variant="inset" className="gap-4">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32 rounded bg-primary/10" />
              <Skeleton className="h-8 w-36 rounded-full bg-primary/10" />
            </div>
            <Skeleton className="h-40 w-full rounded-lg bg-primary/10" />
          </PanelSkel>
        </div>
        <div className="summary-panels">
          {/* Pipeline — flat */}
          <div className="summary-cell">
            <PanelSkel variant="flat"><PanelSkelContent /></PanelSkel>
          </div>
          {/* AI Activity — flat beige */}
          <div className="summary-cell summary-cell--rail">
            <PanelSkel variant="flat-beige"><PanelSkelContent lines={3} /></PanelSkel>
          </div>
          {/* Next — raised white */}
          <div className="summary-cell summary-cell--rail">
            <PanelSkel variant="raised"><PanelSkelContent /></PanelSkel>
          </div>
        </div>
      </div>

      {/* Bumps Today (inset) + A/B (flat) row — 22px gap + top margin from CSS */}
      <div className="summary-bumps-row">
        <div className="summary-bumps-cell">
          <PanelSkel variant="inset"><PanelSkelContent chartH={16} lines={1} /></PanelSkel>
        </div>
        <div className="summary-ab-cell">
          <PanelSkel variant="flat"><PanelSkelContent chartH={16} lines={1} /></PanelSkel>
        </div>
      </div>
    </div>
  );
}

/**
 * Configurations-tab body skeleton — mirrors CampaignSettingsLayout:
 * 190px left section nav (3 items) + large content card with editorial heading,
 * stacked form fields, and prev/next nav.
 */
function CampaignConfigBodySkeleton() {
  return (
    <div className="flex items-start pt-2" style={{ gap: "var(--gap, 22px)" }}>
      {/* Left section nav (190px, 3 items) */}
      <div className="hidden md:flex w-[190px] shrink-0 flex-col gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className={cn(
              "rounded-[var(--r-surface,14px)] px-6 py-4 flex flex-col gap-1.5",
              // First item mimics the active (raised paper) nav button; the rest are flat.
              i === 0 ? "bg-card shadow-[var(--card-glow)]" : "",
            )}
          >
            <div className="flex items-center gap-3">
              <Skeleton className="h-3 w-5 rounded bg-primary/10" />
              <Skeleton className="h-3.5 w-24 rounded bg-primary/10" />
            </div>
            <Skeleton className="h-2.5 w-full rounded bg-primary/10" />
          </div>
        ))}
      </div>
      {/* Content card */}
      <div className="flex-1 min-w-0 rounded-[var(--r-card,16px)] bg-card shadow-[var(--card-glow)] p-9 flex flex-col gap-6">
        {/* Editorial heading */}
        <div className="flex flex-col gap-3 pb-6 border-b border-border">
          <Skeleton className="h-3 w-12 rounded bg-primary/10" />
          <Skeleton className="h-10 w-2/3 rounded bg-primary/10" />
          <Skeleton className="h-3.5 w-3/4 rounded bg-primary/10" />
        </div>
        {/* Form fields */}
        <div className="flex flex-col gap-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex flex-col gap-2">
              <Skeleton className="h-3 w-28 rounded bg-primary/10" />
              <Skeleton className="h-9 w-full rounded-lg bg-primary/10" />
            </div>
          ))}
        </div>
        {/* Prev / Next nav */}
        <div className="flex items-center justify-between pt-6 border-t border-border">
          <Skeleton className="h-9 w-24 rounded-full bg-primary/10" />
          <Skeleton className="h-9 w-28 rounded-full bg-primary/10" />
        </div>
      </div>
    </div>
  );
}

/**
 * Right-panel detail skeleton for the Campaigns split-pane view.
 * Mirrors CampaignDetailView: a rounded "paper" header panel (avatar + name +
 * toolbar) above a tab-aware body (summary dashboard vs configurations form).
 * Pass the active tab so the loading shape matches what's about to render.
 */
function SkeletonCampaignPanel({ tab = "summary" }: { tab?: "summary" | "configurations" }) {
  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Header panel */}
      <div className="shrink-0" style={{ padding: "var(--space-sm) var(--space-xl)" }}>
        <div
          className="px-6 pt-6 pb-7 border border-border bg-card"
          style={{ borderRadius: "var(--r-panel, 22px)", boxShadow: "var(--sh-raised-large)" }}
        >
          <div className="flex items-start gap-3">
            {/* Avatar */}
            <Skeleton className="h-16 w-16 rounded-2xl bg-primary/10 shrink-0" />
            {/* Name + meta */}
            <div className="flex-1 min-w-0 flex flex-col gap-2.5 pt-1">
              <Skeleton className="h-6 w-1/2 rounded bg-primary/10" />
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-20 rounded-full bg-primary/10" />
                <Skeleton className="h-5 w-28 rounded-full bg-primary/10" />
              </div>
            </div>
            {/* Toolbar actions */}
            <div className="flex items-center gap-1.5 shrink-0">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-9 w-9 rounded-full bg-primary/10" />
              ))}
            </div>
          </div>
        </div>
      </div>
      {/* Tab-aware body — L/R padding matches DetailViewBody (3px summary,
          --space-xl configurations); the summary's inner padding comes from
          .summary-root, so total margins line up with the real dashboard. */}
      <div
        className="flex-1 min-h-0 overflow-y-auto"
        style={{
          paddingLeft: tab === "configurations" ? "var(--space-xl)" : 3,
          paddingRight: tab === "configurations" ? "var(--space-xl)" : 3,
          paddingBottom: 3,
        }}
      >
        {tab === "configurations" ? <CampaignConfigBodySkeleton /> : <CampaignSummaryBodySkeleton />}
      </div>
    </div>
  );
}

/**
 * Right-panel detail skeleton for the Leads split-pane view.
 * Mirrors LeadDetailView: a detached hero card (avatar + name + meta + more
 * button + pipeline dash bar) above a 3-column row (200px Contact · flexible
 * Chat · 200px Score), matching the real gaps/widths.
 */
function SkeletonLeadPanel() {
  return (
    <div className="relative flex flex-col h-full overflow-hidden" style={{ gap: 14, paddingTop: 14, paddingBottom: 14 }}>
      {/* Hero card */}
      <div
        className="shrink-0 overflow-hidden bg-card shadow-[var(--card-glow)]"
        style={{ borderRadius: "var(--r-card, 16px)" }}
      >
        <div className="flex items-center gap-4" style={{ padding: "16px 20px" }}>
          {/* Avatar */}
          <Skeleton className="h-[50px] w-[50px] rounded-[14px] bg-primary/10 shrink-0" />
          {/* Name + meta */}
          <div className="flex-1 min-w-0 flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Skeleton className="h-6 w-40 rounded bg-primary/10" />
              <Skeleton className="h-4 w-12 rounded-full bg-primary/10" />
              <Skeleton className="h-4 w-14 rounded bg-primary/10" />
            </div>
            <div className="flex items-center gap-2">
              <Skeleton className="h-2.5 w-20 rounded bg-primary/10" />
              <Skeleton className="h-2.5 w-24 rounded bg-primary/10" />
              <Skeleton className="h-2.5 w-16 rounded bg-primary/10" />
            </div>
          </div>
          {/* More button */}
          <Skeleton className="h-[34px] w-[34px] rounded-full bg-primary/10 shrink-0" />
        </div>
        {/* Pipeline dash bar */}
        <div style={{ padding: "10px 20px 12px" }}>
          <div className="flex items-end gap-1" style={{ height: 18 }}>
            {[7, 9, 16, 9, 5, 5, 5].map((h, i) => (
              <Skeleton key={i} className="flex-1 rounded-full bg-primary/10" style={{ height: h }} />
            ))}
          </div>
          <div className="flex gap-1 mt-1.5">
            {Array.from({ length: 7 }).map((_, i) => (
              <Skeleton key={i} className="flex-1 h-2 rounded bg-primary/10" />
            ))}
          </div>
        </div>
      </div>

      {/* Columns: 200 Contact · flex Chat · 200 Score */}
      <div className="flex-1 min-h-0 w-full flex flex-row" style={{ gap: 14 }}>
        {/* Contact — flat card (Card variant="flat") */}
        <div className="shrink-0 flex" style={{ width: 200 }}>
          <div className="w-full p-4 flex flex-col gap-3">
            <Skeleton className="h-16 w-16 rounded-2xl bg-primary/10 self-center" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-2.5 w-12 rounded bg-primary/10" />
                <Skeleton className="h-3.5 w-full rounded bg-primary/10" />
              </div>
            ))}
          </div>
        </div>
        {/* Chat (agency view) */}
        <div className="flex-1 min-w-0 flex">
          <div className="w-full rounded-[var(--r-card,16px)] bg-card shadow-[var(--card-glow)] flex flex-col overflow-hidden">
            {/* Conversations / Summary toggle */}
            <div className="flex items-center gap-1.5 p-2 shrink-0">
              <Skeleton className="h-8 w-28 rounded-full bg-primary/10" />
              <Skeleton className="h-8 w-20 rounded-full bg-primary/10" />
            </div>
            {/* Chat bubbles */}
            <div className="flex-1 min-h-0 p-4 flex flex-col gap-3 overflow-hidden">
              {([["left", "w-40"], ["right", "w-52"], ["left", "w-32"], ["right", "w-44"], ["left", "w-48"]] as const).map(([side, w], i) => (
                <div key={i} className={cn("flex", side === "right" ? "justify-end" : "justify-start")}>
                  <Skeleton className={cn("h-10 rounded-2xl bg-primary/10", w)} />
                </div>
              ))}
            </div>
          </div>
        </div>
        {/* Score — flat (no card surface) */}
        <div className="shrink-0 flex" style={{ width: 200 }}>
          <div className="w-full p-4 flex flex-col gap-3">
            <Skeleton className="h-3 w-20 rounded bg-primary/10" />
            <Skeleton className="h-24 w-24 rounded-full bg-primary/10 self-center" />
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="flex flex-col gap-1.5">
                <Skeleton className="h-2.5 w-16 rounded bg-primary/10" />
                <Skeleton className="h-2 w-full rounded-full bg-primary/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Right-panel detail skeleton for Accounts split-pane view.
 * Mirrors AccountDetailView layout: transparent toolbar + identity row above
 * a 3-column row of raised-white widget cards (basic info / campaigns / users),
 * matching the real `bg-card shadow-[var(--card-glow)]` widget surfaces.
 */
function SkeletonAccountPanel() {
  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Header — transparent toolbar + identity row */}
      <div className="shrink-0 px-4 pt-2 pb-4 space-y-3">
        <div className="flex items-center gap-1.5">
          <div className="flex-1" />
          {[36, 36, 36].map((w, i) => (
            <Skeleton key={i} className="h-9 rounded-full bg-primary/10" style={{ width: w }} />
          ))}
        </div>
        <div className="flex items-start gap-3">
          <Skeleton className="h-[72px] w-[72px] rounded-full bg-primary/10 shrink-0" />
          <div className="flex flex-col gap-2 flex-1 pt-1">
            <Skeleton className="h-6 w-40 rounded bg-primary/10" />
            <div className="flex items-center gap-1.5">
              <Skeleton className="h-5 w-16 rounded-full bg-primary/10" />
              <Skeleton className="h-5 w-20 rounded-full bg-primary/10" />
            </div>
          </div>
        </div>
      </div>
      {/* 3-column row of raised white widget cards (basic / campaigns / users) */}
      <div className="flex-1 min-h-0 overflow-hidden px-4 pb-4 grid grid-cols-3 gap-1.5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-card shadow-[var(--card-glow)] rounded-xl p-4 flex flex-col gap-3 min-h-0 overflow-hidden">
            <Skeleton className="h-3.5 w-1/2 rounded bg-primary/10" />
            {Array.from({ length: 5 }).map((_, j) => (
              <Skeleton key={j} className="h-3 rounded bg-primary/10" style={{ width: `${85 - j * 8}%` }} />
            ))}
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
