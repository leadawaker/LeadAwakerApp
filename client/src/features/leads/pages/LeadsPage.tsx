import { LeadsTable } from "../components/LeadsTable";
import { CrmShell } from "@/components/crm/CrmShell";

export function LeadsPage() {
  return (
    <CrmShell>
      <div className="la-page">
        <LeadsTable />
      </div>
    </CrmShell>
  );
}
