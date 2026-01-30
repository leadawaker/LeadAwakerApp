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
      <div className="px-6 py-6" data-testid="page-prompt-library">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Prompt Library</h1>

        <div className="mt-4 flex items-center gap-2" data-testid="bar-prompts">
          <input
            className="h-10 w-[320px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
            placeholder="Search prompts…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-prompt-search"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4" data-testid="grid-prompts">
          {rows.map((p) => (
            <div key={p.id} className="rounded-2xl border border-border bg-background p-4" data-testid={`card-prompt-${p.id}`}>
              <div className="font-semibold" data-testid={`text-prompt-name-${p.id}`}>{p.name}</div>
              <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-prompt-usecase-${p.id}`}>{p.use_case}</div>
              <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
                <span data-testid={`text-prompt-model-${p.id}`}>model: {p.model}</span>
                <span data-testid={`text-prompt-score-${p.id}`}>score: {p.performance_score}</span>
              </div>
            </div>
          ))}
        </div>

      </div>
    </CrmShell>
  );
}
