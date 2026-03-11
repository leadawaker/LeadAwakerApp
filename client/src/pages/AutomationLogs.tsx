import React, { useMemo, useState, useEffect, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Link, useLocation } from "wouter";
import { CrmShell } from "@/components/crm/CrmShell";
import { apiFetch } from "@/lib/apiUtils";
import { ApiErrorFallback } from "@/components/crm/ApiErrorFallback";
import { useWorkspace } from "@/hooks/useWorkspace";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  RotateCcw,
  PlayCircle,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Filter,
  CalendarDays,
  Megaphone,
  RefreshCw,
  Check,
  Layers,
  List,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import { SearchPill } from "@/components/ui/search-pill";
import { ViewTabBar } from "@/components/ui/view-tab-bar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { IconBtn } from "@/components/ui/icon-btn";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  getLeadStatusAvatarColor,
  getCampaignAvatarColor,
  getAccountAvatarColor,
} from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { resolveAutomationType } from "@/features/automation/automationRegistry";
import { useExecutionGroups, type ExecutionGroup } from "@/features/automation/hooks/useExecutionGroups";
import { ExecutionProgressBar, getGradientColor } from "@/features/automation/components/ExecutionProgressBar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

// ── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<string, { color: string; icon: any }> = {
  success:  { color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50", icon: CheckCircle2 },
  failed:   { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
  skipped:  { color: "text-muted-foreground bg-muted/50 border-border", icon: AlertCircle },
  waiting:  { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50", icon: Clock },
  retrying: { color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50", icon: RotateCcw },
  started:  { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50", icon: PlayCircle },
  error:    { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50", icon: XCircle },
};

const STATUS_OPTIONS = [
  { value: "all", labelKey: "filters.allStatuses" },
  { value: "success", labelKey: "filters.success" },
  { value: "failed", labelKey: "filters.failed" },
];

// Icon-only status hex colors (inline style — avoids Tailwind purge issues)
const STATUS_ICON_HEX: Record<string, string> = {
  success:  "#10B981",
  failed:   "#F43F5E",
  skipped:  "#9CA3AF",
  waiting:  "#F59E0B",
  retrying: "#6366F1",
  started:  "#3B82F6",
  error:    "#F43F5E",
};

// Per-type label colors for automation sub-label
const AUTOMATION_TYPE_COLORS: Record<string, string> = {
  ai_conversation: "text-violet-600 dark:text-violet-400",
  inbound:         "text-teal-600 dark:text-teal-400",
  booking:         "text-emerald-600 dark:text-emerald-400",
  scheduler:       "text-slate-500 dark:text-slate-400",
  campaign:        "text-orange-600 dark:text-orange-400",
  analytics:       "text-cyan-600 dark:text-cyan-400",
  tasks:           "text-indigo-600 dark:text-indigo-400",
  messaging:       "text-sky-600 dark:text-sky-400",
  error_handler:   "text-rose-600 dark:text-rose-400",
  scoring:         "text-amber-600 dark:text-amber-400",
  generic:         "text-muted-foreground",
};

// ── Column definitions ───────────────────────────────────────────────────────
interface LogColumn { key: string; label: string; width: number; align?: "left" | "right" }

const COLUMNS_STEPS: LogColumn[] = [
  { key: "expand",    label: "",                    width: 36  },
  { key: "id",        label: "columns.id",          width: 44  },
  { key: "createdAt", label: "columns.createdAt",   width: 130 },
  { key: "status",    label: "",                    width: 36  },
  { key: "workflow",  label: "columns.workflow",    width: 185 },
  { key: "pipeline",  label: "columns.pipeline",    width: 240 },
  { key: "execTime",  label: "columns.execTime",    width: 70  },
  { key: "duration",  label: "columns.duration",    width: 65  },
  { key: "lead",      label: "columns.lead",        width: 160 },
  { key: "campaign",  label: "columns.campaign",    width: 150 },
  { key: "account",   label: "columns.account",     width: 150 },
];

const COLUMNS_EXECUTIONS: LogColumn[] = [
  { key: "id",        label: "columns.id",          width: 44  },
  { key: "createdAt", label: "columns.createdAt",   width: 130 },
  { key: "status",    label: "",                    width: 36  },
  { key: "workflow",  label: "columns.workflow",    width: 185 },
  { key: "pipeline",  label: "columns.pipeline",    width: 240 },
  { key: "lead",      label: "columns.lead",        width: 160 },
  { key: "campaign",  label: "columns.campaign",    width: 150 },
  { key: "account",   label: "columns.account",     width: 150 },
];

// ── Helpers ──────────────────────────────────────────────────────────────────
function formatExecutionTime(ms: number | null | undefined): string {
  if (ms == null) return "—";
  const num = Number(ms);
  if (isNaN(num)) return "—";
  if (num < 1000) return `${Math.round(num)}ms`;
  return `${(num / 1000).toFixed(2)}s`;
}

function formatDuration(seconds: number | null | undefined): string | null {
  if (seconds == null) return null;
  const num = Number(seconds);
  if (isNaN(num)) return null;
  return `${num.toFixed(1)}s`;
}

function formatJson(raw: string | null | undefined): string {
  if (!raw) return "";
  try { return JSON.stringify(JSON.parse(raw), null, 2); }
  catch { return raw; }
}

// ── getGroupCurrentStepIdx ────────────────────────────────────────────────────
function getGroupCurrentStepIdx(group: ExecutionGroup): number {
  const { steps, overallStatus } = group;
  if (overallStatus === "success") return steps.length - 1;
  const failedIdx = steps.findIndex(s => s.status === "failed" || s.status === "error");
  if (failedIdx >= 0) return failedIdx;
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].status !== "waiting") return i;
  }
  return 0;
}

// ── Mobile Execution Card ─────────────────────────────────────────────────────
function MobileExecutionCard({ group, idx, isAgencyView }: { group: ExecutionGroup; idx: number; isAgencyView: boolean }) {
  const { t } = useTranslation("automation");
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";
  const [expanded, setExpanded] = useState(false);

  const autoType = group.automationType;
  const status = group.overallStatus;

  // Determine current step index for the gradient bar
  const currentStepIdx = getGroupCurrentStepIdx(group);

  const iconStatus = status === "running" ? "started" : status === "partial" ? "started" : status;
  const config = STATUS_CONFIG[iconStatus] || STATUS_CONFIG.success;
  const StatusIcon = config.icon;
  const iconHex = STATUS_ICON_HEX[iconStatus] || "#9CA3AF";
  const isCritical = group.failedStep?.raw?.is_critical_error === true ||
    group.failedStep?.raw?.is_critical_error === 1;

  // Lead
  const leadName = getLeadName(group.lead) || group.leadName;
  const leadId = group.lead?.id || group.lead?.Id;
  const leadStatus = group.lead?.conversion_status || group.lead?.Conversion_Status || "";
  const leadAvatarColor = getLeadStatusAvatarColor(leadStatus);

  // Campaign
  const campaignName = group.campaign?.name || group.campaign?.Name || group.campaignName;
  const campaignId = group.campaign?.id || group.campaign?.Id;
  const stickerSlug = group.campaign?.campaign_sticker ?? null;
  const campaignSticker = stickerSlug
    ? CAMPAIGN_STICKERS.find((s: any) => s.slug === stickerSlug) ?? null
    : null;
  const campaignAvatarColor = getCampaignAvatarColor(group.campaign?.status || "");

  // Account
  const accountName = group.account?.name || group.account?.Name || group.accountName;
  const accountId = group.account?.id || group.account?.Id;
  const logoUrl = group.account?.logo_url || group.account?.logoUrl || null;
  const accountAvatarColor = getAccountAvatarColor(group.account?.status || "");

  const hasEntities = !!(leadName || campaignName || accountName);

  return (
    <div
      className={cn(
        "rounded-xl overflow-hidden animate-card-enter",
        isCritical ? "bg-red-500/5 border border-red-500/20" : "bg-card",
      )}
      style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
    >
      <button className="w-full px-3 pt-3 pb-2 flex flex-col gap-2 text-left" onClick={() => setExpanded(e => !e)}>
        {/* Row 1: status icon + workflow name + timestamp + chevron */}
        <div className="flex items-center gap-2">
          <StatusIcon className="h-4 w-4 shrink-0" style={{ color: iconHex }} />
          {isCritical && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
          <span className="text-[13px] font-semibold text-foreground truncate flex-1">{group.workflowName || "N/A"}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {group.latestTimestamp
              ? new Date(group.latestTimestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
              : ""}
          </span>
          {hasEntities && (
            <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200", expanded && "rotate-180")} />
          )}
        </div>
        {/* Row 2: type label + step count + total duration */}
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-medium", AUTOMATION_TYPE_COLORS[autoType.id] || "text-muted-foreground")}>
            {autoType.label}
          </span>
          <span className="text-[10px] text-muted-foreground">· {group.steps.length} steps</span>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono tabular-nums">
            {formatExecutionTime(group.totalDurationMs)}
          </span>
        </div>
        {/* Pipeline bar */}
        <ExecutionProgressBar steps={group.steps} currentStepIndex={currentStepIdx} automationTypeId={autoType.id} />
      </button>

      {/* Expanded entity details */}
      {expanded && hasEntities && (
        <div className="px-3 pb-3 space-y-2 border-t border-border/10 pt-2">
          {leadName && (
            <div className="flex items-center gap-2">
              <EntityAvatar name={leadName} bgColor={leadAvatarColor.bg} textColor={leadAvatarColor.text} size={28} />
              {leadId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); try { localStorage.setItem("selected-lead-id", String(leadId)); } catch {} navigate(`${base}/leads`); }}
                  className="text-[12px] font-medium text-foreground underline truncate text-left"
                >
                  {leadName}
                </button>
              ) : <span className="text-[12px] text-muted-foreground">{leadName}</span>}
            </div>
          )}
          {campaignName && (
            <div className="flex items-center gap-2">
              {campaignSticker
                ? <img src={campaignSticker.url} alt="" className="shrink-0 object-contain" style={{ width: 28, height: 28 }} />
                : <EntityAvatar name={campaignName} bgColor={campaignAvatarColor.bg} textColor={campaignAvatarColor.text} size={28} />}
              {campaignId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); try { localStorage.setItem("selected-campaign-id", String(campaignId)); } catch {} navigate(`${base}/campaigns`); }}
                  className="text-[12px] font-medium text-foreground underline truncate text-left"
                >
                  {campaignName}
                </button>
              ) : <span className="text-[12px] text-muted-foreground">{campaignName}</span>}
            </div>
          )}
          {accountName && (
            <div className="flex items-center gap-2">
              <EntityAvatar name={accountName} photoUrl={logoUrl} bgColor={accountAvatarColor.bg} textColor={accountAvatarColor.text} size={28} />
              {accountId ? (
                <button
                  onClick={(e) => { e.stopPropagation(); try { localStorage.setItem("selected-account-id", String(accountId)); } catch {} navigate(`${base}/accounts`); }}
                  className="text-[12px] font-medium text-foreground underline truncate text-left"
                >
                  {accountName}
                </button>
              ) : <span className="text-[12px] text-muted-foreground">{accountName}</span>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Skeleton ─────────────────────────────────────────────────────────────────
function LogsTableSkeleton() {
  return (
    <div className="p-3 space-y-1.5">
      <div className="h-8 bg-[#D1D1D1] rounded animate-pulse mb-2" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="h-[52px] bg-card/70 rounded-xl animate-pulse"
          style={{ animationDelay: `${i * 35}ms` }}
        />
      ))}
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────
function getLeadName(lead: any): string | null {
  if (!lead) return null;
  const first = lead.firstName || lead.first_name || "";
  const last = lead.lastName || lead.last_name || "";
  const full = [first, last].filter(Boolean).join(" ");
  return full || lead.name || lead.Name || lead.full_name || null;
}

export default function AutomationLogsPage() {
  const { t } = useTranslation("automation");
  const { currentAccountId, isAgencyView } = useWorkspace();
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";

  // ── Expand-on-hover button constants ─────────────────────────────────────
  const xBase    = "group inline-flex items-center h-9 pl-[9px] rounded-full border text-[12px] font-medium overflow-hidden shrink-0 transition-[max-width,color,border-color] duration-200 max-w-9";
  const xDefault = "border-black/[0.125] text-foreground/60 hover:text-foreground";
  const xActive  = "border-brand-indigo text-brand-indigo";
  const xSpan    = "whitespace-nowrap pl-1.5 pr-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150";

  const toolbarRef = useRef<HTMLDivElement>(null);

  // ── Filter state ─────────────────────────────────────────────────────────
  const [campaignId, setCampaignId] = useState<number | "all">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [page, setPage] = useState(0);
  const [mobilePage, setMobilePage] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [desktopViewMode, setDesktopViewMode] = useState<"steps" | "executions">("executions");

  // ── Data state ───────────────────────────────────────────────────────────
  const [automationLogs, setAutomationLogs] = useState<any[]>([]);
  const [allLeads, setAllLeads] = useState<any[]>([]);
  const [allAccounts, setAllAccounts] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [expandedRows, setExpandedRows] = useState<Set<string | number>>(new Set());

  const toggleRow = (id: string | number) => {
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ── Fetch ────────────────────────────────────────────────────────────────
  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (currentAccountId) params.set("accountId", String(currentAccountId));
      const qs = params.toString();

      const [logsRes, leadsRes, accountsRes, campaignsRes] = await Promise.all([
        apiFetch(qs ? `/api/automation-logs?${qs}` : "/api/automation-logs"),
        apiFetch(qs ? `/api/leads?${qs}` : "/api/leads"),
        apiFetch("/api/accounts"),
        apiFetch(qs ? `/api/campaigns?${qs}` : "/api/campaigns"),
      ]);

      if (!logsRes.ok) throw new Error(`${logsRes.status}: Failed to fetch automation logs`);

      const logsData      = await logsRes.json();
      const leadsData     = leadsRes.ok ? await leadsRes.json() : [];
      const accountsData  = accountsRes.ok ? await accountsRes.json() : [];
      const campaignsData = campaignsRes.ok ? await campaignsRes.json() : [];

      setAutomationLogs(Array.isArray(logsData) ? logsData : []);
      setAllLeads(Array.isArray(leadsData) ? leadsData : []);
      setAllAccounts(Array.isArray(accountsData) ? accountsData : []);
      setAllCampaigns(Array.isArray(campaignsData) ? campaignsData : []);
    } catch (err) {
      console.error("Failed to fetch automation logs data:", err);
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setLoading(false);
    }
  }, [currentAccountId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ── Filter + sort ────────────────────────────────────────────────────────
  const rows = useMemo(() => {
    return automationLogs
      .filter((r: any) => campaignId === "all" || (r.campaignId || r.campaignsId || r.campaign_id || r.campaigns_id || r.Campaigns_id) === campaignId)
      .filter((r: any) => {
        if (statusFilter === "all") return true;
        const raw = r.status || "";
        const norm = raw === "error" ? "failed" : raw;
        if (statusFilter === "success") return norm === "success";
        if (statusFilter === "failed") return norm === "failed" || raw === "error";
        return true;
      })
      .filter((r: any) => {
        if (!workflowFilter.trim()) return true;
        const name = (r.workflowName || r.workflow_name || "").toLowerCase();
        return name.includes(workflowFilter.trim().toLowerCase());
      })
      .filter((r: any) => {
        const rawDate = r.createdAt || r.created_at || r.CreatedAt;
        if (!rawDate) return true;
        const logDate = new Date(rawDate);
        if (dateFrom) { const from = new Date(dateFrom + "T00:00:00"); if (logDate < from) return false; }
        if (dateTo) { const to = new Date(dateTo + "T23:59:59.999"); if (logDate > to) return false; }
        return true;
      })
      .map((log: any) => {
        const leadId    = log.leadId || log.leadsId || log.lead_id || log.leads_id || log.Leads_id;
        const accountId = log.accountId || log.accountsId || log.account_id || log.accounts_id || log.Accounts_id;
        const campId    = log.campaignId || log.campaignsId || log.campaign_id || log.campaigns_id || log.Campaigns_id;
        const sId = (x: any) => x != null ? String(x) : null;
        return {
          ...log,
          lead:     leadId != null ? (allLeads.find((l: any) => sId(l.id ?? l.Id) === sId(leadId)) ?? null) : null,
          account:  accountId != null ? (allAccounts.find((a: any) => sId(a.id ?? a.Id) === sId(accountId)) ?? null) : null,
          campaign: campId != null ? (allCampaigns.find((c: any) => sId(c.id ?? c.Id) === sId(campId)) ?? null) : null,
        };
      })
      // Propagate campaign/account from sibling steps within same execution
      .reduce((acc: any[], row: any) => { acc.push(row); return acc; }, [] as any[])
      .map((row: any, _: number, all: any[]) => {
        if (row.campaign && row.account) return row;
        const execId = row.workflow_execution_id || row.workflowExecutionId;
        if (!execId) return row;
        const donor = all.find((s: any) =>
          (s.workflow_execution_id || s.workflowExecutionId) === execId &&
          s.campaign && s.account
        );
        if (!donor) return row;
        return { ...row, campaign: row.campaign ?? donor.campaign, account: row.account ?? donor.account };
      })
      .sort((a: any, b: any) => {
        const aDate = a.createdAt || a.created_at || a.CreatedAt || "";
        const bDate = b.createdAt || b.created_at || b.CreatedAt || "";
        return bDate.localeCompare(aDate);
      });
  }, [automationLogs, allLeads, allAccounts, allCampaigns, campaignId, statusFilter, workflowFilter, dateFrom, dateTo]);

  const pageSize = 100;
  const paginatedRows = rows.slice(page * pageSize, (page + 1) * pageSize);
  const totalPages = Math.ceil(rows.length / pageSize);

  // ── Execution groups (for progress bars + pipeline view) ───────────────
  const executionGroups = useExecutionGroups(rows);

  // ── Execution lookup for table progress bars ───────────────────────────
  const executionByRow = useMemo(() => {
    const map = new Map<string | number, typeof executionGroups[0]>();
    for (const group of executionGroups) {
      for (const step of group.steps) {
        map.set(step.id, group);
      }
    }
    return map;
  }, [executionGroups]);

  // ── Desktop executions pagination ────────────────────────────────────────
  const paginatedExecutionGroups = executionGroups.slice(page * pageSize, (page + 1) * pageSize);
  const executionsTotalPages = Math.ceil(executionGroups.length / pageSize);

  // ── Mobile execution groups pagination ───────────────────────────────────
  const mobilePageSize = 50;
  const paginatedGroups = useMemo(
    () => executionGroups.slice(mobilePage * mobilePageSize, (mobilePage + 1) * mobilePageSize),
    [executionGroups, mobilePage],
  );
  const totalMobilePages = Math.ceil(executionGroups.length / mobilePageSize);
  useEffect(() => { setMobilePage(0); }, [campaignId, statusFilter, workflowFilter, dateFrom, dateTo]);
  useEffect(() => { setPage(0); }, [desktopViewMode]);

  // ── Active filter count (for badge) ──────────────────────────────────────
  const activeFilterCount = [
    campaignId !== "all",
    statusFilter !== "all",
    !!dateFrom || !!dateTo,
    !!workflowFilter,
  ].filter(Boolean).length;

  // ── Campaign label for pill ──────────────────────────────────────────────
  const activeCampaignLabel = campaignId !== "all"
    ? (allCampaigns.find((c: any) => (c.id || c.Id) === campaignId)?.name || `#${campaignId}`)
    : undefined;

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <CrmShell>
      <div className="flex flex-col h-full" data-testid="page-automation-logs">
        <div className="flex-1 min-h-0 flex gap-[3px] overflow-hidden">
          <div className="flex flex-col bg-muted rounded-lg overflow-hidden flex-1 min-w-0">

            {/* ── Title + Toolbar (single row) ── */}
            <div ref={toolbarRef} className="pl-[17px] pr-3.5 pt-10 pb-3 shrink-0 flex items-center gap-3 overflow-x-auto [scrollbar-width:none]">
              <div className="flex items-center gap-2 shrink-0">
                <h2 className="text-2xl font-semibold font-heading text-foreground leading-tight">
                  {t("page.title")}
                </h2>
                <span className="h-5 px-1.5 rounded-full bg-foreground/10 flex items-center justify-center text-[10px] font-semibold tabular-nums text-muted-foreground shrink-0">
                  {rows.length}
                </span>
                {activeFilterCount > 0 && (
                  <span className="h-5 px-1.5 rounded-full bg-brand-indigo/15 flex items-center justify-center text-[10px] font-semibold text-brand-indigo shrink-0">
                    {t("toolbar.filterCount", { count: activeFilterCount })}
                  </span>
                )}
              </div>

              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

              <ViewTabBar
                variant="segment"
                tabs={[
                  { id: "executions", label: t("views.executions"), icon: Layers },
                  { id: "steps",      label: t("views.steps"),      icon: List  },
                ]}
                activeId={desktopViewMode}
                onTabChange={(id) => setDesktopViewMode(id as "steps" | "executions")}
              />

              <div className="w-px h-5 bg-border/40 mx-0.5 shrink-0" />

              {/* Search */}
              <SearchPill
                value={workflowFilter}
                onChange={(v) => { setWorkflowFilter(v); setPage(0); }}
                open={searchOpen}
                onOpenChange={setSearchOpen}
                placeholder={t("toolbar.searchPlaceholder")}
              />

              {/* Campaign filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[120px]", campaignId !== "all" ? xActive : xDefault)}>
                    <Megaphone className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.campaign")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-52 max-h-72 overflow-y-auto">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("filters.campaign")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => { setCampaignId("all"); setPage(0); }}
                    className={cn("text-[12px]", campaignId === "all" && "font-semibold text-brand-indigo")}
                  >
                    {t("filters.allCampaigns")}
                    {campaignId === "all" && <Check className="h-3 w-3 ml-auto" />}
                  </DropdownMenuItem>
                  {allCampaigns.map((c: any) => {
                    const cId = c.id || c.Id;
                    return (
                      <DropdownMenuItem
                        key={cId}
                        onClick={() => { setCampaignId(cId); setPage(0); }}
                        className={cn("text-[12px]", campaignId === cId && "font-semibold text-brand-indigo")}
                      >
                        {c.name || `Campaign ${cId}`}
                        {campaignId === cId && <Check className="h-3 w-3 ml-auto" />}
                      </DropdownMenuItem>
                    );
                  })}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Status filter */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[100px]", statusFilter !== "all" ? xActive : xDefault)}>
                    <Filter className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.status")}</span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-44">
                  <DropdownMenuLabel className="text-[10px] uppercase tracking-widest text-muted-foreground">
                    {t("filters.status")}
                  </DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  {STATUS_OPTIONS.map((opt) => (
                    <DropdownMenuItem
                      key={opt.value}
                      onClick={() => { setStatusFilter(opt.value); setPage(0); }}
                      className={cn("text-[12px]", statusFilter === opt.value && "font-semibold text-brand-indigo")}
                    >
                      {t(opt.labelKey)}
                      {statusFilter === opt.value && <Check className="h-3 w-3 ml-auto" />}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Date range filter */}
              <Popover>
                <PopoverTrigger asChild>
                  <button className={cn(xBase, "hover:max-w-[80px]", !!(dateFrom || dateTo) ? xActive : xDefault)}>
                    <CalendarDays className="h-4 w-4 shrink-0" />
                    <span className={xSpan}>{t("filters.date")}</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent align="start" className="w-72 p-3 space-y-3">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                    {t("filters.dateRange")}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{t("filters.from")}</label>
                      <input
                        type="date"
                        value={dateFrom}
                        onChange={(e) => { setDateFrom(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-medium text-muted-foreground">{t("filters.to")}</label>
                      <input
                        type="date"
                        value={dateTo}
                        onChange={(e) => { setDateTo(e.target.value); setPage(0); }}
                        className="w-full h-10 rounded-lg border border-border bg-card px-2 text-[12px] outline-none focus:ring-1 focus:ring-brand-indigo/30"
                      />
                    </div>
                  </div>
                  {(dateFrom || dateTo) && (
                    <button
                      onClick={() => { setDateFrom(""); setDateTo(""); setPage(0); }}
                      className="text-[11px] font-medium text-destructive hover:underline"
                    >
                      {t("filters.clearDateFilter")}
                    </button>
                  )}
                </PopoverContent>
              </Popover>

              {/* Spacer */}
              <div className="flex-1 min-w-0" />

              {/* Refresh */}
              <IconBtn onClick={fetchData} title={t("toolbar.refreshLogs")}>
                <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
              </IconBtn>
            </div>

            {/* ── Content ── */}
            {error && automationLogs.length === 0 && !loading ? (
              <div className="flex-1 min-h-0 flex items-center justify-center p-6">
                <ApiErrorFallback error={error} onRetry={fetchData} isRetrying={loading} />
              </div>
            ) : loading ? (
              <LogsTableSkeleton />
            ) : (
              <>
                {/* ── Mobile execution groups (< 768px) ── */}
                <div className="md:hidden flex-1 min-h-0 overflow-y-auto p-3 space-y-2" data-testid="mobile-logs-list">
                  {paginatedGroups.length === 0 ? (
                    <div className="py-12 flex items-center justify-center">
                      <DataEmptyState variant="automation" compact />
                    </div>
                  ) : (
                    <>
                      {paginatedGroups.map((group, idx) => (
                        <MobileExecutionCard
                          key={group.executionId}
                          group={group}
                          idx={idx}
                          isAgencyView={isAgencyView}
                        />
                      ))}
                      {totalMobilePages > 1 && (
                        <div className="flex items-center justify-center gap-1 py-2">
                          {Array.from({ length: totalMobilePages }).map((_, i) => (
                            <button
                              key={i}
                              onClick={() => setMobilePage(i)}
                              className={cn(
                                "h-8 min-w-[32px] px-2 rounded-full text-[12px] font-semibold",
                                mobilePage === i
                                  ? "bg-brand-indigo text-white"
                                  : "text-muted-foreground hover:bg-card hover:text-foreground",
                              )}
                            >
                              {i + 1}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ── Desktop table (>= 768px) ── */}
                <div className="hidden md:flex flex-1 min-h-0 overflow-hidden flex-col">
                <div className="flex-1 min-h-0 overflow-auto" data-testid="table-logs">
                  <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1260 }}>

                    {/* ── Sticky header ── */}
                    <thead className="sticky top-0 z-20">
                      <tr>
                        {(desktopViewMode === "steps" ? COLUMNS_STEPS : COLUMNS_EXECUTIONS).map((col) => (
                          <th
                            key={col.key}
                            className={cn(
                              "px-3 py-2 text-[10px] font-bold uppercase tracking-wider text-foreground/50 whitespace-nowrap select-none bg-muted border-b border-border/20",
                              col.align === "right" ? "text-right" : "text-left",
                            )}
                            style={{ width: col.width, minWidth: col.width }}
                          >
                            {col.label ? t(col.label) : ""}
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody>
                      {desktopViewMode === "executions" ? (
                        <>
                          {paginatedExecutionGroups.length === 0 && (
                            <tr>
                              <td colSpan={COLUMNS_EXECUTIONS.length} className="py-12">
                                <DataEmptyState variant="automation" compact />
                              </td>
                            </tr>
                          )}
                          {paginatedExecutionGroups.map((group, idx) => {
                            const iconStatus = group.overallStatus === "running" || group.overallStatus === "partial" ? "started" : group.overallStatus;
                            const config = STATUS_CONFIG[iconStatus] || STATUS_CONFIG.success;
                            const ExecStatusIcon = config.icon;
                            const iconHex = STATUS_ICON_HEX[iconStatus] || "#9CA3AF";
                            const isCritical = group.failedStep?.raw?.is_critical_error === true || group.failedStep?.raw?.is_critical_error === 1;
                            const currentStepIdx = getGroupCurrentStepIdx(group);
                            const autoType = group.automationType;
                            const leadName = getLeadName(group.lead) || group.leadName;
                            const leadId = group.lead?.id || group.lead?.Id;
                            const leadStatus = group.lead?.conversion_status || group.lead?.Conversion_Status || "";
                            const leadAvatarColor = getLeadStatusAvatarColor(leadStatus);
                            const campaignName = group.campaign?.name || group.campaign?.Name || group.campaignName;
                            const campaignId = group.campaign?.id || group.campaign?.Id;
                            const stickerSlug = group.campaign?.campaign_sticker ?? null;
                            const campaignSticker = stickerSlug ? CAMPAIGN_STICKERS.find((s: any) => s.slug === stickerSlug) ?? null : null;
                            const campaignAvatarColor = getCampaignAvatarColor(group.campaign?.status || "");
                            const campaignAvatarEl = campaignSticker ? (
                              <img src={campaignSticker.url} alt="" className="shrink-0 object-contain" style={{ width: 28, height: 28 }} />
                            ) : campaignName ? (
                              <EntityAvatar name={campaignName} bgColor={campaignAvatarColor.bg} textColor={campaignAvatarColor.text} size={28} />
                            ) : null;
                            const accountName = group.account?.name || group.account?.Name || group.accountName;
                            const accountId = group.account?.id || group.account?.Id;
                            const logoUrl = group.account?.logo_url || group.account?.logoUrl || null;
                            const accountAvatarColor = getAccountAvatarColor(group.account?.status || "");
                            return (
                              <tr
                                key={group.executionId}
                                className={cn(
                                  "h-[52px] border-b border-border/15 animate-card-enter",
                                  isCritical
                                    ? "bg-red-500/5 hover:bg-red-500/10 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                    : "bg-card hover:bg-card-hover",
                                )}
                                style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
                              >
                                  <td className="px-3" style={{ width: 44 }}>
                                    <span className="text-[11px] font-mono text-muted-foreground/60 tabular-nums">
                                      {page * pageSize + idx + 1}
                                    </span>
                                  </td>
                                  <td className="px-3" style={{ width: 130 }}>
                                    <span className="text-[11px] text-muted-foreground">
                                      {group.latestTimestamp
                                        ? new Date(group.latestTimestamp).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })
                                        : "N/A"}
                                    </span>
                                  </td>
                                  <td className="px-2 text-center" style={{ width: 36 }}>
                                    <ExecStatusIcon className="h-4 w-4" style={{ color: iconHex }} />
                                  </td>
                                  <td className="px-3" style={{ width: 185, minWidth: 185 }}>
                                    <div className="flex items-center gap-2 min-w-0">
                                      {isCritical && <AlertTriangle className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0" />}
                                      <div className="min-w-0">
                                        <span className="text-[13px] font-medium text-foreground truncate block" title={group.workflowName || "N/A"}>
                                          {group.workflowName || "N/A"}
                                        </span>
                                        <span className={cn("text-[10px] font-medium truncate block", AUTOMATION_TYPE_COLORS[autoType.id] || "text-muted-foreground")}>
                                          {autoType.label}
                                        </span>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="px-3" style={{ width: 240, minWidth: 240 }}>
                                    {group.steps.length === 1 ? (
                                      <div>
                                        <ExecutionProgressBar steps={group.steps} compact currentStepIndex={currentStepIdx} automationTypeId={autoType.id} />
                                        <span
                                          className="text-[10px] font-medium mt-0.5 block truncate text-foreground"
                                          title={group.steps[0].stepName}
                                        >
                                          {group.steps[0].stepName}
                                          {group.steps[0].executionTimeMs != null && (
                                            <span className="text-muted-foreground font-mono ml-1">{formatExecutionTime(group.steps[0].executionTimeMs)}</span>
                                          )}
                                        </span>
                                      </div>
                                    ) : (
                                      <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                          <TooltipTrigger asChild>
                                            <div className="cursor-default">
                                              <ExecutionProgressBar steps={group.steps} compact currentStepIndex={currentStepIdx} automationTypeId={autoType.id} />
                                              <span className="text-[10px] text-muted-foreground mt-0.5 block tabular-nums font-mono">
                                                {group.steps.length} steps · {formatExecutionTime(group.totalDurationMs)}
                                              </span>
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" align="start" className="p-2 space-y-0.5 max-w-xs">
                                            {group.steps.map((step, si) => {
                                              const isFuture = si > currentStepIdx;
                                              return (
                                                <div key={si} className={cn("flex items-center gap-2 text-[11px]", isFuture && "opacity-40")}>
                                                  <span style={{ color: isFuture ? "#9CA3AF" : getGradientColor(si, group.steps.length, autoType.id) }} className="shrink-0">●</span>
                                                  <span className={cn(si === currentStepIdx ? "font-semibold" : "")}>{step.stepName}</span>
                                                  <span className="text-muted-foreground ml-2 tabular-nums font-mono shrink-0">
                                                    {formatExecutionTime(step.executionTimeMs)}
                                                  </span>
                                                </div>
                                              );
                                            })}
                                          </TooltipContent>
                                        </Tooltip>
                                      </TooltipProvider>
                                    )}
                                  </td>
                                  <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {leadName && <EntityAvatar name={leadName} bgColor={leadAvatarColor.bg} textColor={leadAvatarColor.text} size={28} />}
                                      {leadName && leadId ? (
                                        <button
                                          onClick={() => { try { localStorage.setItem("selected-lead-id", String(leadId)); } catch {} navigate(`${base}/leads`); }}
                                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                                        >
                                          {leadName}
                                        </button>
                                      ) : leadName ? (
                                        <span className="text-[12px] text-muted-foreground truncate">{leadName}</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {campaignAvatarEl}
                                      {campaignName && campaignId ? (
                                        <button
                                          onClick={() => { try { localStorage.setItem("selected-campaign-id", String(campaignId)); } catch {} navigate(`${base}/campaigns`); }}
                                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                                        >
                                          {campaignName}
                                        </button>
                                      ) : campaignName ? (
                                        <span className="text-[12px] text-muted-foreground truncate">{campaignName}</span>
                                      ) : null}
                                    </div>
                                  </td>
                                  <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {accountName && <EntityAvatar name={accountName} photoUrl={logoUrl} bgColor={accountAvatarColor.bg} textColor={accountAvatarColor.text} size={28} />}
                                      {accountName && accountId ? (
                                        <button
                                          onClick={() => { try { localStorage.setItem("selected-account-id", String(accountId)); } catch {} navigate(`${base}/accounts`); }}
                                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                                        >
                                          {accountName}
                                        </button>
                                      ) : accountName ? (
                                        <span className="text-[12px] text-muted-foreground truncate">{accountName}</span>
                                      ) : null}
                                    </div>
                                  </td>
                              </tr>
                            );
                          })}
                        </>
                      ) : (
                        <>
                          {/* Empty state */}
                          {paginatedRows.length === 0 && (
                            <tr>
                              <td colSpan={COLUMNS_STEPS.length} className="py-12">
                                <DataEmptyState variant="automation" compact />
                              </td>
                            </tr>
                          )}

                          {paginatedRows.map((r: any, idx: number) => {
                            const status = r.status === "error" ? "failed" : r.status;
                            const config = STATUS_CONFIG[status] || STATUS_CONFIG.success;
                            const StatusIcon = config.icon;
                            const isCritical = r.is_critical_error === true || r.is_critical_error === 1 || r.is_critical_error === "true";
                            const isFailed = status === "failed";
                            const rowId: string | number = r.id ?? r.Id ?? idx;
                            const isExpanded = expandedRows.has(rowId);

                            const errorCode: string | null = r.errorCode || r.error_code || null;
                            const inputData: string | null = r.inputData || r.input_data || null;
                            const outputData: string | null = r.outputData || r.output_data || null;

                            return (
                              <React.Fragment key={rowId}>
                                {/* ── Data row ── */}
                                <tr
                                  data-testid={isCritical ? "row-critical-error" : "row-log"}
                                  className={cn(
                                    "h-[52px] border-b border-border/15 animate-card-enter",
                                    isCritical
                                      ? "bg-red-500/5 hover:bg-red-500/10 dark:bg-red-950/20 dark:hover:bg-red-950/30"
                                      : "bg-card hover:bg-card-hover",
                                  )}
                                  style={{ animationDelay: `${Math.min(idx, 15) * 30}ms` }}
                                >
                                  {/* Expand toggle */}
                                  <td className="px-1" style={{ width: 36 }}>
                                    {isFailed && (
                                      <button
                                        onClick={() => toggleRow(rowId)}
                                        className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                                        data-testid="btn-expand-log"
                                        aria-label={isExpanded ? t("detail.collapseError") : t("detail.expandError")}
                                        aria-expanded={isExpanded}
                                      >
                                        {isExpanded
                                          ? <ChevronDown className="h-4 w-4" />
                                          : <ChevronRight className="h-4 w-4" />}
                                      </button>
                                    )}
                                  </td>

                                  {/* ID */}
                                  <td className="px-3" style={{ width: 44 }}>
                                    <span className="text-[11px] font-mono text-muted-foreground/60 tabular-nums">
                                      {page * pageSize + idx + 1}
                                    </span>
                                  </td>

                                  {/* Created At */}
                                  <td className="px-3" style={{ width: 130 }}>
                                    <span className="text-[11px] text-muted-foreground">
                                      {(r.createdAt || r.created_at || r.CreatedAt)
                                        ? new Date(r.createdAt || r.created_at || r.CreatedAt).toLocaleString([], {
                                            month: "short",
                                            day: "numeric",
                                            hour: "numeric",
                                            minute: "2-digit",
                                          })
                                        : "N/A"}
                                    </span>
                                  </td>

                                  {/* Status icon */}
                                  <td className="px-2 text-center" style={{ width: 36 }}>
                                    <StatusIcon
                                      className="h-4 w-4"
                                      style={{ color: STATUS_ICON_HEX[status] || "#9CA3AF" }}
                                      data-testid="icon-status-inline"
                                    />
                                  </td>

                                  {/* Workflow — type label colored */}
                                  <td className="px-3" style={{ width: 185, minWidth: 185 }}>
                                    {(() => {
                                      const wfName = r.workflowName || r.workflow_name || "N/A";
                                      const autoType = resolveAutomationType(wfName);
                                      return (
                                        <div className="flex items-center gap-2 min-w-0">
                                          {isCritical && (
                                            <AlertTriangle
                                              className="h-4 w-4 text-red-500 dark:text-red-400 shrink-0"
                                              data-testid="icon-critical-error"
                                              aria-label={t("detail.criticalError")}
                                            />
                                          )}
                                          <div className="min-w-0">
                                            <span
                                              className="text-[13px] font-medium text-foreground truncate block"
                                              title={wfName}
                                            >
                                              {wfName}
                                            </span>
                                            <span className={cn("text-[10px] font-medium truncate block", AUTOMATION_TYPE_COLORS[autoType.id] || "text-muted-foreground")}>
                                              {autoType.label}
                                            </span>
                                          </div>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Pipeline (step name below bar, no Popover) */}
                                  <td className="px-3" style={{ width: 240, minWidth: 240 }}>
                                    {(() => {
                                      const group = executionByRow.get(r.id);
                                      if (!group) return <span className="text-muted-foreground/30">—</span>;
                                      const currentStepIdx = group.steps.findIndex((s: any) => s.id === r.id);
                                      const stepColor = currentStepIdx >= 0
                                        ? getGradientColor(currentStepIdx, group.steps.length, group.automationType.id)
                                        : "#9CA3AF";
                                      return (
                                        <div>
                                          <ExecutionProgressBar
                                            steps={group.steps}
                                            compact
                                            currentStepIndex={currentStepIdx >= 0 ? currentStepIdx : undefined}
                                            automationTypeId={group.automationType.id}
                                          />
                                          <span
                                            className="text-[10px] font-medium mt-0.5 block truncate"
                                            style={{ color: stepColor }}
                                            title={r.stepName || r.step_name}
                                          >
                                            {r.stepName || r.step_name || "—"}
                                          </span>
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Exec Time */}
                                  <td className="px-3" style={{ width: 70 }} data-testid="cell-exec-time">
                                    <span className={cn(
                                      "text-[11px] font-mono",
                                      (r.executionTimeMs ?? r.execution_time_ms) != null ? "text-foreground" : "text-muted-foreground/50",
                                    )}>
                                      {formatExecutionTime(r.executionTimeMs ?? r.execution_time_ms)}
                                    </span>
                                  </td>

                                  {/* Duration */}
                                  <td className="px-3" style={{ width: 65 }} data-testid="cell-duration">
                                    {(() => {
                                      const dur = r.durationSeconds ?? r.duration_seconds ?? ((r.executionTimeMs ?? r.execution_time_ms) != null ? (r.executionTimeMs ?? r.execution_time_ms) / 1000 : null);
                                      return (
                                        <span className={cn(
                                          "text-[11px] font-mono",
                                          dur != null ? "text-foreground" : "text-muted-foreground/50",
                                        )}>
                                          {formatDuration(dur) ?? "—"}
                                        </span>
                                      );
                                    })()}
                                  </td>

                                  {/* Lead — initials avatar + underlined black text */}
                                  <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                                    {(() => {
                                      const name = getLeadName(r.lead) || r.leadName || r.lead_name;
                                      const id = r.lead?.id || r.lead?.Id || r.leadsId;
                                      const leadStatus = r.lead?.conversion_status || r.lead?.Conversion_Status || r.lead?.pipelineStatus || r.lead?.pipeline_status || "";
                                      const avatarColor = getLeadStatusAvatarColor(leadStatus);
                                      return (
                                        <div className="flex items-center gap-1.5 min-w-0">
                                          {name && (
                                            <EntityAvatar name={name} bgColor={avatarColor.bg} textColor={avatarColor.text} size={28} />
                                          )}
                                          {name && id ? (
                                            <button
                                              onClick={() => {
                                                try { localStorage.setItem("selected-lead-id", String(id)); } catch {}
                                                navigate(`${base}/leads`);
                                              }}
                                              className="text-[12px] font-medium text-foreground underline truncate text-left"
                                            >
                                              {name}
                                            </button>
                                          ) : name ? (
                                            <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                                          ) : null}
                                        </div>
                                      );
                                    })()}
                                  </td>

                                  {/* Campaign — sticker or initials avatar + underlined black text */}
                                  <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                                    {(() => {
                                      const name = r.campaign?.name || r.campaign?.Name || r.campaignName || r.campaign_name;
                                      const id = r.campaign?.id || r.campaign?.Id || r.campaignsId;
                                      const stickerSlug = r.campaign?.campaign_sticker ?? null;
                                      const campaignSticker = stickerSlug
                                        ? CAMPAIGN_STICKERS.find((s: any) => s.slug === stickerSlug) ?? null
                                        : null;
                                      const avatarColor = getCampaignAvatarColor(r.campaign?.status || "");
                                      const avatarEl = campaignSticker ? (
                                        <img src={campaignSticker.url} alt="" className="shrink-0 object-contain" style={{ width: 28, height: 28 }} />
                                      ) : name ? (
                                        <EntityAvatar name={name} bgColor={avatarColor.bg} textColor={avatarColor.text} size={28} />
                                  ) : null;
                                  return (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {avatarEl}
                                      {name && id ? (
                                        <button
                                          onClick={() => {
                                            try { localStorage.setItem("selected-campaign-id", String(id)); } catch {}
                                            navigate(`${base}/campaigns`);
                                          }}
                                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                                        >
                                          {name}
                                        </button>
                                      ) : name ? (
                                        <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </td>

                              {/* Account — photo/initials avatar + underlined black text */}
                              <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                                {(() => {
                                  const name = r.account?.name || r.account?.Name || r.accountName || r.account_name;
                                  const id = r.account?.id || r.account?.Id || r.accountsId;
                                  const logoUrl = r.account?.logo_url || r.account?.logoUrl || null;
                                  const avatarColor = getAccountAvatarColor(r.account?.status || "");
                                  return (
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      {name && (
                                        <EntityAvatar name={name} photoUrl={logoUrl} bgColor={avatarColor.bg} textColor={avatarColor.text} size={28} />
                                      )}
                                      {name && id ? (
                                        <button
                                          onClick={() => {
                                            try { localStorage.setItem("selected-account-id", String(id)); } catch {}
                                            navigate(`${base}/accounts`);
                                          }}
                                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                                        >
                                          {name}
                                        </button>
                                      ) : name ? (
                                        <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                                      ) : null}
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>

                            {/* ── Error expansion row ── */}
                            {isFailed && isExpanded && (
                              <tr>
                                <td
                                  colSpan={COLUMNS_STEPS.length}
                                  className="bg-muted/40 border-b border-border/30"
                                  data-testid="log-error-detail"
                                >
                                  <div className="px-8 py-4 space-y-3">
                                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                                      {t("detail.errorDetails")}
                                    </div>

                                    {errorCode && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          {t("detail.errorCode")}
                                        </div>
                                        <div
                                          data-testid="error-code"
                                          className="inline-flex items-center gap-1.5 text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-500/8 px-3 py-1.5 rounded-lg border border-rose-500/20"
                                        >
                                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                                          {errorCode}
                                        </div>
                                      </div>
                                    )}

                                    {inputData && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          {t("detail.inputData")}
                                        </div>
                                        <pre
                                          data-testid="input-data"
                                          className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all"
                                        >
                                          {formatJson(inputData)}
                                        </pre>
                                      </div>
                                    )}

                                    {outputData && (
                                      <div>
                                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                                          {t("detail.outputData")}
                                        </div>
                                        <pre
                                          data-testid="output-data"
                                          className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all"
                                        >
                                          {formatJson(outputData)}
                                        </pre>
                                      </div>
                                    )}

                                    {!errorCode && !inputData && !outputData && (
                                      <div className="text-sm text-muted-foreground italic">
                                        {t("detail.noErrorDetails")}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                          })}
                        </>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* ── Pagination ── */}
                {(desktopViewMode === "executions" ? executionsTotalPages : totalPages) > 1 && (
                  <div className="shrink-0 border-t border-border/20 bg-muted px-3 py-2 flex items-center justify-center gap-1">
                    {Array.from({ length: desktopViewMode === "executions" ? executionsTotalPages : totalPages }).map((_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        className={cn(
                          "h-8 min-w-[32px] px-2 rounded-full text-[12px] font-semibold",
                          page === i
                            ? "bg-brand-indigo text-white"
                            : "text-muted-foreground hover:bg-card hover:text-foreground",
                        )}
                      >
                        {i + 1}
                      </button>
                    ))}
                  </div>
                )}
                </div>{/* end desktop table wrapper */}
              </>
            )}

          </div>
        </div>
      </div>
    </CrmShell>
  );
}
