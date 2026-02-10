import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { accounts, campaigns, leads, interactions } from "@/data/mocks";
import { Edit2, ExternalLink, Shield, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import TestTable from "@/pages/TestTable";

export default function AppAccounts() {
  const { isAgencyView } = useWorkspace();
  const [editingId, setEditingId] = useState<number | null>(null);

  if (!isAgencyView) {
    return (
      <CrmShell>
        <div className="flex h-full items-center justify-center">
          <p className="text-slate-500">Access denied. Agency only.</p>
        </div>
      </CrmShell>
    );
  }

  return (
    <CrmShell>
      <div className="flex flex-col h-full bg-white overflow-hidden" data-testid="page-accounts">
        <TestTable />
      </div>
    </CrmShell>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white px-4 py-2.5 rounded-2xl border border-slate-200 shadow-sm min-w-[140px]">
      <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest leading-tight">{label}</div>
      <div className="text-xl font-black text-slate-900 mt-0.5 tracking-tight">{value}</div>
    </div>
  );
}
