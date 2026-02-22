import { useMemo, useState, useCallback } from "react";
import {
  Clock,
  MessageSquare,
  Link2,
  Bot,
  Users,
  TrendingUp,
  DollarSign,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronRight,
  BarChart2,
  Settings,
  Layers,
  ListChecks,
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Check,
  Target,
  BarChart3,
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
} from "recharts";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";

// ── Helpers ─────────────────────────────────────────────────────────────────

function getAvatarGradient(status: string): string {
  switch (status) {
    case "Active":     return "from-emerald-500 to-teal-600";
    case "Paused":     return "from-amber-500 to-orange-600";
    case "Completed":
    case "Finished":   return "from-blue-500 to-indigo-600";
    case "Inactive":
    case "Archived":   return "from-slate-400 to-zinc-500";
    default:           return "from-indigo-500 to-violet-600";
  }
}

function getStatusBadge(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700";
    case "Paused":    return "bg-amber-100 text-amber-700 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700";
    case "Completed":
    case "Finished":  return "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
    default:          return "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800/60 dark:text-slate-400 dark:border-slate-700";
  }
}

function getStatusDotColor(status: string): string {
  switch (status) {
    case "Active":    return "bg-emerald-500";
    case "Paused":    return "bg-amber-500";
    case "Completed":
    case "Finished":  return "bg-blue-500";
    default:          return "bg-slate-400";
  }
}

// ── Campaign lifecycle stepper ────────────────────────────────────────────────

const CAMPAIGN_LIFECYCLE = [
  { key: "Inactive",  label: "Inactive" },
  { key: "Active",    label: "Active"   },
  { key: "Paused",    label: "Paused"   },
  { key: "Completed", label: "Done"     },
];

function CampaignStatusStepper({ status }: { status: string }) {
  const normalized = status === "Finished" ? "Completed" : status;
  const currentIdx = CAMPAIGN_LIFECYCLE.findIndex((s) => s.key === normalized);

  return (
    <div className="flex items-center gap-0 overflow-x-auto scrollbar-hide">
      {CAMPAIGN_LIFECYCLE.map((stage, i) => {
        const isPast    = i < currentIdx;
        const isCurrent = i === currentIdx;
        return (
          <div key={stage.key} className="flex items-center gap-0 shrink-0">
            {i > 0 && (
              <div className={cn(
                "h-px w-5 shrink-0",
                isPast || isCurrent ? "bg-emerald-300 dark:bg-emerald-700" : "bg-border/50"
              )} />
            )}
            <div className={cn(
              "flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap transition-colors",
              isCurrent
                ? cn("border", getStatusBadge(stage.key))
                : isPast
                ? "text-emerald-600 dark:text-emerald-500"
                : "text-muted-foreground/50"
            )}>
              {isPast    && <Check className="h-2.5 w-2.5 shrink-0" />}
              {isCurrent && <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />}
              {stage.label}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  if (roi === null) return "text-slate-500 dark:text-slate-400";
  if (roi >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (roi >= 0) return "text-blue-600 dark:text-blue-400";
  return "text-rose-600 dark:text-rose-400";
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
    };
  }

  const sorted = [...cMetrics].sort((a, b) =>
    (b.metric_date || "").localeCompare(a.metric_date || "")
  );
  const latest = sorted[0];
  const totalLeadsTargeted = cMetrics.reduce((s, m) => s + (m.total_leads_targeted || 0), 0);
  const totalMessagesSent = cMetrics.reduce((s, m) => s + (m.total_messages_sent || 0), 0);
  const totalCost = cMetrics.reduce((s, m) => s + (Number(m.total_cost) || 0), 0);

  return {
    totalLeadsTargeted,
    totalMessagesSent,
    responseRate: Number(latest.response_rate_percent) || 0,
    bookingRate: Number(latest.booking_rate_percent) || 0,
    totalCost,
    costPerLead: Number(latest.cost_per_lead) || 0,
    costPerBooking: Number(latest.cost_per_booking) || 0,
    roiPercent: Number(latest.roi_percent) || 0,
  };
}

// ── Sub-components ───────────────────────────────────────────────────────────

function WidgetCard({ title, icon, children, fullWidth = false, testId }: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  fullWidth?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={cn(
        "bg-card border border-border rounded-xl shadow-sm overflow-hidden",
        fullWidth && "col-span-2"
      )}
      data-testid={testId}
    >
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border/60 bg-muted/20">
        <div className="text-muted-foreground">{icon}</div>
        <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</span>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[12px] text-foreground text-right break-words max-w-[60%]", mono && "font-mono text-[11px]")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {value
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        : <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
      }
    </div>
  );
}

function BumpCard({ bumpNumber, template, delayHours }: {
  bumpNumber: number;
  template: string | null | undefined;
  delayHours: number | null | undefined;
}) {
  return (
    <div className="rounded-xl border border-border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bump {bumpNumber}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Delay: {formatHours(delayHours)}</span>
        </div>
      </div>
      {template
        ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{template}</p>
        : <p className="text-[11px] text-muted-foreground italic">No template set</p>
      }
    </div>
  );
}

function QualificationCriteriaDisplay({ raw }: { raw: string | null | undefined }) {
  if (!raw) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <ListChecks className="w-6 h-6 text-muted-foreground/30 mb-2" />
        <p className="text-[12px] text-muted-foreground italic">No qualification criteria defined</p>
      </div>
    );
  }

  let parsed: Record<string, unknown> | null = null;
  try {
    const p = JSON.parse(raw);
    if (typeof p === "object" && p !== null && !Array.isArray(p)) parsed = p as Record<string, unknown>;
  } catch { /* plain text */ }

  if (parsed) {
    return (
      <div className="space-y-2">
        {Object.entries(parsed).map(([key, value]) => {
          const label = key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
          let displayValue: React.ReactNode;
          if (typeof value === "boolean") {
            displayValue = value
              ? <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400"><CheckCircle2 className="w-3.5 h-3.5" /> Yes</span>
              : <span className="flex items-center gap-1 text-slate-500"><XCircle className="w-3.5 h-3.5" /> No</span>;
          } else if (Array.isArray(value)) {
            displayValue = (
              <div className="flex flex-wrap gap-1 justify-end">
                {(value as unknown[]).map((item, i) => (
                  <span key={i} className="inline-block bg-muted rounded-md px-1.5 py-0.5 text-[10px] font-medium text-foreground">{String(item)}</span>
                ))}
              </div>
            );
          } else {
            displayValue = <span className="text-[12px] text-foreground break-words text-right max-w-[60%]">{String(value ?? "—")}</span>;
          }
          return (
            <div key={key} className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
              <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
              <span className="text-right">{displayValue}</span>
            </div>
          );
        })}
      </div>
    );
  }

  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{raw}</p>
    </div>
  );
}

function PerformanceChart({ metrics }: { metrics: CampaignMetricsHistory[] }) {
  const chartData = useMemo(() => {
    return [...metrics]
      .sort((a, b) => (a.metric_date || "").localeCompare(b.metric_date || ""))
      .map((m) => ({
        date: m.metric_date
          ? new Date(m.metric_date).toLocaleDateString(undefined, { month: "short", day: "numeric" })
          : "",
        "Response %": Number(m.response_rate_percent) || 0,
        "Booking %": Number(m.booking_rate_percent) || 0,
        "ROI %": Number(m.roi_percent) || 0,
      }));
  }, [metrics]);

  if (chartData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <BarChart2 className="w-8 h-8 text-muted-foreground/30 mb-2" />
        <p className="text-[12px] text-muted-foreground">No trend data yet</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid hsl(var(--border))", backgroundColor: "hsl(var(--card))", color: "hsl(var(--foreground))", fontSize: "11px", padding: "6px 10px" }} />
          <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
          <Line type="monotone" dataKey="Response %" stroke="#6366f1" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="Booking %" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
          <Line type="monotone" dataKey="ROI %" stroke="#10b981" strokeWidth={1.5} dot={false} activeDot={{ r: 3 }} strokeDasharray="4 2" />
        </LineChart>
      </ResponsiveContainer>
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

// ── Empty state ──────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
      <div className="w-14 h-14 rounded-2xl bg-muted/60 flex items-center justify-center">
        <Zap className="w-7 h-7 text-muted-foreground/40" />
      </div>
      <div>
        <p className="text-sm font-semibold text-foreground/70">Select a campaign</p>
        <p className="text-xs text-muted-foreground mt-1">Click any campaign on the left to see its details</p>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

interface CampaignDetailViewProps {
  campaign: Campaign;
  metrics: CampaignMetricsHistory[];
  onEdit: (campaign: Campaign) => void;
  onToggleStatus: (campaign: Campaign) => void;
}

export function CampaignDetailView({ campaign, metrics, onEdit, onToggleStatus }: CampaignDetailViewProps) {
  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  const agg = useMemo(() => getCampaignMetrics(campaign, campaignMetrics), [campaign, campaignMetrics]);

  const status = String(campaign.status || "");
  const avatarGradient = getAvatarGradient(status);
  const badgeCls = getStatusBadge(status);
  const dotCls = getStatusDotColor(status);

  const initials = (campaign.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const isActive  = status === "Active";
  const isPaused  = status === "Paused";
  const canToggle = isActive || isPaused;

  const hasMetrics =
    agg.totalLeadsTargeted > 0 || agg.totalMessagesSent > 0 ||
    (agg.responseRate !== null && agg.responseRate > 0) ||
    (agg.bookingRate !== null && agg.bookingRate > 0);

  return (
    <div className="flex flex-col h-full overflow-hidden" data-testid="campaign-detail-view">

      {/* ── HEADER — D365 soft mint gradient ───────────────────────── */}
      <div className="shrink-0 relative overflow-hidden border-b border-border/30" data-testid="campaign-detail-view-header">
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-50/40 dark:from-emerald-950/30 dark:via-teal-950/20 dark:to-background" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_rgba(167,243,208,0.35)_0%,_transparent_65%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-emerald-200/60 to-transparent dark:via-emerald-800/30" />

        <div className="relative px-4 pt-4 pb-3 space-y-2.5">

          {/* Row 1: Avatar + Name + Actions */}
          <div className="flex items-start gap-3.5">
            <div className={cn(
              "w-14 h-14 rounded-2xl flex items-center justify-center text-lg font-black text-white shadow-md shrink-0 ring-2 ring-white/60",
              `bg-gradient-to-br ${avatarGradient}`
            )}>
              {initials || <Zap className="w-6 h-6" />}
            </div>

            <div className="flex-1 min-w-0 mt-0.5">
              <h2 className="text-[20px] font-bold text-foreground leading-tight tracking-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || "Unnamed Campaign"}
              </h2>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                <span
                  className={cn("inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border", badgeCls)}
                  data-testid="campaign-detail-view-status"
                >
                  <span className={cn("w-1.5 h-1.5 rounded-full", dotCls)} />
                  {status || "Unknown"}
                </span>
                {campaign.account_name && (
                  <span className="text-[12px] text-foreground/60 truncate">{campaign.account_name}</span>
                )}
                {campaign.type && (
                  <span className="text-[11px] text-foreground/50">{campaign.type}</span>
                )}
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex items-center gap-2 shrink-0 mt-0.5">
              <button
                onClick={() => onEdit(campaign)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                data-testid="campaign-detail-view-edit"
              >
                <Pencil className="w-3.5 h-3.5" />
                Edit
              </button>
              {canToggle && (
                <button
                  onClick={() => onToggleStatus(campaign)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-foreground/5 hover:bg-foreground/10 dark:bg-white/10 dark:hover:bg-white/15 text-foreground border border-border/50 text-xs font-semibold transition-colors"
                  data-testid="campaign-detail-view-toggle-status"
                >
                  {isActive
                    ? <><PauseCircle className="w-3.5 h-3.5" />Pause</>
                    : <><PlayCircle className="w-3.5 h-3.5" />Activate</>
                  }
                </button>
              )}
            </div>
          </div>

          {/* Row 2: Status lifecycle stepper */}
          <CampaignStatusStepper status={status} />

        </div>
      </div>

      {/* ── BODY — 3 cards in parallel, fixed height, no outer scroll ── */}
      <div className="flex-1 grid grid-cols-3 gap-3 p-3 bg-slate-50/50 dark:bg-muted/10 min-h-0 overflow-hidden">

        {/* Card 1: Performance */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="campaign-detail-view-trends">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <TrendingUp className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Performance</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            {hasMetrics ? (
              <div className="space-y-3">
                {/* Stat grid */}
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { v: agg.totalLeadsTargeted.toLocaleString(), l: "Leads" },
                    { v: agg.totalMessagesSent.toLocaleString(),  l: "Messages" },
                    { v: `${agg.responseRate ?? 0}%`,             l: "Response" },
                    { v: `${agg.bookingRate ?? 0}%`,              l: "Booking" },
                  ].map((s) => (
                    <div key={s.l} className="rounded-lg bg-muted/40 px-2 py-2 text-center">
                      <div className="text-[15px] font-black text-foreground tabular-nums leading-tight">{s.v}</div>
                      <div className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{s.l}</div>
                    </div>
                  ))}
                </div>
                {/* ROI */}
                <div className="flex items-center justify-between text-[12px] py-1 border-b border-border/30">
                  <span className="text-muted-foreground">ROI</span>
                  <span className={cn("font-bold", getRoiColor(agg.roiPercent))}>
                    {agg.roiPercent != null
                      ? `${agg.roiPercent >= 0 ? "+" : ""}${agg.roiPercent.toFixed(0)}%`
                      : "—"}
                  </span>
                </div>
                {/* Cost rows */}
                <div className="space-y-1.5 text-[12px]">
                  {[
                    { l: "Total Cost",    v: `$${(agg.totalCost ?? 0).toFixed(2)}` },
                    { l: "Cost / Lead",   v: `$${(agg.costPerLead ?? 0).toFixed(2)}` },
                    { l: "Cost / Booking",v: `$${(agg.costPerBooking ?? 0).toFixed(2)}` },
                  ].map((r) => (
                    <div key={r.l} className="flex justify-between">
                      <span className="text-muted-foreground">{r.l}</span>
                      <span className="text-foreground font-medium">{r.v}</span>
                    </div>
                  ))}
                </div>
                {/* Trend chart */}
                {campaignMetrics.length > 0 && (
                  <div className="pt-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2">Trends</p>
                    <PerformanceChart metrics={campaignMetrics} />
                  </div>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-center py-8">
                <BarChart3 className="w-8 h-8 text-muted-foreground/25 mb-2" />
                <p className="text-[12px] text-muted-foreground">No metrics yet</p>
                <p className="text-[11px] text-muted-foreground/60 mt-0.5">Metrics appear once the campaign runs</p>
              </div>
            )}
          </div>
        </div>

        {/* Card 2: Configuration */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="campaign-detail-view-settings">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configuration</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3">
            <div className="space-y-0">
              <InfoRow label="Type" value={campaign.type} />
              <InfoRow label="Description" value={campaign.description} />
              <InfoRow label="Start date" value={formatDate(campaign.start_date)} />
              <InfoRow label="End date" value={formatDate(campaign.end_date)} />
              <InfoRow
                label="Active hours"
                value={campaign.active_hours_start || campaign.active_hours_end
                  ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}`
                  : null}
              />
              <InfoRow label="Daily limit" value={campaign.daily_lead_limit?.toLocaleString()} />
              <InfoRow label="Interval" value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : null} />
              <BoolRow label="Stop on response" value={campaign.stop_on_response} />
              <BoolRow label="Use AI bumps" value={campaign.use_ai_bumps} />
              <InfoRow label="Max bumps" value={campaign.max_bumps} />
            </div>

            {/* AI Config sub-section */}
            <div className="mt-3 pt-3 border-t border-border/30">
              <div className="flex items-center gap-1.5 mb-2">
                <Bot className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI</span>
              </div>
              <div className="space-y-0">
                <InfoRow label="Model" value={campaign.ai_model || "Default"} />
                <InfoRow label="Temperature" value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null} />
                <InfoRow label="Agent" value={campaign.agent_name} />
                <InfoRow label="Service" value={campaign.service_name} />
              </div>
              {campaign.ai_prompt_template && (
                <div className="mt-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Prompt</p>
                  <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-2 break-words max-h-24 overflow-y-auto">
                    {campaign.ai_prompt_template}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Card 3: Message Templates */}
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden flex flex-col min-h-0" data-testid="campaign-detail-view-templates">
          <div className="px-3 py-2.5 border-b border-border/30 flex items-center gap-1.5 shrink-0 bg-muted/20">
            <Layers className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message Templates</span>
          </div>
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* First message */}
            <div className="rounded-xl border border-border/50 bg-muted/30 p-3 space-y-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">First Message</span>
              {campaign.first_message_template || campaign.First_Message
                ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {campaign.first_message_template || campaign.First_Message}
                  </p>
                : <p className="text-[11px] text-muted-foreground italic">No template set</p>
              }
            </div>
            <BumpCard bumpNumber={1} template={campaign.bump_1_template} delayHours={campaign.bump_1_delay_hours} />
            <BumpCard bumpNumber={2} template={campaign.bump_2_template} delayHours={campaign.bump_2_delay_hours} />
            <BumpCard bumpNumber={3} template={campaign.bump_3_template} delayHours={campaign.bump_3_delay_hours} />
          </div>
        </div>

      </div>
    </div>
  );
}
