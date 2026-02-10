import { useMemo, useState } from "react";
import { CrmShell } from "@/components/crm/CrmShell";
import { useWorkspace } from "@/hooks/useWorkspace";
import { cn } from "@/lib/utils";
import {
  Filter,
  ChevronDown,
  Eye,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/* Mock reference data (NOT using your existing mocks)                 */
/* ------------------------------------------------------------------ */

const mockAccounts = [
  { id: 1, name: "LeadAwaker Agency" },
  { id: 2, name: "FitnessGym ABC" },
  { id: 3, name: "LawFirm XYZ" },
];

const mockCampaigns = [
  {
    id: 101,
    name: "Client Reactivation Q1",
    description: "Re-engage cold leads from last quarter",
    status: "Active",
    type: "Reactivation",
    account_id: 1,
    ai_prompt_template: "Reactivation AI prompt v1",
    bump_1_template: "Just checking back in 🙂",
    daily_lead_limit: 120,
    leads_total: 340,
    messages_sent: 890,
  },
  {
    id: 102,
    name: "Outbound Scale – Lawyers",
    description: "Cold outreach to small law firms",
    status: "Active",
    type: "Outbound",
    account_id: 3,
    ai_prompt_template: "Law firm pitch prompt",
    bump_1_template: "Any thoughts?",
    daily_lead_limit: 80,
    leads_total: 210,
    messages_sent: 540,
  },
  {
    id: 103,
    name: "Black Friday Promo",
    description: "Seasonal promo campaign",
    status: "Inactive",
    type: "Broadcast",
    account_id: 2,
    ai_prompt_template: "Promo announcement template",
    bump_1_template: "",
    daily_lead_limit: 0,
    leads_total: 95,
    messages_sent: 190,
  },
  {
    id: 104,
    name: "Warm Leads Follow-Up",
    description: "Follow-up with inbound website leads",
    status: "Finished",
    type: "Follow-up",
    account_id: 1,
    ai_prompt_template: "Warm inbound AI script",
    bump_1_template: "Still interested?",
    daily_lead_limit: 60,
    leads_total: 180,
    messages_sent: 320,
  },
];

/* ------------------------------------------------------------------ */

export default function AppCampaigns() {
  const { isAgencyView } = useWorkspace();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "Active" | "Inactive">("all");

  const filteredCampaigns = useMemo(() => {
    return mockCampaigns
      .filter(c =>
        accountFilter === "all" ? true : c.account_id === accountFilter
      )
      .filter(c =>
        statusFilter === "all" ? true : c.status === statusFilter
      )
      .filter(c =>
        search
          ? c.name.toLowerCase().includes(search.toLowerCase())
          : true
      );
  }, [search, accountFilter, statusFilter]);

  return (
    <CrmShell>
      <div className="flex flex-col h-full pb-4 bg-white">
        <div className="pt-6 -mt-2 mb-8">
          <h1 className="text-3xl font-black tracking-tight text-slate-900 flex items-center gap-3" data-testid="text-title">
            <div className="h-8 w-1.5 bg-blue-600 rounded-full" />
            Campaigns
          </h1>
        </div>

        {/* FILTER BAR */}
        <div className="flex items-center gap-3 mb-6 mt-[2px]">

          {/* Search */}
          <div className="relative w-[320px]">
            <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search campaigns by name..."
              className="h-11 w-full rounded-2xl border border-slate-200 bg-white pl-11 pr-4 text-sm font-medium shadow-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>

          {/* Account dropdown */}
          <Dropdown
            label={
              accountFilter === "all"
                ? "All accounts"
                : mockAccounts.find(a => a.id === accountFilter)?.name
            }
          >
            <DropdownItem onClick={() => setAccountFilter("all")}>
              All accounts
            </DropdownItem>
            {mockAccounts.map(acc => (
              <DropdownItem
                key={acc.id}
                onClick={() => setAccountFilter(acc.id)}
              >
                {acc.name}
              </DropdownItem>
            ))}
          </Dropdown>

          {/* Status dropdown */}
          <Dropdown
            label={
              statusFilter === "all"
                ? "All campaigns"
                : statusFilter
            }
          >
            <DropdownItem onClick={() => setStatusFilter("all")}>
              All campaigns
            </DropdownItem>
            <DropdownItem onClick={() => setStatusFilter("Active")}>
              Active
            </DropdownItem>
            <DropdownItem onClick={() => setStatusFilter("Inactive")}>
              Inactive
            </DropdownItem>
          </Dropdown>

        </div>

        {/* TABLE */}
        <div className="flex-1 bg-white rounded-[32px] border border-slate-200 overflow-hidden shadow-sm flex flex-col">

          {/* Header */}
          <div className="grid grid-cols-[1.5fr_1fr_1fr_1fr_100px] px-8 py-4 text-[11px] font-bold uppercase tracking-wider text-slate-400 bg-slate-50 border-b">
            <div>Campaign</div>
            <div>Account</div>
            <div>Status</div>
            <div>Leads</div>
            <div className="text-right">Actions</div>
          </div>

          {/* Rows */}
          <div className="overflow-y-auto divide-y divide-slate-50">
            {filteredCampaigns.map(c => {
              const account = mockAccounts.find(a => a.id === c.account_id);
              return (
                <div
                  key={c.id}
                  className="grid grid-cols-[1.5fr_1fr_1fr_1fr_100px] px-8 py-6 text-sm items-center hover:bg-slate-50/40 transition-colors"
                >
                  <div>
                    <div className="font-bold text-slate-900">{c.name}</div>
                    <div className="text-xs text-slate-500 mt-1 truncate">
                      {c.description}
                    </div>
                  </div>

                  <div className="font-semibold text-slate-700">
                    {account?.name}
                  </div>

                  <div>
                    <span
                      className={cn(
                        "px-2.5 py-1 rounded-full text-[10px] font-black uppercase border",
                        c.status === "Active"
                          ? "bg-blue-50 text-blue-700 border-blue-100"
                          : "bg-slate-50 text-slate-500 border-slate-100"
                      )}
                    >
                      {c.status}
                    </span>
                  </div>

                  <div className="font-bold text-slate-900">
                    {c.leads_total}
                  </div>

                  <div className="text-right">
                    <button className="p-2.5 rounded-xl hover:bg-white hover:shadow-md border border-transparent hover:border-slate-100 text-slate-400 hover:text-blue-600">
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

/* ------------------------------------------------------------------ */
/* Small dropdown components                                           */
/* ------------------------------------------------------------------ */

function Dropdown({
  label,
  children,
}: {
  label: string | undefined;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="h-11 px-4 rounded-2xl border border-slate-200 bg-white flex items-center gap-2 text-sm font-semibold shadow-sm hover:bg-slate-50"
      >
        {label}
        <ChevronDown className="w-4 h-4 text-slate-400" />
      </button>

      {open && (
        <div className="absolute z-50 mt-2 min-w-full bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {children}
        </div>
      )}
    </div>
  );
}

function DropdownItem({
  children,
  onClick,
}: {
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="w-full text-left px-4 py-2.5 text-sm hover:bg-slate-50 font-medium"
    >
      {children}
    </button>
  );
}