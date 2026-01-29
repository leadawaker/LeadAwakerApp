import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { tags, leads } from "@/data/mocks";

export default function TagsPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    const accountLeads = leads.filter((l) => l.account_id === currentAccountId);
    const counts = new Map<string, number>();
    accountLeads.forEach((l) => {
      const raw = l.tags ?? [];
      raw.forEach((t) => counts.set(t, (counts.get(t) ?? 0) + 1));
    });

    return tags
      .filter((t) => t.account_id === currentAccountId)
      .filter((t) => (q ? t.name.toLowerCase().includes(q.toLowerCase()) : true))
      .map((t) => ({ ...t, count: counts.get(t.name) ?? 0 }))
      .sort((a, b) => b.count - a.count);
  }, [currentAccountId, q]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-tags">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Tags</h1>
        <p className="text-sm text-muted-foreground" data-testid="text-subtitle">
          Tag library + counts (MOCK).
        </p>

        <div className="mt-4 flex items-center gap-2" data-testid="bar-tags">
          <input
            className="h-10 w-[280px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
            placeholder="Search tags…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-tag-search"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3" data-testid="grid-tags">
          {rows.map((t) => (
            <div key={t.id} className="rounded-2xl border border-border bg-background p-4" data-testid={`card-tag-${t.id}`}>
              <div className="font-semibold" data-testid={`text-tag-name-${t.id}`}>{t.name}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-tag-count-${t.id}`}>{t.count} leads</div>
            </div>
          ))}
        </div>

        <div className="mt-3 text-xs text-muted-foreground" data-testid="text-real">
          REAL: useSWR(`${import.meta.env.VITE_NOCODB_URL}/api/v1/db/data/nocodb/Tags`)
        </div>
      </div>
    </CrmShell>
  );
}
