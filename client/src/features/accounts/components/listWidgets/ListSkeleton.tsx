export function ListSkeleton() {
  return (
    <div className="space-y-0 p-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 px-4 py-3.5 rounded-lg animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-10 w-10 rounded-full bg-primary/10 shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-primary/10 rounded-full w-2/3" />
            <div className="h-2.5 bg-primary/5 rounded-full w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Loading skeleton for the compact (narrow) account rail — mirrors the
 *  44×44 mono tiles of CompactAccountCard. */
export function CompactListSkeleton() {
  return (
    <div className="flex flex-col items-center gap-0">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-center py-1 mx-1 animate-pulse"
          style={{ animationDelay: `${i * 50}ms` }}
        >
          <div className="h-11 w-11 rounded-[10px] bg-primary/10" />
        </div>
      ))}
    </div>
  );
}
