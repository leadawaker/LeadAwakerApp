import { useState, useMemo } from "react";
import { Search, X } from "lucide-react";
import { leads, interactions } from "@/data/mocks";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Link } from "wouter";

export function SearchModal({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as { leadId: number; title: string; subtitle: string }[];

    const leadHits = leads
      .filter((l) => l.account_id === currentAccountId)
      .filter((l) =>
        [l.full_name, l.phone, l.email].some((v) => v.toLowerCase().includes(query)),
      )
      .slice(0, 8)
      .map((l) => ({ leadId: l.id, title: l.full_name, subtitle: `${l.phone} • ${l.email}` }));

    const interactionHits = interactions
      .filter((i) => i.account_id === currentAccountId)
      .filter((i) => i.content.toLowerCase().includes(query))
      .slice(0, 6)
      .map((i) => {
        const lead = leads.find((l) => l.id === i.lead_id);
        return {
          leadId: i.lead_id,
          title: lead?.full_name ?? `Lead #${i.lead_id}`,
          subtitle: `Message: ${i.content.slice(0, 72)}${i.content.length > 72 ? "…" : ""}`,
        };
      });

    const merged = [...leadHits, ...interactionHits];
    const uniq = new Map<number, { leadId: number; title: string; subtitle: string }>();
    merged.forEach((r) => {
      if (!uniq.has(r.leadId)) uniq.set(r.leadId, r);
    });

    return Array.from(uniq.values()).slice(0, 10);
  }, [q, currentAccountId]);

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-search">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto">
        <div className="h-14 px-4 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground" />
            <span className="font-semibold">Search</span>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            autoFocus
            placeholder="Search leads..."
            className="h-11 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
          />

          <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden">
            {results.length === 0 ? (
              <div className="p-4 text-sm text-muted-foreground">
                {q.trim() ? "No results." : "Start typing to search…"}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {results.map((r) => (
                  <a
                    key={r.leadId}
                    href={`/agency/contacts/${r.leadId}`}
                    onClick={(e) => {
                      e.preventDefault();
                      window.history.pushState({}, "", `/agency/contacts/${r.leadId}`);
                      window.dispatchEvent(new PopStateEvent("popstate"));
                      onOpenChange(false);
                    }}
                    className="block p-4 hover:bg-muted/20"
                  >
                    <div className="font-semibold">{r.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{r.subtitle}</div>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>
      </aside>
    </div>
  );
}
