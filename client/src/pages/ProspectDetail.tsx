import { useRoute, useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { useProspectsData } from "@/features/prospects/hooks/useProspectsData";
import { ProspectDetailView } from "@/features/prospects/components/ProspectDetailView";
import { SkeletonLeadDetail } from "@/components/ui/skeleton";
import { deleteProspect } from "@/features/prospects/api/prospectsApi";
import { useMemo, useCallback } from "react";

export default function ProspectDetailPage() {
  const [location, setLocation] = useLocation();
  const isAgency = location.startsWith("/agency");
  const routePrefix = isAgency ? "/agency" : "/subaccount";

  const [, params] = useRoute(isAgency ? "/agency/prospects/:id" : "/subaccount/prospects/:id");
  const id = Number(params?.id);

  const { rows, loading, handleInlineUpdate } = useProspectsData(undefined);

  const prospect = useMemo(() => {
    if (!Number.isFinite(id) || id <= 0) return null;
    return rows.find((r) => (r.Id ?? r.id) === id) ?? null;
  }, [id, rows]);

  const handleSave = useCallback(async (field: string, value: string) => {
    if (!prospect) return;
    const pid = prospect.Id ?? prospect.id ?? 0;
    await handleInlineUpdate(pid, field, value, [pid]);
  }, [prospect, handleInlineUpdate]);

  const handleDelete = useCallback(async () => {
    if (!prospect) return;
    const pid = prospect.Id ?? prospect.id ?? 0;
    await deleteProspect(pid);
    setLocation(`${routePrefix}/prospects`);
  }, [prospect, routePrefix, setLocation]);

  return (
    <CrmShell>
      {loading ? (
        <SkeletonLeadDetail />
      ) : !prospect ? (
        <div className="px-6 py-6 text-sm text-muted-foreground">
          Prospect not found.
        </div>
      ) : (
        <ProspectDetailView
          prospect={prospect as any}
          onSave={handleSave}
          onDelete={handleDelete}
          onBack={() => setLocation(`${routePrefix}/prospects`)}
        />
      )}
    </CrmShell>
  );
}
