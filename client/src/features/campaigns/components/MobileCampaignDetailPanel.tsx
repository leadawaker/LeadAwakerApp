import { useState, useMemo, useEffect, useRef, type ComponentType } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { ChevronLeft, Tag, Calendar, Zap, Users, BarChart2 } from "lucide-react";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { useCampaignTags } from "../hooks/useCampaignTags";
import { CAMPAIGN_STATUS_HEX } from "@/lib/avatarUtils";
import { resolveColor } from "@/features/tags/types";

/* ── Types ─────────────────────────────────────────────────────────────────── */
type TabId = "summary" | "config" | "tags";

interface MobileCampaignDetailPanelProps {
  campaign: Campaign | null;
  metrics: CampaignMetricsHistory[];
  open: boolean;
  onBack: () => void;
}

/* ── Helpers ────────────────────────────────────────────────────────────────── */
function formatDate(s: string | null | undefined): string {
  if (!s) return "—";
  try {
    return new Date(s).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
  } catch {
    return s;
  }
}

/* ── Summary Tab ──────────────────────────────────────────────────────────── */
function SummaryTab({ campaign }: { campaign: Campaign; metrics: CampaignMetricsHistory[] }) {
  const { t } = useTranslation("campaigns");

  const leads = Number(campaign.total_leads_targeted ?? 0);
  const messages = Number(campaign.total_messages_sent ?? 0);
  const responseRate = Number(campaign.response_rate_percent ?? 0);
  const bookings = Number(campaign.bookings_generated ?? 0);
  const statusHex = CAMPAIGN_STATUS_HEX[String(campaign.status)] || "#6B7280";

  const roiPercent = Number(campaign.roi_percent ?? 0);
  const estRevenue = Number(campaign.value_per_booking ?? 0) * Number(campaign.bookings_generated ?? 0);

  const metricCards: { label: string; value: string; icon: ComponentType<{ className?: string }>; testid: string }[] = [
    { label: t("panel.metrics.leads"),        value: leads > 0        ? leads.toLocaleString()      : "—", icon: Users,    testid: "campaign-metric-leads" },
    { label: t("panel.metrics.messages"),     value: messages > 0     ? messages.toLocaleString()   : "—", icon: Zap,      testid: "campaign-metric-messages" },
    { label: t("panel.metrics.responseRate"), value: responseRate > 0 ? `${responseRate}%`           : "—", icon: BarChart2,testid: "campaign-metric-response-rate" },
    { label: t("panel.metrics.bookings"),     value: bookings > 0     ? bookings.toLocaleString()   : "—", icon: Calendar, testid: "campaign-metric-booked-calls" },
  ];

  return (
    <div className="p-4 space-y-4" data-testid="campaign-summary-tab">
      {/* Status row */}
      <div className="flex items-center gap-2 px-1" data-testid="campaign-summary-status">
        <span
          className="w-2 h-2 rounded-full shrink-0"
          style={{ backgroundColor: statusHex }}
        />
        <span className="text-sm font-medium text-foreground">
          {t(`statusLabels.${String(campaign.status)}`, String(campaign.status))}
        </span>
        {campaign.account_name && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-sm text-muted-foreground truncate">{campaign.account_name}</span>
          </>
        )}
      </div>

      {/* Metric cards grid */}
      <div className="grid grid-cols-2 gap-2" data-testid="campaign-summary-metrics">
        {metricCards.map(({ label, value, icon: Icon, testid }) => (
          <div
            key={label}
            data-testid={testid}
            className="bg-card rounded-2xl p-3.5 flex flex-col gap-1 border border-border/30"
          >
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="text-[11px] font-medium uppercase tracking-wide truncate">{label}</span>
            </div>
            <span className="text-[22px] font-bold tabular-nums text-foreground leading-tight">{value}</span>
          </div>
        ))}
      </div>

      {/* Start / End dates */}
      <div className="bg-card rounded-2xl border border-border/30 overflow-hidden" data-testid="campaign-summary-dates">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
          <span className="text-[13px] text-muted-foreground shrink-0">{t("panel.startDate")}</span>
          <span className="text-[13px] font-medium text-foreground" data-testid="campaign-summary-start-date">
            {formatDate(campaign.start_date)}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <span className="text-[13px] text-muted-foreground shrink-0">{t("panel.endDate")}</span>
          <span className="text-[13px] font-medium text-foreground" data-testid="campaign-summary-end-date">
            {formatDate(campaign.end_date)}
          </span>
        </div>
      </div>

      {/* Mini financials */}
      {(Number(campaign.roi_percent) !== 0 || Number(campaign.value_per_booking) > 0) && (
        <div className="bg-card rounded-2xl border border-border/30 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
            <span className="text-[13px] text-muted-foreground shrink-0">ROI</span>
            <span
              className={cn(
                "text-[13px] font-semibold tabular-nums",
                roiPercent >= 100
                  ? "text-emerald-600 dark:text-emerald-400"
                  : roiPercent >= 0
                    ? "text-blue-600 dark:text-blue-400"
                    : "text-rose-600 dark:text-rose-400"
              )}
            >
              {roiPercent != null ? `${roiPercent >= 0 ? "+" : ""}${roiPercent.toFixed(0)}%` : "—"}
            </span>
          </div>
          {estRevenue > 0 && (
            <div className="flex items-center justify-between px-4 py-3">
              <span className="text-[13px] text-muted-foreground shrink-0">Est. Revenue</span>
              <span className="text-[13px] font-semibold text-foreground tabular-nums">
                ${estRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          )}
        </div>
      )}

      {/* Description */}
      {campaign.description && (
        <div className="bg-card rounded-2xl p-4 border border-border/30">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2">
            {t("config.description")}
          </p>
          <p className="text-sm text-foreground/80 leading-relaxed">{campaign.description}</p>
        </div>
      )}
    </div>
  );
}

/* ── Config Tab ───────────────────────────────────────────────────────────── */
function ConfigTab({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");

  const rows: { label: string; value: string | null; testid?: string }[] = [
    { label: t("config.type"),        value: campaign.type || "—",        testid: "campaign-config-type" },
    { label: t("columns.account"),    value: campaign.account_name || "—", testid: "campaign-config-account" },
    { label: t("config.channel"),     value: campaign.channel || "WhatsApp", testid: "campaign-config-channel" },
    { label: t("config.startDate"),   value: formatDate(campaign.start_date), testid: "campaign-config-start-date" },
    { label: t("config.endDate"),     value: formatDate(campaign.end_date),   testid: "campaign-config-end-date" },
    { label: t("config.activeHours"), value: (campaign.active_hours_start && campaign.active_hours_end) ? `${campaign.active_hours_start} – ${campaign.active_hours_end}` : "—", testid: "campaign-config-active-hours" },
    { label: t("config.dailyLimit"),  value: campaign.daily_lead_limit ? `${campaign.daily_lead_limit} leads/day` : "—", testid: "campaign-config-daily-limit" },
    { label: t("config.interval"),    value: campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : "—", testid: "campaign-config-interval" },
    { label: t("config.stopOnResponse"), value: campaign.stop_on_response ? t("common.yes", "Yes") : t("common.no", "No"), testid: "campaign-config-stop-on-response" },
    { label: t("config.useAiBumps"),  value: campaign.use_ai_bumps ? t("common.yes", "Yes") : t("common.no", "No"), testid: "campaign-config-use-ai-bumps" },
    { label: t("config.maxBumps"),    value: campaign.max_bumps != null ? String(campaign.max_bumps) : "—", testid: "campaign-config-max-bumps" },
    { label: t("config.model"),       value: campaign.ai_model || "—", testid: "campaign-config-ai-model" },
  ];

  return (
    <div className="p-4 space-y-3" data-testid="campaign-config-tab">
      {/* Settings field list */}
      <div className="bg-card rounded-2xl border border-border/30 overflow-hidden" data-testid="campaign-config-settings">
        {rows.map(({ label, value, testid }, i) => (
          <div
            key={label}
            data-testid={testid}
            className={cn(
              "flex items-center justify-between px-4 py-3 gap-3",
              i < rows.length - 1 && "border-b border-border/20"
            )}
          >
            <span className="text-[13px] text-muted-foreground shrink-0">{label}</span>
            <span className="text-[13px] font-medium text-foreground text-right truncate max-w-[60%]">{value || "—"}</span>
          </div>
        ))}
      </div>

      {/* AI Prompt template */}
      {campaign.ai_prompt_template && (
        <div className="bg-card rounded-2xl p-4 border border-border/30" data-testid="campaign-config-ai-prompt">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("config.promptTemplate")}
            </p>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-8">
            {campaign.ai_prompt_template}
          </p>
        </div>
      )}

      {/* First message template preview */}
      {campaign.first_message_template && (
        <div className="bg-card rounded-2xl p-4 border border-border/30" data-testid="campaign-config-first-message">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="h-3.5 w-3.5 text-muted-foreground" />
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
              {t("config.firstMessage")}
            </p>
          </div>
          <p className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap line-clamp-6">
            {campaign.first_message_template}
          </p>
        </div>
      )}
    </div>
  );
}

/* ── Tags Tab ─────────────────────────────────────────────────────────────── */
function TagsTab({ campaign }: { campaign: Campaign }) {
  const { t } = useTranslation("campaigns");
  const campaignId = campaign.id || (campaign as any).Id || 0;
  const campaignName = String(campaign.name || "");

  const { tags, tagCounts, loading, error } = useCampaignTags(campaignId, campaignName);

  // Group tags by category — must be before any conditional returns (Rules of Hooks)
  const grouped = useMemo(() => {
    const map = new Map<string, typeof tags>();
    tags.forEach((tag) => {
      const cat = tag.category || "—";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(tag);
    });
    return Array.from(map.entries()).sort(([a], [b]) => a.localeCompare(b));
  }, [tags]);

  if (loading) {
    return (
      <div className="p-4 flex items-center justify-center py-16">
        <div className="text-sm text-muted-foreground">{t("tags.loadingTags")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 flex items-center justify-center py-16">
        <div className="text-sm text-destructive">{t("tags.failedToLoadTags")}</div>
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="p-4 flex flex-col items-center justify-center py-16 text-center gap-3">
        <Tag className="h-10 w-10 text-muted-foreground/30" />
        <div>
          <p className="text-sm font-medium text-muted-foreground">{t("tags.noTagsYet")}</p>
          <p className="text-xs text-muted-foreground/60 mt-1">{t("tags.createTagsDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 space-y-4">
      {grouped.map(([category, catTags]) => (
        <div key={category}>
          {category !== "—" && (
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-2 px-1">
              {category}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            {catTags.map((tag) => {
              const hexColor = resolveColor(tag.color);
              return (
                <div
                  key={tag.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[13px] font-medium bg-muted text-foreground/80"
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: hexColor }}
                  />
                  {tag.name}
                  {(tagCounts.get(tag.name) ?? 0) > 0 && (
                    <span className="opacity-50 text-[11px]">({tagCounts.get(tag.name)})</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ── Main Panel Component ─────────────────────────────────────────────────── */
export function MobileCampaignDetailPanel({
  campaign,
  metrics,
  open,
  onBack,
}: MobileCampaignDetailPanelProps) {
  const { t } = useTranslation("campaigns");
  const [activeTab, setActiveTab] = useState<TabId>("summary");
  const [mounted, setMounted] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setMounted(true); }, []);

  // Reset scroll state when panel opens/closes
  useEffect(() => {
    if (!open) setIsScrolled(false);
  }, [open]);

  // Glassmorphism blur: activate backdrop-filter when content is scrolled
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setIsScrolled(el.scrollTop > 2);
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  });

  const tabs: { id: TabId; label: string }[] = [
    { id: "summary", label: t("tabs.summary") },
    { id: "config",  label: t("tabs.configurations") },
    { id: "tags",    label: t("tabs.tags") },
  ];

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && campaign && (
        <motion.div
          key="mobile-campaign-panel"
          variants={{
            initial: { x: "100%" },
            animate: { x: 0, transition: { type: "tween", duration: 0.3, ease: [0.0, 0.0, 0.2, 1] } },
            exit:    { x: "100%", transition: { type: "tween", duration: 0.3, ease: [0.4, 0.0, 1, 1] } },
          }}
          initial="initial"
          animate="animate"
          exit="exit"
          data-testid="mobile-campaign-detail-panel"
          className="md:hidden fixed inset-0 z-[200] bg-background flex flex-col"
          style={{ height: "100dvh" }}
        >
          {/* Sticky header — glassmorphism blur activates on scroll */}
          <div
            className="sticky top-0 z-10 border-b border-border/20 flex items-center gap-2 px-3 shrink-0"
            style={{
              paddingTop: "calc(0.75rem + var(--safe-top, 0px))",
              paddingBottom: "0.75rem",
              backgroundColor: isScrolled ? "hsl(var(--background) / 0.75)" : "hsl(var(--background))",
              backdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
              WebkitBackdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
              transition: "backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background-color 200ms ease",
            }}
          >
            <button
              onClick={() => { setActiveTab("summary"); onBack(); }}
              className="flex items-center justify-center w-9 h-9 rounded-full text-foreground/70 hover:text-foreground hover:bg-muted transition-colors shrink-0 touch-target"
              aria-label={t("toolbar.cancel")}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <h2 className="flex-1 min-w-0 text-[17px] font-semibold truncate text-foreground">
              {String(campaign.name || t("detail.unnamed"))}
            </h2>
          </div>

          {/* Tab bar — also blurs on scroll */}
          <div
            className="flex items-center border-b border-border/20 shrink-0 relative"
            style={{
              backgroundColor: isScrolled ? "hsl(var(--background) / 0.75)" : "hsl(var(--background))",
              backdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
              WebkitBackdropFilter: isScrolled ? "blur(12px) saturate(1.2)" : "none",
              transition: "backdrop-filter 200ms ease, -webkit-backdrop-filter 200ms ease, background-color 200ms ease",
            }}
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                data-testid={`campaign-tab-${tab.id}`}
                className={cn(
                  "flex-1 py-3 min-h-[44px] text-[13px] font-medium transition-colors",
                  activeTab === tab.id
                    ? "text-brand-indigo"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
            {/* Animated sliding indicator — uses transform, no transition-all */}
            <span
              className="absolute bottom-0 h-0.5 bg-brand-indigo rounded-full pointer-events-none"
              style={{
                width: `${100 / tabs.length}%`,
                transform: `translateX(${tabs.findIndex((t) => t.id === activeTab) * 100}%)`,
                transition: "transform 150ms ease",
              }}
            />
          </div>

          {/* Scrollable content */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto"
            style={{ paddingBottom: "var(--bottombar-h, 64px)" }}
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.div
                key={activeTab}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {activeTab === "summary" && <SummaryTab campaign={campaign} metrics={metrics} />}
                {activeTab === "config"  && <ConfigTab campaign={campaign} />}
                {activeTab === "tags"    && <TagsTab campaign={campaign} />}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
