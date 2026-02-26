import { useMemo, useState, useCallback, useEffect, Fragment } from "react";
import {
  Clock,
  MessageSquare,
  Bot,
  DollarSign,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart2,
  Settings,
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  BarChart3,
  Megaphone,
  Target,
  X,
  TrendingUp,
  FileText,
  ArrowRight,
  ChevronDown,
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { DateRangeFilter, getDefaultDateRange, isWithinDateRange, type DateRangeValue } from "@/components/crm/DateRangeFilter";
import { useLeads } from "@/hooks/useApiData";

// ── Helpers ─────────────────────────────────────────────────────────────────

const CAMPAIGN_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  Active:    { bg: "#DCFCE7", text: "#15803D" },
  Paused:    { bg: "#FEF3C7", text: "#92400E" },
  Completed: { bg: "#DBEAFE", text: "#1D4ED8" },
  Finished:  { bg: "#DBEAFE", text: "#1D4ED8" },
  Inactive:  { bg: "#F4F4F5", text: "#52525B" },
  Archived:  { bg: "#F4F4F5", text: "#52525B" },
  Draft:     { bg: "#E5E7EB", text: "#374151" },
};

function getCampaignAvatarColor(status: string): { bg: string; text: string } {
  return CAMPAIGN_STATUS_COLORS[status] ?? { bg: "#E5E7EB", text: "#374151" };
}

const CAMPAIGN_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

function formatHours(h: number | null | undefined): string {
  if (!h && h !== 0) return "—";
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  const rem = h % 24;
  return rem > 0 ? `${d}d ${rem}h` : `${d}d`;
}

function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

function getRoiColor(roi: number | null): string {
  if (roi === null) return "text-muted-foreground";
  if (roi >= 100) return "text-emerald-600";
  if (roi >= 0) return "text-blue-600";
  return "text-rose-600";
}

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
}

function fmtCurrencyDecimals(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}

function getCampaignMetrics(campaign: Campaign, cMetrics: CampaignMetricsHistory[]) {
  const directLeads = Number(campaign.total_leads_targeted) || 0;
  const directMessages = Number(campaign.total_messages_sent) || 0;
  const directResponseRate = Number(campaign.response_rate_percent) || 0;
  const directBookingRate = Number(campaign.booking_rate_percent) || 0;

  if (directLeads > 0 || directMessages > 0 || directResponseRate > 0 || directBookingRate > 0) {
    return {
      totalLeadsTargeted: directLeads,
      totalMessagesSent: directMessages,
      responseRate: directResponseRate,
      bookingRate: directBookingRate,
      totalCost: Number(campaign.total_cost) || 0,
      costPerLead: Number(campaign.cost_per_lead) || 0,
      costPerBooking: Number(campaign.cost_per_booking) || 0,
      roiPercent: Number(campaign.roi_percent) || 0,
      bookings: directLeads > 0 ? Math.round(directLeads * directBookingRate / 100) : 0,
    };
  }

  if (cMetrics.length === 0) {
    return {
      totalLeadsTargeted: 0,
      totalMessagesSent: 0,
      responseRate: null as number | null,
      bookingRate: null as number | null,
      totalCost: null as number | null,
      costPerLead: null as number | null,
      costPerBooking: null as number | null,
      roiPercent: null as number | null,
      bookings: 0,
    };
  }

  const sorted = [...cMetrics].sort((a, b) =>
    (b.metric_date || "").localeCompare(a.metric_date || "")
  );
  const latest = sorted[0];
  const totalLeadsTargeted = cMetrics.reduce((s, m) => s + (m.total_leads_targeted || 0), 0);
  const totalMessagesSent = cMetrics.reduce((s, m) => s + (m.total_messages_sent || 0), 0);
  const totalCost = cMetrics.reduce((s, m) => s + (Number(m.total_cost) || 0), 0);
  const bookingRateVal = Number(latest.booking_rate_percent) || 0;
  const bookings = totalLeadsTargeted > 0 ? Math.round(totalLeadsTargeted * bookingRateVal / 100) : 0;

  return {
    totalLeadsTargeted,
    totalMessagesSent,
    responseRate: Number(latest.response_rate_percent) || 0,
    bookingRate: bookingRateVal,
    totalCost,
    costPerLead: Number(latest.cost_per_lead) || 0,
    costPerBooking: Number(latest.cost_per_booking) || 0,
    roiPercent: Number(latest.roi_percent) || 0,
    bookings,
  };
}

// ── Contract type (minimal, for financials) ──────────────────────────────────

interface ContractFinancials {
  id: number;
  title: string | null;
  deal_type: string | null;
  value_per_booking: number | null;
  payment_trigger: string | null;
  monthly_fee: number | null;
  fixed_fee_amount: number | null;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ label, value, mono = false, editChild }: {
  label: string; value: React.ReactNode; mono?: boolean; editChild?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 shrink-0 pt-0.5 min-w-[90px]">{label}</span>
      {editChild ?? (
        <span className={cn("text-[12px] font-semibold text-foreground text-right break-words max-w-[60%]", mono && "font-mono text-[11px]")}>
          {value ?? "—"}
        </span>
      )}
    </div>
  );
}

function BoolRow({ label, value, editChild }: {
  label: string; value: boolean | null | undefined; editChild?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{label}</span>
      {editChild ?? (value
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        : <XCircle className="w-4 h-4 text-foreground/25 shrink-0" />
      )}
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
      className="p-1 rounded hover:bg-white/30 transition-colors text-foreground/40 hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Editable field helpers ────────────────────────────────────────────────────

function EditText({
  value, onChange, placeholder, multiline = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  if (multiline) {
    return (
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/30"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/30"
    />
  );
}

function EditNumber({
  value, onChange, placeholder,
}: {
  value: string | number; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={String(value)}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-blue/40 placeholder:text-foreground/30"
    />
  );
}

function EditDate({
  value, onChange,
}: {
  value: string; onChange: (v: string) => void;
}) {
  return (
    <input
      type="date"
      value={value ? value.slice(0, 10) : ""}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-blue/40"
    />
  );
}

function EditSelect({
  value, onChange, options,
}: {
  value: string; onChange: (v: string) => void; options: string[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      {options.map((o) => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function EditToggle({
  value, onChange,
}: {
  value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className={cn(
        "h-5 w-9 rounded-full transition-colors relative shrink-0",
        value ? "bg-brand-blue" : "bg-foreground/20"
      )}
    >
      <span className={cn(
        "absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform",
        value ? "translate-x-4" : "translate-x-0.5"
      )} />
    </button>
  );
}

// ── Contract select for edit mode ─────────────────────────────────────────────

function ContractSelect({
  value,
  onChange,
  accountsId,
}: {
  value: string;
  onChange: (v: string) => void;
  accountsId?: number | null;
}) {
  const [contracts, setContracts] = useState<{ id: number; title: string | null }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const url = accountsId ? `/api/contracts?accountId=${accountsId}` : "/api/contracts";
    apiFetch(url)
      .then((r) => r.json())
      .then((data) => {
        const list = Array.isArray(data) ? data : data?.list ?? [];
        setContracts(list);
      })
      .catch(() => setContracts([]))
      .finally(() => setLoading(false));
  }, [accountsId]);

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      disabled={loading}
      className="w-full text-[12px] bg-white/60 border border-brand-blue/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-blue/40"
    >
      <option value="">— None linked</option>
      {contracts.map((c) => (
        <option key={c.id} value={String(c.id)}>
          {c.title || `Contract #${c.id}`}
        </option>
      ))}
    </select>
  );
}

// ── Funnel Widget (6 real pipeline stages) ───────────────────────────────────

const FUNNEL_STAGES = [
  { key: "new",       label: "New",                dbValue: "New",                color: "#6B7280" },
  { key: "contacted", label: "Contacted",          dbValue: "Contacted",          color: "#4F46E5" },
  { key: "responded", label: "Responded",          dbValue: "Responded",          color: "#14B8A6" },
  { key: "multi",     label: "Multiple Responses", dbValue: "Multiple Responses", color: "#22C55E" },
  { key: "qualified", label: "Qualified",          dbValue: "Qualified",          color: "#84CC16" },
  { key: "booked",    label: "Call Booked",        dbValue: "Booked",             color: "#FCB803" },
] as const;

function CampaignFunnelWidget({ campaignId }: { campaignId: number }) {
  const { leads, loading } = useLeads(undefined, campaignId);

  const stages = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      ...s,
      count: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
    }));
  }, [leads]);

  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const allZero = stages.every((s) => s.count === 0);

  if (loading) {
    return (
      <div className="flex flex-col items-center gap-2 w-full py-1">
        {FUNNEL_STAGES.map((s, i) => (
          <div
            key={s.key}
            className="h-9 rounded-full bg-foreground/[0.06] animate-pulse"
            style={{ width: `${100 - i * 13}%` }}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full gap-0">
      {stages.map((stage, i) => {
        const widthPct = allZero ? 100 - i * 13 : Math.max((stage.count / maxCount) * 100, 20);
        const isNarrow = widthPct < 35;
        const isYellow = stage.key === "booked";
        const textColor = isYellow ? "#131B49" : "#fff";

        const convNext =
          i < stages.length - 1 && stage.count > 0
            ? ((stages[i + 1].count / stage.count) * 100).toFixed(1)
            : null;

        return (
          <Fragment key={stage.key}>
            {/* Stage bar */}
            <div className="w-full flex flex-col items-center">
              {isNarrow && !allZero && (
                <div className="flex items-center justify-between w-full px-1 mb-0.5">
                  <span className="text-[12px] font-medium text-foreground/60">{stage.label}</span>
                  <span className="text-[12px] font-semibold text-foreground tabular-nums">
                    {stage.count.toLocaleString()}
                  </span>
                </div>
              )}
              <div
                className={cn(
                  "h-9 rounded-full flex items-center justify-between px-3.5",
                  "transition-[width] duration-200 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
                  allZero && "border border-dashed border-foreground/15",
                )}
                style={{
                  width: `${widthPct}%`,
                  backgroundColor: allZero ? "transparent" : stage.color,
                  opacity: stage.count === 0 && !allZero ? 0.35 : 1,
                }}
              >
                {!isNarrow && (
                  <>
                    <span
                      className="text-[13px] font-medium truncate"
                      style={{ color: allZero ? "var(--foreground)" : textColor, opacity: allZero ? 0.35 : 1 }}
                    >
                      {stage.label}
                    </span>
                    <span
                      className="text-[13px] font-semibold tabular-nums ml-2 shrink-0"
                      style={{ color: allZero ? "var(--foreground)" : textColor, opacity: allZero ? 0.35 : 1 }}
                    >
                      {allZero ? "0" : stage.count.toLocaleString()}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Conversion arrow between stages */}
            {i < stages.length - 1 && (
              <div className="flex items-center justify-center gap-1 py-[3px]">
                <ChevronDown className="h-3 w-3 text-foreground/20" />
                {convNext !== null ? (
                  <span className="text-[11px] tabular-nums font-medium text-foreground/40">
                    {convNext}%
                  </span>
                ) : (
                  <span className="text-[11px] text-foreground/20">—</span>
                )}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}

// ── Conversion Pie Chart ──────────────────────────────────────────────────────

function ConversionPieChart({ agg }: { agg: ReturnType<typeof getCampaignMetrics> }) {
  const leads     = agg.totalLeadsTargeted;
  const contacted = agg.totalMessagesSent;
  const responded = leads > 0 ? Math.round(leads * (agg.responseRate ?? 0) / 100) : 0;
  const booked    = leads > 0 ? Math.round(leads * (agg.bookingRate  ?? 0) / 100) : 0;
  const respondedNotBooked = Math.max(0, responded - booked);
  const contactedNotResponded = Math.max(0, contacted - responded);
  const notContacted = Math.max(0, leads - contacted);

  const data = [
    { name: "Call Booked",    value: booked,                  color: "#F59E0B" },
    { name: "Responded",      value: respondedNotBooked,      color: "#818CF8" },
    { name: "No Response",    value: contactedNotResponded,   color: "#4F46E5" },
    { name: "Not Contacted",  value: notContacted,            color: "#CBD5E1" },
  ].filter(d => d.value > 0);

  if (leads === 0 || data.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <p className="text-[11px] text-foreground/40">No conversion data</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius="28%"
              outerRadius="52%"
              dataKey="value"
              strokeWidth={0}
            >
              {data.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid rgba(0,0,0,0.08)", fontSize: "11px", padding: "4px 8px" }}
              formatter={(v: number) => [v.toLocaleString(), ""]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-2 shrink-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: d.color }} />
            <span className="text-[11px] text-foreground/60 flex-1 truncate">{d.name}</span>
            <span className="text-[11px] font-semibold tabular-nums text-foreground">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Financials Widget (redesigned) ─────────────────────────────────────────────

function FinancialsWidget({
  agg,
  campaign,
  contract,
  contractLoading,
  isAgencyUser,
  onGoToConfig,
}: {
  agg: ReturnType<typeof getCampaignMetrics>;
  campaign: Campaign;
  contract: ContractFinancials | null;
  contractLoading: boolean;
  isAgencyUser: boolean;
  onGoToConfig: () => void;
}) {
  // Resolve financial values: prefer contract fields, then campaign fallback
  const dealType = contract?.deal_type ?? null;
  const valuePB = Number(contract?.value_per_booking ?? campaign.value_per_booking ?? 0) || 0;
  const paymentTrigger = contract?.payment_trigger ?? null;
  const monthlyFee = Number(contract?.monthly_fee ?? 0) || 0;
  const fixedFeeAmt = Number(contract?.fixed_fee_amount ?? 0) || 0;

  const totalCost = agg.totalCost ?? 0;
  const costPerBooking = agg.costPerBooking ?? 0;
  const bookings = agg.bookings ?? 0;

  // Compute campaign duration in months (for monthly retainer)
  const campaignMonths = useMemo(() => {
    if (!campaign.start_date) return 1;
    const start = new Date(campaign.start_date);
    const end = campaign.end_date ? new Date(campaign.end_date) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const months = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24 * 30)));
    return months;
  }, [campaign.start_date, campaign.end_date]);

  // Projected revenue computation
  const projectedRevenue = useMemo(() => {
    let rev = bookings * valuePB;
    if (monthlyFee > 0) rev += monthlyFee * campaignMonths;
    if (fixedFeeAmt > 0) rev += fixedFeeAmt;
    return rev;
  }, [bookings, valuePB, monthlyFee, campaignMonths, fixedFeeAmt]);

  // ROI: (projected_revenue - total_cost) / total_cost * 100
  const computedRoi = useMemo(() => {
    if (totalCost <= 0) return null;
    return ((projectedRevenue - totalCost) / totalCost) * 100;
  }, [projectedRevenue, totalCost]);

  const roiValue = computedRoi ?? agg.roiPercent;
  const hasContractOrValue = contract !== null || valuePB > 0;

  // Deal type badge colors
  const dealTypeBadge: Record<string, { bg: string; text: string }> = {
    retainer:        { bg: "#DBEAFE", text: "#1D4ED8" },
    per_booking:     { bg: "#D1FAE5", text: "#065F46" },
    fixed:           { bg: "#F3F4F6", text: "#374151" },
    retainer_plus:   { bg: "#EDE9FE", text: "#5B21B6" },
    sale_closed:     { bg: "#FEF3C7", text: "#92400E" },
  };
  const dtColors = dealType ? (dealTypeBadge[dealType] ?? { bg: "#F3F4F6", text: "#374151" }) : null;
  const dealTypeLabel: Record<string, string> = {
    retainer:        "Retainer",
    per_booking:     "Per Booking",
    fixed:           "Fixed Fee",
    retainer_plus:   "Retainer +",
    sale_closed:     "Sale Closed",
  };
  const paymentTriggerLabel: Record<string, string> = {
    booked_call:  "Booked Call",
    sale_closed:  "Closed Sale",
    meeting_held: "Meeting Held",
  };

  if (contractLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-5 h-5 rounded-full border-2 border-brand-blue/30 border-t-brand-blue animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-y-auto">

      {/* Deal type badge (if contract linked) */}
      {dtColors && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 min-w-[90px]">Deal Type</span>
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
            style={{ backgroundColor: dtColors.bg, color: dtColors.text }}
          >
            {dealTypeLabel[dealType!] ?? dealType}
          </span>
          {contract && (
            <span className="text-[10px] text-foreground/40 truncate flex items-center gap-1">
              <FileText className="w-3 h-3 shrink-0" />
              {contract.title || `Contract #${contract.id}`}
            </span>
          )}
        </div>
      )}

      {/* 2-up: Total Spend + Cost / Booking — agency only */}
      {isAgencyUser && (
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl bg-white/40 px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Total Spend</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrency(totalCost)}</div>
          </div>
          <div className="rounded-xl bg-white/40 px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Cost / Booking</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrencyDecimals(costPerBooking)}</div>
          </div>
        </div>
      )}

      {/* 2-up: Value / Booking + Payment Trigger */}
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-white/40 px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Value / Booking</div>
          <div className="text-[18px] font-bold tabular-nums text-foreground">
            {valuePB > 0 ? fmtCurrency(valuePB) : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white/40 px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Payment Trigger</div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">
            {paymentTrigger ? (paymentTriggerLabel[paymentTrigger] ?? paymentTrigger) : "—"}
          </div>
        </div>
      </div>

      {/* Projected Revenue — agency only */}
      {isAgencyUser && hasContractOrValue && (
        <div className="rounded-xl bg-white/40 px-3 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider">Projected Revenue</div>
            {paymentTrigger === "sale_closed" && (
              <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">est.</span>
            )}
          </div>
          <div className="text-[22px] font-bold tabular-nums text-foreground">{fmtCurrency(projectedRevenue)}</div>
        </div>
      )}

      {/* No contract + no value prompt */}
      {!hasContractOrValue && (
        <button
          onClick={onGoToConfig}
          className="flex items-center gap-1.5 text-[11px] text-brand-blue font-medium hover:underline mt-1"
        >
          <ArrowRight className="w-3 h-3" />
          Link a contract in Config →
        </button>
      )}

      {/* ROI — large display */}
      <div className="rounded-xl bg-white/40 px-3 py-3">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Return on Investment</div>
        <div className={cn("text-[28px] font-black tabular-nums leading-none", getRoiColor(roiValue))}>
          {roiValue != null ? `${roiValue >= 0 ? "+" : ""}${roiValue.toFixed(0)}%` : "—"}
        </div>
      </div>

    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty() {
  return (
    <div className="relative flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      {/* ── Full-height gradient: same warm bloom as CampaignDetailView ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF286_0%,rgba(255,242,134,0.60)_40%,rgba(255,242,134,0.25)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center ring-1 ring-amber-200/50">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">Select a campaign</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any campaign on the left to see its performance, configuration, and message templates.
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
        <span>&larr; Choose from the list</span>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface CampaignDetailViewProps {
  campaign: Campaign;
  metrics: CampaignMetricsHistory[];
  allCampaigns: Campaign[];
  onToggleStatus: (campaign: Campaign) => void;
  onSave: (id: number, patch: Record<string, unknown>) => Promise<void>;
  compact?: boolean;
}

export function CampaignDetailView({ campaign, metrics, allCampaigns, onToggleStatus, onSave, compact = false }: CampaignDetailViewProps) {
  const { isAgencyUser } = useWorkspace();

  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  // ── Tab + date range state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"summary" | "configurations">("summary");
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange());

  // ── Filter metrics by date range ───────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    return campaignMetrics.filter((m) => isWithinDateRange(m.metric_date, dateRange));
  }, [campaignMetrics, dateRange]);

  const agg = useMemo(() => getCampaignMetrics(campaign, filteredMetrics), [campaign, filteredMetrics]);

  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);

  const initials = (campaign.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const isActive  = status === "Active";
  const isPaused  = status === "Paused";
  const canToggle = isActive || isPaused;

  // ── Compute campaign number (#N) ───────────────────────────────────────────
  const campaignNumber = useMemo(() => {
    const accountId = campaign.account_id || (campaign as any).Accounts_id;
    const sameAccount = allCampaigns
      .filter((c) => (c.account_id || (c as any).Accounts_id) === accountId)
      .sort((a, b) => (a.created_at || "").localeCompare(b.created_at || ""));
    const idx = sameAccount.findIndex((c) => (c.id || c.Id) === (campaign.id || campaign.Id));
    return idx >= 0 ? idx + 1 : 1;
  }, [campaign, allCampaigns]);

  // ── Compute duration ───────────────────────────────────────────────────────
  const durationLabel = useMemo(() => {
    if (!campaign.start_date) return null;
    const start = new Date(campaign.start_date);
    const isCompleted = status === "Completed" || status === "Finished" || status === "Archived";
    const end = isCompleted && campaign.end_date ? new Date(campaign.end_date) : new Date();
    const diffMs = end.getTime() - start.getTime();
    const days = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
    const prefix = isCompleted ? "Ran for" : "Running for";
    return `${prefix} ${days} day${days !== 1 ? "s" : ""}`;
  }, [campaign.start_date, campaign.end_date, status]);

  // ── Inline editing state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // ── Linked contract fetch ───────────────────────────────────────────────────
  const [linkedContract, setLinkedContract] = useState<ContractFinancials | null>(null);
  const [contractLoading, setContractLoading] = useState(false);

  useEffect(() => {
    const contractId = campaign.contract_id ?? (campaign as any).contract_id;
    if (!contractId) {
      setLinkedContract(null);
      return;
    }
    setContractLoading(true);
    apiFetch(`/api/contracts/${contractId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => setLinkedContract(data ?? null))
      .catch(() => setLinkedContract(null))
      .finally(() => setContractLoading(false));
  }, [campaign.contract_id, (campaign as any).contract_id]);

  const startEdit = () => {
    setDraft({
      name: campaign.name || "",
      status: campaign.status || "",
      type: campaign.type || "",
      description: campaign.description || "",
      start_date: campaign.start_date || "",
      end_date: campaign.end_date || "",
      active_hours_start: campaign.active_hours_start || "",
      active_hours_end: campaign.active_hours_end || "",
      daily_lead_limit: campaign.daily_lead_limit ?? "",
      message_interval_minutes: campaign.message_interval_minutes ?? "",
      stop_on_response: campaign.stop_on_response ?? false,
      use_ai_bumps: campaign.use_ai_bumps ?? false,
      max_bumps: campaign.max_bumps ?? "",
      ai_model: campaign.ai_model || "",
      ai_temperature: campaign.ai_temperature ?? "",
      agent_name: campaign.agent_name || "",
      service_name: campaign.service_name || "",
      ai_prompt_template: campaign.ai_prompt_template || "",
      first_message_template: campaign.first_message_template || campaign.First_Message || "",
      bump_1_template: campaign.bump_1_template || "",
      bump_1_delay_hours: campaign.bump_1_delay_hours ?? "",
      bump_2_template: campaign.bump_2_template || "",
      bump_2_delay_hours: campaign.bump_2_delay_hours ?? "",
      bump_3_template: campaign.bump_3_template || "",
      bump_3_delay_hours: campaign.bump_3_delay_hours ?? "",
      contract_id: String(campaign.contract_id || (campaign as any).contract_id || ""),
      value_per_booking: campaign.value_per_booking ?? "",
    });
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft({});
  };

  const handleSave = async () => {
    const id = campaign.id || campaign.Id;
    if (!id) return;
    setSaving(true);
    try {
      await onSave(id, draft);
      setIsEditing(false);
      setDraft({});
    } catch (e) {
      console.error("Save failed", e);
    } finally {
      setSaving(false);
    }
  };

  const goToConfig = useCallback(() => setActiveTab("configurations"), []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="campaign-detail-view">

      {/* ── Full-height gradient: vivid yellow top-left → beige mid → blue lower ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF286_0%,rgba(255,242,134,0.60)_40%,rgba(255,242,134,0.25)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      {/* ── Header content ── */}
      <div className="shrink-0">
        <div className="relative px-4 pt-6 pb-5 space-y-3">

          {/* Row 1: CRM action toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium bg-brand-blue text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                  {saving ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-3 w-3" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                {activeTab === "configurations" && (
                  <button
                    onClick={startEdit}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                  >
                    <Pencil className="h-3 w-3" />
                    Edit
                  </button>
                )}
                {canToggle && (
                  <button
                    onClick={() => onToggleStatus(campaign)}
                    className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                  >
                    {isActive
                      ? <><PauseCircle className="h-3 w-3" />Pause</>
                      : <><PlayCircle className="h-3 w-3" />Activate</>
                    }
                  </button>
                )}
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
                  <RefreshCw className="h-3 w-3" />
                  Refresh
                </button>
                <button className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors">
                  <Trash2 className="h-3 w-3" />
                  Delete
                </button>
              </>
            )}
          </div>

          {/* Row 2: Avatar + Name */}
          <div className="flex items-start gap-3">
            <div
              className="h-[72px] w-[72px] rounded-full flex items-center justify-center text-xl font-bold shrink-0"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials || <Zap className="w-6 h-6" />}
            </div>

            <div className="flex-1 min-w-0 py-1">
              <h2 className="text-[27px] font-semibold font-heading text-foreground leading-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || "Unnamed Campaign"}
              </h2>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">
                    Campaign #{campaignNumber}
                  </span>
                  {status && (
                    <span
                      className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold"
                      style={{ backgroundColor: `${CAMPAIGN_STATUS_HEX[status]}20`, color: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
                      data-testid="campaign-detail-view-status"
                    >
                      <span
                        className="w-1.5 h-1.5 rounded-full shrink-0"
                        style={{ backgroundColor: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
                      />
                      {status}
                    </span>
                  )}
                  {campaign.account_name && (
                    <span className="text-[11px] text-foreground/50">{campaign.account_name}</span>
                  )}
                  {durationLabel && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-foreground/50">
                      <Clock className="w-3 h-3" />
                      {durationLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Tab row: Summary / Configurations + Date range */}
      <div className="relative shrink-0 px-4 pt-2 pb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("summary")}
            className={cn(
              "h-10 px-5 rounded-full text-[12px] font-semibold transition-colors",
              activeTab === "summary"
                ? "bg-foreground text-background"
                : "border border-border/50 text-foreground/60 hover:text-foreground hover:border-border"
            )}
          >
            Summary
          </button>
          <button
            onClick={() => setActiveTab("configurations")}
            className={cn(
              "h-10 px-5 rounded-full text-[12px] font-semibold transition-colors",
              activeTab === "configurations"
                ? "bg-foreground text-background"
                : "border border-border/50 text-foreground/60 hover:text-foreground hover:border-border"
            )}
          >
            Configurations
          </button>
        </div>
        {activeTab === "summary" && (
          <DateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            allFrom={campaign.start_date ? new Date(campaign.start_date) : undefined}
          />
        )}
      </div>

      {/* ── Body ── */}
      <div className={cn("relative flex-1 p-[3px]", compact ? "overflow-y-auto" : "overflow-hidden")}>

        {/* ── Summary tab — 3 tall columns to bottom ── */}
        {activeTab === "summary" && (
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-3 gap-[3px] h-full")}>

            {/* ── Col 1: Key Metrics (4 squares) + Performance Trends ── */}
            <div className={cn(compact ? "flex flex-col gap-3" : "flex flex-col gap-[3px] min-h-0")}>

              {/* Key Metrics: 4 stat squares */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto", compact ? "shrink-0" : "flex-1 min-h-0")} data-testid="campaign-detail-view-metrics">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Key Metrics</span>
                </div>
                <div className="grid grid-cols-2 gap-3 flex-1">
                  {[
                    { v: agg.totalLeadsTargeted.toLocaleString(), l: "Leads Targeted" },
                    { v: agg.totalMessagesSent.toLocaleString(),  l: "Messages Sent"  },
                    { v: agg.responseRate != null ? `${agg.responseRate}%` : "—", l: "Response %" },
                    { v: agg.bookingRate  != null ? `${agg.bookingRate}%`  : "—", l: "Booking %"  },
                  ].map((s) => (
                    <div key={s.l} className="rounded-xl bg-white/40 p-4 flex flex-col items-center justify-center text-center">
                      <div className="text-[28px] font-black text-foreground tabular-nums leading-none">{s.v}</div>
                      <div className="text-[10px] text-foreground/40 uppercase tracking-wider mt-1.5">{s.l}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Performance Trends chart — fills remaining height */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4", compact ? "min-h-[200px]" : "flex-1 min-h-0")} data-testid="campaign-detail-view-trends">
                <div className="flex items-center gap-2">
                  <BarChart2 className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Performance Trends</span>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(() => {
                        return [...filteredMetrics]
                          .sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""))
                          .map((m) => ({
                            date: m.metric_date
                              ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                              : "",
                            "Response %": Number(m.response_rate_percent) || 0,
                            "Booking %":  Number(m.booking_rate_percent)  || 0,
                          }));
                      })()}
                      margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
                      <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                      <Line type="monotone" dataKey="Response %" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                      <Line type="monotone" dataKey="Booking %"  stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

            {/* ── Col 2 (middle): Pipeline Funnel + Conversion Pie ── */}
            <div className={cn(compact ? "flex flex-col gap-3" : "flex flex-col gap-[3px] min-h-0")}>

              {/* Pipeline Funnel — 6 real stages */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto", compact ? "shrink-0" : "flex-1 min-h-0")} data-testid="campaign-detail-view-funnel">
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Pipeline Funnel</span>
                </div>
                <CampaignFunnelWidget campaignId={campaign.id || (campaign as any).Id} />
              </div>

              {/* Conversion breakdown pie chart */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto", compact ? "min-h-[200px]" : "flex-1 min-h-0")} data-testid="campaign-detail-view-conversions">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Conversions</span>
                </div>
                <ConversionPieChart agg={agg} />
              </div>

            </div>

            {/* ── Col 3: Financials + ROI Trend ── */}
            <div className={cn(compact ? "flex flex-col gap-3" : "flex flex-col gap-[3px] min-h-0")}>

              {/* Financials — redesigned */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4 overflow-y-auto", compact ? "shrink-0" : "flex-1 min-h-0")} data-testid="campaign-detail-view-financials">
                <div className="flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Financials</span>
                </div>
                <FinancialsWidget
                  agg={agg}
                  campaign={campaign}
                  contract={linkedContract}
                  contractLoading={contractLoading}
                  isAgencyUser={isAgencyUser}
                  onGoToConfig={goToConfig}
                />
              </div>

              {/* ROI Trend — fills remaining height */}
              <div className={cn("bg-white/60 rounded-xl p-5 flex flex-col gap-4", compact ? "min-h-[200px]" : "flex-1 min-h-0")} data-testid="campaign-detail-view-roi">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-foreground/40" />
                  <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">ROI Trend</span>
                </div>
                <div className="flex-1 min-h-0">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                      data={(() => {
                        return [...filteredMetrics]
                          .sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""))
                          .map((m) => ({
                            date: m.metric_date
                              ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                              : "",
                            "ROI %": Number(m.roi_percent) || 0,
                          }));
                      })()}
                      margin={{ top: 4, right: 4, bottom: 4, left: -20 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
                      <Line type="monotone" dataKey="ROI %" stroke="#10b981" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* ── Configurations tab ── */}
        {activeTab === "configurations" && (
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-3 gap-[3px] h-full")}>

            {/* Column 1: Configuration / Settings */}
            <div className="bg-white/60 rounded-xl p-5 space-y-3 overflow-y-auto" data-testid="campaign-detail-view-settings">
              <div className="flex items-center gap-2 mb-1">
                <Settings className="w-4 h-4 text-foreground/40" />
                <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Configuration</span>
              </div>

              {/* Type + Description */}
              <div className="space-y-0">
                <InfoRow label="Type" value={campaign.type}
                  editChild={isEditing ? <EditText value={String(draft.type ?? "")} onChange={(v) => setDraft(d => ({...d, type: v}))} placeholder="Campaign type" /> : undefined}
                />
                <InfoRow label="Description" value={campaign.description}
                  editChild={isEditing ? <EditText value={String(draft.description ?? "")} onChange={(v) => setDraft(d => ({...d, description: v}))} multiline placeholder="Description…" /> : undefined}
                />
              </div>

              {/* Schedule group */}
              <div className="space-y-0">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pt-3 pb-2">Schedule</p>
                <InfoRow label="Start date" value={formatDate(campaign.start_date)}
                  editChild={isEditing ? <EditDate value={String(draft.start_date ?? "")} onChange={(v) => setDraft(d => ({...d, start_date: v}))} /> : undefined}
                />
                <InfoRow label="End date" value={formatDate(campaign.end_date)}
                  editChild={isEditing ? <EditDate value={String(draft.end_date ?? "")} onChange={(v) => setDraft(d => ({...d, end_date: v}))} /> : undefined}
                />
                <InfoRow
                  label="Active hours"
                  value={campaign.active_hours_start || campaign.active_hours_end ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}` : null}
                  editChild={isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <EditText value={String(draft.active_hours_start ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_start: v}))} placeholder="09:00" />
                      <span className="text-foreground/40 text-[11px]">→</span>
                      <EditText value={String(draft.active_hours_end ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_end: v}))} placeholder="18:00" />
                    </div>
                  ) : undefined}
                />
                <InfoRow label="Daily limit" value={campaign.daily_lead_limit?.toLocaleString()}
                  editChild={isEditing ? <EditNumber value={String(draft.daily_lead_limit ?? "")} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v}))} placeholder="e.g. 50" /> : undefined}
                />
                <InfoRow label="Interval" value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : null}
                  editChild={isEditing ? <EditNumber value={String(draft.message_interval_minutes ?? "")} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} placeholder="minutes" /> : undefined}
                />
              </div>

              {/* Behavior group */}
              <div className="space-y-0">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pt-3 pb-2">Behavior</p>
                <BoolRow label="Stop on response" value={campaign.stop_on_response}
                  editChild={isEditing ? <EditToggle value={Boolean(draft.stop_on_response)} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
                />
                <BoolRow label="Use AI bumps" value={campaign.use_ai_bumps}
                  editChild={isEditing ? <EditToggle value={Boolean(draft.use_ai_bumps)} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
                />
                <InfoRow label="Max bumps" value={campaign.max_bumps}
                  editChild={isEditing ? <EditNumber value={String(draft.max_bumps ?? "")} onChange={(v) => setDraft(d => ({...d, max_bumps: v}))} placeholder="e.g. 3" /> : undefined}
                />
              </div>

              {/* Contract group */}
              <div className="space-y-0">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pt-3 pb-2">Contract</p>
                <InfoRow
                  label="Deal"
                  value={
                    linkedContract
                      ? (linkedContract.title || `Contract #${linkedContract.id}`)
                      : "— None linked"
                  }
                  editChild={isEditing ? (
                    <ContractSelect
                      value={String(draft.contract_id ?? "")}
                      onChange={(v) => setDraft(d => ({...d, contract_id: v}))}
                      accountsId={campaign.account_id || (campaign as any).Accounts_id}
                    />
                  ) : undefined}
                />
                <InfoRow
                  label="Value / Booking"
                  value={
                    linkedContract?.value_per_booking != null
                      ? fmtCurrency(Number(linkedContract.value_per_booking))
                      : campaign.value_per_booking != null
                        ? fmtCurrency(Number(campaign.value_per_booking))
                        : null
                  }
                  editChild={isEditing ? (
                    <EditNumber
                      value={String(draft.value_per_booking ?? "")}
                      onChange={(v) => setDraft(d => ({...d, value_per_booking: v}))}
                      placeholder="e.g. 500"
                    />
                  ) : undefined}
                />
              </div>
            </div>

            {/* Column 2: AI Settings */}
            <div className="bg-white/60 rounded-xl p-5 space-y-3 overflow-y-auto" data-testid="campaign-detail-view-ai">
              <div className="flex items-center gap-2 mb-1">
                <Bot className="w-4 h-4 text-foreground/40" />
                <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">AI Settings</span>
              </div>
              <div className="space-y-0">
                <InfoRow label="Model" value={campaign.ai_model || "Default"}
                  editChild={isEditing ? <EditText value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} placeholder="Model name" /> : undefined}
                />
                <InfoRow label="Temperature" value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null}
                  editChild={isEditing ? <EditNumber value={String(draft.ai_temperature ?? "")} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} placeholder="0.7" /> : undefined}
                />
                <InfoRow label="Agent" value={campaign.agent_name}
                  editChild={isEditing ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => setDraft(d => ({...d, agent_name: v}))} /> : undefined}
                />
                <InfoRow label="Service" value={campaign.service_name}
                  editChild={isEditing ? <EditText value={String(draft.service_name ?? "")} onChange={(v) => setDraft(d => ({...d, service_name: v}))} /> : undefined}
                />
              </div>
              {(campaign.ai_prompt_template || isEditing) && (
                <div className="space-y-1.5">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pb-1">Prompt Template</p>
                  {isEditing ? (
                    <EditText
                      value={String(draft.ai_prompt_template ?? "")}
                      onChange={(v) => setDraft(d => ({...d, ai_prompt_template: v}))}
                      multiline
                      placeholder="System prompt / AI instructions…"
                    />
                  ) : (
                    <div className="relative rounded-lg bg-white/30 p-2 max-h-32 overflow-y-auto">
                      <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {campaign.ai_prompt_template}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 3: Message Templates */}
            <div className="bg-white/60 rounded-xl p-5 space-y-3 overflow-y-auto" data-testid="campaign-detail-view-templates">
              <div className="flex items-center gap-2 mb-1">
                <MessageSquare className="w-4 h-4 text-foreground/40" />
                <span className="text-[15px] font-bold uppercase tracking-widest text-foreground/50 font-heading">Message Templates</span>
              </div>

              {/* First message */}
              <div className="rounded-xl bg-white/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">First Message</span>
                  {!isEditing && (campaign.first_message_template || campaign.First_Message) && (
                    <CopyButton value={campaign.first_message_template || campaign.First_Message || ""} />
                  )}
                </div>
                {isEditing ? (
                  <EditText
                    value={String(draft.first_message_template ?? "")}
                    onChange={(v) => setDraft(d => ({...d, first_message_template: v}))}
                    multiline
                    placeholder="Hi {name}, we noticed…"
                  />
                ) : (
                  campaign.first_message_template || campaign.First_Message
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {campaign.first_message_template || campaign.First_Message}
                      </p>
                    : <p className="text-[11px] text-foreground/40 italic">No template set</p>
                )}
              </div>

              {/* Bump 1 */}
              <div className="rounded-xl bg-white/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Bump 1</span>
                    <ChevronRight className="w-3 h-3 text-foreground/30" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-foreground/50">Delay (h):</span>
                        <input
                          type="number"
                          value={String(draft.bump_1_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_1_delay_hours: e.target.value}))}
                          className="w-14 text-[11px] bg-white/60 border border-brand-blue/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="24"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>Delay: {formatHours(campaign.bump_1_delay_hours)}</span>
                      </div>
                    )}
                    {!isEditing && campaign.bump_1_template && <CopyButton value={campaign.bump_1_template} />}
                  </div>
                </div>
                {isEditing ? (
                  <EditText
                    value={String(draft.bump_1_template ?? "")}
                    onChange={(v) => setDraft(d => ({...d, bump_1_template: v}))}
                    multiline
                    placeholder="Follow-up message…"
                  />
                ) : (
                  campaign.bump_1_template
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.bump_1_template}</p>
                    : <p className="text-[11px] text-foreground/40 italic">No template set</p>
                )}
              </div>

              {/* Bump 2 */}
              <div className="rounded-xl bg-white/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Bump 2</span>
                    <ChevronRight className="w-3 h-3 text-foreground/30" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-foreground/50">Delay (h):</span>
                        <input
                          type="number"
                          value={String(draft.bump_2_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_2_delay_hours: e.target.value}))}
                          className="w-14 text-[11px] bg-white/60 border border-brand-blue/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="48"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>Delay: {formatHours(campaign.bump_2_delay_hours)}</span>
                      </div>
                    )}
                    {!isEditing && campaign.bump_2_template && <CopyButton value={campaign.bump_2_template} />}
                  </div>
                </div>
                {isEditing ? (
                  <EditText
                    value={String(draft.bump_2_template ?? "")}
                    onChange={(v) => setDraft(d => ({...d, bump_2_template: v}))}
                    multiline
                    placeholder="Second follow-up…"
                  />
                ) : (
                  campaign.bump_2_template
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.bump_2_template}</p>
                    : <p className="text-[11px] text-foreground/40 italic">No template set</p>
                )}
              </div>

              {/* Bump 3 */}
              <div className="rounded-xl bg-white/40 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Bump 3</span>
                    <ChevronRight className="w-3 h-3 text-foreground/30" />
                  </div>
                  <div className="flex items-center gap-2">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <span className="text-[10px] text-foreground/50">Delay (h):</span>
                        <input
                          type="number"
                          value={String(draft.bump_3_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_3_delay_hours: e.target.value}))}
                          className="w-14 text-[11px] bg-white/60 border border-brand-blue/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="72"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>Delay: {formatHours(campaign.bump_3_delay_hours)}</span>
                      </div>
                    )}
                    {!isEditing && campaign.bump_3_template && <CopyButton value={campaign.bump_3_template} />}
                  </div>
                </div>
                {isEditing ? (
                  <EditText
                    value={String(draft.bump_3_template ?? "")}
                    onChange={(v) => setDraft(d => ({...d, bump_3_template: v}))}
                    multiline
                    placeholder="Third follow-up…"
                  />
                ) : (
                  campaign.bump_3_template
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{campaign.bump_3_template}</p>
                    : <p className="text-[11px] text-foreground/40 italic">No template set</p>
                )}
              </div>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
