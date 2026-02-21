import { useMemo } from "react";
import {
  X,
  Clock,
  MessageSquare,
  Calendar,
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

// ── Helpers ────────────────────────────────────────────────────────────────

function getStatusColor(status: string): { bg: string; text: string; dot: string } {
  switch (status) {
    case "Active":
      return { bg: "bg-emerald-500/15", text: "text-emerald-600 dark:text-emerald-400", dot: "bg-emerald-500" };
    case "Draft":
      return { bg: "bg-slate-500/15", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
    case "Paused":
      return { bg: "bg-amber-500/15", text: "text-amber-600 dark:text-amber-400", dot: "bg-amber-500" };
    case "Completed":
    case "Finished":
      return { bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", dot: "bg-blue-500" };
    case "Archived":
    case "Inactive":
      return { bg: "bg-slate-400/10", text: "text-slate-500 dark:text-slate-400", dot: "bg-slate-400" };
    default:
      return { bg: "bg-slate-500/15", text: "text-slate-600 dark:text-slate-400", dot: "bg-slate-400" };
  }
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

// ── Sub-components ──────────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="text-muted-foreground">{icon}</div>
      <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h3>
    </div>
  );
}

function InfoRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{label}</span>
      <span
        className={cn(
          "text-[12px] text-foreground text-right break-words max-w-[60%]",
          mono && "font-mono text-[11px]"
        )}
      >
        {value ?? "—"}
      </span>
    </div>
  );
}

function BoolRow({ label, value }: { label: string; value: boolean | null | undefined }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      {value ? (
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
      ) : (
        <XCircle className="w-4 h-4 text-slate-400 shrink-0" />
      )}
    </div>
  );
}

/** Renders a single bump template block */
function BumpCard({
  bumpNumber,
  template,
  delayHours,
}: {
  bumpNumber: number;
  template: string | null | undefined;
  delayHours: number | null | undefined;
}) {
  return (
    <div
      className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
      data-testid={`campaign-detail-bump-${bumpNumber}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            Bump {bumpNumber}
          </span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/50" />
        </div>
        <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Clock className="w-3 h-3" />
          <span>Delay: {formatHours(delayHours)}</span>
        </div>
      </div>
      {template ? (
        <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
          {template}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground italic">No template set</p>
      )}
    </div>
  );
}

/** Performance chart using Recharts */
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
        <p className="text-[12px] text-muted-foreground">No performance data yet</p>
      </div>
    );
  }

  return (
    <div className="w-full" style={{ height: 180 }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            contentStyle={{
              borderRadius: "10px",
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
              color: "hsl(var(--foreground))",
              fontSize: "11px",
              padding: "6px 10px",
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }}
          />
          <Line
            type="monotone"
            dataKey="Response %"
            stroke="#6366f1"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="Booking %"
            stroke="#f59e0b"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="ROI %"
            stroke="#10b981"
            strokeWidth={1.5}
            dot={false}
            activeDot={{ r: 3 }}
            strokeDasharray="4 2"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

/** Get ROI color class based on value */
function getRoiColor(roi: number): string {
  if (roi >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (roi >= 0) return "text-blue-600 dark:text-blue-400";
  return "text-rose-600 dark:text-rose-400";
}

/** Latest metric summary row */
function MetricSummaryRow({
  metrics,
}: {
  metrics: CampaignMetricsHistory[];
}) {
  const latest = useMemo(() => {
    if (metrics.length === 0) return null;
    return [...metrics].sort((a, b) =>
      (b.metric_date || "").localeCompare(a.metric_date || "")
    )[0];
  }, [metrics]);

  const totals = useMemo(() => {
    return metrics.reduce(
      (acc, m) => ({
        leadsTargeted: acc.leadsTargeted + (Number(m.total_leads_targeted) || 0),
        messagesSent: acc.messagesSent + (Number(m.total_messages_sent) || 0),
        responses: acc.responses + (Number(m.total_responses_received) || 0),
        bookings: acc.bookings + (Number(m.bookings_generated) || 0),
        cost: acc.cost + (Number(m.total_cost) || 0),
      }),
      { leadsTargeted: 0, messagesSent: 0, responses: 0, bookings: 0, cost: 0 }
    );
  }, [metrics]);

  if (!latest) return null;

  const roiValue = Number(latest.roi_percent) || 0;
  const costPerLead = Number(latest.cost_per_lead) || 0;
  const costPerBooking = Number(latest.cost_per_booking) || 0;

  const pills: { label: string; value: string; color: string; testId?: string }[] = [
    { label: "Leads", value: totals.leadsTargeted.toLocaleString(), color: "text-violet-600 dark:text-violet-400" },
    { label: "Messages", value: totals.messagesSent.toLocaleString(), color: "text-blue-600 dark:text-blue-400" },
    { label: "Responses", value: totals.responses.toLocaleString(), color: "text-cyan-600 dark:text-cyan-400" },
    { label: "Bookings", value: totals.bookings.toLocaleString(), color: "text-amber-600 dark:text-amber-400" },
    {
      label: "Response %",
      value: `${Number(latest.response_rate_percent) || 0}%`,
      color: "text-indigo-600 dark:text-indigo-400",
    },
    {
      label: "Booking %",
      value: `${Number(latest.booking_rate_percent) || 0}%`,
      color: "text-orange-600 dark:text-orange-400",
    },
    {
      label: "Total Cost",
      value: `$${totals.cost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
      color: "text-rose-600 dark:text-rose-400",
      testId: "campaign-detail-total-cost",
    },
    {
      label: "Cost/Lead",
      value: `$${costPerLead.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`,
      color: "text-orange-600 dark:text-orange-400",
      testId: "campaign-detail-cost-per-lead",
    },
    {
      label: "Cost/Booking",
      value: costPerBooking > 0
        ? `$${costPerBooking.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
        : "—",
      color: "text-pink-600 dark:text-pink-400",
      testId: "campaign-detail-cost-per-booking",
    },
    {
      label: "ROI",
      value: `${roiValue >= 0 ? "+" : ""}${roiValue}%`,
      color: getRoiColor(roiValue),
      testId: "campaign-detail-roi-percent",
    },
  ];

  return (
    <div className="grid grid-cols-5 gap-2" data-testid="campaign-detail-metrics-summary">
      {pills.map((p) => (
        <div
          key={p.label}
          className="rounded-xl bg-muted/40 p-2.5 text-center"
          data-testid={p.testId}
        >
          <div className={cn("text-sm font-black tabular-nums leading-tight", p.color)}>{p.value}</div>
          <div className="text-[9px] text-muted-foreground mt-0.5 font-semibold uppercase tracking-wider">
            {p.label}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── Main Panel ──────────────────────────────────────────────────────────────

interface CampaignDetailPanelProps {
  campaign: Campaign | null;
  metrics: CampaignMetricsHistory[];
  open: boolean;
  onClose: () => void;
}

export function CampaignDetailPanel({
  campaign,
  metrics,
  open,
  onClose,
}: CampaignDetailPanelProps) {
  // Filter metrics to just this campaign
  const campaignMetrics = useMemo(() => {
    if (!campaign) return [];
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  if (!open || !campaign) return null;

  const statusColors = getStatusColor(String(campaign.status || ""));
  const initials = (campaign.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        onClick={onClose}
        data-testid="campaign-detail-backdrop"
        aria-label="Close campaign detail"
      />

      {/* Panel */}
      <div
        className={cn(
          "fixed right-0 top-0 bottom-0 z-50 w-full max-w-[480px]",
          "bg-background border-l border-border shadow-2xl",
          "flex flex-col overflow-hidden",
          "animate-in slide-in-from-right duration-250 ease-out"
        )}
        data-testid="campaign-detail-panel"
        role="dialog"
        aria-modal="true"
        aria-label={`Campaign details: ${campaign.name}`}
      >
        {/* ── HEADER ──────────────────────────────────────────── */}
        <div className="shrink-0 flex items-start gap-3 p-5 border-b border-border">
          {/* Avatar */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white shrink-0"
            style={{
              background:
                (campaign.status as string) === "Active"
                  ? "linear-gradient(135deg, #10b981, #059669)"
                  : (campaign.status as string) === "Paused"
                  ? "linear-gradient(135deg, #f59e0b, #d97706)"
                  : (campaign.status as string) === "Inactive" || (campaign.status as string) === "Archived"
                  ? "linear-gradient(135deg, #94a3b8, #64748b)"
                  : "linear-gradient(135deg, #6366f1, #4f46e5)",
            }}
          >
            {initials || <Zap className="w-4 h-4" />}
          </div>

          {/* Name + status */}
          <div className="flex-1 min-w-0">
            <h2
              className="text-base font-bold text-foreground truncate leading-tight"
              data-testid="campaign-detail-name"
            >
              {campaign.name || "Unnamed Campaign"}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide",
                  statusColors.bg,
                  statusColors.text
                )}
                data-testid="campaign-detail-status"
              >
                <span className={cn("w-1.5 h-1.5 rounded-full inline-block", statusColors.dot)} />
                {campaign.status || "Unknown"}
              </span>
              {campaign.account_name && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {campaign.account_name}
                </span>
              )}
            </div>
          </div>

          {/* Close button */}
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors shrink-0"
            data-testid="campaign-detail-close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* PERFORMANCE METRICS ─────────────────────────────── */}
          {campaignMetrics.length > 0 && (
            <section data-testid="campaign-detail-section-metrics">
              <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} title="Performance" />
              <MetricSummaryRow metrics={campaignMetrics} />
            </section>
          )}

          {/* PERFORMANCE CHART ───────────────────────────────── */}
          {campaignMetrics.length > 0 && (
            <section data-testid="campaign-detail-section-chart">
              <SectionHeader icon={<BarChart2 className="w-3.5 h-3.5" />} title="Trends" />
              <div className="rounded-xl border border-border bg-card p-3">
                <PerformanceChart metrics={campaignMetrics} />
              </div>
            </section>
          )}

          {/* CAMPAIGN SETTINGS ───────────────────────────────── */}
          <section data-testid="campaign-detail-section-settings">
            <SectionHeader icon={<Settings className="w-3.5 h-3.5" />} title="Settings" />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow label="Description" value={campaign.description || "—"} />
              <InfoRow label="Type" value={campaign.type} />
              <InfoRow
                label="Start date"
                value={formatDate(campaign.start_date)}
              />
              <InfoRow
                label="End date"
                value={formatDate(campaign.end_date)}
              />
              <InfoRow
                label="Active hours"
                value={
                  campaign.active_hours_start || campaign.active_hours_end
                    ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}`
                    : "—"
                }
              />
              <InfoRow
                label="Daily lead limit"
                value={campaign.daily_lead_limit?.toLocaleString() || "—"}
              />
              <InfoRow
                label="Message interval"
                value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : "—"}
              />
              <BoolRow label="Stop on response" value={campaign.stop_on_response} />
              <BoolRow label="Use AI bumps" value={campaign.use_ai_bumps} />
              <InfoRow
                label="Max bumps"
                value={campaign.max_bumps}
              />
            </div>
          </section>

          {/* AI SETTINGS ─────────────────────────────────────── */}
          <section data-testid="campaign-detail-section-ai">
            <SectionHeader icon={<Bot className="w-3.5 h-3.5" />} title="AI Configuration" />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow label="AI model" value={campaign.ai_model || "Default"} />
              <InfoRow
                label="AI temperature"
                value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : "—"}
              />
              <InfoRow label="Agent name" value={campaign.agent_name} />
              <InfoRow label="Service name" value={campaign.service_name} />
              {campaign.ai_prompt_template && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    AI Prompt Template
                  </p>
                  <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap bg-muted/30 rounded-lg p-2 break-words">
                    {campaign.ai_prompt_template}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* MESSAGE TEMPLATES ───────────────────────────────── */}
          <section data-testid="campaign-detail-section-templates">
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} title="Message Templates" />
            <div className="space-y-3">
              {/* First message */}
              <div
                className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
                data-testid="campaign-detail-first-message"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    First Message
                  </span>
                </div>
                {campaign.first_message_template || campaign.First_Message ? (
                  <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {campaign.first_message_template || campaign.First_Message}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">No template set</p>
                )}
              </div>

              {/* Bump 1, 2, 3 */}
              <BumpCard
                bumpNumber={1}
                template={campaign.bump_1_template}
                delayHours={campaign.bump_1_delay_hours}
              />
              <BumpCard
                bumpNumber={2}
                template={campaign.bump_2_template}
                delayHours={campaign.bump_2_delay_hours}
              />
              <BumpCard
                bumpNumber={3}
                template={campaign.bump_3_template}
                delayHours={campaign.bump_3_delay_hours}
              />
            </div>
          </section>

          {/* COST & ROI ─────────────────────────────────────────── */}
          <section data-testid="campaign-detail-section-cost-metrics">
            <SectionHeader icon={<DollarSign className="w-3.5 h-3.5" />} title="Cost & ROI" />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow
                label="Total cost"
                value={
                  <span data-testid="campaign-detail-direct-total-cost">
                    ${Number(campaign.total_cost ?? 0).toFixed(2)}
                  </span>
                }
              />
              <InfoRow
                label="Cost per lead"
                value={
                  <span data-testid="campaign-detail-direct-cost-per-lead">
                    ${Number(campaign.cost_per_lead ?? 0).toFixed(2)}
                  </span>
                }
              />
              <InfoRow
                label="Cost per booking"
                value={
                  <span data-testid="campaign-detail-direct-cost-per-booking">
                    ${Number(campaign.cost_per_booking ?? 0).toFixed(2)}
                  </span>
                }
              />
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">ROI</span>
                <span
                  className={cn(
                    "text-[12px] font-bold text-right",
                    getRoiColor(Number(campaign.roi_percent) || 0)
                  )}
                  data-testid="campaign-detail-direct-roi-percent"
                >
                  {campaign.roi_percent != null
                    ? `${Number(campaign.roi_percent) >= 0 ? "+" : ""}${Number(campaign.roi_percent).toFixed(0)}%`
                    : "—"}
                </span>
              </div>
            </div>
          </section>

          {/* INTEGRATIONS ────────────────────────────────────── */}
          <section data-testid="campaign-detail-section-integrations">
            <SectionHeader icon={<Link2 className="w-3.5 h-3.5" />} title="Integrations" />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow
                label="n8n workflow ID"
                value={campaign.n8n_workflow_id || "—"}
                mono
              />
              <InfoRow
                label="Calendar link"
                value={
                  campaign.calendar_link || campaign.calendar_link_override ? (
                    <a
                      href={campaign.calendar_link || campaign.calendar_link_override}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary underline underline-offset-2 text-[11px] break-all"
                    >
                      {(campaign.calendar_link || campaign.calendar_link_override)?.slice(0, 40)}…
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <InfoRow
                label="Webhook URL"
                value={campaign.webhook_url || "—"}
                mono
              />
            </div>
          </section>

          {/* AUDIENCE ────────────────────────────────────────── */}
          {(campaign.target_audience || campaign.campaign_niche_override || campaign.campaign_service) && (
            <section data-testid="campaign-detail-section-audience">
              <SectionHeader icon={<Users className="w-3.5 h-3.5" />} title="Audience & Targeting" />
              <div className="rounded-xl border border-border bg-card p-3 space-y-0">
                <InfoRow label="Target audience" value={campaign.target_audience} />
                <InfoRow label="Niche" value={campaign.campaign_niche_override} />
                <InfoRow label="Service" value={campaign.campaign_service} />
                <InfoRow label="USP" value={campaign.campaign_usp} />
                <InfoRow label="Inquiry timeframe" value={campaign.inquiry_timeframe} />
              </div>
            </section>
          )}

          {/* Bottom spacer for mobile chrome */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}
