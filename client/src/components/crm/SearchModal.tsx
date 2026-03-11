import { useState, useEffect, useMemo } from "react";
import { Search, X } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

export function SearchModal({ open, onOpenChange, inline }: { open: boolean; onOpenChange: (v: boolean) => void; inline?: boolean }) {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allInteractions, setAllInteractions] = useState<any[]>([]);

  // Fetch leads and interactions from API when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    async function fetchData() {
      try {
        const params = new URLSearchParams();
        if (currentAccountId) params.set("accountId", String(currentAccountId));
        const qs = params.toString();

        const [leadsRes, interactionsRes] = await Promise.all([
          apiFetch(qs ? `/api/leads?${qs}` : "/api/leads"),
          apiFetch(qs ? `/api/interactions?${qs}` : "/api/interactions"),
        ]);

        if (!cancelled) {
          const leadsData = leadsRes.ok ? await leadsRes.json() : [];
          const interactionsData = interactionsRes.ok ? await interactionsRes.json() : [];
          setAllLeads(Array.isArray(leadsData) ? leadsData : []);
          setAllInteractions(Array.isArray(interactionsData) ? interactionsData : []);
        }
      } catch (err) {
        console.error("Failed to fetch search data:", err);
      }
    }
    fetchData();
    return () => { cancelled = true; };
  }, [open, currentAccountId]);

  const results = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return [] as { leadId: number; title: string; subtitle: string }[];

    const leadHits = allLeads
      .filter((l: any) =>
        [l.full_name || "", l.phone || "", l.email || l.Email || ""].some((v: string) => v.toLowerCase().includes(query)),
      )
      .slice(0, 8)
      .map((l: any) => ({ leadId: l.id || l.Id, title: l.full_name || l.name || "", subtitle: `${l.phone || ""} • ${l.email || l.Email || ""}` }));

    const interactionHits = allInteractions
      .filter((i: any) => (i.content || "").toLowerCase().includes(query))
      .slice(0, 6)
      .map((i: any) => {
        const leadId = i.lead_id || i.leads_id || i.Leads_id;
        const lead = allLeads.find((l: any) => (l.id || l.Id) === leadId);
        return {
          leadId,
          title: lead?.full_name || lead?.name || `Lead #${leadId}`,
          subtitle: `Message: ${(i.content || "").slice(0, 72)}${(i.content || "").length > 72 ? "…" : ""}`,
        };
      });

    const merged = [...leadHits, ...interactionHits];
    const uniq = new Map<number, { leadId: number; title: string; subtitle: string }>();
    merged.forEach((r) => {
      if (!uniq.has(r.leadId)) uniq.set(r.leadId, r);
    });

    return Array.from(uniq.values()).slice(0, 10);
  }, [q, allLeads, allInteractions]);

  const content = (
    <div className="p-4 h-full flex flex-col">
      <div className={cn("relative", !inline && "mt-0")}>
        {!inline && (
          <div className="h-14 px-4 border-b border-border flex items-center justify-between mb-4 -mx-4">
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
        )}
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
          placeholder="Search leads..."
          className="h-11 w-full rounded-xl border border-border bg-muted/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary/30"
        />
      </div>

      <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden flex-grow">
        {results.length === 0 ? (
          <div className="p-4 text-sm text-muted-foreground">
            {q.trim() ? "No results." : "Start typing to search…"}
          </div>
        ) : (
          <div className="divide-y divide-border overflow-auto h-full">
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
  );

  if (inline) return content;

  return (
    <div className="fixed inset-0 z-[70] pointer-events-none" data-testid="overlay-search">
      <button
        type="button"
        className="absolute inset-0 bg-black/35 pointer-events-auto"
        style={{ left: '48px' }}
        onClick={() => onOpenChange(false)}
      />
      <aside className="absolute left-[48px] top-0 bottom-0 w-[400px] border-r border-border bg-background shadow-xl pointer-events-auto">
        {content}
      </aside>
    </div>
  );
}
