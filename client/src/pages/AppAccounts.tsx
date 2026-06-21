import { CrmShell } from "@/components/crm/CrmShell";
import Accounts from "@/pages/Accounts";

export default function AppAccounts() {
  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-accounts">
        <Accounts />
      </div>
    </CrmShell>
  );
}
