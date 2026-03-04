import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import {
  Clock,
  Zap,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ChevronLeft,
  Pencil,
  PauseCircle,
  PlayCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
  Megaphone,
  X,
  FileText,
  ArrowRight,
  Camera,
  Tag,
  Plus,
  ArrowUpDown,
  Filter,
  Layers,
  ImageIcon,
  Sparkles,
} from "lucide-react";
// Gradient tester removed — gradient is baked in
import { CampaignTagsSection } from "./CampaignTagsSection";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AreaChart,
  Area,
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
import { DonutChart } from "@/components/ui/donut-chart";
import { motion, AnimatePresence } from "framer-motion";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { renderRichText } from "@/lib/richTextUtils";
import { useWorkspace } from "@/hooks/useWorkspace";
import { apiFetch } from "@/lib/apiUtils";
import { DateRangeFilter, getDefaultDateRange, isWithinDateRange, type DateRangeValue } from "@/components/crm/DateRangeFilter";
import { useLeads } from "@/hooks/useApiData";
import { AgendaWidget } from "@/components/crm/AgendaWidget";
import { ActivityFeed } from "@/components/crm/ActivityFeed";
import { PIPELINE_HEX, getCampaignAvatarColor, CAMPAIGN_STATUS_HEX, getInitials } from "@/lib/avatarUtils";
import type { CampaignSortBy, CampaignGroupBy } from "../pages/CampaignsPage";
import { SearchPill } from "@/components/ui/search-pill";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// ── Expand-on-hover toolbar button tokens ────────────────────────────────────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Sort / Group / Filter labels ────────────────────────────────────────────
const DETAIL_SORT_LABELS: Record<CampaignSortBy, string> = {
  recent:        "Most Recent",
  name_asc:      "Name A \u2192 Z",
  name_desc:     "Name Z \u2192 A",
  leads_desc:    "Most Leads",
  response_desc: "Best Response",
};
const DETAIL_GROUP_LABELS: Record<CampaignGroupBy, string> = {
  none:    "None",
  status:  "Status",
  account: "Account",
  type:    "Type",
};
const DETAIL_STATUS_FILTER_OPTIONS = ["Active", "Paused", "Completed", "Inactive", "Draft"];
const DETAIL_STATUS_HEX: Record<string, string> = {
  Active:    "#22C55E",
  Paused:    "#F59E0B",
  Completed: "#3B82F6",
  Finished:  "#3B82F6",
  Inactive:  "#94A3B8",
  Archived:  "#94A3B8",
  Draft:     "#6B7280",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

// ── Count-up animation hook ───────────────────────────────────────────────────
function useCountUp(target: number, duration = 900, trigger = 0): number {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number | null>(null);
  useEffect(() => {
    if (target === 0) { setValue(0); return; }
    const start = performance.now();
    const from = 0;
    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(animate);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, duration, trigger]);
  return value;
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
      className="p-1 rounded hover:bg-white/30 dark:hover:bg-white/[0.04] transition-colors text-foreground/40 hover:text-foreground shrink-0"
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
        className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
      />
    );
  }
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
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
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30"
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
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
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
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
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
        value ? "bg-brand-indigo" : "bg-foreground/20"
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
      className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 outline-none focus:ring-1 focus:ring-brand-indigo/40"
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

// ── Pipeline + Donut — shared data + hover state ─────────────────────────────

function tintColor(hex: string, amount: number): string {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgb(${Math.round(r+(255-r)*amount)},${Math.round(g+(255-g)*amount)},${Math.round(b+(255-b)*amount)})`;
}

const FUNNEL_STAGES = [
  { key: "new",       label: "New",                dbValue: "New" },
  { key: "contacted", label: "Contacted",          dbValue: "Contacted" },
  { key: "responded", label: "Responded",          dbValue: "Responded" },
  { key: "multi",     label: "Multiple Responses", dbValue: "Multiple Responses" },
  { key: "qualified", label: "Qualified",          dbValue: "Qualified" },
  { key: "booked",    label: "Call Booked",        dbValue: "Booked" },
  { key: "closed",    label: "Closed",             dbValue: "Closed" },
  { key: "lost",      label: "Lost",               dbValue: "Lost" },
  { key: "dnd",       label: "DND",                dbValue: "DND" },
] as const;

function PipelineAndDonutWidget({ campaignId }: { campaignId: number }) {
  const { leads, loading } = useLeads(undefined, campaignId);
  // hoveredKey: transient (mouse-over only), cleared on mouse-leave
  // lockedKey:  persists on click, cleared on click-away or re-click
  const [hoveredKey, setHoveredKey] = useState<string | null>(null);
  const [lockedKey,  setLockedKey]  = useState<string | null>(null);

  // Reset selection whenever the campaign changes
  useEffect(() => {
    setHoveredKey(null);
    setLockedKey(null);
  }, [campaignId]);

  // Effective active key: hover takes priority, then locked, then none
  const activeKey = hoveredKey ?? lockedKey;

  const stages = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      ...s,
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
      count: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
    }));
  }, [leads]);

  const total = stages.reduce((s, st) => s + st.count, 0);
  const maxCount = Math.max(...stages.map((s) => s.count), 1);
  const hasData = stages.some((s) => s.count > 0);

  // Donut segments — only stages with data
  const donutData = useMemo(() =>
    stages.filter((s) => s.count > 0).map((s) => ({
      key:   s.key,
      label: s.label,
      value: s.count,
      color: s.color,
    }))
  , [stages]);

  const activeStage = activeKey ? stages.find((s) => s.key === activeKey) : null;
  const displayCount = activeStage ? activeStage.count : total;
  const displayLabel = activeStage ? activeStage.label : "Total Leads";

  if (loading) {
    return (
      <>
        <div className="flex justify-center" style={{ marginTop: -8 }}>
          <div className="w-[170px] h-[170px] rounded-full border-[22px] border-foreground/[0.06] animate-pulse" />
        </div>
        <div className="border-t border-border/15" />
        <div className="flex flex-col flex-1 justify-between w-full py-1">
          {FUNNEL_STAGES.map((s) => (
            <div key={s.key} className="flex flex-col gap-0.5">
              <div className="h-3 w-2/3 rounded bg-foreground/[0.06] animate-pulse" />
              <div className="h-[4px] w-full rounded-full bg-foreground/[0.06] animate-pulse" />
            </div>
          ))}
        </div>
      </>
    );
  }

  if (!hasData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center gap-2 py-6">
        <p className="text-[11px] text-foreground/40">No pipeline data yet</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Donut chart ── */}
      <div className="flex justify-center" style={{ marginTop: -8 }}>
        <DonutChart
          data={donutData}
          size={178}
          strokeWidth={22}
          animationDuration={1.0}
          animationDelayPerSegment={0.04}
          activeKey={activeKey}
          onSegmentHover={(seg) => setHoveredKey(seg?.key ?? null)}
          onSegmentClick={(seg) => setLockedKey(prev => prev !== null ? null : (seg.key ?? null))}
          onBackgroundClick={() => setLockedKey(null)}
          centerContent={
            <AnimatePresence mode="wait">
              <motion.div
                key={displayLabel}
                initial={{ opacity: 0, scale: 0.88 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.88 }}
                transition={{ duration: 0.18, ease: "easeOut" }}
                className="flex flex-col items-center justify-center text-center pointer-events-none select-none"
              >
                <span className="text-[10px] font-medium uppercase tracking-widest text-foreground/35 mb-0.5 leading-none max-w-[110px] truncate">
                  {displayLabel}
                </span>
                <span className="text-[26px] font-black tabular-nums leading-none text-foreground">
                  {displayCount.toLocaleString()}
                </span>
                {activeStage && total > 0 && (
                  <span className="text-[11px] font-medium text-foreground/40 mt-0.5 leading-none">
                    {((activeStage.count / total) * 100).toFixed(0)}%
                  </span>
                )}
              </motion.div>
            </AnimatePresence>
          }
        />
      </div>

      {/* ── Funnel bars ── */}
      <div className="flex flex-col flex-1 justify-between w-full">
        {stages.map((stage) => {
          const isActive   = activeKey === stage.key;
          const isDimmed   = activeKey !== null && !isActive;
          const hasCount   = stage.count > 0;
          const widthPct   = hasCount ? Math.max((stage.count / maxCount) * 100, 4) : 0;
          const pct        = total > 0 && hasCount ? ((stage.count / total) * 100).toFixed(0) : null;
          const barColor   = isDimmed ? tintColor(stage.color, 0.72) : stage.color;

          return (
            <div
              key={stage.key}
              className="flex flex-col gap-0.5 cursor-pointer"
              onMouseEnter={() => setHoveredKey(hasCount ? stage.key : null)}
              onMouseLeave={() => setHoveredKey(null)}
              onClick={() => { if (hasCount) setLockedKey(prev => prev !== null ? null : stage.key); }}
            >
              {/* Label + count */}
              <div className="flex items-center justify-between gap-1">
                <span
                  className="text-[11px] font-medium truncate"
                  style={{
                    color: "rgba(0,0,0,0.55)",
                    transition: "color 150ms ease",
                  }}
                >
                  {stage.label}
                </span>
                <div className="flex items-center gap-1 shrink-0">
                  <span
                    className="text-[11px] font-semibold tabular-nums"
                    style={{
                      color: isDimmed ? "rgba(0,0,0,0.25)" : "rgba(0,0,0,0.75)",
                      transition: "color 150ms ease",
                    }}
                  >
                    {stage.count.toLocaleString()}
                  </span>
                  {pct && (
                    <span
                      className="text-[10px] tabular-nums"
                      style={{
                        color: isDimmed ? "rgba(0,0,0,0.15)" : "rgba(0,0,0,0.3)",
                        transition: "color 150ms ease",
                      }}
                    >
                      {pct}%
                    </span>
                  )}
                </div>
              </div>
              {/* Progress bar */}
              <div
                className="w-full rounded-full overflow-hidden bg-foreground/[0.03]"
                style={{
                  height: isActive ? "6px" : "4px",
                  transition: "height 150ms ease",
                }}
              >
                {hasCount && (
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${widthPct}%`,
                      backgroundColor: barColor,
                      transition: "background-color 150ms ease, width 300ms ease",
                    }}
                  />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

// ── Animated metric card ─────────────────────────────────────────────────────
function AnimatedMetricCard({ numericValue, displayValue, label, animTrigger }: {
  numericValue: number;
  displayValue: string;
  label: string;
  animTrigger: number;
}) {
  const isPercent = displayValue.endsWith("%");
  const isDash = displayValue === "—";
  const animated = useCountUp(isDash ? 0 : numericValue, 900, animTrigger);
  const display = isDash ? "—" : isPercent ? `${animated}%` : animated.toLocaleString();
  return (
    <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-4 md:p-8 flex flex-col items-center justify-center text-center">
      <div className="text-[22px] md:text-[28px] font-black text-foreground tabular-nums leading-none">{display}</div>
      <div className="text-[10px] text-foreground/40 uppercase tracking-wider mt-1.5">{label}</div>
    </div>
  );
}

// ── Conversion Pie Chart (standalone — used in non-compact contexts) ──────────

function ConversionDoughnutWidget({ campaignId, compact = false }: { campaignId: number; compact?: boolean }) {
  const { leads, loading } = useLeads(undefined, campaignId);

  const data = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      name: s.label,
      value: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
    }));
  }, [leads]);

  const total = data.reduce((s, d) => s + d.value, 0);
  const hasData = data.some((d) => d.value > 0);

  if (loading) {
    return (
      <div className={cn("flex items-center justify-center", compact ? "h-[100px]" : "flex-1")}>
        <div className="w-5 h-5 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
      </div>
    );
  }

  if (total === 0 || !hasData) {
    return (
      <div className={cn("flex flex-col items-center justify-center text-center", compact ? "h-[100px]" : "flex-1")}>
        <p className="text-[11px] text-foreground/40">No conversion data</p>
      </div>
    );
  }

  const visibleData = data.filter((d) => d.value > 0);

  // compact prop no longer renders a separate pie — PipelineAndDonutWidget handles that
  // This path is only reached for non-compact (legacy) usage

  return (
    <div className="flex flex-col gap-3 flex-1 min-h-0">
      <div className="flex-1 min-h-0" style={{ minHeight: "140px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={visibleData}
              cx="50%"
              cy="50%"
              innerRadius="30%"
              outerRadius="55%"
              dataKey="value"
              strokeWidth={1}
              stroke="rgba(255,255,255,0.6)"
            >
              {visibleData.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{ borderRadius: "8px", border: "1px solid rgba(0,0,0,0.08)", fontSize: "11px", padding: "4px 8px" }}
              formatter={(v: number, name: string) => [v.toLocaleString(), name]}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-col gap-1.5 shrink-0">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2">
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: d.color, opacity: d.value === 0 ? 0.3 : 1 }}
            />
            <span className={cn("text-[11px] flex-1 truncate", d.value === 0 ? "text-foreground/30" : "text-foreground/60")}>
              {d.name}
            </span>
            <span className={cn("text-[11px] font-semibold tabular-nums", d.value === 0 ? "text-foreground/30" : "text-foreground")}>
              {d.value.toLocaleString()}
            </span>
            {total > 0 && d.value > 0 && (
              <span className="text-[10px] tabular-nums text-foreground/35 w-7 text-right shrink-0">
                {((d.value / total) * 100).toFixed(0)}%
              </span>
            )}
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
        <div className="w-5 h-5 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin" />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Total Spend</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrency(totalCost)}</div>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Cost / Booking</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrencyDecimals(costPerBooking)}</div>
          </div>
        </div>
      )}

      {/* 2-up: Value / Booking + Payment Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Value / Booking</div>
          <div className="text-[18px] font-bold tabular-nums text-foreground">
            {valuePB > 0 ? fmtCurrency(valuePB) : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Payment Trigger</div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">
            {paymentTrigger ? (paymentTriggerLabel[paymentTrigger] ?? paymentTrigger) : "—"}
          </div>
        </div>
      </div>

      {/* Projected Revenue — agency only */}
      {isAgencyUser && hasContractOrValue && (
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
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
          className="flex items-center gap-1.5 text-[11px] text-brand-indigo font-medium hover:underline mt-1"
        >
          <ArrowRight className="w-3 h-3" />
          Link a contract in Config →
        </button>
      )}

      {/* ROI — large display */}
      <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">Return on Investment</div>
        <div className={cn("text-[28px] font-black tabular-nums leading-none", getRoiColor(roiValue))}>
          {roiValue != null ? `${roiValue >= 0 ? "+" : ""}${roiValue.toFixed(0)}%` : "—"}
        </div>
      </div>

    </div>
  );
}

// ── AI Summary Widget ────────────────────────────────────────────────────────

function AISummaryWidget({ campaign, summary, generatedAt, onRefreshed }: {
  campaign: Campaign;
  summary: string | null;
  generatedAt: string | null;
  onRefreshed: (summary: string, generatedAt: string) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const formattedAt = useMemo(() => {
    if (!generatedAt) return null;
    try {
      return new Date(generatedAt).toLocaleString(undefined, {
        day: "2-digit", month: "short", year: "numeric",
        hour: "2-digit", minute: "2-digit",
      });
    } catch { return null; }
  }, [generatedAt]);

  const handleGenerate = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const httpRes = await apiFetch(`/api/campaigns/${campaign.id || (campaign as any).Id}/generate-summary`, {
        method: "POST",
      });
      const res = await httpRes.json() as any;
      if (res.error === "NO_GROQ_API_KEY") {
        setError("Groq API key not configured. Add GROQ_API_KEY to .env.");
        return;
      }
      if (res.error) {
        setError("Failed to generate summary. Try again.");
        return;
      }
      onRefreshed(res.summary, res.generated_at);
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }, [campaign, onRefreshed]);

  // Paragraph splitting for styled display
  const paragraphs = useMemo(() => {
    if (!summary) return [];
    return summary.split(/\n\n+/).filter(p => p.trim().length > 0);
  }, [summary]);

  return (
    <div className="flex-1 flex flex-col gap-4 overflow-y-auto min-h-0">
      {/* Header row: timestamp + regenerate button */}
      <div className="flex items-center justify-between gap-2 shrink-0">
        {formattedAt ? (
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-foreground/35 tabular-nums">Last run: {formattedAt}</span>
          </div>
        ) : (
          <span className="text-[10px] text-foreground/30 italic">No analysis yet</span>
        )}
        <button
          onClick={handleGenerate}
          disabled={loading}
          className={cn(
            "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9",
            loading
              ? "border-brand-indigo/30 text-brand-indigo/50 cursor-not-allowed"
              : "border-brand-indigo/40 text-brand-indigo hover:text-brand-indigo hover:max-w-[140px]"
          )}
          title={loading ? "Generating…" : summary ? "Regenerate" : "Generate"}
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" />
          )}
          <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {summary ? "Regenerate" : "Generate"}
          </span>
        </button>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-lg bg-rose-50 border border-rose-200/60 px-3 py-2.5 text-[11px] text-rose-600 shrink-0">
          {error}
        </div>
      )}

      {/* Summary content */}
      {paragraphs.length > 0 ? (
        <div className="flex flex-col gap-3 text-[12px] leading-relaxed text-foreground/75">
          {paragraphs.map((p, i) => (
            <p key={i} className={cn(
              i === 0 && "font-medium text-foreground/85"
            )}>{renderRichText(p)}</p>
          ))}
        </div>
      ) : !loading && !error && (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-6">
          <div className="w-10 h-10 rounded-2xl bg-brand-indigo/8 flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-brand-indigo/50" />
          </div>
          <div>
            <p className="text-[12px] font-medium text-foreground/50">No AI analysis yet</p>
            <p className="text-[11px] text-foreground/35 mt-0.5">Runs nightly or click Generate</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty() {
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      {/* ── Full-height gradient ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />

      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-700/30">
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
  onRefresh?: () => void;
  onDelete?: (id: number) => Promise<void>;
  compact?: boolean;
  onCreateCampaign?: () => void;
  listSearch?: string;
  onListSearchChange?: (v: string) => void;
  searchOpen?: boolean;
  onSearchOpenChange?: (v: boolean) => void;
  sortBy?: CampaignSortBy;
  onSortByChange?: (v: CampaignSortBy) => void;
  isSortNonDefault?: boolean;
  filterStatus?: string[];
  onToggleFilterStatus?: (s: string) => void;
  filterAccount?: string;
  onFilterAccountChange?: (a: string) => void;
  isFilterActive?: boolean;
  groupBy?: CampaignGroupBy;
  onGroupByChange?: (v: CampaignGroupBy) => void;
  isGroupNonDefault?: boolean;
  availableAccounts?: string[];
  onResetControls?: () => void;
  onBack?: () => void;
}

export function CampaignDetailView({
  campaign, metrics, allCampaigns, onToggleStatus, onSave, onRefresh, onDelete, compact = false,
  onCreateCampaign, listSearch, onListSearchChange, searchOpen, onSearchOpenChange,
  sortBy, onSortByChange, isSortNonDefault, filterStatus, onToggleFilterStatus,
  filterAccount, onFilterAccountChange, isFilterActive, groupBy, onGroupByChange,
  isGroupNonDefault, availableAccounts, onResetControls, onBack,
}: CampaignDetailViewProps) {
  const { isAgencyUser, isAdmin } = useWorkspace();

  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  // ── Tab + date range state ─────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"summary" | "configurations" | "tags">("summary");
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange());

  // ── Reset tab when campaign changes ─────────────────────────────────────────
  const [animTrigger, setAnimTrigger] = useState(0);
  useEffect(() => {
    setActiveTab("summary");
    setAnimTrigger((n) => n + 1);
  }, [campaign.id, campaign.Id]);

  // ── Filter metrics by date range ───────────────────────────────────────────
  const filteredMetrics = useMemo(() => {
    return campaignMetrics.filter((m) => isWithinDateRange(m.metric_date, dateRange));
  }, [campaignMetrics, dateRange]);

  const agg = useMemo(() => getCampaignMetrics(campaign, filteredMetrics), [campaign, filteredMetrics]);

  const status = String(campaign.status || "");
  const avatarColor = getCampaignAvatarColor(status);
  const isDraft = status === "Draft";
  const isPaused = status === "Paused";
  const isInactive = status === "Inactive";

  const initials = (campaign.name || "?")
    .split(" ")
    .slice(0, 2)
    .map((w: string) => w[0]?.toUpperCase() ?? "")
    .join("");

  const isActive  = status === "Active";
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

  // ── Compute duration (created_at / createdAt — Drizzle returns camelCase) ───
  const campaignCreatedAt: string | null = (campaign as any).createdAt ?? campaign.created_at ?? null;
  const durationDays = useMemo(() => {
    if (!campaignCreatedAt) return null;
    const start = new Date(campaignCreatedAt);
    const end = new Date();
    const days = Math.max(0, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
    return days;
  }, [campaignCreatedAt]);
  const durationLabel = durationDays !== null
    ? `${durationDays} day${durationDays !== 1 ? "s" : ""}`
    : null;

  // (Gradient tester removed — gradient is now baked in)

  // ── Inline editing state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [saving, setSaving] = useState(false);

  // ── Local AI summary state (overrides prop until next campaign load) ─────────
  const [localAiSummary, setLocalAiSummary] = useState<string | null>(campaign.ai_summary ?? null);
  const [localAiSummaryAt, setLocalAiSummaryAt] = useState<string | null>(campaign.ai_summary_generated_at ?? null);
  useEffect(() => {
    setLocalAiSummary(campaign.ai_summary ?? null);
    setLocalAiSummaryAt(campaign.ai_summary_generated_at ?? null);
  }, [campaign.id, campaign.Id, campaign.ai_summary, campaign.ai_summary_generated_at]);

  const handleAiSummaryRefreshed = useCallback((summary: string, generatedAt: string) => {
    setLocalAiSummary(summary);
    setLocalAiSummaryAt(generatedAt);
  }, []);

  // ── Stable refs for campaign + onSave (prevent infinite loops in callbacks) ─
  const campaignRef = useRef(campaign);
  campaignRef.current = campaign;
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  // ── Logo upload ────────────────────────────────────────────────────────────
  const logoInputRef = useRef<HTMLInputElement>(null);

  const handleLogoFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (logoInputRef.current) logoInputRef.current.value = "";
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result as string;
      const id = campaignRef.current.id || campaignRef.current.Id;
      if (id) await onSaveRef.current(id, { logo_url: dataUrl });
    };
    reader.readAsDataURL(file);
  }, []);

  const handleRemoveLogo = useCallback(async () => {
    const id = campaignRef.current.id || campaignRef.current.Id;
    if (id) await onSaveRef.current(id, { logo_url: "" });
  }, []);

  // ── Sticker / Profile image ────────────────────────────────────────────────
  const [selectedStickerSlug, setSelectedStickerSlug] = useState<string | null>(
    (campaign as any).campaign_sticker ?? null
  );
  const [hueValue, setHueValue] = useState<number>((campaign as any).campaign_hue ?? 0);
  const [stickerSize, setStickerSize] = useState<number>((campaign as any).campaign_sticker_size ?? 130);
  const [photoDialogOpen, setPhotoDialogOpen] = useState(false);
  // Pending selections inside the dialog (only committed on Submit)
  const [pendingSlug, setPendingSlug] = useState<string | null>(null);
  const [pendingHue, setPendingHue] = useState<number>(0);

  // Sync sticker state when campaign prop changes (e.g. after optimistic save)
  const campaignId = campaign.id || (campaign as any).Id;
  useEffect(() => {
    setSelectedStickerSlug((campaign as any).campaign_sticker ?? null);
    setHueValue((campaign as any).campaign_hue ?? 0);
    setStickerSize((campaign as any).campaign_sticker_size ?? 130);
  }, [campaignId]);

  const selectedSticker = CAMPAIGN_STICKERS.find(s => s.slug === selectedStickerSlug) ?? null;

  // Stable callback — never recreates, reads latest campaign/onSave via refs
  const saveSticker = useCallback(async (slug: string | null, hue: number, size: number) => {
    const id = campaignRef.current.id || (campaignRef.current as any).Id;
    if (id) await onSaveRef.current(id, { campaign_sticker: slug, campaign_hue: hue, campaign_sticker_size: size });
  }, []);

  // Debounce hue/size saves (slider drags only — skip on campaign switch / initial mount)
  const isStickerSyncRef = useRef(true);
  useEffect(() => {
    // Mark that the sync just ran — skip the next debounce fire
    isStickerSyncRef.current = true;
  }, [campaignId]);
  useEffect(() => {
    if (!selectedStickerSlug) return;
    if (isStickerSyncRef.current) { isStickerSyncRef.current = false; return; }
    const t = setTimeout(() => saveSticker(selectedStickerSlug, hueValue, stickerSize), 600);
    return () => clearTimeout(t);
  }, [hueValue, stickerSize, selectedStickerSlug, saveSticker]);

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
      channel: campaign.channel || "sms",
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

      {/* ── Full-height gradient ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />

      {/* ── Header content ── */}
      <div className="shrink-0">
        <div className="relative px-4 pt-6 pb-5 space-y-3">

          {/* Row 1: CRM action toolbar */}
          <div className="flex items-center gap-1.5 flex-wrap">
            {onBack && (
              <button
                onClick={onBack}
                className="md:hidden h-9 w-9 rounded-full border border-black/[0.125] bg-background grid place-items-center shrink-0 mr-2"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            )}
            {isEditing ? (
              <>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium bg-brand-indigo text-white hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? "Saving\u2026" : "Save"}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </button>
              </>
            ) : (
              <>
                {activeTab === "configurations" && (
                  <button
                    onClick={startEdit}
                    className={cn(xBase, "hover:max-w-[80px]", xDefault)}
                  >
                    <Pencil className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>Edit</span>
                  </button>
                )}

                {onCreateCampaign && (
                  <>
                    <button onClick={onCreateCampaign} className={cn(xBase, "hover:max-w-[80px]", xDefault)} title="New campaign">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>Add</span>
                    </button>

                    <SearchPill
                      value={listSearch ?? ""}
                      onChange={(v) => onListSearchChange?.(v)}
                      open={true}
                      onOpenChange={() => {}}
                      placeholder="Search campaigns..."
                    />

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isSortNonDefault ? xActive : xDefault)} title="Sort">
                          <ArrowUpDown className="h-4 w-4 shrink-0" />
                          <span className={xSpan}>Sort</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {(Object.keys(DETAIL_SORT_LABELS) as CampaignSortBy[]).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => onSortByChange?.(s)}
                            className={cn("text-[12px]", sortBy === s && "font-semibold text-brand-indigo")}
                          >
                            {DETAIL_SORT_LABELS[s]}
                            {sortBy === s && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)} title="Filter">
                          <Filter className="h-4 w-4 shrink-0" />
                          <span className={xSpan}>Filter</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Status</div>
                        <DropdownMenuSeparator />
                        {DETAIL_STATUS_FILTER_OPTIONS.map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={(e) => { e.preventDefault(); onToggleFilterStatus?.(s); }}
                            className="flex items-center gap-2 text-[12px]"
                          >
                            <span
                              className="h-1.5 w-1.5 rounded-full shrink-0"
                              style={{ backgroundColor: DETAIL_STATUS_HEX[s] || "#6B7280" }}
                            />
                            <span className={cn("flex-1", filterStatus?.includes(s) && "font-bold text-brand-indigo")}>{s}</span>
                            {filterStatus?.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                        {(availableAccounts?.length ?? 0) > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Account</div>
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(""); }}
                              className={cn("flex items-center gap-2 text-[12px]", !filterAccount && "font-bold text-brand-indigo")}
                            >
                              <span className="flex-1">All Accounts</span>
                              {!filterAccount && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            {availableAccounts?.map((a) => (
                              <DropdownMenuItem
                                key={a}
                                onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(filterAccount === a ? "" : a); }}
                                className={cn("flex items-center gap-2 text-[12px]", filterAccount === a && "font-bold text-brand-indigo")}
                              >
                                <span className="flex-1 truncate">{a}</span>
                                {filterAccount === a && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                              </DropdownMenuItem>
                            ))}
                          </>
                        )}
                        {isFilterActive && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={onResetControls} className="text-[12px] text-destructive">
                              Clear all filters
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isGroupNonDefault ? xActive : xDefault)} title="Group">
                          <Layers className="h-4 w-4 shrink-0" />
                          <span className={xSpan}>Group</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        {(Object.keys(DETAIL_GROUP_LABELS) as CampaignGroupBy[]).map((g) => (
                          <DropdownMenuItem
                            key={g}
                            onClick={() => onGroupByChange?.(g)}
                            className={cn("text-[12px]", groupBy === g && "font-semibold text-brand-indigo")}
                          >
                            {DETAIL_GROUP_LABELS[g]}
                            {groupBy === g && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}

                <div className="ml-auto" />
                {canToggle && (
                  <button
                    onClick={() => onToggleStatus(campaign)}
                    className={cn(xBase, isActive ? "hover:max-w-[100px]" : "hover:max-w-[110px]", xDefault)}
                  >
                    {isActive
                      ? <><PauseCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>Pause</span></>
                      : <><PlayCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>Activate</span></>
                    }
                  </button>
                )}
                <button onClick={onRefresh} className={cn(xBase, "hover:max-w-[110px]", xDefault)}>
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>Refresh</span>
                </button>
                {onDelete && (deleteConfirm ? (
                  <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-red-300/50 bg-card px-4 text-[12px]">
                    <span className="text-foreground/60">Delete?</span>
                    <button
                      className="h-7 px-3 rounded-full bg-red-600 text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                      disabled={deleting}
                      onClick={async () => { setDeleting(true); try { await onDelete?.(campaign.id || campaign.Id); } finally { setDeleting(false); setDeleteConfirm(false); } }}
                    >
                      {deleting ? "..." : "Yes"}
                    </button>
                    <button className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors" onClick={() => setDeleteConfirm(false)}>No</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className={cn(xBase, "hover:max-w-[100px]", "border-black/[0.125] text-red-500 hover:text-red-600")}>
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>Delete</span>
                  </button>
                ))}
                {/* Gradient button removed */}
              </>
            )}
          </div>

          {/* Row 2: Avatar + Name + Meta chips */}
          <div className="relative flex items-center gap-3">
            {/* Logo / Sticker circle — admin: click to open photo dialog */}
            <div className="relative group shrink-0">
              <div
                className={cn(
                  "relative flex items-center justify-center text-xl font-bold",
                  !selectedSticker && "rounded-full overflow-hidden",
                  isAdmin ? "cursor-pointer" : "cursor-default"
                )}
                style={{
                  width: selectedSticker ? Math.min(stickerSize, 130) : 72,
                  height: selectedSticker ? Math.min(stickerSize, 130) : 72,
                  ...(campaign.logo_url || selectedSticker ? {} : isDraft
                    ? { backgroundColor: "#B8C8E8", color: "#2D3F6E" }
                    : isPaused
                    ? { backgroundColor: "#C8B86A", color: "#5A4A1A" }
                    : { backgroundColor: avatarColor.bg, color: avatarColor.text }),
                }}
                onClick={() => {
                  if (!isAdmin) return;
                  setPendingSlug(selectedStickerSlug);
                  setPendingHue(hueValue);
                  setPhotoDialogOpen(true);
                }}
                title={isAdmin ? "Click to change photo" : undefined}
              >
                {selectedSticker ? (
                  <img
                    src={selectedSticker.url}
                    alt={selectedSticker.label}
                    className="object-contain w-full h-full"
                    style={{ filter:
                      isInactive ? "grayscale(1) opacity(0.8)"
                      : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.8)"
                      : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.8)"
                      : `hue-rotate(${hueValue}deg)`
                    }}
                  />
                ) : campaign.logo_url ? (
                  <img
                    src={campaign.logo_url}
                    alt="logo"
                    className="h-full w-full object-cover"
                    style={{ filter:
                      isInactive ? "grayscale(1) opacity(0.5)"
                      : isDraft ? "grayscale(1) sepia(1) hue-rotate(185deg) saturate(4) brightness(0.9) opacity(0.5)"
                      : isPaused ? "sepia(1) saturate(2) hue-rotate(-5deg) brightness(0.85) opacity(0.5)"
                      : undefined
                    }}
                  />
                ) : (
                  initials || <Zap className="w-6 h-6" />
                )}
              </div>
              {/* Hover overlay — admin only */}
              {isAdmin && (
                <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer pointer-events-none">
                  <Camera className="w-5 h-5 text-white" />
                </div>
              )}
              {/* Remove logo button — admin, hover-only, top-right */}
              {isAdmin && campaign.logo_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); handleRemoveLogo(); }}
                  title="Remove logo"
                  className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-white dark:bg-card border border-black/[0.125] flex items-center justify-center text-foreground/50 hover:text-red-500 hover:border-red-300 transition-colors z-10 opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>
            {/* Hidden file input for logo upload (used inside dialog) */}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />

            {/* ── Photo / Sticker dialog (Admin only) ─────────────────────── */}
            <Dialog open={photoDialogOpen} onOpenChange={setPhotoDialogOpen}>
              <DialogContent className="max-w-sm">
                <DialogHeader>
                  <DialogTitle>Campaign Photo</DialogTitle>
                </DialogHeader>

                {/* Preview */}
                <div className="flex justify-center py-2">
                  {(() => {
                    const previewSticker = CAMPAIGN_STICKERS.find(s => s.slug === pendingSlug) ?? null;
                    return previewSticker ? (
                      <img
                        src={previewSticker.url}
                        alt={previewSticker.label}
                        className="object-contain"
                        style={{ width: 80, height: 80, filter: `hue-rotate(${pendingHue}deg)` }}
                      />
                    ) : (
                      <div className="h-[72px] w-[72px] rounded-full flex items-center justify-center bg-muted/30 text-muted-foreground/40">
                        <ImageIcon className="h-8 w-8" />
                      </div>
                    );
                  })()}
                </div>

                {/* Hue slider — only when a sticker is selected */}
                {pendingSlug && (
                  <div className="space-y-1.5 px-1">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">Hue</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">{pendingHue}°</p>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={360}
                      value={pendingHue}
                      onChange={(e) => setPendingHue(Number(e.target.value))}
                      className="w-full accent-brand-indigo cursor-pointer"
                    />
                  </div>
                )}

                {/* Upload logo button */}
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  className="w-full h-9 rounded-lg border border-black/[0.125] text-[12px] font-medium text-foreground/60 hover:text-foreground hover:border-black/[0.175] transition-colors flex items-center justify-center gap-1.5"
                >
                  <Camera className="h-4 w-4" />
                  Upload logo image
                </button>

                {/* Sticker grid */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">Choose sticker</p>
                  <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                    <button
                      type="button"
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center border transition-colors",
                        !pendingSlug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]"
                      )}
                      onClick={() => setPendingSlug(null)}
                      title="No sticker"
                    >
                      <X className="h-4 w-4 text-muted-foreground" />
                    </button>
                    {CAMPAIGN_STICKERS.map((s) => (
                      <button
                        key={s.slug}
                        type="button"
                        className={cn(
                          "h-10 w-10 rounded-lg flex items-center justify-center border transition-colors p-1",
                          pendingSlug === s.slug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]"
                        )}
                        onClick={() => setPendingSlug(s.slug)}
                        title={s.label}
                      >
                        <img
                          src={s.url}
                          alt={s.label}
                          className="h-full w-full object-contain"
                          style={{ filter: `hue-rotate(${pendingHue}deg)` }}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedStickerSlug(pendingSlug);
                    setHueValue(pendingHue);
                    saveSticker(pendingSlug, pendingHue, stickerSize);
                    setPhotoDialogOpen(false);
                  }}
                  className="w-full h-9 rounded-lg bg-brand-indigo text-white text-[13px] font-semibold hover:bg-brand-indigo/90 transition-colors"
                >
                  Save
                </button>
              </DialogContent>
            </Dialog>

            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || "Unnamed Campaign"}
              </h2>

              {/* Subtitle: date + status */}
              <div className="mt-1 flex flex-col gap-1" data-testid="campaign-detail-view-status">
                {campaignCreatedAt && (
                  <span className="inline-flex items-center gap-1 text-[11px] text-foreground/50">
                    <Clock className="w-3 h-3 shrink-0" />
                    Started {formatDate(campaignCreatedAt)}
                    {durationLabel && <span className="text-foreground/35">· {durationLabel}</span>}
                  </span>
                )}
                {status && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold self-start"
                    style={{ backgroundColor: `${CAMPAIGN_STATUS_HEX[status]}20`, color: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }} />
                    {status}
                  </span>
                )}
              </div>
            </div>

            {/* Meta chips — centered on right edge of col 2 (≈66.7% of panel minus px-4 correction), aligned with "Started" date */}
            {/* Desktop only: absolutely positioned overlay */}
            <div className="absolute -translate-x-1/2 bottom-[45px] hidden md:flex items-center gap-6 pointer-events-auto z-10" style={{ left: "calc(66.67% - 5px)" }}>
              {campaign.account_name && (
                <div className="flex items-center gap-1.5">
                  <div
                    className="h-[30px] w-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                    style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
                  >
                    {(campaign as any).account_logo_url
                      ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" />
                      : <span className="text-[10px] font-bold">{getInitials(campaign.account_name)}</span>
                    }
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Owner</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                  </div>
                </div>
              )}
              {(campaign as any).channel && (
                <div className="flex items-center gap-1.5">
                  <div className="h-[30px] w-[30px] rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-foreground/[0.06]">
                    <img
                      src={`/logos/${(
                        ({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com"
                      )}.svg`}
                      alt={(campaign as any).channel}
                      className="h-[16px] w-[16px] object-contain"
                    />
                  </div>
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Channel</div>
                    <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                  </div>
                </div>
              )}
              {campaign.type && (
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Type</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
                </div>
              )}
              {campaign.daily_lead_limit != null && (
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Daily Limit</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.daily_lead_limit} leads</div>
                </div>
              )}
              {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Active Hours</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">
                    {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                    {" – "}
                    {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mobile only: meta chips row below title */}
          <div className="flex md:hidden flex-wrap items-center gap-3 pt-1">
            {campaign.account_name && (
              <div className="flex items-center gap-1.5">
                <div
                  className="h-[24px] w-[24px] rounded-full flex items-center justify-center shrink-0 overflow-hidden"
                  style={(campaign as any).account_logo_url ? {} : { backgroundColor: "rgba(0,0,0,0.08)", color: "#374151" }}
                >
                  {(campaign as any).account_logo_url
                    ? <img src={(campaign as any).account_logo_url} alt="account" className="h-full w-full object-cover" />
                    : <span className="text-[9px] font-bold">{getInitials(campaign.account_name)}</span>
                  }
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Owner</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                </div>
              </div>
            )}
            {(campaign as any).channel && (
              <div className="flex items-center gap-1.5">
                <div className="h-[24px] w-[24px] rounded-full flex items-center justify-center shrink-0 overflow-hidden bg-foreground/[0.06]">
                  <img
                    src={`/logos/${(
                      ({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com"
                    )}.svg`}
                    alt={(campaign as any).channel}
                    className="h-[14px] w-[14px] object-contain"
                  />
                </div>
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Channel</div>
                  <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                </div>
              </div>
            )}
            {campaign.type && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Type</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
              </div>
            )}
            {campaign.daily_lead_limit != null && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">Daily Limit</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{campaign.daily_lead_limit} leads</div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tab row: Summary / DateRange / Configurations */}
      <div className="relative shrink-0 px-4 pt-4 md:pt-6 pb-[3px] flex items-center flex-wrap gap-2">
        <button
          onClick={() => setActiveTab("summary")}
          className={cn(
            "h-9 px-5 rounded-full text-[12px] font-semibold transition-colors",
            activeTab === "summary"
              ? "bg-foreground text-background"
              : "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
          )}
        >
          Summary
        </button>
        <button
          onClick={() => setActiveTab("configurations")}
          className={cn(
            "h-9 px-5 rounded-full text-[12px] font-semibold transition-colors",
            activeTab === "configurations"
              ? "bg-foreground text-background"
              : "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
          )}
        >
          Configurations
        </button>
        {isAgencyUser && (
          <button
            onClick={() => setActiveTab("tags")}
            className={cn(
              "h-9 px-5 rounded-full text-[12px] font-semibold transition-colors",
              activeTab === "tags"
                ? "bg-foreground text-background"
                : "border border-black/[0.125] text-foreground/60 hover:text-foreground hover:border-black/[0.175]"
            )}
          >
            Tags
          </button>
        )}
      </div>

      {/* ── Body ── */}
      <div className={cn("relative flex-1 p-[3px] overflow-y-auto")}>

        {/* ── Summary tab — 3-col grid, rows auto-match heights ── */}
        {activeTab === "summary" && (
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-3 md:grid-rows-[680px_680px] gap-[3px]")}>

            {/* ── Row 1, Col 1: Key Metrics + Performance Trends ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-metrics">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">Key Metrics</span>
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  allFrom={campaignCreatedAt ? new Date(campaignCreatedAt) : undefined}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AnimatedMetricCard numericValue={agg.totalLeadsTargeted} displayValue={agg.totalLeadsTargeted.toLocaleString()} label="Leads Targeted" animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.totalMessagesSent}  displayValue={agg.totalMessagesSent.toLocaleString()}  label="Messages Sent"  animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.responseRate ?? 0}  displayValue={agg.responseRate != null ? `${agg.responseRate}%` : "—"} label="Response %" animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.bookingRate  ?? 0}  displayValue={agg.bookingRate  != null ? `${agg.bookingRate}%`  : "—"} label="Booking %"  animTrigger={animTrigger} />
              </div>

              {/* Performance Trends chart — pushed to bottom */}
              <div className="mt-auto pt-1">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">Performance Trends</span>
                <div className="h-[280px]" key={animTrigger} data-testid="campaign-detail-view-trends">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart
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
                      <defs>
                        <linearGradient id="fillResponse" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#3ACBDF" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#3ACBDF" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="fillBooking" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#f5b70b" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#f5be0b" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.06)" />
                      <XAxis dataKey="date" tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                      <YAxis tick={{ fontSize: 10, fill: "rgba(0,0,0,0.4)" }} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={{ borderRadius: "10px", border: "1px solid rgba(0,0,0,0.1)", backgroundColor: "rgba(255,255,255,0.95)", color: "#111", fontSize: "11px", padding: "6px 10px" }} />
                      <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "8px" }} />
                      <Area type="monotone" dataKey="Response %" stroke="#3ACBDF" strokeWidth={2} fill="url(#fillResponse)" dot={false} activeDot={{ r: 3 }} />
                      <Area type="monotone" dataKey="Booking %"  stroke="#f5be0b" strokeWidth={2} fill="url(#fillBooking)"  dot={false} activeDot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Row 1, Col 2: Up Next ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto" data-testid="campaign-detail-view-agenda">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground shrink-0">Up Next</span>
              <AgendaWidget accountId={undefined} className="flex-1 min-h-0 bg-transparent" hideHeader />
            </div>

            {/* ── Row 1, Col 3: Pipeline + Donut (unified, interactive) ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-5 overflow-hidden" data-testid="campaign-detail-view-funnel">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">Pipeline</span>
              <PipelineAndDonutWidget campaignId={campaign.id || (campaign as any).Id} />
            </div>

            {/* ── Row 2, Col 1: AI Summary ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-4 overflow-hidden" data-testid="campaign-detail-view-ai-summary">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground shrink-0">AI Analysis</span>
              <AISummaryWidget
                campaign={campaign}
                summary={localAiSummary}
                generatedAt={localAiSummaryAt}
                onRefreshed={handleAiSummaryRefreshed}
              />
            </div>

            {/* ── Row 2, Col 2: Activity Feed ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto" data-testid="campaign-detail-view-activity">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground shrink-0">Activity</span>
              <ActivityFeed accountId={undefined} compact className="flex-1 min-h-0" />
            </div>

            {/* ── Row 2, Col 3: Financials + ROI Trend ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-conversions">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">Financials</span>
              <FinancialsWidget
                agg={agg}
                campaign={campaign}
                contract={linkedContract}
                contractLoading={contractLoading}
                isAgencyUser={isAgencyUser}
                onGoToConfig={goToConfig}
              />

              {/* ROI Trend — pushed to bottom */}
              <div className="mt-auto border-t border-border/20 pt-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">ROI Trend</span>
                <div className="h-[180px]" data-testid="campaign-detail-view-roi">
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
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-3 gap-[3px] md:h-full")}>

            {/* Column 1: Configuration / Settings */}
            <div className="bg-card rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-settings">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Configuration</span>

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

                {/* Channel picker */}
                <div className="flex items-start justify-between gap-3 py-2 border-b border-border/20">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 shrink-0 pt-0.5 min-w-[90px]">Channel</span>
                  {isEditing ? (
                    <div className="flex gap-1">
                      {(["sms", "whatsapp", "instagram"] as const).map((ch) => (
                        <button
                          key={ch}
                          type="button"
                          onClick={() => setDraft(d => ({ ...d, channel: ch }))}
                          className={cn(
                            "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                            draft.channel === ch
                              ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                              : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                          )}
                        >
                          {ch === "sms" ? "SMS" : ch === "whatsapp" ? "WhatsApp" : "Instagram"}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] font-semibold text-foreground text-right">
                      {campaign.channel === "whatsapp" ? "WhatsApp" : campaign.channel === "instagram" ? "Instagram" : "SMS"}
                    </span>
                  )}
                </div>

                <BoolRow label="Stop on response" value={campaign.stop_on_response}
                  editChild={isEditing ? <EditToggle value={Boolean(draft.stop_on_response)} onChange={(v) => setDraft(d => ({...d, stop_on_response: v}))} /> : undefined}
                />
                <BoolRow label="Use AI bumps" value={campaign.use_ai_bumps}
                  editChild={isEditing ? <EditToggle value={Boolean(draft.use_ai_bumps)} onChange={(v) => setDraft(d => ({...d, use_ai_bumps: v}))} /> : undefined}
                />
                {(isEditing ? draft.channel : campaign.channel) === "whatsapp" && (
                  <>
                    <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pt-3 pb-1">
                      Voice Notes
                    </p>
                    <BoolRow
                      label="First message as voice note"
                      value={campaign.first_message_voice_note ?? false}
                      editChild={isEditing ? (
                        <EditToggle
                          value={Boolean(draft.first_message_voice_note)}
                          onChange={(v) => setDraft(d => ({ ...d, first_message_voice_note: v }))}
                        />
                      ) : undefined}
                    />
                    <BoolRow
                      label="Bump 1 as voice note"
                      value={campaign.bump_1_voice_note ?? false}
                      editChild={isEditing ? (
                        <EditToggle
                          value={Boolean(draft.bump_1_voice_note)}
                          onChange={(v) => setDraft(d => ({ ...d, bump_1_voice_note: v }))}
                        />
                      ) : undefined}
                    />
                    <BoolRow
                      label="Bump 2 as voice note"
                      value={campaign.bump_2_voice_note ?? false}
                      editChild={isEditing ? (
                        <EditToggle
                          value={Boolean(draft.bump_2_voice_note)}
                          onChange={(v) => setDraft(d => ({ ...d, bump_2_voice_note: v }))}
                        />
                      ) : undefined}
                    />
                    <BoolRow
                      label="Bump 3 as voice note"
                      value={campaign.bump_3_voice_note ?? false}
                      editChild={isEditing ? (
                        <EditToggle
                          value={Boolean(draft.bump_3_voice_note)}
                          onChange={(v) => setDraft(d => ({ ...d, bump_3_voice_note: v }))}
                        />
                      ) : undefined}
                    />
                    <BoolRow
                      label="AI replies as voice notes"
                      value={campaign.ai_reply_voice_note ?? false}
                      editChild={isEditing ? (
                        <EditToggle
                          value={Boolean(draft.ai_reply_voice_note)}
                          onChange={(v) => setDraft(d => ({ ...d, ai_reply_voice_note: v }))}
                        />
                      ) : undefined}
                    />
                    <InfoRow
                      label="Voice ID"
                      value={campaign.tts_voice_id ?? ""}
                      editChild={isEditing ? (
                        <EditText
                          value={String(draft.tts_voice_id ?? "")}
                          onChange={(v) => setDraft(d => ({ ...d, tts_voice_id: v }))}
                          placeholder="e.g. gabriel (leave blank for default)"
                        />
                      ) : undefined}
                    />
                  </>
                )}
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
            <div className="bg-card rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-ai">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">AI Settings</span>
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
                    <div className="relative rounded-lg bg-white/30 dark:bg-white/[0.04] p-2 max-h-32 overflow-y-auto">
                      <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {campaign.ai_prompt_template}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Column 3: Message Templates */}
            <div className="bg-card rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-templates">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Message Templates</span>

              {/* First message */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-1.5">
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
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-2">
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
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
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
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-2">
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
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
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
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-2">
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
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
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

        {/* ── Tags tab ── */}
        {activeTab === "tags" && (
          <div className="flex-1 min-h-0 overflow-hidden">
            <CampaignTagsSection
              campaignId={campaign.id || campaign.Id}
              campaignName={campaign.name || ""}
            />
          </div>
        )}

      </div>

    </div>
  );
}
