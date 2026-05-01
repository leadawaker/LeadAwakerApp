import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import CadencePage from "@/features/cadence/pages/CadencePage";

export default function AppCadence() {
  const { isAgencyView } = useWorkspace();

  if (!isAgencyView) {
    return (
      <CrmShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-muted-foreground">Access denied. Agency only.</p>
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-cadence">
        <CadencePage />
      </div>
    </CrmShell>
  );
}
