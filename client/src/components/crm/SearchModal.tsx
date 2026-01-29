import * as Dialog from "@radix-ui/react-dialog";
import { useMemo, useState } from "react";
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
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/35 z-[80]" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-[81] w-[640px] max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-background shadow-xl overflow-hidden"
          data-testid="modal-search"
        >
          <div className="p-4 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2" data-testid="text-search-title">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span className="font-semibold">Search</span>
              <span className="text-xs text-muted-foreground">(Contacts + Interactions)</span>
            </div>
            <Dialog.Close asChild>
              <button
                className="h-9 w-9 rounded-xl hover:bg-muted/30 grid place-items-center"
                data-testid="button-search-close"
              >
                <X className="h-4 w-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="p-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoFocus
              placeholder="Search contact name, phone, email, or message…"
              className="h-11 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
              data-testid="input-search"
            />

            <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="list-search-results">
              {results.length === 0 ? (
                <div className="p-4 text-sm text-muted-foreground" data-testid="empty-search">
                  {q.trim() ? "No results." : "Start typing to search…"}
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {results.map((r) => (
                    <Link
                      key={r.leadId}
                      href={`/app/lead/${r.leadId}`}
                      onClick={() => onOpenChange(false)}
                      className="block p-4 hover:bg-muted/20"
                      data-testid={`row-search-${r.leadId}`}
                    >
                      <div className="font-semibold" data-testid={`text-search-name-${r.leadId}`}>{r.title}</div>
                      <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-search-sub-${r.leadId}`}>{r.subtitle}</div>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className="mt-3 text-xs text-muted-foreground" data-testid="text-search-real">
              REAL: global search via NocoDB full-text / indexed fields (Contacts + Interactions)
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
