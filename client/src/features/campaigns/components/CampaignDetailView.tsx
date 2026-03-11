import { useMemo, useState, useCallback, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Clock,
  Zap,
  Bot,
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
  LayoutTemplate,
  Layers,
  Save,
  ImageIcon,
  Sparkles,
  Search,
} from "lucide-react";
// Gradient tester removed — gradient is baked in
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
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
import { useToast } from "@/hooks/use-toast";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { ColorPicker } from "@/features/tags/components/ColorPicker";
import type { Tag as TagType, TagSortOption, TagAutoAppliedFilter } from "@/features/tags/types";
import type { TagGroupOption } from "@/features/tags/types";
import { usePersistedState } from "@/hooks/usePersistedState";

/* ── Saved template type ─────────────────────────────────────────────────── */
type SavedTemplate = { name: string; tags: { name: string; color: string; category: string }[] };

/* ── Reactivation tag template (source: campaign_id=1) ────────────────────── */
const REACTIVATION_TAG_TEMPLATE: { name: string; color: string; category: string }[] = [
  { name: "First Message Sent", color: "gray", category: "automation" },
  { name: "ai stop", color: "red", category: "Automation" },
  { name: "bump 2.1", color: "blue", category: "Automation" },
  { name: "bump 3.1", color: "blue", category: "Automation" },
  { name: "no bump", color: "gray", category: "Automation" },
  { name: "reply generating", color: "yellow", category: "Automation" },
  { name: "dnd", color: "red", category: "Behavior" },
  { name: "manual takeover", color: "orange", category: "Behavior" },
  { name: "appointment booked", color: "green", category: "Outcome" },
  { name: "goodbye", color: "gray", category: "Outcome" },
  { name: "no response", color: "gray", category: "Outcome" },
  { name: "schedule", color: "green", category: "Outcome" },
  { name: "high priority", color: "red", category: "Priority" },
  { name: "warm lead", color: "orange", category: "Priority" },
  { name: "dbr android", color: "purple", category: "Source" },
  { name: "fb lead", color: "purple", category: "Source" },
  { name: "sleeping beauty android optin", color: "purple", category: "Source" },
  { name: "bump 2 reply", color: "blue", category: "Status" },
  { name: "bump 3 reply", color: "blue", category: "Status" },
  { name: "bump response", color: "blue", category: "Status" },
  { name: "first message", color: "yellow", category: "Status" },
  { name: "follow-up", color: "orange", category: "Status" },
  { name: "lead", color: "blue", category: "Status" },
  { name: "multiple messages", color: "blue", category: "Status" },
  { name: "qualify", color: "green", category: "Status" },
  { name: "responded", color: "green", category: "Status" },
  { name: "second message", color: "yellow", category: "Status" },
];

// ── Expand-on-hover toolbar button tokens ────────────────────────────────────
const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
const xActive  = "border-brand-indigo text-brand-indigo";
const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

// ── Sort / Group / Filter labels ────────────────────────────────────────────
const DETAIL_SORT_LABEL_KEYS: Record<CampaignSortBy, string> = {
  recent:        "sortOptions.recent",
  name_asc:      "sortOptions.nameAsc",
  name_desc:     "sortOptions.nameDesc",
  leads_desc:    "sortOptions.leadsDesc",
  response_desc: "sortOptions.responseDesc",
};
const DETAIL_GROUP_LABEL_KEYS: Record<CampaignGroupBy, string> = {
  none:    "groupBy.none",
  status:  "groupBy.status",
  account: "groupBy.account",
  type:    "groupBy.type",
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
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{label}</span>
      {editChild ?? (
        <span className={cn("text-[12px] font-semibold text-foreground break-words", mono && "font-mono text-[11px]")}>
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
    <div className="flex flex-col gap-0.5 py-2 border-b border-border/20 last:border-0">
      <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{label}</span>
      {editChild ?? (value
        ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
        : <XCircle className="w-4 h-4 text-foreground/25" />
      )}
    </div>
  );
}

function CopyButton({ value }: { value: string }) {
  const { t } = useTranslation("campaigns");
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
      title={t("copy")}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-500" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

// ── Duplicate button (inline confirm) ─────────────────────────────────────────
function DuplicateButton({
  campaign, onDuplicate, t,
}: {
  campaign: Campaign;
  onDuplicate: (campaign: Campaign) => Promise<void>;
  t: (key: string) => string;
}) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  if (confirming) {
    return (
      <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-black/[0.125] bg-card px-2.5 text-[12px] shrink-0">
        <span className="text-foreground/60 mr-0.5 whitespace-nowrap">{t("toolbar.duplicate")}?</span>
        <button
          className="h-7 px-3 rounded-full bg-brand-indigo text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
          disabled={loading}
          onClick={async () => {
            setLoading(true);
            try { await onDuplicate(campaign); } finally { setLoading(false); setConfirming(false); }
          }}
        >
          {loading ? "…" : t("confirm.yes")}
        </button>
        <button
          className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors"
          onClick={() => setConfirming(false)}
        >
          {t("confirm.no")}
        </button>
      </div>
    );
  }
  return (
    <button
      onClick={() => setConfirming(true)}
      className={cn(xBase, "hover:max-w-[110px]", xDefault)}
    >
      <Copy className="h-4 w-4 shrink-0" />
      <span className={xSpan}>{t("toolbar.duplicate")}</span>
    </button>
  );
}

// ── Editable field helpers ────────────────────────────────────────────────────

function EditText({
  value, onChange, placeholder, multiline = false,
}: {
  value: string; onChange: (v: string) => void; placeholder?: string; multiline?: boolean;
}) {
  const taRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    if (!taRef.current) return;
    taRef.current.style.height = "auto";
    taRef.current.style.height = Math.min(taRef.current.scrollHeight, 320) + "px";
  }, [value]);
  if (multiline) {
    return (
      <textarea
        ref={taRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={3}
        className="w-full text-[12px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded-lg px-2.5 py-1.5 resize-none outline-none focus:ring-1 focus:ring-brand-indigo/40 placeholder:text-foreground/30 overflow-y-auto"
        style={{ minHeight: "72px", maxHeight: "320px" }}
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
        "inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors",
        value ? "bg-brand-indigo" : "bg-foreground/20"
      )}
    >
      <span className={cn(
        "pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-sm ring-0 transition-transform",
        value ? "translate-x-[18px]" : "translate-x-0"
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
      <option value="">—</option>
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
  { key: "new",       labelKey: "funnelStages.new",               dbValue: "New" },
  { key: "contacted", labelKey: "funnelStages.contacted",         dbValue: "Contacted" },
  { key: "responded", labelKey: "funnelStages.responded",         dbValue: "Responded" },
  { key: "multi",     labelKey: "funnelStages.multipleResponses", dbValue: "Multiple Responses" },
  { key: "qualified", labelKey: "funnelStages.qualified",         dbValue: "Qualified" },
  { key: "booked",    labelKey: "funnelStages.callBooked",        dbValue: "Booked" },
  { key: "closed",    labelKey: "funnelStages.closed",            dbValue: "Closed" },
  { key: "lost",      labelKey: "funnelStages.lost",              dbValue: "Lost" },
  { key: "dnd",       labelKey: "funnelStages.dnd",               dbValue: "DND" },
] as const;

function PipelineAndDonutWidget({ campaignId }: { campaignId: number }) {
  const { t } = useTranslation("campaigns");
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
      label: t(s.labelKey),
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
      count: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
    }));
  }, [leads, t]);

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
  const displayLabel = activeStage ? activeStage.label : t("summary.totalLeads");

  if (loading) {
    return (
      <>
        <div className="flex justify-center">
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
        <p className="text-[11px] text-foreground/40">{t("summary.noPipelineData")}</p>
      </div>
    );
  }

  return (
    <>
      {/* ── Donut chart ── */}
      <div className="flex justify-center" style={{ marginTop: 7 }}>
        <DonutChart
          data={donutData}
          size={154}
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
  const { t } = useTranslation("campaigns");
  const { leads, loading } = useLeads(undefined, campaignId);

  const data = useMemo(() => {
    return FUNNEL_STAGES.map((s) => ({
      name: t(s.labelKey),
      value: leads.filter((l: any) => l.conversion_status === s.dbValue).length,
      color: PIPELINE_HEX[s.dbValue] || "#6B7280",
    }));
  }, [leads, t]);

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
        <p className="text-[11px] text-foreground/40">{t("summary.noConversionData")}</p>
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
  const { t } = useTranslation("campaigns");
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
    retainer:        t("financials.dealTypes.retainer"),
    per_booking:     t("financials.dealTypes.per_booking"),
    fixed:           t("financials.dealTypes.fixed"),
    retainer_plus:   t("financials.dealTypes.retainer_plus"),
    sale_closed:     t("financials.dealTypes.sale_closed"),
  };
  const paymentTriggerLabel: Record<string, string> = {
    booked_call:  t("financials.paymentTriggers.booked_call"),
    sale_closed:  t("financials.paymentTriggers.sale_closed"),
    meeting_held: t("financials.paymentTriggers.meeting_held"),
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
          <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40 min-w-[90px]">{t("financials.dealType")}</span>
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
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.totalSpend")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrency(totalCost)}</div>
          </div>
          <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.costPerBooking")}</div>
            <div className="text-[18px] font-bold tabular-nums text-foreground">{fmtCurrencyDecimals(costPerBooking)}</div>
          </div>
        </div>
      )}

      {/* 2-up: Value / Booking + Payment Trigger */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.valuePerBooking")}</div>
          <div className="text-[18px] font-bold tabular-nums text-foreground">
            {valuePB > 0 ? fmtCurrency(valuePB) : "—"}
          </div>
        </div>
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
          <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.paymentTrigger")}</div>
          <div className="text-[13px] font-semibold text-foreground leading-snug">
            {paymentTrigger ? (paymentTriggerLabel[paymentTrigger] ?? paymentTrigger) : "—"}
          </div>
        </div>
      </div>

      {/* Projected Revenue — agency only */}
      {isAgencyUser && hasContractOrValue && (
        <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
          <div className="flex items-center gap-2 mb-0.5">
            <div className="text-[10px] text-foreground/40 uppercase tracking-wider">{t("financials.projectedRevenue")}</div>
            {paymentTrigger === "sale_closed" && (
              <span className="text-[9px] font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">{t("financials.est")}</span>
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
          {t("financials.linkContractPrompt")}
        </button>
      )}

      {/* ROI — large display */}
      <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] px-3 py-3">
        <div className="text-[10px] text-foreground/40 uppercase tracking-wider mb-1">{t("financials.returnOnInvestment")}</div>
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
  const { t, i18n } = useTranslation("campaigns");
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: i18n.language?.split("-")[0] || "en" }),
      });
      const res = await httpRes.json() as any;
      if (res.error === "NO_GROQ_API_KEY") {
        setError(t("summary.groqApiKeyMissing"));
        return;
      }
      if (res.error) {
        setError(t("summary.generateFailed"));
        return;
      }
      onRefreshed(res.summary, res.generated_at);
    } catch {
      setError(t("summary.networkError"));
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
            <span className="text-[10px] text-foreground/35 tabular-nums">{t("summary.lastRun", { date: formattedAt })}</span>
          </div>
        ) : (
          <span className="text-[10px] text-foreground/30 italic">{t("summary.noAnalysisYet")}</span>
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
          title={loading ? t("summary.generating") : summary ? t("summary.regenerate") : t("summary.generate")}
        >
          {loading ? (
            <div className="w-4 h-4 rounded-full border-2 border-brand-indigo/30 border-t-brand-indigo animate-spin shrink-0" />
          ) : (
            <Sparkles className="h-4 w-4 shrink-0" />
          )}
          <span className="whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            {summary ? t("summary.regenerate") : t("summary.generate")}
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
            <p className="text-[12px] font-medium text-foreground/50">{t("summary.noAiAnalysis")}</p>
            <p className="text-[11px] text-foreground/35 mt-0.5">{t("summary.aiRunsNightly")}</p>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Empty state ──────────────────────────────────────────────────────────────

export function CampaignDetailViewEmpty({ compact = false }: { compact?: boolean }) {
  const { t } = useTranslation("campaigns");
  return (
    <div className="relative h-full flex flex-col items-center justify-center gap-5 p-8 text-center overflow-hidden">
      {/* ── Background ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      {!compact && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      <div className="relative z-10">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/40 dark:to-orange-950/40 flex items-center justify-center ring-1 ring-amber-200/50 dark:ring-amber-700/30">
          <Megaphone className="h-10 w-10 text-amber-400" />
        </div>
      </div>
      <div className="relative z-10 space-y-1.5">
        <p className="text-sm font-semibold text-foreground/70">{t("empty.selectCampaign")}</p>
        <p className="text-xs text-muted-foreground max-w-[180px] leading-relaxed">
          {t("empty.selectCampaignDesc")}
        </p>
      </div>
      <div className="relative z-10 flex items-center gap-1.5 text-[11px] text-amber-500 font-medium">
        <span>{t("empty.chooseFromList")}</span>
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
  onDuplicate?: (campaign: Campaign) => Promise<void>;
  compact?: boolean;
  onCreateCampaign?: () => void;
  activeTab?: "summary" | "configurations";
  onActiveTabChange?: (tab: "summary" | "configurations") => void;
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
  campaign, metrics, allCampaigns, onToggleStatus, onSave, onRefresh, onDelete, onDuplicate, compact = false,
  onCreateCampaign, activeTab: activeTabProp, onActiveTabChange, listSearch, onListSearchChange, searchOpen, onSearchOpenChange,
  sortBy, onSortByChange, isSortNonDefault, filterStatus, onToggleFilterStatus,
  filterAccount, onFilterAccountChange, isFilterActive, groupBy, onGroupByChange,
  isGroupNonDefault, availableAccounts, onResetControls, onBack,
}: CampaignDetailViewProps) {
  const { t } = useTranslation("campaigns");
  const { isAgencyUser, isAdmin } = useWorkspace();
  const { toast } = useToast();

  const campaignMetrics = useMemo(() => {
    const cid = campaign.id || campaign.Id;
    return metrics.filter((m) => {
      const mid = Number(m.campaigns_id || (m as any).campaignsId || 0);
      return mid === cid;
    });
  }, [campaign, metrics]);

  // ── Tab + date range state ─────────────────────────────────────────────────
  // Controlled by parent via activeTabProp/onActiveTabChange; fallback to internal state when not provided
  const [internalTab, setInternalTab] = useState<"summary" | "configurations">("summary");
  const activeTab = activeTabProp ?? internalTab;
  const setActiveTab = useCallback((tab: "summary" | "configurations") => {
    setInternalTab(tab);
    onActiveTabChange?.(tab);
  }, [onActiveTabChange]);
  const [dateRange, setDateRange] = useState<DateRangeValue>(getDefaultDateRange());

  // ── Tags toolbar state (rendered inline with tab bar) ──────────────────────
  const [tagsSearch, setTagsSearch] = useState("");
  const [tagsSortBy, setTagsSortBy] = useState<TagSortOption>("name_asc");
  const tagsGroupBy: TagGroupOption = "category";
  const [tagsFilterAuto, setTagsFilterAuto] = useState<TagAutoAppliedFilter>("all");
  const [tagsFilterCat, setTagsFilterCat] = useState("");
  const [tagsCategories, setTagsCategories] = useState<string[]>([]);
  const [tagsCreateOpen, setTagsCreateOpen] = useState(false);
  const [tagsNewName, setTagsNewName] = useState("");
  const [tagsNewColor, setTagsNewColor] = useState("blue");
  const [tagsNewCategory, setTagsNewCategory] = useState("");
  const tagsCreateRef = useRef<((data: { name: string; color: string; category?: string }) => Promise<void>) | null>(null);

  const tagsIsFilterActive = tagsFilterAuto !== "all" || !!tagsFilterCat;
  const tagsFilterCount = (tagsFilterAuto !== "all" ? 1 : 0) + (tagsFilterCat ? 1 : 0);
  const tagsIsSortNonDefault = tagsSortBy !== "name_asc";

  const submitTagCreate = useCallback(async () => {
    if (!tagsNewName.trim()) return;
    try {
      await tagsCreateRef.current?.({
        name: tagsNewName.trim(),
        color: tagsNewColor,
        category: tagsNewCategory.trim() || undefined,
      });
      setTagsNewName("");
      setTagsNewColor("blue");
      setTagsNewCategory("");
      setTagsCreateOpen(false);
    } catch { /* handled by hook */ }
  }, [tagsNewName, tagsNewColor, tagsNewCategory]);

  // ── Tag template state + handlers ───────────────────────────────────────────
  const tagsDataRef = useRef<TagType[] | null>(null);
  const [savedTemplates, setSavedTemplates] = usePersistedState<SavedTemplate[]>("la:tag-templates", []);
  const [selectedTemplate, setSelectedTemplate] = useState<SavedTemplate | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [templateApplying, setTemplateApplying] = useState(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [saveTemplateName, setSaveTemplateName] = useState("");

  const handleSelectTemplate = useCallback((tpl: SavedTemplate) => {
    setSelectedTemplate(tpl);
    setTemplateDialogOpen(true);
  }, []);

  const applyTemplate = useCallback(async () => {
    if (!tagsCreateRef.current || !selectedTemplate) return;
    setTemplateApplying(true);
    try {
      let created = 0;
      for (const tag of selectedTemplate.tags) {
        try {
          await tagsCreateRef.current({ name: tag.name, color: tag.color, category: tag.category });
          created++;
        } catch {
          // tag may already exist — skip
        }
      }
      toast({ title: "Template applied", description: `${created} tag(s) created.` });
    } finally {
      setTemplateApplying(false);
      setTemplateDialogOpen(false);
      setSelectedTemplate(null);
    }
  }, [selectedTemplate, toast]);

  const handleSaveTemplate = useCallback(() => {
    const currentTags = tagsDataRef.current;
    if (!currentTags || currentTags.length === 0 || !saveTemplateName.trim()) return;
    const newTemplate: SavedTemplate = {
      name: saveTemplateName.trim(),
      tags: currentTags.map((t) => ({ name: t.name, color: t.color || "blue", category: t.category || "" })),
    };
    setSavedTemplates((prev) => [...prev, newTemplate]);
    toast({ title: "Template saved", description: `"${newTemplate.name}" saved with ${newTemplate.tags.length} tags.` });
    setSaveDialogOpen(false);
    setSaveTemplateName("");
  }, [saveTemplateName, setSavedTemplates, toast]);

  const handleDeleteTemplate = useCallback((index: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setSavedTemplates((prev) => prev.filter((_, i) => i !== index));
    toast({ title: "Template deleted" });
  }, [setSavedTemplates, toast]);

  // ── pill styles (reused inside tab bar) ────────────────────────────────────
  const tagPill = "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border border-black/[0.125] bg-transparent text-foreground/60 hover:text-foreground hover:bg-muted/50 transition-colors";
  const tagPillActive = "inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-[11px] font-medium border border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo transition-colors";

  // ── Animate when campaign changes (tab persists across campaign switches) ────
  const [animTrigger, setAnimTrigger] = useState(0);
  useEffect(() => {
    setAnimTrigger((n) => n + 1);
  }, [campaign.id, campaign.Id]);

  // ── Prompt library (conversation prompts for linking) ─────────────────────
  const [, navigate] = useLocation();
  const [conversationPrompts, setConversationPrompts] = useState<any[]>([]);
  useEffect(() => {
    apiFetch("/api/prompts")
      .then((r) => r.ok ? r.json() : [])
      .then((data: any[]) => {
        setConversationPrompts(
          Array.isArray(data) ? data.filter((p) => (p.use_case || p.useCase || "").toLowerCase() === "conversation") : []
        );
      })
      .catch(() => {});
  }, []);

  // Derive the currently linked prompt for this campaign
  const linkedPrompt = useMemo(() => {
    const cid = campaign.id || (campaign as any).Id;
    return conversationPrompts.find((p) => Number(p.campaigns_id || p.campaignsId || p.Campaigns_id) === cid) ?? null;
  }, [conversationPrompts, campaign.id, (campaign as any).Id]);

  // ── Daily capacity stats ───────────────────────────────────────────────────
  const [dailyStats, setDailyStats] = useState<{ sentToday: number; dailyLimit: number; channel: string } | null>(null);
  useEffect(() => {
    const id = campaign.id || (campaign as any).Id;
    if (!id) return;
    apiFetch(`/api/campaigns/${id}/daily-stats`)
      .then((r) => r.json())
      .then(setDailyStats)
      .catch(() => {});
  }, [campaign.id, (campaign as any).Id]);

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
    ? t("meta.duration", { count: durationDays })
    : null;

  // (Gradient tester removed — gradient is now baked in)

  // ── Inline editing state ────────────────────────────────────────────────────
  const [isEditing, setIsEditing] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [draft, setDraft] = useState<Record<string, unknown>>({});
  const [originalDraft, setOriginalDraft] = useState<Record<string, unknown>>({});
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
    const d: Record<string, unknown> = {
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
      first_message_voice_note: campaign.first_message_voice_note ?? false,
      bump_1_voice_note: campaign.bump_1_voice_note ?? false,
      bump_2_voice_note: campaign.bump_2_voice_note ?? false,
      bump_3_voice_note: campaign.bump_3_voice_note ?? false,
      ai_reply_voice_note: campaign.ai_reply_voice_note ?? false,
      tts_voice_id: campaign.tts_voice_id || "",
      max_bumps: campaign.max_bumps ?? "",
      ai_model: campaign.ai_model || "",
      ai_temperature: campaign.ai_temperature ?? "",
      agent_name: campaign.agent_name || "",
      service_name: campaign.service_name || "",
      booking_mode_override: campaign.booking_mode_override || "",
      niche_question: campaign.niche_question || "",
      what_lead_did: campaign.what_lead_did || "",
      inquiries_source: campaign.inquiries_source || "",
      website: campaign.website || "",
      calendar_link_override: campaign.calendar_link_override || campaign.calendar_link || "",
      campaign_usp: campaign.campaign_usp || "",
      prompt_linked_id: linkedPrompt ? String(linkedPrompt.id || linkedPrompt.Id) : "",
      ai_prompt_template: campaign.ai_prompt_template || "",
      first_message_template: campaign.first_message_template || campaign.First_Message || "",
      second_message: campaign.second_message || "",
      bump_1_template: campaign.bump_1_template || "",
      bump_1_delay_hours: campaign.bump_1_delay_hours ?? "",
      bump_2_template: campaign.bump_2_template || "",
      bump_2_delay_hours: campaign.bump_2_delay_hours ?? "",
      bump_3_template: campaign.bump_3_template || "",
      bump_3_delay_hours: campaign.bump_3_delay_hours ?? "",
      contract_id: String(campaign.contract_id || (campaign as any).contract_id || ""),
      value_per_booking: campaign.value_per_booking ?? "",
      channel: campaign.channel || "sms",
    };
    setOriginalDraft(d);
    setDraft(d);
    setIsEditing(true);
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setDraft({});
    setOriginalDraft({});
  };

  const hasChanges = useMemo(() => {
    if (!isEditing || Object.keys(originalDraft).length === 0) return false;
    return Object.keys(originalDraft).some(k =>
      JSON.stringify(draft[k]) !== JSON.stringify(originalDraft[k])
    );
  }, [draft, originalDraft, isEditing]);

  const handleSave = async () => {
    const id = campaign.id || campaign.Id;
    if (!id) return;
    setSaving(true);
    try {
      // Handle prompt linking changes
      const prevPromptId = String(originalDraft.prompt_linked_id ?? "");
      const newPromptId  = String(draft.prompt_linked_id ?? "");
      if (newPromptId !== prevPromptId) {
        // Unlink old prompt
        if (prevPromptId) {
          await apiFetch(`/api/prompts/${prevPromptId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignsId: null }),
          });
        }
        // Link new prompt and copy its text into ai_prompt_template
        if (newPromptId) {
          await apiFetch(`/api/prompts/${newPromptId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ campaignsId: id }),
          });
          // Copy prompt text so automation keeps working
          const selectedP = conversationPrompts.find((p) => String(p.id || p.Id) === newPromptId);
          if (selectedP) {
            draft.ai_prompt_template = selectedP.prompt_text || selectedP.promptText || "";
          }
        }
        // Refresh prompt list so linked state updates
        apiFetch("/api/prompts")
          .then((r) => r.ok ? r.json() : [])
          .then((data: any[]) => {
            setConversationPrompts(
              Array.isArray(data) ? data.filter((p) => (p.use_case || p.useCase || "").toLowerCase() === "conversation") : []
            );
          })
          .catch(() => {});
      }

      // Remove prompt_linked_id from patch — it's not a campaign column
      const { prompt_linked_id: _omit, ...rawPatch } = draft as any;
      // Convert empty strings to null so Zod numeric validation doesn't reject the payload
      const campaignPatch = Object.fromEntries(
        Object.entries(rawPatch).map(([k, v]) => [k, v === "" ? null : v])
      );
      await onSave(id, campaignPatch);
      setIsEditing(false);
      setDraft({});
      setOriginalDraft({});
      toast({ title: "Saved", description: "Campaign updated." });
    } catch (e) {
      console.error("Save failed", e);
      toast({ title: "Save failed", description: "Could not save changes.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const goToConfig = useCallback(() => setActiveTab("configurations"), []);

  return (
    <div className="relative flex flex-col h-full overflow-hidden" data-testid="campaign-detail-view">

      {/* ── Background ── */}
      <div className="absolute inset-0 bg-popover dark:bg-background" />
      {!compact && (
        <>
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_200%_200%_at_6%_5%,#fff8c6_0%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_103%_130%_at_35%_85%,rgba(255,134,134,0.4)_0%,transparent_69%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_52%_48%_at_0%_0%,#fff6ba_5%,transparent_30%)] dark:opacity-[0.08]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_102%_at_78%_50%,rgba(255,194,165,0.6)_0%,transparent_66%)] dark:opacity-[0.08]" />
        </>
      )}

      {/* ── Header content ── */}
      <div className="shrink-0 relative z-10">
        <div className="relative px-4 pt-6 pb-5 space-y-3 max-w-[1386px] w-full mr-auto">

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
                  disabled={saving || !hasChanges}
                  className={cn(
                    "inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium transition-colors",
                    (hasChanges && !saving)
                      ? "bg-brand-indigo text-white hover:opacity-90 transition-opacity"
                      : "bg-muted text-muted-foreground cursor-not-allowed"
                  )}
                >
                  {saving ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  {saving ? t("toolbar.saving") : t("toolbar.save")}
                </button>
                <button
                  onClick={cancelEdit}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 h-9 px-4 rounded-full text-[12px] font-medium border border-black/[0.125] bg-transparent text-foreground hover:bg-muted/50 transition-colors"
                >
                  <X className="h-4 w-4" />
                  {t("toolbar.close")}
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
                    <span className={xSpan}>{t("toolbar.edit")}</span>
                  </button>
                )}

                {onCreateCampaign && (
                  <>
                    <button onClick={onCreateCampaign} className={cn(xBase, "hover:max-w-[80px]", xDefault)} title="New campaign">
                      <Plus className="h-4 w-4 shrink-0" />
                      <span className={xSpan}>{t("toolbar.add")}</span>
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
                          <span className={xSpan}>{t("toolbar.sort")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-44">
                        {(Object.keys(DETAIL_SORT_LABEL_KEYS) as CampaignSortBy[]).map((s) => (
                          <DropdownMenuItem
                            key={s}
                            onClick={() => onSortByChange?.(s)}
                            className={cn("text-[12px]", sortBy === s && "font-semibold text-brand-indigo")}
                          >
                            {t(DETAIL_SORT_LABEL_KEYS[s])}
                            {sortBy === s && <Check className="h-3 w-3 ml-auto" />}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isFilterActive ? xActive : xDefault)} title="Filter">
                          <Filter className="h-4 w-4 shrink-0" />
                          <span className={xSpan}>{t("toolbar.filter")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-52 max-h-80 overflow-y-auto">
                        <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.status")}</div>
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
                            <span className={cn("flex-1", filterStatus?.includes(s) && "font-bold text-brand-indigo")}>{t(`statusLabels.${s}`, s)}</span>
                            {filterStatus?.includes(s) && <Check className="h-3 w-3 text-brand-indigo shrink-0" />}
                          </DropdownMenuItem>
                        ))}
                        {(availableAccounts?.length ?? 0) > 0 && (
                          <>
                            <DropdownMenuSeparator />
                            <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("filter.account")}</div>
                            <DropdownMenuItem
                              onClick={(e) => { e.preventDefault(); onFilterAccountChange?.(""); }}
                              className={cn("flex items-center gap-2 text-[12px]", !filterAccount && "font-bold text-brand-indigo")}
                            >
                              <span className="flex-1">{t("filter.allAccounts")}</span>
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
                              {t("filter.clearAllFilters")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={cn(xBase, "hover:max-w-[100px]", isGroupNonDefault ? xActive : xDefault)} title="Group">
                          <Layers className="h-4 w-4 shrink-0" />
                          <span className={xSpan}>{t("toolbar.group")}</span>
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="w-40">
                        {(Object.keys(DETAIL_GROUP_LABEL_KEYS) as CampaignGroupBy[]).map((g) => (
                          <DropdownMenuItem
                            key={g}
                            onClick={() => onGroupByChange?.(g)}
                            className={cn("text-[12px]", groupBy === g && "font-semibold text-brand-indigo")}
                          >
                            {t(DETAIL_GROUP_LABEL_KEYS[g])}
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
                      ? <><PauseCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.pause")}</span></>
                      : <><PlayCircle className="h-4 w-4 shrink-0" /><span className={xSpan}>{t("toolbar.activate")}</span></>
                    }
                  </button>
                )}
                <button onClick={onRefresh} className={cn(xBase, "hover:max-w-[110px]", xDefault)}>
                  <RefreshCw className="h-4 w-4 shrink-0" />
                  <span className={xSpan}>{t("toolbar.refresh")}</span>
                </button>
                {onDuplicate && (
                  <DuplicateButton campaign={campaign} onDuplicate={onDuplicate} t={t} />
                )}
                {onDelete && (deleteConfirm ? (
                  <div className="inline-flex items-center gap-1.5 h-9 rounded-full border border-red-300/50 bg-card px-4 text-[12px]">
                    <span className="text-foreground/60">{t("confirm.deleteConfirm")}</span>
                    <button
                      className="h-7 px-3 rounded-full bg-red-600 text-white font-semibold text-[11px] hover:opacity-90 disabled:opacity-50 transition-opacity"
                      disabled={deleting}
                      onClick={async () => { setDeleting(true); try { await onDelete?.(campaign.id || campaign.Id); } finally { setDeleting(false); setDeleteConfirm(false); } }}
                    >
                      {deleting ? "..." : t("confirm.yes")}
                    </button>
                    <button className="h-7 px-3 rounded-full text-muted-foreground text-[11px] hover:text-foreground transition-colors" onClick={() => setDeleteConfirm(false)}>{t("confirm.no")}</button>
                  </div>
                ) : (
                  <button onClick={() => setDeleteConfirm(true)} className={cn(xBase, "hover:max-w-[100px]", "border-black/[0.125] text-red-500 hover:text-red-600")}>
                    <Trash2 className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("toolbar.delete")}</span>
                  </button>
                ))}
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
                title={isAdmin ? t("photo.clickToChange") : undefined}
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
                  title={t("photo.removeLogo")}
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
                  <DialogTitle>{t("photo.dialogTitle")}</DialogTitle>
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
                      <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.hue")}</p>
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
                  {t("photo.uploadLogo")}
                </button>

                {/* Sticker grid */}
                <div className="space-y-2">
                  <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold">{t("photo.chooseSticker")}</p>
                  <div className="grid grid-cols-5 gap-1.5 max-h-[200px] overflow-y-auto pr-1">
                    <button
                      type="button"
                      className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center border transition-colors",
                        !pendingSlug ? "border-brand-indigo bg-indigo-50" : "border-black/[0.125] hover:border-black/[0.175]"
                      )}
                      onClick={() => setPendingSlug(null)}
                      title={t("photo.noSticker")}
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
                  {t("toolbar.save")}
                </button>
              </DialogContent>
            </Dialog>

            <div className="flex-1 min-w-0">
              <h2 className="text-[18px] md:text-[27px] font-semibold font-heading text-foreground leading-tight truncate" data-testid="campaign-detail-view-name">
                {campaign.name || t("detail.unnamed")}
              </h2>

              {/* Subtitle: status */}
              <div className="mt-1 flex flex-col gap-1" data-testid="campaign-detail-view-status">
                {status && (
                  <span
                    className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold self-start"
                    style={{ backgroundColor: `${CAMPAIGN_STATUS_HEX[status]}20`, color: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }}
                  >
                    <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: CAMPAIGN_STATUS_HEX[status] || "#6B7280" }} />
                    {t(`statusLabels.${status}`, status)}
                  </span>
                )}
              </div>
            </div>

            {/* Meta chips — absolute overlay when wide (list view), hidden when compact (table view) */}
            {!compact && (
              <div className="absolute -translate-x-1/2 bottom-[45px] hidden md:flex items-center gap-10 whitespace-nowrap pointer-events-auto z-10" style={{ left: "calc(66.67% - 5px)" }}>
                {(campaign as any).channel && (
                  <div className="flex items-center gap-1.5">
                    <img
                      src={`/logos/${(
                        ({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com"
                      )}.svg`}
                      alt={(campaign as any).channel}
                      className="h-[26px] w-[26px] object-contain shrink-0"
                    />
                    <div>
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
                      <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                    </div>
                  </div>
                )}
                {campaignCreatedAt && (
                  <div className="ml-6">
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
                  </div>
                )}
                {campaign.type && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
                  </div>
                )}
                {campaign.daily_lead_limit != null && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
                      {dailyStats != null ? `${dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
                    </div>
                  </div>
                )}
                {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
                  <div>
                    <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
                    <div className="text-[11px] font-bold text-foreground leading-none">
                      {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                      {" – "}
                      {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
                    </div>
                  </div>
                )}
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
                      <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
                      <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Mobile meta chips (always) + compact/table-view meta chips (flow below title) */}
          <div className={cn("flex flex-wrap items-center gap-7", compact ? "flex" : "flex md:hidden")}>
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
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.owner")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none">{campaign.account_name}</div>
                </div>
              </div>
            )}
            {(campaign as any).channel && (
              <div className="flex items-center gap-1.5">
                <img
                  src={`/logos/${(
                    ({ whatsapp: "whatsapp-svgrepo-com", instagram: "instagram-svgrepo-com", email: "email-address-svgrepo-com", sms: "sms-svgrepo-com", phone: "phone-call-svgrepo-com" } as Record<string, string>)[(campaign as any).channel?.toLowerCase()] ?? "sms-svgrepo-com"
                  )}.svg`}
                  alt={(campaign as any).channel}
                  className="h-[24px] w-[24px] object-contain shrink-0"
                />
                <div>
                  <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.channel")}</div>
                  <div className="text-[11px] font-bold text-foreground leading-none capitalize">{(campaign as any).channel}</div>
                </div>
              </div>
            )}
            {campaignCreatedAt && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.started")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{formatDate(campaignCreatedAt)}</div>
              </div>
            )}
            {campaign.type && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.type")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">{campaign.type}</div>
              </div>
            )}
            {campaign.daily_lead_limit != null && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.dailyLimit")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none tabular-nums">
                  {dailyStats != null ? `${dailyStats.sentToday} / ${campaign.daily_lead_limit}` : `${campaign.daily_lead_limit}`}
                </div>
              </div>
            )}
            {(campaign.active_hours_start || (campaign as any).activeHoursStart) && (
              <div>
                <div className="text-[8px] uppercase tracking-widest text-muted-foreground/50 font-medium leading-none mb-0.5">{t("meta.activeHours")}</div>
                <div className="text-[11px] font-bold text-foreground leading-none">
                  {((campaign.active_hours_start || (campaign as any).activeHoursStart) as string).slice(0, 5)}
                  {" – "}
                  {((campaign.active_hours_end || (campaign as any).activeHoursEnd) as string)?.slice(0, 5) ?? "—"}
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Tags toolbar — shown below header when tags tab is active */}
      <div className="relative z-10 shrink-0 px-4 pt-0 md:pt-0 pb-0 flex items-center flex-wrap gap-2">
        {/* ── Tags toolbar — inline with tab bar when tags tab is active ── */}
        {isAgencyUser && false && (
          <>
            <div className="w-px h-5 bg-border/40 mx-0.5" />

            {/* Search */}
            <div className="relative flex items-center">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                placeholder={t("tags.searchTags")}
                value={tagsSearch}
                onChange={(e) => setTagsSearch(e.target.value)}
                className="h-8 w-[160px] pl-8 pr-3 text-[11px] rounded-full border border-black/[0.125] bg-transparent outline-none focus:border-brand-indigo/50 transition-colors"
              />
            </div>

            {/* Add tag */}
            <Popover open={tagsCreateOpen} onOpenChange={setTagsCreateOpen}>
              <PopoverTrigger asChild>
                <button className={tagPill}>
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-72 p-4 space-y-3">
                <p className="text-[12px] font-semibold text-foreground">{t("tags.newTag")}</p>
                <input
                  type="text"
                  placeholder={t("tags.tagNamePlaceholder")}
                  value={tagsNewName}
                  onChange={(e) => setTagsNewName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") submitTagCreate(); }}
                  className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                  autoFocus
                />
                <ColorPicker value={tagsNewColor} onChange={setTagsNewColor} />
                <input
                  type="text"
                  placeholder={t("tags.categoryPlaceholder")}
                  value={tagsNewCategory}
                  onChange={(e) => setTagsNewCategory(e.target.value)}
                  className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
                />
                <div className="flex justify-end gap-2 pt-1">
                  <Button variant="ghost" size="sm" onClick={() => setTagsCreateOpen(false)}>
                    {t("toolbar.cancel")}
                  </Button>
                  <Button size="sm" onClick={submitTagCreate} disabled={!tagsNewName.trim()}>
                    {t("tags.create")}
                  </Button>
                </div>
              </PopoverContent>
            </Popover>

            {/* Tag templates dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={tagPill} title="Tag templates">
                  <LayoutTemplate className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <DropdownMenuItem
                  className="text-[12px]"
                  disabled={!tagsDataRef.current?.length}
                  onClick={() => { setSaveTemplateName(campaign.name || ""); setSaveDialogOpen(true); }}
                >
                  <Save className="h-3.5 w-3.5 mr-2" />
                  Save as Template
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuSub>
                  <DropdownMenuSubTrigger className="text-[12px]">Apply Template</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent className="w-52">
                    <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-wider px-2 py-1">Built-in</DropdownMenuLabel>
                    <DropdownMenuItem
                      className="text-[12px]"
                      onClick={() => handleSelectTemplate({ name: "Reactivation", tags: REACTIVATION_TAG_TEMPLATE })}
                    >
                      Reactivation
                      <span className="ml-auto text-[10px] text-muted-foreground">{REACTIVATION_TAG_TEMPLATE.length}</span>
                    </DropdownMenuItem>
                    {savedTemplates.length > 0 ? (
                      <>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase text-muted-foreground tracking-wider px-2 py-1">Saved</DropdownMenuLabel>
                        {savedTemplates.map((tpl, i) => (
                          <DropdownMenuItem
                            key={`${tpl.name}-${i}`}
                            className="text-[12px]"
                            onClick={() => handleSelectTemplate(tpl)}
                          >
                            <span className="truncate flex-1">{tpl.name}</span>
                            <span className="flex items-center gap-1 ml-2 shrink-0">
                              <span className="text-[10px] text-muted-foreground">{tpl.tags.length}</span>
                              <button
                                className="text-muted-foreground/40 hover:text-red-500 p-0.5 rounded"
                                onClick={(e) => handleDeleteTemplate(i, e)}
                              >
                                <Trash2 className="h-3 w-3" />
                              </button>
                            </span>
                          </DropdownMenuItem>
                        ))}
                      </>
                    ) : (
                      <>
                        <DropdownMenuSeparator />
                        <div className="px-2 py-1.5 text-[11px] text-muted-foreground italic">No saved templates</div>
                      </>
                    )}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Sort */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={tagsIsSortNonDefault ? tagPillActive : tagPill}>
                  <ArrowUpDown className="h-3.5 w-3.5" />
                  {t("tags.sorting")}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-44">
                {([
                  { value: "name_asc" as TagSortOption,     label: t("sortOptions.nameAsc") },
                  { value: "name_desc" as TagSortOption,    label: t("sortOptions.nameDesc") },
                  { value: "count_desc" as TagSortOption,   label: t("sortOptions.leadsDesc") },
                  { value: "category_asc" as TagSortOption, label: t("tags.category") },
                ]).map((opt) => (
                  <DropdownMenuItem key={opt.value} onClick={() => setTagsSortBy(opt.value)} className="text-[12px] flex items-center justify-between">
                    {opt.label}
                    {tagsSortBy === opt.value && <Check className="h-4 w-4 text-brand-indigo" />}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Filter */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className={tagsIsFilterActive ? tagPillActive : tagPill}>
                  <Filter className="h-3.5 w-3.5" />
                  {t("tags.filter")}
                  {tagsIsFilterActive && ` · ${tagsFilterCount}`}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-52">
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("tags.autoApplied")}</div>
                {(["all", "yes", "no"] as const).map((val) => (
                  <DropdownMenuItem key={val} onClick={() => setTagsFilterAuto(val)} className="text-[12px] flex items-center justify-between">
                    {val === "all" ? t("tags.all") : val === "yes" ? t("tags.yes") : t("tags.no")}
                    {tagsFilterAuto === val && <Check className="h-4 w-4 text-brand-indigo" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator />
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{t("tags.category")}</div>
                <DropdownMenuItem onClick={() => setTagsFilterCat("")} className="text-[12px] flex items-center justify-between">
                  {t("tags.allCategories")}
                  {!tagsFilterCat && <Check className="h-4 w-4 text-brand-indigo" />}
                </DropdownMenuItem>
                {tagsCategories.map((cat) => (
                  <DropdownMenuItem key={cat} onClick={() => setTagsFilterCat(cat)} className="text-[12px] flex items-center justify-between">
                    {cat}
                    {tagsFilterCat.toLowerCase() === cat.toLowerCase() && <Check className="h-4 w-4 text-brand-indigo" />}
                  </DropdownMenuItem>
                ))}
                {tagsIsFilterActive && (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => { setTagsFilterAuto("all"); setTagsFilterCat(""); }} className="text-[12px] text-destructive">
                      {t("tags.clearAllFilters")}
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>

          </>
        )}
      </div>

      {/* ── Body — overlaps header; mask fades content as it slides under ── */}
      <div
        className="relative flex-1 px-[3px] pb-[3px] -mt-[80px] pt-[83px] overflow-y-auto"
        style={{
          maskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
          WebkitMaskImage: "linear-gradient(to bottom, transparent 0px, black 83px)",
        }}
      >

        {/* ── Summary tab — 3-col grid, rows auto-match heights ── */}
        {activeTab === "summary" && (
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-3 md:grid-rows-[680px_680px] gap-[3px]", "max-w-[1386px] w-full mr-auto")}>

            {/* ── Row 1, Col 1: Pipeline + Donut ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-funnel">
              <div className="flex items-center min-h-[36px]">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.pipeline")}</span>
              </div>
              <PipelineAndDonutWidget campaignId={campaign.id || (campaign as any).Id} />
            </div>

            {/* ── Row 1, Col 2: Key Metrics + Performance Trends ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-metrics">
              <div className="flex items-center justify-between gap-2 min-h-[36px]">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.keyMetrics")}</span>
                <DateRangeFilter
                  value={dateRange}
                  onChange={setDateRange}
                  allFrom={campaignCreatedAt ? new Date(campaignCreatedAt) : undefined}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <AnimatedMetricCard numericValue={agg.totalLeadsTargeted} displayValue={agg.totalLeadsTargeted.toLocaleString()} label={t("summary.leadsTargeted")} animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.totalMessagesSent}  displayValue={agg.totalMessagesSent.toLocaleString()}  label={t("summary.messagesSent")}  animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.responseRate ?? 0}  displayValue={agg.responseRate != null ? `${agg.responseRate}%` : "—"} label={t("summary.responsePercent")} animTrigger={animTrigger} />
                <AnimatedMetricCard numericValue={agg.bookingRate  ?? 0}  displayValue={agg.bookingRate  != null ? `${agg.bookingRate}%`  : "—"} label={t("summary.bookingPercent")}  animTrigger={animTrigger} />
              </div>

              {/* Performance Trends chart — pushed to bottom */}
              <div className="mt-auto pt-1">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("summary.performanceTrends")}</span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-3 h-[2px] rounded-full inline-block bg-[#3ACBDF]" />
                      Response %
                    </span>
                    <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <span className="w-3 h-[2px] rounded-full inline-block bg-[#f5be0b]" />
                      Booking %
                    </span>
                  </div>
                </div>
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
                      margin={{ top: 15, right: 4, bottom: 0, left: -39 }}
                    >
                      <defs>
                        <linearGradient id="fillResponse" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#9a9a9a" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="#a3a3a3" stopOpacity={0} />
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
                      <Area type="monotone" dataKey="Response %" stroke="#a0a0a0" strokeWidth={2} fill="url(#fillResponse)" dot={false} activeDot={{ r: 3 }} />
                      <Area type="monotone" dataKey="Booking %"  stroke="#f5be0b" strokeWidth={2} fill="url(#fillBooking)"  dot={false} activeDot={{ r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* ── Row 1, Col 3: Up Next ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-y-auto" data-testid="campaign-detail-view-agenda">
              <div className="flex items-center min-h-[32px] shrink-0">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.upNext")}</span>
              </div>
              <AgendaWidget accountId={undefined} className="flex-1 min-h-0 bg-transparent" hideHeader />
            </div>

            {/* ── Row 2, Col 1: Activity Feed ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-activity">
              <div className="flex items-center min-h-[36px] shrink-0">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.activity")}</span>
              </div>

              {/* Daily capacity */}
              {dailyStats && (
                <div className="bg-white/90 dark:bg-white/[0.06] rounded-lg px-4 py-3 flex flex-col gap-2 shrink-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Daily Capacity</span>
                    <span className="text-[11px] text-muted-foreground tabular-nums">
                      {dailyStats.sentToday.toLocaleString()} / {dailyStats.dailyLimit.toLocaleString()} · resets midnight
                    </span>
                  </div>
                  <div className="h-1.5 w-full bg-black/[0.07] dark:bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, (dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit)) * 100)}%`,
                        backgroundColor:
                          dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit) >= 0.9 ? "#ef4444" :
                          dailyStats.sentToday / Math.max(1, dailyStats.dailyLimit) >= 0.7 ? "#f59e0b" : "#3ACBDF",
                      }}
                    />
                  </div>
                </div>
              )}

              <ActivityFeed accountId={undefined} className="flex-1 min-h-0" />
            </div>

            {/* ── Row 2, Col 2: Financials + ROI Trend ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-conversions">
              <div className="flex items-center min-h-[36px]">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.financials")}</span>
              </div>
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
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-2 block">{t("summary.roiTrend")}</span>
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

            {/* ── Row 2, Col 3: AI Summary ── */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 flex flex-col gap-6 overflow-hidden" data-testid="campaign-detail-view-ai-summary">
              <div className="flex items-center min-h-[36px] shrink-0">
                <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("summary.aiAnalysis")}</span>
              </div>
              <AISummaryWidget
                campaign={campaign}
                summary={localAiSummary}
                generatedAt={localAiSummaryAt}
                onRefreshed={handleAiSummaryRefreshed}
              />
            </div>

          </div>
        )}

        {/* ── Configurations tab ── */}
        {activeTab === "configurations" && (
          <div className={cn(compact ? "flex flex-col gap-3" : "grid grid-cols-1 md:grid-cols-3 gap-[3px] md:h-full", "max-w-[1386px] w-full mr-auto")}>

            {/* Column 1: Configuration / Settings */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-settings">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("config.configuration")}</span>

              {/* Status + Type + Booking Mode + Business Description + extra fields */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                <InfoRow label={t("columns.status")} value={String(campaign.status || "—")}
                  editChild={isEditing ? <EditSelect value={String(draft.status ?? campaign.status ?? "")} onChange={(v) => setDraft(d => ({...d, status: v}))} options={["Active", "Paused", "Draft", "Completed", "Inactive"]} /> : undefined}
                />
                <InfoRow label={t("config.type")} value={campaign.type}
                  editChild={isEditing ? (
                    <select
                      value={draft.type as string || ""}
                      onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}
                      className="w-full rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    >
                      <option value="">— Select type —</option>
                      <option value="Cold Outreach">Cold Outreach</option>
                      <option value="Re-engagement">Re-engagement</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Event">Event</option>
                    </select>
                  ) : undefined}
                />
                {/* Booking Mode — Call Agent / Direct Booking */}
                <div className="flex flex-col gap-0.5 py-2 border-b border-border/20">
                  <span className="text-[10px] font-medium uppercase tracking-wider text-foreground/40">{t("config.bookingMode")}</span>
                  {isEditing ? (
                    <div className="flex gap-1 flex-wrap">
                      {(["Call Agent", "Direct Booking"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setDraft(d => ({ ...d, booking_mode_override: mode }))}
                          className={cn(
                            "text-[11px] font-medium px-2.5 py-1 rounded-full border transition-colors",
                            draft.booking_mode_override === mode
                              ? "border-brand-indigo/50 bg-brand-indigo/10 text-brand-indigo"
                              : "border-black/[0.125] bg-transparent text-foreground/60 hover:bg-muted/50"
                          )}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <span className="text-[12px] font-semibold text-foreground">
                      {campaign.booking_mode_override || "—"}
                    </span>
                  )}
                </div>
                <InfoRow label={t("config.businessDescription")} value={campaign.description}
                  editChild={isEditing ? <EditText value={String(draft.description ?? "")} onChange={(v) => setDraft(d => ({...d, description: v}))} multiline placeholder="Business description…" /> : undefined}
                />
                <InfoRow label={t("config.nicheQuestion")} value={campaign.niche_question}
                  editChild={isEditing ? <EditText value={String(draft.niche_question ?? "")} onChange={(v) => setDraft(d => ({...d, niche_question: v}))} placeholder="e.g. Are you still looking for…?" /> : undefined}
                />
                <InfoRow label={t("config.whatLeadDid")} value={campaign.what_lead_did}
                  editChild={isEditing ? <EditText value={String(draft.what_lead_did ?? "")} onChange={(v) => setDraft(d => ({...d, what_lead_did: v}))} multiline placeholder="e.g. Filled out a form, clicked an ad…" /> : undefined}
                />
                <InfoRow label={t("config.inquiriesSource")} value={campaign.inquiries_source}
                  editChild={isEditing ? <EditText value={String(draft.inquiries_source ?? "")} onChange={(v) => setDraft(d => ({...d, inquiries_source: v}))} placeholder="e.g. Contact form, landing page" /> : undefined}
                />
                <InfoRow label={t("config.website")} value={campaign.website || ""}
                  editChild={isEditing ? <EditText value={String(draft.website ?? "")} onChange={(v) => setDraft(d => ({...d, website: v}))} placeholder="https://example.com" /> : undefined}
                />
                <InfoRow label={t("config.calendarLink")} value={campaign.calendar_link_override || campaign.calendar_link}
                  editChild={isEditing ? <EditText value={String(draft.calendar_link_override ?? "")} onChange={(v) => setDraft(d => ({...d, calendar_link_override: v}))} placeholder="https://calendly.com/…" /> : undefined}
                />
                <InfoRow label={t("config.usp")} value={campaign.campaign_usp}
                  editChild={isEditing ? <EditText value={String(draft.campaign_usp ?? "")} onChange={(v) => setDraft(d => ({...d, campaign_usp: v}))} multiline placeholder="What makes this offer unique…" /> : undefined}
                />
              </div>

              {/* Schedule group */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pb-2">{t("config.schedule")}</p>
                <InfoRow label={t("config.startDate")} value={formatDate(campaign.start_date)}
                  editChild={isEditing ? <EditDate value={String(draft.start_date ?? "")} onChange={(v) => setDraft(d => ({...d, start_date: v}))} /> : undefined}
                />
                <InfoRow label={t("config.endDate")} value={formatDate(campaign.end_date)}
                  editChild={isEditing ? <EditDate value={String(draft.end_date ?? "")} onChange={(v) => setDraft(d => ({...d, end_date: v}))} /> : undefined}
                />
                <InfoRow
                  label={t("config.activeHours")}
                  value={campaign.active_hours_start || campaign.active_hours_end ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}` : null}
                  editChild={isEditing ? (
                    <div className="flex items-center gap-1 flex-1 min-w-0">
                      <EditText value={String(draft.active_hours_start ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_start: v}))} placeholder="09:00" />
                      <span className="text-foreground/40 text-[11px]">→</span>
                      <EditText value={String(draft.active_hours_end ?? "")} onChange={(v) => setDraft(d => ({...d, active_hours_end: v}))} placeholder="18:00" />
                    </div>
                  ) : undefined}
                />
                {(isEditing ? draft.channel : campaign.channel) !== "whatsapp" && (
                  <InfoRow label={t("config.dailyLimit")} value={campaign.daily_lead_limit?.toLocaleString()}
                    editChild={isEditing ? <EditNumber value={String(draft.daily_lead_limit ?? "")} onChange={(v) => setDraft(d => ({...d, daily_lead_limit: v}))} placeholder="e.g. 50" /> : undefined}
                  />
                )}
                <InfoRow label={t("config.interval")} value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : null}
                  editChild={isEditing ? <EditNumber value={String(draft.message_interval_minutes ?? "")} onChange={(v) => setDraft(d => ({...d, message_interval_minutes: v}))} placeholder="minutes" /> : undefined}
                />
              </div>
            </div>

            {/* Column 2: AI Settings */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto" data-testid="campaign-detail-view-ai">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">{t("config.aiSettings")}</span>
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                <InfoRow label={t("config.agent")} value={campaign.agent_name}
                  editChild={isEditing ? <EditText value={String(draft.agent_name ?? "")} onChange={(v) => setDraft(d => ({...d, agent_name: v}))} /> : undefined}
                />
                <InfoRow label={t("config.service")} value={campaign.service_name}
                  editChild={isEditing ? <EditText value={String(draft.service_name ?? "")} onChange={(v) => setDraft(d => ({...d, service_name: v}))} /> : undefined}
                />
              </div>
              {/* Prompt library link */}
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pb-1">{t("config.promptLinked")}</p>
                {isEditing ? (
                  <select
                    value={String(draft.prompt_linked_id ?? "")}
                    onChange={(e) => setDraft(d => ({ ...d, prompt_linked_id: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-input bg-background px-2.5 text-[12px] text-foreground outline-none focus:ring-2 focus:ring-brand-indigo/30 transition-colors"
                  >
                    <option value="">{t("config.noPromptLinked")}</option>
                    {conversationPrompts.map((p) => (
                      <option key={p.id || p.Id} value={String(p.id || p.Id)}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                ) : linkedPrompt ? (
                  <div
                    className="flex items-center gap-2 p-2.5 rounded-xl bg-white/80 dark:bg-white/[0.06] cursor-pointer hover:bg-white dark:hover:bg-white/[0.10] transition-colors"
                    onClick={() => {
                      localStorage.setItem("prompt-library-initial-id", String(linkedPrompt.id || linkedPrompt.Id));
                      navigate(isAgencyUser ? "/agency/prompt-library" : "/subaccount/prompt-library");
                    }}
                  >
                    {/* AI icon circle */}
                    <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-brand-indigo/10 text-brand-indigo flex-shrink-0">
                      <Bot className="w-4 h-4" />
                    </div>
                    {/* name */}
                    <span className="text-sm font-medium flex-1 truncate">{linkedPrompt.name || linkedPrompt.Name}</span>
                    {/* status badge */}
                    <span className={cn(
                      "text-xs px-1.5 py-0.5 rounded-full font-medium",
                      (linkedPrompt.status || linkedPrompt.Status) === "active"
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-muted text-muted-foreground"
                    )}>
                      {linkedPrompt.status || linkedPrompt.Status || "unknown"}
                    </span>
                  </div>
                ) : (
                  <p className="text-[11px] text-foreground/40 italic">{t("config.noPromptLinked")}</p>
                )}
              </div>
              {/* Message Templates — merged into col 2 */}
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{t("config.messageTemplates")}</span>

              {/* First message */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">{t("config.firstMessage")}</span>
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
                    : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
                )}
              </div>

              {/* Second message (auto-sent on first reply) */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.08] p-3 md:p-6 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-foreground/40">Second Message</span>
                  {!isEditing && campaign.second_message && (
                    <CopyButton value={campaign.second_message} />
                  )}
                </div>
                <p className="text-[10px] text-foreground/40 italic">Auto-sent on first lead reply, before AI takes over</p>
                {isEditing ? (
                  <EditText
                    value={String(draft.second_message ?? "")}
                    onChange={(v) => setDraft(d => ({...d, second_message: v}))}
                    multiline
                    placeholder="Nice! My manager asked me to reach out but I didn't want to spam you. Are you still looking?"
                  />
                ) : (
                  campaign.second_message
                    ? <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                        {campaign.second_message}
                      </p>
                    : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
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
                        <span className="text-[10px] text-foreground/50">{t("config.delayHours")}</span>
                        <input
                          type="number"
                          value={String(draft.bump_1_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_1_delay_hours: e.target.value === "" ? "" : Number(e.target.value)}))}
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="24"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>{t("config.delayLabel", { value: formatHours(campaign.bump_1_delay_hours) })}</span>
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
                    : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
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
                        <span className="text-[10px] text-foreground/50">{t("config.delayHours")}</span>
                        <input
                          type="number"
                          value={String(draft.bump_2_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_2_delay_hours: e.target.value === "" ? "" : Number(e.target.value)}))}
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="48"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>{t("config.delayLabel", { value: formatHours(campaign.bump_2_delay_hours) })}</span>
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
                    : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
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
                        <span className="text-[10px] text-foreground/50">{t("config.delayHours")}</span>
                        <input
                          type="number"
                          value={String(draft.bump_3_delay_hours ?? "")}
                          onChange={(e) => setDraft(d => ({...d, bump_3_delay_hours: e.target.value === "" ? "" : Number(e.target.value)}))}
                          className="w-14 text-[11px] bg-white/60 dark:bg-white/[0.10] border border-brand-indigo/30 rounded px-1.5 py-0.5 outline-none"
                          placeholder="72"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[11px] text-foreground/50">
                        <Clock className="w-3 h-3" />
                        <span>{t("config.delayLabel", { value: formatHours(campaign.bump_3_delay_hours) })}</span>
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
                    : <p className="text-[11px] text-foreground/40 italic">{t("config.noTemplateSet")}</p>
                )}
              </div>

              {/* AI Model + Temperature — at bottom of templates section */}
              <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                <p className="text-[10px] uppercase tracking-wider text-foreground/40 font-semibold pb-2">{t("config.aiSettings")}</p>
                <InfoRow label={t("config.model")} value={campaign.ai_model || "Default"}
                  editChild={isEditing ? <EditText value={String(draft.ai_model ?? "")} onChange={(v) => setDraft(d => ({...d, ai_model: v}))} placeholder="Model name" /> : undefined}
                />
                <InfoRow label={t("config.temperature")} value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : null}
                  editChild={isEditing ? <EditNumber value={String(draft.ai_temperature ?? "")} onChange={(v) => setDraft(d => ({...d, ai_temperature: v}))} placeholder="0.7" /> : undefined}
                />
              </div>

            </div>

            {/* Column 3: Behavior */}
            <div className="bg-card/75 rounded-xl p-4 md:p-8 space-y-6 overflow-y-auto">
              <span className="text-[18px] font-semibold font-heading leading-tight text-foreground">Behavior</span>
                {/* Channel + toggles */}
                <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                  <InfoRow label={t("config.channel")} value={campaign.channel || "WhatsApp"} />
                  <BoolRow label={t("config.stopOnResponse")} value={campaign.stop_on_response} />
                  <BoolRow label={t("config.useAiBumps")} value={campaign.use_ai_bumps} />
                  {campaign.channel === "whatsapp" && (
                    <InfoRow
                      label={t("config.whatsappTier")}
                      value={(() => {
                        const lim = campaign.daily_lead_limit;
                        if (!lim || lim > 100000) return "Tier 4 · ∞";
                        if (lim > 10000) return "Tier 3 · 100k/day";
                        if (lim > 1000) return "Tier 2 · 10k/day";
                        return "Tier 1 · 1,000/day";
                      })()}
                    />
                  )}
                  <InfoRow label={t("config.maxBumps")} value={campaign.max_bumps} />
                </div>

                {/* Voice Notes */}
                <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 pb-2">Voice Notes</p>
                  <BoolRow label={t("config.firstMessageVoiceNote")} value={campaign.first_message_voice_note ?? false} />
                  <BoolRow label={t("config.bump1VoiceNote")} value={campaign.bump_1_voice_note ?? false} />
                  <BoolRow label={t("config.bump2VoiceNote")} value={campaign.bump_2_voice_note ?? false} />
                  <BoolRow label={t("config.bump3VoiceNote")} value={campaign.bump_3_voice_note ?? false} />
                  <BoolRow label={t("config.aiReplyVoiceNote")} value={campaign.ai_reply_voice_note ?? false} />
                  <InfoRow label={t("config.voiceId")} value={campaign.tts_voice_id || null} />
                </div>

                {/* Contract */}
                <div className="rounded-xl bg-white/80 dark:bg-white/[0.06] p-3 space-y-0">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/40 pb-2">{t("config.contract")}</p>
                  <InfoRow
                    label={t("config.deal")}
                    value={linkedContract ? (linkedContract.title || `Contract #${linkedContract.id}`) : t("config.noneLinked")}
                  />
                  <InfoRow
                    label={t("config.valuePerBooking")}
                    value={
                      linkedContract?.value_per_booking != null
                        ? fmtCurrency(Number(linkedContract.value_per_booking))
                        : campaign.value_per_booking != null
                          ? fmtCurrency(Number(campaign.value_per_booking))
                          : null
                    }
                  />
                </div>
            </div>


          </div>
        )}


      </div>

      {/* ── Apply template confirmation dialog ──────────────────────────── */}
      <AlertDialog open={templateDialogOpen} onOpenChange={(open) => { setTemplateDialogOpen(open); if (!open) setSelectedTemplate(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Apply {selectedTemplate?.name} Template?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create {selectedTemplate?.tags.length ?? 0} tags from the {selectedTemplate?.name} template
              for <span className="font-medium text-foreground">{campaign.name}</span>.
              Existing tags with the same name will be skipped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={templateApplying}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={applyTemplate} disabled={templateApplying}>
              {templateApplying ? "Applying..." : "Apply Template"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Save template dialog ──────────────────────────────────────────── */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Save Tags as Template</DialogTitle>
          </DialogHeader>
          <p className="text-[13px] text-muted-foreground">
            Save the {tagsDataRef.current?.length ?? 0} tags from{" "}
            <span className="font-medium text-foreground">{campaign.name}</span> as a reusable template.
          </p>
          <input
            type="text"
            placeholder="Template name"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSaveTemplate(); }}
            className="w-full h-9 px-3 text-[12px] rounded-md border border-input bg-background outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
            autoFocus
          />
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={() => setSaveDialogOpen(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveTemplate} disabled={!saveTemplateName.trim()}>Save Template</Button>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}
