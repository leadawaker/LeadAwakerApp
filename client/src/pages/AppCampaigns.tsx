import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { campaigns, interactions, leads, accounts } from "@/data/mocks";
import { FiltersBar } from "@/components/crm/FiltersBar";
import { cn } from "@/lib/utils";
import { Target, Zap, MessageSquare, TrendingUp, Filter, Eye } from "lucide-react";

export default function AppCampaigns() {
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [showAllAccounts, setShowAllAccounts] = useState(isAgencyView);
  const [onlyActive, setOnlyActive] = useState(false);
  const [q, setQ] = useState("");

  const rows = useMemo(() => {
    return campaigns
      .filter((c) => (showAllAccounts ? true : c.account_id === currentAccountId))
      .filter((c) => (onlyActive ? c.status === "Active" : true))
      .filter((c) => (q ? c.name.toLowerCase().includes(q.toLowerCase()) : true));
  }, [currentAccountId, showAllAccounts, onlyActive, q]);

  return (
    <CrmShell>
      <div className="px-10 py-8 flex flex-col h-full bg-[#F6F5FA]/30" data-testid="page-campaigns">
        <div className="flex items-center justify-between mb-8 -mt-4">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">Campaign Manager</h1>
            <p className="text-slate-500 font-medium text-sm mt-1">Monitor and control outreach performance</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex gap-1">
              {isAgencyView && (
                <ToggleButton 
                  active={showAllAccounts} 
                  onClick={() => setShowAllAccounts(!showAllAccounts)}
                  label="All Accounts"
                />
              )}
              <ToggleButton 
                active={onlyActive} 
                onClick={() => setOnlyActive(!onlyActive)}
                label="Active Only"
              />
            </div>
          </div>
        </div>

        <div className="mb-6 flex gap-4">
          <div className="relative flex-1">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input 
              className="h-12 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm font-medium focus:ring-2 focus:ring-blue-500/20 outline-none shadow-sm transition-all"
              placeholder="Search campaigns by name..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
          </div>
        </div>

        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_100px] text-[11px] font-bold text-slate-400 bg-slate-50/50 border-b border-slate-100 px-8 py-4 uppercase tracking-wider">
            <div>Campaign Details</div>
            <div>Account</div>
            <div>Status</div>
            <div>Audience</div>
            <div>Volume</div>
            <div className="text-right">Metrics</div>
          </div>

          <div className="divide-y divide-slate-50 overflow-y-auto">
            {rows.map((c) => {
              const account = accounts.find(a => a.id === c.account_id);
              const leadCount = leads.filter(l => l.campaign_id === c.id).length;
              const sent = interactions.filter(i => i.campaign_id === c.id && i.direction === "Outbound").length;
              const received = interactions.filter(i => i.campaign_id === c.id && i.direction === "Inbound").length;

              return (
                <div key={c.id} className="grid grid-cols-[1.5fr_1fr_1fr_1fr_1fr_100px] px-8 py-6 text-sm items-center hover:bg-slate-50/30 transition-colors group">
                  <div className="min-w-0 pr-4">
                    <div className="font-bold text-slate-900 truncate flex items-center gap-2">
                      {c.name}
                      <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[9px] font-black uppercase tracking-tighter">
                        {c.type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-500 font-medium truncate mt-1">
                      {c.description}
                    </div>
                  </div>

                  <div className="font-bold text-slate-700">
                    {account?.name || "Unknown"}
                  </div>

                  <div>
                    <div className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-tight border",
                      c.status === "Active" ? "bg-blue-50 text-blue-700 border-blue-100" : "bg-slate-50 text-slate-500 border-slate-100"
                    )}>
                      <div className={cn("w-1.5 h-1.5 rounded-full", c.status === "Active" ? "bg-blue-500 animate-pulse" : "bg-slate-400")} />
                      {c.status}
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <div className="font-bold text-slate-900">{leadCount}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Total Leads</div>
                  </div>

                  <div className="flex flex-col">
                    <div className="font-bold text-slate-900">{sent}</div>
                    <div className="text-[10px] text-slate-400 font-medium uppercase tracking-tight">Messages Sent</div>
                  </div>

                  <div className="text-right">
                    <button className="p-2.5 rounded-xl hover:bg-white hover:shadow-md text-slate-400 hover:text-blue-600 transition-all border border-transparent hover:border-slate-100">
                      <Eye className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </CrmShell>
  );
}

function ToggleButton({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "px-4 py-1.5 rounded-xl text-xs font-bold transition-all",
        active 
          ? "bg-slate-900 text-white shadow-lg" 
          : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"
      )}
    >
      {label}
    </button>
  );
}
