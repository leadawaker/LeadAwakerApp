import { LeadsTable } from "../components/LeadsTable";
import { CrmShell } from "@/components/crm/CrmShell";

export function LeadsPage() {
  return (
    <CrmShell>
      <LeadsTable />
    </CrmShell>
  );
}
