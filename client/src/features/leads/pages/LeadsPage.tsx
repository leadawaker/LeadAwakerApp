import { LeadsTable, type LeadsPageMode } from "../components/LeadsTable";
import { CrmShell } from "@/components/crm/CrmShell";

/**
 * Hosts the leads workspace in one of three modes (Conversations / Contacts split):
 *  - "conversations" → chat threads only
 *  - "contacts"      → directory (Table + Pipeline)
 *  - "all"           → legacy combined page (default)
 */
export function LeadsPage({ mode = "all" }: { mode?: LeadsPageMode } = {}) {
  return (
    <CrmShell>
      <div className="la-page">
        <LeadsTable mode={mode} />
      </div>
    </CrmShell>
  );
}
