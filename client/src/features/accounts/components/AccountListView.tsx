import { useState, useMemo, useEffect } from "react";
import { Search, Building2, Plus, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AccountRow } from "./AccountDetailsDialog";
import { AccountDetailView, AccountDetailViewEmpty } from "./AccountDetailView";

// ── Helpers ──────────────────────────────────────────────────────────────────

type StatusFilter = "all" | "Active" | "Trial" | "Inactive" | "Suspended";

function getStatusAccent(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Trial":     return "bg-amber-500";
    case "Suspended": return "bg-rose-500";
    case "Inactive":  return "bg-slate-400";
    default:          return "bg-indigo-500";
  }
}

function getStatusPillColors(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400";
    case "Trial":     return "bg-amber-500/15 text-amber-700 dark:text-amber-400";
    case "Suspended": return "bg-rose-500/15 text-rose-700 dark:text-rose-400";
    default:          return "bg-slate-400/15 text-slate-600 dark:text-slate-400";
  }
}

// ── Skeleton row ─────────────────────────────────────────────────────────────

function ListRowSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-3 animate-pulse">
      <div className="w-1 h-10 rounded-full bg-muted shrink-0" />
      <div className="w-8 h-8 rounded-lg bg-muted shrink-0" />
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="h-3 w-3/4 bg-muted rounded" />
        <div className="h-2.5 w-1/2 bg-muted rounded" />
      </div>
    </div>
  );
}

// ── Props ────────────────────────────────────────────────────────────────────

interface AccountListViewProps {
  accounts: AccountRow[];
  loading: boolean;
  selectedAccount: AccountRow | null;
  onSelectAccount: (account: AccountRow) => void;
  onAddAccount: () => void;
  onEditAccount: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
}

// ── Component ────────────────────────────────────────────────────────────────

export function AccountListView({
  accounts,
  loading,
  selectedAccount,
  onSelectAccount,
  onAddAccount,
  onEditAccount,
  onToggleStatus,
}: AccountListViewProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const STATUS_TABS: { value: StatusFilter; label: string }[] = [
    { value: "all",       label: "All"       },
    { value: "Active",    label: "Active"    },
    { value: "Trial",     label: "Trial"     },
    { value: "Inactive",  label: "Inactive"  },
    { value: "Suspended", label: "Suspended" },
  ];

  const filteredAccounts = useMemo(() => {
    let result = accounts;
    if (statusFilter !== "all") {
      result = result.filter((a) => String(a.status || "") === statusFilter);
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter((a) =>
        String(a.name || "").toLowerCase().includes(q) ||
        String(a.owner_email || "").toLowerCase().includes(q) ||
        String(a.business_niche || "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [accounts, search, statusFilter]);

  // Auto-select first account when data loads
  useEffect(() => {
    if (!selectedAccount && filteredAccounts.length > 0) {
      onSelectAccount(filteredAccounts[0]);
    }
  }, [filteredAccounts, selectedAccount, onSelectAccount]);

  return (
    <div className="flex h-full overflow-hidden gap-3" data-testid="account-list-view">

      {/* ── LEFT PANE ─────────────────────────────────────────────── */}
      <div className="w-[300px] shrink-0 flex flex-col rounded-xl bg-stone-100 dark:bg-stone-900/60 overflow-hidden shadow-sm">

        {/* Header */}
        <div className="px-4 pt-4 pb-2 shrink-0">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-semibold font-heading text-foreground leading-tight">Accounts</h1>
            <button
              onClick={onAddAccount}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors"
              data-testid="account-list-add-btn"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
          <span className="text-xs font-medium text-muted-foreground mt-0.5 block">
            {loading ? "Loading…" : `${filteredAccounts.length} account${filteredAccounts.length !== 1 ? "s" : ""}`}
          </span>
        </div>

        {/* Search */}
        <div className="px-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="Search accounts…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-8 pl-8 pr-3 text-xs rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-800 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 transition-colors"
              data-testid="account-list-search"
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex items-center gap-1 px-3 pb-2 shrink-0 overflow-x-auto scrollbar-none">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setStatusFilter(tab.value)}
              className={cn(
                "shrink-0 px-2.5 py-1 rounded-md text-[11px] font-medium transition-colors",
                statusFilter === tab.value
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/60"
              )}
              data-testid={`account-filter-tab-${tab.value}`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Account list */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <>{[1, 2, 3, 4, 5].map((i) => <ListRowSkeleton key={i} />)}</>
          ) : filteredAccounts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Building2 className="w-8 h-8 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">No accounts found</p>
              {search && <p className="text-xs text-muted-foreground/70 mt-1">Try a different search</p>}
            </div>
          ) : (
            filteredAccounts.map((account) => {
              const aid = account.Id ?? account.id;
              const selId = selectedAccount?.Id ?? selectedAccount?.id;
              const isSelected = aid != null && aid === selId;
              const status = String(account.status || "");
              const accent = getStatusAccent(status);
              const pillColors = getStatusPillColors(status);

              const initials = (account.name || "?")
                .split(" ")
                .slice(0, 2)
                .map((w: string) => w[0]?.toUpperCase() ?? "")
                .join("");

              return (
                <button
                  key={aid}
                  type="button"
                  onClick={() => onSelectAccount(account)}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative group",
                    "border-b border-border/40 last:border-0",
                    isSelected ? "bg-primary/10 dark:bg-primary/15 border-l-[3px] border-l-primary" : "hover:bg-stone-200/70 dark:hover:bg-white/5"
                  )}
                  data-testid={`account-list-row-${aid}`}
                >
                  {/* Status accent bar */}
                  <div className={cn("w-1 h-9 rounded-full shrink-0 transition-all", accent, !isSelected && "opacity-40 group-hover:opacity-70")} />

                  {/* Avatar */}
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{
                      background: status === "Active"
                        ? "linear-gradient(135deg, #10b981, #059669)"
                        : status === "Trial"
                        ? "linear-gradient(135deg, #f59e0b, #d97706)"
                        : status === "Suspended"
                        ? "linear-gradient(135deg, #f43f5e, #e11d48)"
                        : status === "Inactive"
                        ? "linear-gradient(135deg, #94a3b8, #64748b)"
                        : "linear-gradient(135deg, #6366f1, #4f46e5)",
                    }}
                  >
                    {initials || <Building2 className="w-3.5 h-3.5" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs truncate leading-tight", isSelected ? "text-primary font-bold" : "text-foreground font-semibold")}>
                      {account.name || "Unnamed Account"}
                    </p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className={cn("text-[10px] font-semibold px-1.5 py-0.5 rounded-md", pillColors)}>
                        {status || "Unknown"}
                      </span>
                      {account.type && (
                        <span className="text-[10px] text-muted-foreground">{account.type}</span>
                      )}
                      {account.business_niche && (
                        <span className="text-[10px] text-muted-foreground truncate max-w-[80px]">
                          {account.business_niche}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Selected dot */}
                  {isSelected && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── RIGHT PANE ────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden rounded-xl bg-background shadow-sm">
        {selectedAccount ? (
          <AccountDetailView
            account={selectedAccount}
            onEdit={onEditAccount}
            onToggleStatus={onToggleStatus}
          />
        ) : (
          <AccountDetailViewEmpty />
        )}
      </div>
    </div>
  );
}
