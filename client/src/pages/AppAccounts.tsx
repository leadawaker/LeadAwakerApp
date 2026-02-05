import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { accounts, campaigns, leads, interactions } from "@/data/mocks";
import { Edit2, ExternalLink, Shield, CheckCircle2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AppAccounts() {
  const { isAgencyView } = useWorkspace();
  const [editingId, setEditingId] = useState<number | null>(null);

  const rows = useMemo(() => {
    const clients = accounts.filter((a) => a.id !== 1);
    return clients.map((a) => {
      const accCampaigns = campaigns.filter((c) => c.account_id === a.id);
      const leadsCount = leads.filter((l) => l.account_id === a.id).length;
      const campaignsActive = accCampaigns.filter((c) => c.status === "Active").length;
      
      const totalSent = interactions.filter(i => i.account_id === a.id && i.direction === "Outbound").length;
      const totalReceived = interactions.filter(i => i.account_id === a.id && i.direction === "Inbound").length;
      const totalCost = accCampaigns.reduce((sum, c) => sum + c.total_cost, 0);

      return {
        account: a,
        leadsCount,
        campaignsActive,
        totalSent,
        totalReceived,
        totalCost,
      };
    });
  }, []);

  return (
    <CrmShell>
      <div className="px-10 py-8 flex flex-col h-full bg-[#F6F5FA]/30" data-testid="page-accounts">
        <div className="flex items-center justify-between mb-8 -mt-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900" data-testid="text-title">Agency Accounts</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Manage and monitor all subaccount performance</p>
          </div>
          <div className="flex gap-3">
            <Stat label="Total Accounts" value={String(rows.length)} />
            <Stat label="Active Campaigns" value={String(rows.reduce((sum, r) => sum + r.campaignsActive, 0))} />
            <Stat label="Total Revenue" value={`$${rows.reduce((sum, r) => sum + r.totalCost, 0).toFixed(0)}`} />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col" data-testid="table-accounts">
          <div className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr_1fr_100px] text-[11px] font-bold text-slate-400 bg-slate-50/50 border-b border-slate-100 px-8 py-4 uppercase tracking-wider">
            <div>ID</div>
            <div>Account Info</div>
            <div>Status</div>
            <div>Contacts</div>
            <div>Campaigns</div>
            <div>Performance</div>
            <div className="text-right">Action</div>
          </div>
          
          <div className="divide-y divide-slate-50 overflow-y-auto">
            {rows.map((r) => (
              <div key={r.account.id} className="grid grid-cols-[80px_1.5fr_1fr_1fr_1fr_1fr_100px] px-8 py-5 text-sm items-center hover:bg-slate-50/30 transition-colors" data-testid={`row-account-${r.account.id}`}>
                <div className="font-mono text-xs text-slate-400" data-testid={`text-account-id-${r.account.id}`}>
                  #{r.account.id}
                </div>
                
                <div className="min-w-0 pr-4">
                  <div className="font-bold text-slate-900 truncate flex items-center gap-2" data-testid={`text-account-name-${r.account.id}`}>
                    {r.account.name}
                    <ExternalLink className="w-3 h-3 text-slate-300 group-hover:text-blue-500 cursor-pointer" />
                  </div>
                  <div className="text-xs text-slate-500 font-medium truncate mt-0.5" data-testid={`text-account-owner-${r.account.id}`}>
                    {r.account.owner_email}
                  </div>
                </div>

                <div>
                  <div className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border",
                    r.account.status === "Active" ? "bg-emerald-50 text-emerald-700 border-emerald-100" : "bg-slate-50 text-slate-500 border-slate-100"
                  )}>
                    {r.account.status === "Active" ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {r.account.status}
                  </div>
                </div>

                <div className="font-bold text-slate-700" data-testid={`text-account-leads-${r.account.id}`}>
                  {r.leadsCount}
                  <span className="text-[10px] text-slate-400 ml-1 font-medium italic">total</span>
                </div>

                <div className="font-bold text-slate-700" data-testid={`text-account-campaigns-${r.account.id}`}>
                  {r.campaignsActive}
                  <span className="text-[10px] text-slate-400 ml-1 font-medium italic">active</span>
                </div>

                <div className="flex flex-col gap-0.5">
                  <div className="text-xs font-bold text-slate-900">${r.totalCost.toFixed(0)} <span className="text-[10px] text-slate-400 font-medium">spend</span></div>
                  <div className="text-[10px] text-slate-500 font-medium">{r.totalSent} sent • {r.totalReceived} recv</div>
                </div>

                <div className="text-right">
                  <button 
                    onClick={() => setEditingId(r.account.id)}
                    className="p-2.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-900 transition-all border border-transparent hover:border-slate-200"
                    data-testid={`button-edit-account-${r.account.id}`}
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
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
