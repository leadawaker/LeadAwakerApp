import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { promptLibrary } from "@/data/mocks";

export default function PromptLibraryPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return promptLibrary
      .filter((p) => p.account_id === currentAccountId)
      .filter((p) => (q ? p.name.toLowerCase().includes(q.toLowerCase()) : true));
  }, [currentAccountId, q]);

  return (
    <CrmShell>
      <div className="px-6 py-6 h-full flex flex-col" data-testid="page-prompt-library">
        <div className="flex items-center gap-2 mb-6" data-testid="bar-prompts">
          <input
            className="h-10 w-[320px] max-w-full rounded-xl border border-border bg-white px-4 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-prompt-search"
          />
        </div>

        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-2" data-testid="grid-prompts">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-white p-4 h-fit shadow-sm" data-testid={`card-prompt-${p.id}`}>
              <div className="font-semibold text-slate-900" data-testid={`text-prompt-name-${p.id}`}>{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-prompt-usecase-${p.id}`}>{p.use_case}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium" data-testid={`text-prompt-model-${p.id}`}>model: {p.model}</span>
                <span className="font-medium" data-testid={`text-prompt-score-${p.id}`}>score: {p.performance_score}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </CrmShell>
  );
}
