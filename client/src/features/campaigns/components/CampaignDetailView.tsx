import { useMemo, useState, useCallback } from "react";
import {
  Clock,
  MessageSquare,
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
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  BarChart3,
  Megaphone,
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

// ── Campaign lifecycle stepper ────────────────────────────────────────────────

const CAMPAIGN_LIFECYCLE = [
  { key: "Inactive",  label: "Inactive" },
  { key: "Active",    label: "Active"   },
  { key: "Paused",    label: "Paused"   },
  { key: "Completed", label: "Done"     },
];

function CampaignStatusStepper({ status }: { status: string }) {
  const normalized = status === "Finished" ? "Completed" : status;
  const stages = CAMPAIGN_LIFECYCLE;

  const currentIndex = stages.findIndex((s) => s.key === normalized);

  return (
    <div className="w-full px-1">
      <div className="flex items-start">
        {stages.map((stage, i) => {
          const hex = CAMPAIGN_STATUS_HEX[stage.key] || "#6B7280";
          const isPast = i < currentIndex;
          const isCurrent = i === currentIndex;

          return (
            <div key={stage.key} className="flex items-start flex-1" style={{ minWidth: 0 }}>
              <div className="flex flex-col items-center gap-1 shrink-0">
                <div className="h-[14px] flex items-center justify-center">
                  {isCurrent ? (
                    <div style={{ width: 14, height: 14, borderRadius: "50%", backgroundColor: hex, boxShadow: `0 0 0 3px ${hex}25, 0 0 8px ${hex}40` }} />
                  ) : isPast ? (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: hex }} />
                  ) : (
                    <div style={{ width: 10, height: 10, borderRadius: "50%", backgroundColor: "transparent", border: "2px solid #D1D5DB" }} />
                  )}
                </div>
                <span
                  className="text-[8px] leading-none text-center"
                  style={{ color: isCurrent ? hex : "rgba(0,0,0,0.3)", fontWeight: isCurrent ? 700 : 500 }}
                >
                  {stage.label}
                </span>
              </div>
              {i < stages.length - 1 && (
                <div
                  className="flex-1 mt-[6px]"
                  style={{
                    height: 2, minWidth: 4,
                    backgroundColor: isPast ? (CAMPAIGN_STATUS_HEX[stages[i + 1]?.key] || hex) : "#E5E7EB",
                  }}
                />
              )}
            </div>
          );
        })}
      </div>
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
  if (roi === null) return "text-muted-foreground";
  if (roi >= 100) return "text-emerald-600";
  if (roi >= 0) return "text-blue-600";
  return "text-rose-600";
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

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-white/20 last:border-0">
      <span className="text-[11px] text-foreground/50 shrink-0 pt-0.5">{label}</span>
      <span className={cn("text-[12px] text-foreground text-right break-words max-w-[60%]", mono && "font-mono text-[11px]")}>
        {value ?? "—"}
      </span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/20 last:border-0">
      <span className="text-[11px] text-foreground/50">{label}</span>
      {value
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
        : <XCircle className="w-4 h-4 text-foreground/25 shrink-0" />
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
    <div className="rounded-xl bg-white/40 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">Bump {bumpNumber}</span>
          <ChevronRight className="w-3 h-3 text-foreground/30" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-foreground/50">
          <Clock className="w-3 h-3" />
          <span>Delay: {formatHours(delayHours)}</span>
        </div>
      </div>
      {template
        ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">{template}</p>
        : <p className="text-[11px] text-foreground/40 italic">No template set</p>
      }
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
        <BarChart2 className="w-8 h-8 text-foreground/15 mb-2" />
        <p className="text-[12px] text-foreground/40">No trend data yet</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
          <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
          <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
          <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
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
      className="p-1 rounded hover:bg-white/30 transition-colors text-foreground/40 hover:text-foreground shrink-0"
      title="Copy"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-5 p-8 text-center">
      <div className="relative">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 flex items-center justify-center ring-1 ring-amber-200/50">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">Select a campaign</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          Click any campaign on the left to see its performance, configuration, and message templates.
        </p>
      </div>
      <div className="flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
        <span>&larr; Choose from the list</span>
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
  const avatarColor = getCampaignAvatarColor(status);

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
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="campaign-detail-view">

      {/* ── Full-height gradient: vivid yellow top-left → beige mid → blue lower ── */}
      <div className="absolute inset-0 bg-[#F8F3EB]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_72%_56%_at_100%_0%,#FFFFFF_0%,rgba(255,255,255,0.80)_30%,transparent_60%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_80%_at_0%_0%,#FFF0A0_0%,#FFF7CC_40%,rgba(255,248,210,0.40)_64%,transparent_80%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_62%_72%_at_100%_36%,rgba(241,218,162,0.62)_0%,transparent_64%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_92%_36%_at_48%_53%,rgba(210,188,130,0.22)_0%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_98%_74%_at_50%_88%,rgba(105,170,255,0.60)_0%,transparent_74%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_54%_at_54%_60%,rgba(165,205,255,0.38)_0%,transparent_66%)]" />

      {/* ── Header content ── */}
      <div className="shrink-0">
        <div className="relative px-4 pt-6 pb-5 space-y-3">

          {/* Row 1: CRM action toolbar */}
          <div className="flex items-center gap-1 flex-wrap">
            <button
              onClick={() => onEdit(campaign)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium border border-border/60 bg-transparent text-foreground hover:bg-muted/50 transition-colors"
            >
              <Pencil className="h-3 w-3" />
              Edit
            </button>
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
          </div>

          {/* Row 2: Avatar + Name */}
          <div className="flex items-start gap-3">
            <div
              className="h-14 w-14 rounded-full flex items-center justify-center text-lg font-bold shrink-0"
              style={{ backgroundColor: avatarColor.bg, color: avatarColor.text }}
            >
              {initials || <Zap className="w-6 h-6" />}
            </div>

            <div className="flex-1 min-w-0 py-1">
              <h2 className="text-[27px] font-semibold font-heading text-foreground leading-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || "Unnamed Campaign"}
              </h2>

              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                {/* Left: badges */}
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-0.5 rounded border border-border/50 text-[10px] font-medium text-muted-foreground">
                    Campaign
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
                </div>

                {/* Right: meta strip */}
                <div className="flex items-center gap-[25px] ml-4">
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Leads</div>
                    <div className="text-[13px] font-bold text-foreground tabular-nums">{agg.totalLeadsTargeted.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Messages</div>
                    <div className="text-[13px] font-bold text-foreground tabular-nums">{agg.totalMessagesSent.toLocaleString()}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Response</div>
                    <div className="text-[13px] font-bold text-foreground tabular-nums">{agg.responseRate != null ? `${agg.responseRate}%` : "—"}</div>
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Booking</div>
                    <div className="text-[13px] font-bold text-foreground tabular-nums">{agg.bookingRate != null ? `${agg.bookingRate}%` : "—"}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Row 3: Campaign lifecycle stepper */}
          {status && <CampaignStatusStepper status={status} />}

        </div>
      </div>

      {/* ── Body — 3-column layout: [Performance] | [Configuration] | [Templates] ── */}
      <div className="relative flex-1 overflow-hidden min-h-0 p-[3px] flex flex-col">
        <div className="flex-1 grid gap-[3px]" style={{ gridTemplateColumns: "1fr 1.4fr 1fr" }}>

          {/* Column 1: Performance */}
          <div className="flex flex-col gap-[3px]">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full" data-testid="campaign-detail-view-trends">
                <p className="text-[17px] font-semibold font-heading text-foreground">Performance</p>

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
                        <div key={s.l} className="rounded-lg bg-white/40 px-2 py-2 text-center">
                          <div className="text-[15px] font-black text-foreground tabular-nums leading-tight">{s.v}</div>
                          <div className="text-[9px] text-foreground/40 uppercase tracking-wider mt-0.5">{s.l}</div>
                        </div>
                      ))}
                    </div>

                    {/* ROI */}
                    <div className="flex items-center justify-between text-[12px] py-1 border-b border-white/30">
                      <span className="text-foreground/50">ROI</span>
                      <span className={cn("font-bold", getRoiColor(agg.roiPercent))}>
                        {agg.roiPercent != null
                          ? `${agg.roiPercent >= 0 ? "+" : ""}${agg.roiPercent.toFixed(0)}%`
                          : "—"}
                      </span>
                    </div>

                    {/* Cost rows */}
                    <div className="space-y-1.5 text-[12px]">
                      {[
                        { l: "Total Cost",     v: `$${(agg.totalCost ?? 0).toFixed(2)}` },
                        { l: "Cost / Lead",    v: `$${(agg.costPerLead ?? 0).toFixed(2)}` },
                        { l: "Cost / Booking", v: `$${(agg.costPerBooking ?? 0).toFixed(2)}` },
                      ].map((r) => (
                        <div key={r.l} className="flex justify-between">
                          <span className="text-foreground/50">{r.l}</span>
                          <span className="text-foreground font-medium">{r.v}</span>
                        </div>
                      ))}
                    </div>

                    {/* Trend chart */}
                    {campaignMetrics.length > 0 && (
                      <div className="pt-1">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-2">Trends</p>
                        <PerformanceChart metrics={campaignMetrics} />
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center flex-1 text-center py-8">
                    <BarChart3 className="w-8 h-8 text-foreground/15 mb-2" />
                    <p className="text-[12px] text-foreground/40">No metrics yet</p>
                    <p className="text-[11px] text-foreground/30 mt-0.5">Metrics appear once the campaign runs</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Configuration (wider) */}
          <div className="flex flex-col gap-[3px]">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full" data-testid="campaign-detail-view-settings">
                <p className="text-[17px] font-semibold font-heading text-foreground">Configuration</p>

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
                <div className="mt-1 pt-3 border-t border-white/30">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Bot className="w-3 h-3 text-foreground/40" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">AI</span>
                  </div>
                  <div className="space-y-0">
                    <InfoRow label="Model" value={campaign.ai_model || "Default"} />
                    <InfoRow label="Temperature" value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null} />
                    <InfoRow label="Agent" value={campaign.agent_name} />
                    <InfoRow label="Service" value={campaign.service_name} />
                  </div>
                  {campaign.ai_prompt_template && (
                    <div className="mt-2">
                      <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 mb-1.5">Prompt</p>
                      <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-white/30 rounded-lg p-2 break-words max-h-24 overflow-y-auto">
                        {campaign.ai_prompt_template}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Column 3: Message Templates */}
          <div className="flex flex-col gap-[3px]">
            <div className="flex-1 min-h-0 overflow-y-auto">
              <div className="bg-white/60 rounded-xl p-4 flex flex-col gap-3 h-full" data-testid="campaign-detail-view-templates">
                <p className="text-[17px] font-semibold font-heading text-foreground">Templates</p>

                {/* First message */}
                <div className="rounded-xl bg-white/40 p-3 space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-foreground/50">First Message</span>
                  {campaign.first_message_template || campaign.First_Message
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {campaign.first_message_template || campaign.First_Message}
                      </p>
                    : <p className="text-[11px] text-foreground/40 italic">No template set</p>
                  }
                </div>

                <BumpCard bumpNumber={1} template={campaign.bump_1_template} delayHours={campaign.bump_1_delay_hours} />
                <BumpCard bumpNumber={2} template={campaign.bump_2_template} delayHours={campaign.bump_2_delay_hours} />
                <BumpCard bumpNumber={3} template={campaign.bump_3_template} delayHours={campaign.bump_3_delay_hours} />
              </div>
            </div>
          </div>

        </div>
      </div>

    </div>
  );
}
