// Loading shape of a split list (Calls, Chats, Billing, Calendar): the real section title on the
// ground and white card, with placeholder rows.
import { ListSection } from "./ListSection";

const shade = "bg-primary/10";

function Row({ i }: { i: number }) {
  return (
    <div className="flex items-center gap-2.5 animate-pulse" style={{ padding: "10px 12px", animationDelay: `${i * 50}ms` }}>
      <div className={`h-9 w-9 shrink-0 ${shade}`} style={{ borderRadius: "var(--r-surface)" }} />
      <div className="flex-1 min-w-0 space-y-[7px]">
        <div className={`h-3 rounded-full ${shade}`} style={{ width: `${48 + ((i * 17) % 30)}%` }} />
        <div className={`h-2 rounded-full ${shade}`} style={{ width: `${30 + ((i * 11) % 25)}%`, opacity: 0.6 }} />
      </div>
      <div className={`h-2 w-9 shrink-0 rounded-full ${shade}`} style={{ opacity: 0.6 }} />
    </div>
  );
}

export function SplitListSkeleton({ groups = [3, 5] }: { groups?: number[] }) {
  return (
    <div aria-busy="true" data-testid="split-list-skeleton">
      {groups.map((rows, g) => (
        <ListSection key={g} label={<span className={`block h-3.5 rounded-full ${shade}`} style={{ width: 72 + g * 16, marginBlock: 3 }} />}>
          {Array.from({ length: rows }, (_, i) => <Row key={i} i={i + g} />)}
        </ListSection>
      ))}
    </div>
  );
}

/** The soft filter tabs above a split list. */
export function ListHeadSkeleton() {
  return (
    <div className="la-list-head" aria-hidden="true">
      <div className="la-seg la-seg--main la-seg--soft la-seg--fill" style={{ flex: 1 }}>
        <div className="flex-1 animate-pulse rounded-full" style={{ height: 32, background: "var(--list-selected)", boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--wine) 35%, transparent)" }} />
        <div className="flex-1" style={{ height: 32 }} />
      </div>
    </div>
  );
}
