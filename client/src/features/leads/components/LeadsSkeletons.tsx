// Loading skeletons for the Chats and Leads pages, shaped like the real layout:
// the table (header, group band, 52px rows), the pipeline columns, and the
// Chats detail pane (hero, recap sidebar on the left, chat on the right).
import { ListHeadSkeleton, ListSection, SplitListSkeleton } from "@/components/crm/primitives";

const bar = "bg-primary/10 rounded-full";

/** Leads Table view: sticky header, one group band, then 52px rows. */
export function TableSkeleton() {
  const cols = [180, 120, 140, 110, 120, 160, 120];
  return (
    <div className="h-full overflow-hidden" data-testid="leads-table-skeleton">
      <div className="flex items-center gap-4 h-[37px] px-3" style={{ borderBottom: "1px solid var(--line)" }}>
        <div className="h-[18px] w-[18px] rounded-[5px] bg-primary/10 shrink-0" />
        {cols.map((w, i) => <div key={i} className={`h-2 ${bar} shrink-0`} style={{ width: Math.round(w * 0.4) }} />)}
      </div>
      <div className="flex items-center gap-2 h-[44px] px-3 animate-pulse" style={{ background: "color-mix(in srgb, var(--bg-2) 55%, var(--bg) 45%)", borderBottom: "1px solid var(--line-strong)" }}>
        <div className="h-[18px] w-[18px] rounded-[5px] bg-primary/10 shrink-0" />
        <div className={`h-2 w-16 ${bar}`} />
        <div className={`h-3 w-6 ${bar}`} />
      </div>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 h-[52px] px-3 animate-pulse" style={{ borderBottom: "1px solid var(--line)", animationDelay: `${i * 40}ms` }}>
          <div className="h-[18px] w-[18px] rounded-[5px] bg-primary/10 shrink-0" />
          <div className="flex items-center gap-2.5 shrink-0" style={{ width: cols[0] }}>
            <div className="h-[30px] w-[30px] rounded-[8px] bg-primary/10 shrink-0" />
            <div className={`h-3 ${bar}`} style={{ width: `${50 + ((i * 13) % 40)}%` }} />
          </div>
          <div className="flex items-center gap-1.5 shrink-0" style={{ width: cols[1] }}>
            <div className="h-2 w-2 rounded-full bg-primary/15" />
            <div className={`h-2.5 w-16 ${bar}`} />
          </div>
          {cols.slice(2).map((w, j) => (
            <div key={j} className={`h-2.5 ${bar} shrink-0`} style={{ width: Math.round(w * (0.45 + ((i + j) % 4) * 0.1)), opacity: 0.7 }} />
          ))}
        </div>
      ))}
    </div>
  );
}

/** Pipeline view: column header (dot, label, count pill) over an inset body of cards. */
export function KanbanSkeleton({ columns = 8 }: { columns?: number }) {
  return (
    <div className="flex gap-3 h-full overflow-hidden" data-testid="kanban-loading-skeleton">
      {Array.from({ length: columns }).map((_, c) => (
        <div key={c} className="flex flex-col h-full shrink-0 w-[210px] min-w-[195px]" data-testid="kanban-skeleton-column">
          <div className="flex items-center gap-2 px-1 pb-2.5">
            <span className="bg-primary/15" style={{ width: 9, height: 9, borderRadius: 3 }} />
            <div className={`h-2.5 w-20 ${bar}`} />
            <div className={`h-3.5 w-7 ml-auto ${bar}`} />
          </div>
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden" style={{ borderRadius: "var(--r-card)", padding: 8, gap: 8, background: "var(--bg)", boxShadow: "var(--sh-inset-crisp)" }}>
            {Array.from({ length: Math.max(1, 4 - (c % 3)) }).map((_, i) => (
              <div key={i} className="animate-pulse" style={{ padding: "10px 11px", borderRadius: "var(--r-surface)", background: "var(--card)", boxShadow: "var(--sh-raised-crisp)", animationDelay: `${(c * 3 + i) * 50}ms` }} data-testid="kanban-skeleton-card">
                <div className="flex items-center gap-[9px]">
                  <div className="h-[30px] w-[30px] rounded-[8px] bg-primary/10 shrink-0" />
                  <div className="flex-1 min-w-0 space-y-[6px]">
                    <div className={`h-3 ${bar}`} style={{ width: `${55 + ((i * 17) % 35)}%` }} />
                    <div className={`h-2 w-1/2 ${bar}`} style={{ opacity: 0.6 }} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Chats detail pane: hero card, then the Recap and Contact cards (left) and the
 * chat panel (right), capped at 1100px and centred like LeadDetailView.
 */
export function ChatsDetailSkeleton() {
  return (
    <div className="relative flex flex-col h-full" style={{ padding: 14 }} data-testid="chats-detail-skeleton">
      <div className="mx-auto w-full flex flex-col min-h-0 flex-1" style={{ maxWidth: 1100, gap: 14 }}>
        <div className="neu-raised animate-pulse" style={{ borderRadius: "var(--r-card)", background: "var(--card)", flexShrink: 0 }}>
          <div className="flex items-center gap-4" style={{ padding: "16px 20px" }}>
            <div className="h-[50px] w-[50px] rounded-[14px] bg-primary/10 shrink-0" />
            <div className="flex-1 min-w-0 space-y-2.5">
              <div className="flex items-center gap-2">
                <div className={`h-5 w-44 ${bar}`} />
                <div className={`h-4 w-14 ${bar}`} style={{ opacity: 0.6 }} />
              </div>
              <div className="flex items-center gap-3">
                <div className={`h-2 w-24 ${bar}`} style={{ opacity: 0.6 }} />
                <div className={`h-2 w-20 ${bar}`} style={{ opacity: 0.6 }} />
              </div>
            </div>
          </div>
          <div className="flex gap-1" style={{ padding: "0 20px 14px" }}>
            {Array.from({ length: 7 }).map((_, i) => <div key={i} className="flex-1 h-1.5 rounded-full bg-primary/10" />)}
          </div>
        </div>
        <div className="flex-1 min-h-0 flex" style={{ gap: 14 }}>
          <div className="animate-pulse shrink-0" style={{ width: 338 }}>
            <ListSection label={<span className={`block h-3.5 w-16 ${bar}`} style={{ marginBlock: 3 }} />}>
              <div className="space-y-2" style={{ padding: 16 }}>
                {Array.from({ length: 3 }).map((_, i) => <div key={i} className={`h-2.5 ${bar}`} style={{ width: `${88 - i * 14}%`, opacity: 0.7 }} />)}
              </div>
            </ListSection>
            <ListSection label={<span className={`block h-3.5 w-20 ${bar}`} style={{ marginBlock: 3 }} />}>
              <div className="flex flex-col" style={{ padding: 16, gap: 14 }}>
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className={`h-2 w-16 ${bar}`} style={{ opacity: 0.6 }} />
                    <div className={`h-3 ${bar}`} style={{ width: `${60 + i * 8}%` }} />
                  </div>
                ))}
              </div>
            </ListSection>
          </div>
          <div className="glass flex-1 min-w-0 flex flex-col" style={{ borderRadius: "var(--r-card)", padding: 18, gap: 12 }}>
            {[0, 1, 0, 1, 1, 0].map((out, i) => (
              <div key={i} className={`flex ${out ? "justify-end" : "justify-start"} animate-pulse`} style={{ animationDelay: `${i * 70}ms` }}>
                <div className="bg-primary/10" style={{ height: 34 + ((i * 7) % 18), width: `${38 + ((i * 11) % 24)}%`, borderRadius: "var(--r-surface)" }} />
              </div>
            ))}
            <div className="mt-auto h-10 rounded-full bg-primary/10" style={{ opacity: 0.6 }} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Card list (Chats toolbar): stage avatar, name over a stage line, time, optional peek row. */
export function CardListSkeleton({ peek = false }: { peek?: boolean }) {
  return (
    <div className="flex flex-col" style={{ gap: 3 }} data-testid="leads-list-skeleton">
      <div className="flex items-center gap-2 animate-pulse" style={{ padding: "12px 10px 8px" }}>
        <div className="h-2 w-14 rounded-full bg-primary/10" />
        <div className="h-2 w-4 rounded-full bg-primary/10" />
      </div>
      {Array.from({ length: 9 }).map((_, i) => (
        <div key={i} className="animate-pulse" style={{ padding: "10px 10px 10px 11px", animationDelay: `${i * 50}ms` }}>
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 bg-primary/10 shrink-0" style={{ borderRadius: "var(--r-surface)" }} />
            <div className="flex-1 min-w-0 space-y-[6px] pt-0.5">
              <div className={`h-3 ${bar}`} style={{ width: `${48 + ((i * 17) % 30)}%` }} />
              <div className={`h-2 ${bar}`} style={{ width: `${30 + ((i * 11) % 25)}%`, opacity: 0.6 }} />
            </div>
            <div className={`h-2 w-9 ${bar} shrink-0 mt-1`} style={{ opacity: 0.6 }} />
          </div>
          {peek && (
            <div className="flex items-center gap-1.5 mt-2">
              <div className={`h-3 w-10 ${bar} shrink-0`} />
              <div className={`h-2 flex-1 ${bar}`} style={{ opacity: 0.6 }} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Quick-filter row under the Leads topbar. */
function QuickFiltersSkeleton() {
  return (
    <div className="shrink-0 flex items-center gap-3 animate-pulse" style={{ padding: "9px 17px" }}>
      {[230, 260].map((w, i) => <div key={i} className="h-[30px] rounded-[var(--r-button)] bg-primary/10" style={{ width: w }} />)}
    </div>
  );
}

/**
 * Body of the route-level loader for the Chats / Leads pages (shown while the
 * page chunk loads), so the first paint already matches the page.
 */
export function LeadsRouteSkeleton({ mode }: { mode: "conversations" | "contacts" | "all" }) {
  if (mode === "conversations") {
    return (
      <div className="flex min-h-0 flex-1">
        <div className="la-list-panel la-list-panel--split hidden md:flex flex-col shrink-0" style={{ width: "var(--toolbar-w)" }}>
          <ListHeadSkeleton />
          <div className="la-split-scroll flex-1 min-h-0 overflow-hidden"><SplitListSkeleton /></div>
        </div>
        <div className="hidden lg:flex flex-1 min-w-0"><ChatsDetailSkeleton /></div>
      </div>
    );
  }
  let view = "table";
  try { view = localStorage.getItem(`leads-view-mode:${mode}`) || (mode === "all" ? "list" : "table"); } catch {}
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <QuickFiltersSkeleton />
      <div className="flex-1 min-h-0" style={{ padding: view === "pipeline" ? "12px 6px 6px" : 0 }}>
        {view === "pipeline" ? <KanbanSkeleton /> : <TableSkeleton />}
      </div>
    </div>
  );
}
