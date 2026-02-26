import { useState, useCallback, useEffect, useRef } from "react";
import {
  Building2,
  Phone,
  Bot,
  Globe,
  Clock,
  FileText,
  Pencil,
  CheckCircle2,
  PauseCircle,
  Ban,
  HelpCircle,
  Copy,
  Check,
  Eye,
  EyeOff,
  Mail,
  ExternalLink,
  PlayCircle,
  PowerOff,
  ChevronRight,
  Plus,
  Search,
  Users,
  Megaphone,
  Receipt,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { apiFetch } from "@/lib/apiUtils";
import { useLocation } from "wouter";
import type { AccountRow } from "./AccountDetailsDialog";

// ── Avatar color utility ──────────────────────────────────────────────────────

const AVATAR_COLORS = [
  { bg: "bg-indigo-100", text: "text-indigo-700" },
  { bg: "bg-emerald-100", text: "text-emerald-700" },
  { bg: "bg-amber-100", text: "text-amber-700" },
  { bg: "bg-rose-100", text: "text-rose-700" },
  { bg: "bg-violet-100", text: "text-violet-700" },
  { bg: "bg-cyan-100", text: "text-cyan-700" },
];

function getAvatarColor(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarGradient(status: string): string {
  switch (status) {
    case "Active":    return "from-emerald-500 to-teal-600";
    case "Trial":     return "from-amber-500 to-orange-600";
    case "Suspended": return "from-rose-500 to-red-600";
    case "Inactive":  return "from-slate-400 to-zinc-500";
    default:          return "from-indigo-500 to-violet-600";
  }
}

function getStatusBadgeCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-100 text-emerald-700 border-emerald-200";
    case "Trial":     return "bg-amber-100 text-amber-700 border-amber-200";
    case "Suspended": return "bg-rose-100 text-rose-700 border-rose-200";
    case "Inactive":  return "bg-slate-100 text-slate-600 border-slate-200";
    default:          return "bg-slate-100 text-slate-600 border-slate-200";
  }
}

function getStatusDotCls(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Trial":     return "bg-amber-500";
    case "Suspended": return "bg-rose-500";
    case "Inactive":  return "bg-slate-400";
    default:          return "bg-indigo-400";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "Active":    return <CheckCircle2 className="w-3 h-3" />;
    case "Trial":     return <Clock className="w-3 h-3" />;
    case "Suspended": return <Ban className="w-3 h-3" />;
    case "Inactive":  return <PauseCircle className="w-3 h-3" />;
    default:          return <HelpCircle className="w-3 h-3" />;
  }
}

function getCampaignAcronymCls(status: string): string {
  switch (status) {
    case "Active":  return "bg-emerald-100 text-emerald-700";
    case "Draft":   return "bg-slate-100 text-slate-600";
    case "Paused":  return "bg-amber-100 text-amber-700";
    default:        return "bg-indigo-100 text-indigo-700";
  }
}

function getCampaignStatusPillCls(status: string): string {
  switch (status) {
    case "Active":  return "bg-emerald-100 text-emerald-700";
    case "Draft":   return "bg-slate-100 text-slate-600";
    case "Paused":  return "bg-amber-100 text-amber-700";
    default:        return "bg-indigo-100 text-indigo-700";
  }
}

// ── Account status row ────────────────────────────────────────────────────────

const ACCOUNT_STATUSES = ["Trial", "Active", "Inactive", "Suspended"] as const;

function AccountStatusRow({ status }: { status: string }) {
  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {ACCOUNT_STATUSES.map((s, i) => {
        const isCurrent = s === status;
        const isPast = ACCOUNT_STATUSES.indexOf(s as typeof ACCOUNT_STATUSES[number]) <
                       ACCOUNT_STATUSES.indexOf(status as typeof ACCOUNT_STATUSES[number]);
        return (
          <div key={s} className="flex items-center gap-0 shrink-0">
            {i > 0 && (
              <div className={cn("h-px w-5 shrink-0",
                isPast || isCurrent ? "bg-emerald-300" : "bg-border/50"
              )} />
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap",
              isCurrent
                ? cn("border", getStatusBadgeCls(s))
                : isPast
                ? "text-emerald-600"
                : "text-muted-foreground/50"
            )}>
              {isPast    && <Check className="h-2.5 w-2.5 shrink-0" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />}
              {s}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function parseServiceCategories(val: string | null | undefined): string[] {
  if (!val) return [];
  const trimmed = val.trim();
  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return parsed.map((s: unknown) => String(s).trim()).filter(Boolean);
    } catch { /* fall through */ }
  }
  return trimmed.split(",").map((s) => s.trim()).filter(Boolean);
}

function formatTimeDisplay(val: string | null | undefined): string {
  if (!val) return "—";
  const parts = val.split(":");
  if (parts.length < 2) return val;
  const hours = parseInt(parts[0], 10);
  const minutes = parts[1];
  if (isNaN(hours)) return val;
  const ampm = hours >= 12 ? "PM" : "AM";
  const h = hours % 12 === 0 ? 12 : hours % 12;
  return `${String(h).padStart(2, "0")}:${minutes} ${ampm}`;
}

// ── TooltipPicker ─────────────────────────────────────────────────────────────

function TooltipPicker({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      ref={ref}
      className="absolute z-50 top-full mt-1 right-0 bg-white rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.12)] ring-1 ring-black/[0.06] border border-border/30 min-w-[220px] max-w-[260px] overflow-hidden"
    >
      {children}
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false }: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[12px] text-foreground text-right break-words max-w-[65%]", mono && "font-mono text-[11px]")}>
        {value ?? <span className="text-muted-foreground italic">—</span>}
      </span>
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [value]);
  return (
    <button
      onClick={handleCopy}
      className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

function SecretRow({ label, value }: { label: string; value: string | null | undefined }) {
  const [revealed, setRevealed] = useState(false);
  if (!value) return <InfoRow label={label} value={null} />;
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0">{label}</span>
      <div className="flex items-center gap-1 min-w-0">
        <span className={cn("text-[11px] font-mono text-foreground truncate max-w-[140px]", !revealed && "tracking-widest")}>
          {revealed ? value : "••••••••••••"}
        </span>
        <button
          onClick={() => setRevealed((r) => !r)}
          className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground shrink-0"
          title={revealed ? "Hide" : "Reveal"}
        >
          {revealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
        </button>
        <CopyButton value={value} />
      </div>
    </div>
  );
}

// ── Panel section header ──────────────────────────────────────────────────────

function PanelSectionHeader({
  title,
  count,
  onAdd,
  addOpen,
  children: pickerChildren,
}: {
  title: string;
  count?: number;
  onAdd?: () => void;
  addOpen?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
        {count !== undefined && (
          <span className="text-[10px] font-medium text-muted-foreground/60 tabular-nums">({count})</span>
        )}
      </div>
      {onAdd && (
        <div className="relative">
          <button
            onClick={onAdd}
            className={cn(
              "h-5 w-5 rounded-full flex items-center justify-center transition-colors shrink-0",
              addOpen
                ? "bg-primary text-primary-foreground"
                : "bg-black/[0.06] hover:bg-primary hover:text-primary-foreground text-muted-foreground"
            )}
          >
            {addOpen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
          </button>
          {pickerChildren}
        </div>
      )}
    </div>
  );
}

// ── AccountCampaignsPanel ─────────────────────────────────────────────────────

interface CampaignRow {
  id?: number;
  Id?: number;
  name?: string;
  status?: string;
  Accounts_id?: number;
  accountsId?: number;
  [key: string]: unknown;
}

function AccountCampaignsPanel({
  accountId,
  routePrefix,
}: {
  accountId: number;
  routePrefix: string;
}) {
  const [, setLocation] = useLocation();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadCampaigns = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/campaigns?accountId=${accountId}`)
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list || data?.data || [];
        setCampaigns(list);
      })
      .catch(() => setCampaigns([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    loadCampaigns();
  }, [loadCampaigns]);

  // Load all campaigns for picker (to link existing unassigned ones)
  const loadAllCampaigns = useCallback(() => {
    apiFetch("/api/campaigns")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list || data?.data || [];
        setAllCampaigns(list);
      })
      .catch(() => setAllCampaigns([]));
  }, []);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen((o) => !o);
    setPickerSearch("");
    if (!pickerOpen) loadAllCampaigns();
  }, [pickerOpen, loadAllCampaigns]);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSearch("");
  }, []);

  const assignedIds = new Set(campaigns.map((c) => c.Id ?? c.id));

  const pickerCampaigns = allCampaigns
    .filter((c) => {
      const cid = c.Id ?? c.id;
      if (assignedIds.has(cid)) return false;
      const q = pickerSearch.toLowerCase();
      if (q && !String(c.name || "").toLowerCase().includes(q)) return false;
      return true;
    });

  async function handleAssignCampaign(campaign: CampaignRow) {
    const cid = campaign.Id ?? campaign.id;
    if (!cid) return;
    try {
      await apiFetch(`/api/campaigns/${cid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      handleClosePicker();
      loadCampaigns();
    } catch {
      // silent
    }
  }

  function handleNavigateCampaign(cid: number | undefined) {
    if (!cid) return;
    setLocation(`${routePrefix}/campaigns?selectedId=${cid}`);
  }

  const getCampaignAcronym = (name: string) =>
    (name || "?").replace(/[^a-zA-Z0-9 ]/g, "").split(" ").slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");

  return (
    <div className="flex flex-col min-h-0">
      <PanelSectionHeader
        title="Campaigns"
        count={campaigns.length}
        onAdd={handleOpenPicker}
        addOpen={pickerOpen}
      >
        <TooltipPicker open={pickerOpen} onClose={handleClosePicker}>
          <div className="p-1.5">
            <div className="relative mb-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search campaigns…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full h-7 pl-6 pr-2 text-[11px] rounded-lg border border-border/50 bg-muted/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {pickerCampaigns.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  {pickerSearch ? "No campaigns match" : "All campaigns assigned"}
                </div>
              ) : (
                pickerCampaigns.map((c) => {
                  const cid = c.Id ?? c.id;
                  const acronym = getCampaignAcronym(c.name || "");
                  const status = String(c.status || "");
                  return (
                    <button
                      key={cid}
                      onClick={() => handleAssignCampaign(c)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] transition-colors text-left"
                    >
                      <div className={cn(
                        "h-6 w-6 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0",
                        getCampaignAcronymCls(status)
                      )}>
                        {acronym}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{c.name}</p>
                        {status && (
                          <span className={cn("text-[9px] font-semibold px-1 py-0 rounded", getCampaignStatusPillCls(status))}>
                            {status}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </TooltipPicker>
      </PanelSectionHeader>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-black/[0.03] animate-pulse" />
          ))}
        </div>
      ) : campaigns.length === 0 ? (
        <div className="py-4 text-center">
          <Megaphone className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-[11px] text-muted-foreground">No campaigns linked</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto">
          {campaigns.map((c) => {
            const cid = c.Id ?? c.id;
            const acronym = getCampaignAcronym(c.name || "");
            const status = String(c.status || "");
            return (
              <div
                key={cid}
                className="rounded-lg bg-black/[0.03] hover:bg-black/[0.05] px-3 py-2.5 cursor-pointer transition-colors"
                onClick={() => handleNavigateCampaign(cid)}
              >
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "h-7 w-7 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0",
                    getCampaignAcronymCls(status)
                  )}>
                    {acronym}
                  </div>
                  <span className="text-[12px] font-semibold text-foreground flex-1 truncate">
                    {c.name || "Unnamed Campaign"}
                  </span>
                  <span className={cn(
                    "text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                    getCampaignStatusPillCls(status)
                  )}>
                    {status || "—"}
                  </span>
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AccountInvoicesPanel ──────────────────────────────────────────────────────

interface InvoiceRow {
  id?: number;
  Id?: number;
  title?: string;
  invoice_number?: string;
  status?: string;
  total_amount?: number | string;
  amount?: number | string;
  [key: string]: unknown;
}

function getInvoiceStatusPillCls(status: string): string {
  switch (status?.toLowerCase()) {
    case "paid":    return "bg-emerald-100 text-emerald-700";
    case "pending": return "bg-amber-100 text-amber-700";
    case "overdue": return "bg-rose-100 text-rose-700";
    case "draft":   return "bg-slate-100 text-slate-600";
    default:        return "bg-slate-100 text-slate-600";
  }
}

function AccountInvoicesPanel({
  accountId,
  routePrefix,
}: {
  accountId: number;
  routePrefix: string;
}) {
  const [, setLocation] = useLocation();
  const [invoices, setInvoices] = useState<InvoiceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadInvoices = useCallback(() => {
    setLoading(true);
    apiFetch(`/api/invoices?accountId=${accountId}`)
      .then((res) => {
        if (!res.ok) throw new Error("no invoices endpoint");
        return res.json();
      })
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list || data?.data || [];
        setInvoices(list);
      })
      .catch(() => setInvoices([]))
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen((o) => !o);
    setPickerSearch("");
  }, []);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSearch("");
  }, []);

  function handleNavigateInvoice() {
    setLocation(`${routePrefix}/billing`);
  }

  const formatAmount = (amount: number | string | undefined) => {
    if (amount == null) return null;
    const num = Number(amount);
    if (isNaN(num)) return String(amount);
    return `€${num.toFixed(2)}`;
  };

  return (
    <div className="flex flex-col min-h-0 mt-4 pt-4 border-t border-border/30">
      <PanelSectionHeader
        title="Invoices"
        count={invoices.length}
        onAdd={handleOpenPicker}
        addOpen={pickerOpen}
      >
        <TooltipPicker open={pickerOpen} onClose={handleClosePicker}>
          <div className="p-1.5">
            <div className="relative mb-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search invoices…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full h-7 pl-6 pr-2 text-[11px] rounded-lg border border-border/50 bg-muted/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="py-3 text-center text-[11px] text-muted-foreground">
              Go to Billing to manage invoices
            </div>
            <button
              onClick={() => {
                handleClosePicker();
                setLocation(`${routePrefix}/billing`);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary/10 hover:bg-primary/15 text-primary text-[11px] font-semibold transition-colors"
            >
              <Receipt className="h-3 w-3" />
              Open Billing
            </button>
          </div>
        </TooltipPicker>
      </PanelSectionHeader>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-10 rounded-lg bg-black/[0.03] animate-pulse" />
          ))}
        </div>
      ) : invoices.length === 0 ? (
        <div className="py-4 text-center">
          <Receipt className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-[11px] text-muted-foreground">No invoices found</p>
        </div>
      ) : (
        <div className="space-y-1.5 overflow-y-auto">
          {invoices.map((inv) => {
            const iid = inv.Id ?? inv.id;
            const title = inv.title || inv.invoice_number || `Invoice #${iid}`;
            const status = String(inv.status || "");
            const amount = formatAmount(inv.total_amount ?? inv.amount);
            return (
              <div
                key={iid}
                className="rounded-lg bg-black/[0.03] hover:bg-black/[0.05] px-3 py-2 cursor-pointer transition-colors"
                onClick={handleNavigateInvoice}
              >
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded bg-violet-50 border border-violet-200 flex items-center justify-center text-[10px] font-bold text-violet-600 shrink-0">
                    #
                  </div>
                  <span className="text-[11px] font-semibold text-foreground flex-1 truncate">
                    {title}
                  </span>
                  {amount && (
                    <span className="text-[10px] font-mono text-foreground/60 shrink-0">{amount}</span>
                  )}
                  {status && (
                    <span className={cn(
                      "text-[9px] font-semibold px-1.5 py-0.5 rounded-full shrink-0",
                      getInvoiceStatusPillCls(status)
                    )}>
                      {status}
                    </span>
                  )}
                  <ChevronRight className="h-3 w-3 text-muted-foreground shrink-0" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── AccountUsersPanel ─────────────────────────────────────────────────────────

interface UserRow {
  id?: number;
  Id?: number;
  full_name_1?: string;
  fullName1?: string;
  email?: string;
  role?: string;
  status?: string;
  accountsId?: number;
  Accounts_id?: number;
  [key: string]: unknown;
}

function AccountUsersPanel({ accountId }: { accountId: number }) {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [allUsers, setAllUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerSearch, setPickerSearch] = useState("");

  const loadUsers = useCallback(() => {
    setLoading(true);
    apiFetch("/api/users")
      .then((res) => res.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list || data?.data || [];
        setAllUsers(list);
        const accountUsers = list.filter((u: UserRow) => {
          const uid = u.accountsId ?? u.Accounts_id ?? (u as any).accounts_id;
          return uid === accountId;
        });
        setUsers(accountUsers);
      })
      .catch(() => {
        setAllUsers([]);
        setUsers([]);
      })
      .finally(() => setLoading(false));
  }, [accountId]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleOpenPicker = useCallback(() => {
    setPickerOpen((o) => !o);
    setPickerSearch("");
  }, []);

  const handleClosePicker = useCallback(() => {
    setPickerOpen(false);
    setPickerSearch("");
  }, []);

  const assignedIds = new Set(users.map((u) => u.id ?? u.Id));

  // Filter: exclude users already in THIS account (listed above),
  // AND exclude users assigned to OTHER accounts (non-null accountsId != 0)
  const pickerUsers = allUsers.filter((u) => {
    const uid = u.id ?? u.Id;
    if (assignedIds.has(uid)) return false;
    const uAccId = u.accountsId ?? u.Accounts_id ?? (u as any).accounts_id;
    // If assigned to another account, exclude
    if (uAccId && uAccId !== accountId) return false;
    const q = pickerSearch.toLowerCase();
    const name = getUserDisplayName(u);
    if (q && !name.toLowerCase().includes(q)) return false;
    return true;
  });

  async function handleAssignUser(user: UserRow) {
    const uid = user.id ?? user.Id;
    if (!uid) return;
    try {
      await apiFetch(`/api/users/${uid}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ Accounts_id: accountId }),
      });
      handleClosePicker();
      loadUsers();
    } catch {
      // silent
    }
  }

  function getUserDisplayName(u: UserRow): string {
    return u.full_name_1 || u.fullName1 || u.email || "Unknown User";
  }

  return (
    <div className="flex flex-col min-h-0">
      <PanelSectionHeader
        title="Users"
        count={users.length}
        onAdd={handleOpenPicker}
        addOpen={pickerOpen}
      >
        <TooltipPicker open={pickerOpen} onClose={handleClosePicker}>
          <div className="p-1.5">
            <div className="relative mb-1">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
              <input
                autoFocus
                type="text"
                placeholder="Search users…"
                value={pickerSearch}
                onChange={(e) => setPickerSearch(e.target.value)}
                className="w-full h-7 pl-6 pr-2 text-[11px] rounded-lg border border-border/50 bg-muted/30 placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              />
            </div>
            <div className="max-h-[200px] overflow-y-auto">
              {pickerUsers.length === 0 ? (
                <div className="py-4 text-center text-[11px] text-muted-foreground">
                  {pickerSearch ? "No users match" : "No unassigned users available"}
                </div>
              ) : (
                pickerUsers.map((u) => {
                  const uid = u.id ?? u.Id;
                  const name = getUserDisplayName(u);
                  const initials = getInitials(name);
                  const colors = getAvatarColor(name);
                  return (
                    <button
                      key={uid}
                      onClick={() => handleAssignUser(u)}
                      className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-black/[0.04] transition-colors text-left"
                    >
                      <div className={cn(
                        "h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0",
                        colors.bg,
                        colors.text
                      )}>
                        {initials || "?"}
                      </div>
                      <span className="text-[11px] font-medium text-foreground truncate flex-1">{name}</span>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </TooltipPicker>
      </PanelSectionHeader>

      {loading ? (
        <div className="space-y-1.5">
          {[1, 2].map((i) => (
            <div key={i} className="h-9 rounded-lg bg-black/[0.03] animate-pulse" />
          ))}
        </div>
      ) : users.length === 0 ? (
        <div className="py-4 text-center">
          <Users className="h-5 w-5 text-muted-foreground/30 mx-auto mb-1.5" />
          <p className="text-[11px] text-muted-foreground">No users assigned</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {users.map((u) => {
            const uid = u.id ?? u.Id;
            const name = getUserDisplayName(u);
            const initials = getInitials(name);
            const colors = getAvatarColor(name);
            const role = String(u.role || "");
            return (
              <div
                key={uid}
                className="flex items-center gap-2 rounded-lg bg-black/[0.03] px-2.5 py-2"
              >
                <div className={cn(
                  "h-7 w-7 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0",
                  colors.bg,
                  colors.text
                )}>
                  {initials || "?"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[12px] font-semibold text-foreground truncate">{name}</p>
                  {role && <p className="text-[10px] text-muted-foreground">{role}</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function AccountDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Building2 className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/70">Select an account</p>
        <p className="text-xs text-muted-foreground mt-1">Click any account on the left to see its details</p>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

interface AccountDetailViewProps {
  account: AccountRow;
  onEdit: (account: AccountRow) => void;
  onToggleStatus: (account: AccountRow) => void;
}

export function AccountDetailView({ account, onEdit, onToggleStatus }: AccountDetailViewProps) {
  const [location] = useLocation();
  const routePrefix = location.startsWith("/subaccount") ? "/subaccount" : "/agency";

  const status = String(account.status || "Unknown");
  const avatarGradient = getAvatarGradient(status);
  const badgeCls = getStatusBadgeCls(status);
  const dotCls = getStatusDotCls(status);
  const accountId = account.Id ?? account.id ?? 0;

  const isActive = status === "Active";
  const canToggle = status === "Active" || status === "Inactive";

  const initials = (account.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const serviceCategories = parseServiceCategories(account.service_categories);

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="account-detail-view">

      {/* ── HEADER ──────────────────────────────────────────────────── */}
      <div className="shrink-0 relative overflow-hidden border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50/40" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(167,243,208,0.35)_0%,_transparent_65%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent" />

        <div className="relative px-4 pt-4 pb-3 space-y-2.5">

          {/* Row 1: Avatar + Identity + Actions */}
          <div className="flex items-start gap-3.5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-md shrink-0 ring-2 ring-white/60",
              `bg-gradient-to-br ${avatarGradient}`
            )}>
              {initials || <Building2 className="w-6 h-6" />}
            </div>

            <div className="flex-1 min-w-0 mt-0.5">
              <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-tight truncate" data-testid="account-detail-name">
                {account.name || "Unnamed Account"}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", badgeCls)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", dotCls)} />
                  {getStatusIcon(status)}
                  {status}
                </span>
                {account.type && (
                  <span className="text-[12px] text-foreground/60">{account.type}</span>
                )}
                {account.business_niche && (
                  <span className="text-[11px] text-foreground/50 truncate">{account.business_niche}</span>
                )}
                <span className="text-[11px] text-foreground/40">#{accountId}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={() => onEdit(account)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                data-testid="account-detail-edit-btn"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              {canToggle && (
                <button
                  onClick={() => onToggleStatus(account)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                  data-testid="account-detail-toggle-btn"
                >
                  {isActive
                    ? <><PowerOff className="w-3.5 h-3.5" />Deactivate</>
                    : <><PlayCircle className="w-3.5 h-3.5" />Activate</>
                  }
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Account status indicator */}
          <AccountStatusRow status={status} />

        </div>
      </div>

      {/* ── BODY — 3 cards in parallel ────────────────────────────── */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 bg-slate-50/50 min-h-0 overflow-hidden">

        {/* Card 1: Overview — Basic info + Contact */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-basic">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Building2 className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Overview</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0">
            <InfoRow label="Type" value={account.type} />
            <InfoRow label="Niche" value={account.business_niche} />
            {/* Contact sub-section */}
            <div className="pt-3 mt-1 border-t border-border/30 space-y-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Phone className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Contact</span>
              </div>
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Email</span>
                <div className="flex items-center gap-1 min-w-0">
                  {account.owner_email
                    ? <>
                        <span className="text-[12px] text-foreground truncate max-w-[120px]">{account.owner_email}</span>
                        <a href={`mailto:${account.owner_email}`} className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted transition-colors">
                          <Mail className="h-3 w-3" />
                        </a>
                      </>
                    : <span className="text-[12px] text-muted-foreground italic">—</span>
                  }
                </div>
              </div>
              <InfoRow label="Phone" value={account.phone} />
              <div className="flex items-start justify-between gap-3 py-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">Website</span>
                <div className="flex items-center gap-1 min-w-0">
                  {account.website
                    ? <>
                        <span className="text-[12px] text-foreground truncate max-w-[100px]">{account.website}</span>
                        <a href={account.website} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-foreground shrink-0 p-1 rounded hover:bg-muted transition-colors">
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </>
                    : <span className="text-[12px] text-muted-foreground italic">—</span>
                  }
                </div>
              </div>
            </div>
            {/* Notes / description */}
            {(account.business_description || account.notes || serviceCategories.length > 0) && (
              <div className="pt-3 mt-1 border-t border-border/30">
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Notes</span>
                </div>
                {account.business_description && (
                  <p className="text-[12px] text-foreground leading-relaxed mb-2 line-clamp-3">{account.business_description}</p>
                )}
                {serviceCategories.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {serviceCategories.map((cat, i) => (
                      <span key={i} className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary border border-primary/20">
                        {cat}
                      </span>
                    ))}
                  </div>
                )}
                {account.notes && !account.business_description && (
                  <p className="text-[12px] text-foreground leading-relaxed line-clamp-4">{account.notes}</p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Schedule & AI */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-ai">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Bot className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI & Schedule</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0">
            <InfoRow label="AI Name" value={account.default_ai_name} />
            <InfoRow label="AI Role" value={account.default_ai_role} />
            <InfoRow label="AI Style" value={account.default_ai_style} />
            <InfoRow label="Typo Frequency" value={account.default_typo_frequency} />
            <InfoRow label="Opt-out Keyword" value={account.opt_out_keyword} />
            <InfoRow label="Terminology" value={account.preferred_terminology} />
            {/* Schedule sub-section */}
            <div className="pt-3 mt-1 border-t border-border/30 space-y-0">
              <div className="flex items-center gap-1.5 mb-2">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Schedule</span>
              </div>
              <InfoRow label="Timezone" value={account.timezone} />
              <InfoRow label="Hours Open" value={formatTimeDisplay(account.business_hours_start)} />
              <InfoRow label="Hours Close" value={formatTimeDisplay(account.business_hours_end)} />
              <InfoRow label="Max Daily Sends" value={account.max_daily_sends != null ? String(account.max_daily_sends) : null} />
            </div>
          </div>
        </div>

        {/* Card 3: Campaigns + Users + Invoices */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="account-widget-relations">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Megaphone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Relations</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-0 flex flex-col gap-0">

            {/* Campaigns */}
            <AccountCampaignsPanel accountId={accountId} routePrefix={routePrefix} />

            {/* Divider */}
            <div className="border-t border-border/30 mt-4 pt-4">
              <AccountUsersPanel accountId={accountId} />
            </div>

            {/* Invoices */}
            <AccountInvoicesPanel accountId={accountId} routePrefix={routePrefix} />

          </div>
        </div>

        {/* Card 4: Twilio Integration — spans from col 1 to col 2 inline */}
      </div>

      {/* ── TWILIO row — below the 3-col grid ─────────────────────── */}
      <div className="shrink-0 px-3 pb-3">
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden" data-testid="account-widget-twilio">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 bg-muted/20">
            <Globe className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Twilio</span>
          </div>
          <div className="px-3 py-2 grid grid-cols-2 gap-x-6">
            <div>
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40">
                <span className="text-[11px] text-muted-foreground shrink-0">Account SID</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_account_sid || "—"}</span>
                  {account.twilio_account_sid && <CopyButton value={String(account.twilio_account_sid)} />}
                </div>
              </div>
              <SecretRow label="Auth Token" value={account.twilio_auth_token} />
            </div>
            <div>
              <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40">
                <span className="text-[11px] text-muted-foreground shrink-0">Service SID</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_messaging_service_sid || "—"}</span>
                  {account.twilio_messaging_service_sid && <CopyButton value={String(account.twilio_messaging_service_sid)} />}
                </div>
              </div>
              <div className="flex items-center justify-between gap-3 py-1.5">
                <span className="text-[11px] text-muted-foreground shrink-0">From Number</span>
                <div className="flex items-center gap-1 min-w-0">
                  <span className="text-[11px] font-mono text-foreground truncate max-w-[100px]">{account.twilio_default_from_number || "—"}</span>
                  {account.twilio_default_from_number && <CopyButton value={String(account.twilio_default_from_number)} />}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
