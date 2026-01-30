import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { users } from "@/data/mocks";

export default function UsersPage() {
  const { currentAccountId } = useWorkspace();
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return users
      .filter((u) => u.account_id === currentAccountId)
      .filter((u) => (q ? u.email.toLowerCase().includes(q.toLowerCase()) : true));
  }, [currentAccountId, q]);

  return (
    <CrmShell>
      <div className="px-6 py-6" data-testid="page-users">
        <h1 className="text-2xl font-extrabold tracking-tight" data-testid="text-title">Users</h1>

        <div className="mt-4 flex items-center gap-2" data-testid="bar-users">
          <input
            className="h-10 w-[280px] max-w-full rounded-xl border border-border bg-muted/20 px-3 text-sm"
            placeholder="Search email…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            data-testid="input-user-search"
          />
        </div>

        <div className="mt-4 rounded-2xl border border-border bg-background overflow-hidden" data-testid="table-users">
          <div className="grid grid-cols-[1fr_140px_220px] text-xs font-semibold text-muted-foreground bg-muted/20 border-b border-border px-4 py-3">
            <div>email</div>
            <div>role</div>
            <div>last_login_at</div>
          </div>
          <div className="divide-y divide-border">
            {rows.map((u) => (
              <div key={u.id} className="grid grid-cols-[1fr_140px_220px] px-4 py-3 text-sm" data-testid={`row-user-${u.id}`}>
                <div className="font-semibold" data-testid={`text-user-email-${u.id}`}>{u.email}</div>
                <div className="text-muted-foreground" data-testid={`text-user-role-${u.id}`}>{u.role}</div>
                <div className="text-muted-foreground" data-testid={`text-user-last-${u.id}`}>{new Date(u.last_login_at).toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </CrmShell>
  );
}
