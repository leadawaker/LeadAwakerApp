import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Link2,
  Bot,
  Users,
  TrendingUp,
  DollarSign,
  Zap,
  CheckCircle2,
  XCircle,
  BarChart2,
  Settings,
  Layers,
  ListChecks,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Campaign, CampaignMetricsHistory } from "@/types/models";
import { cn } from "@/lib/utils";
import { IconBtn } from "@/components/ui/icon-btn";
import { formatDate } from "./formFields/campaignFormatters";
import {
  QualificationCriteriaDisplay,
  BumpCard,
  PerformanceChart,
  MetricSummaryRow,
} from "./detailPanelWidgets";

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

/** Get ROI color class based on value */
function getRoiColor(roi: number): string {
  if (roi >= 100) return "text-emerald-600 dark:text-emerald-400";
  if (roi >= 0) return "text-blue-600 dark:text-blue-400";
  return "text-rose-600 dark:text-rose-400";
}

// ── Local sub-components (read-only variants, used only in this panel) ──────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="icon-circle-lg border-2 border-black/[0.125] text-muted-foreground flex items-center justify-center shrink-0">{icon}</div>
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
  const { t } = useTranslation("campaigns");
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
              {campaign.name || t("detail.unnamed")}
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
                {t(`statusLabels.${campaign.status}`, campaign.status as string) || t("statusLabels.Unknown")}
              </span>
              {campaign.account_name && (
                <span className="text-[11px] text-muted-foreground truncate">
                  {campaign.account_name}
                </span>
              )}
            </div>
          </div>

          {/* Close button */}
          <IconBtn
            onClick={onClose}
            data-testid="campaign-detail-close"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </IconBtn>
        </div>

        {/* ── SCROLLABLE BODY ─────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-5 space-y-6">

          {/* PERFORMANCE METRICS ─────────────────────────────── */}
          {campaignMetrics.length > 0 && (
            <section data-testid="campaign-detail-section-metrics">
              <SectionHeader icon={<TrendingUp className="w-3.5 h-3.5" />} title={t("panel.performance")} />
              <MetricSummaryRow metrics={campaignMetrics} />
            </section>
          )}

          {/* PERFORMANCE CHART ───────────────────────────────── */}
          {campaignMetrics.length > 0 && (
            <section data-testid="campaign-detail-section-chart">
              <SectionHeader icon={<BarChart2 className="w-3.5 h-3.5" />} title={t("panel.trends")} />
              <div className="rounded-xl border border-border bg-card p-3">
                <PerformanceChart metrics={campaignMetrics} />
              </div>
            </section>
          )}

          {/* CAMPAIGN SETTINGS ───────────────────────────────── */}
          <section data-testid="campaign-detail-section-settings">
            <SectionHeader icon={<Settings className="w-3.5 h-3.5" />} title={t("panel.settings")} />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow label={t("panel.descriptionLabel")} value={campaign.description || "—"} />
              <InfoRow label={t("panel.typeLabel")} value={campaign.type} />
              <InfoRow
                label={t("panel.startDate")}
                value={formatDate(campaign.start_date)}
              />
              <InfoRow
                label={t("panel.endDate")}
                value={formatDate(campaign.end_date)}
              />
              <InfoRow
                label={t("panel.activeHours")}
                value={
                  campaign.active_hours_start || campaign.active_hours_end
                    ? `${campaign.active_hours_start || "—"} → ${campaign.active_hours_end || "—"}`
                    : "—"
                }
              />
              <InfoRow
                label={t("panel.dailyLeadLimit")}
                value={campaign.daily_lead_limit?.toLocaleString() || "—"}
              />
              <InfoRow
                label={t("panel.messageInterval")}
                value={campaign.message_interval_minutes ? `${campaign.message_interval_minutes} min` : "—"}
              />
              <BoolRow label={t("panel.stopOnResponse")} value={campaign.stop_on_response} />
              <BoolRow label={t("panel.useAiBumps")} value={campaign.use_ai_bumps} />
              <InfoRow
                label={t("panel.maxBumps")}
                value={campaign.max_bumps}
              />
            </div>
          </section>

          {/* AI SETTINGS ─────────────────────────────────────── */}
          <section data-testid="campaign-detail-section-ai">
            <SectionHeader icon={<Bot className="w-3.5 h-3.5" />} title={t("panel.aiConfiguration")} />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow label={t("panel.aiModel")} value={campaign.ai_model || "Default"} />
              <InfoRow
                label={t("panel.aiTemperature")}
                value={campaign.ai_temperature != null ? String(campaign.ai_temperature) : "—"}
              />
              <InfoRow label={t("panel.agentName")} value={campaign.agent_name} />
              <InfoRow label={t("panel.serviceName")} value={campaign.service_name} />
              {campaign.ai_prompt_template && (
                <div className="pt-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-1">
                    {t("panel.aiPromptTemplate")}
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
            <SectionHeader icon={<Layers className="w-3.5 h-3.5" />} title={t("panel.messageTemplates")} />
            <div className="space-y-3">
              {/* First message */}
              <div
                className="rounded-xl border border-border bg-muted/30 p-3 space-y-2"
                data-testid="campaign-detail-first-message"
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {t("panel.firstMessage")}
                  </span>
                </div>
                {campaign.first_message_template || campaign.First_Message ? (
                  <p className="text-[12px] text-foreground leading-relaxed whitespace-pre-wrap break-words">
                    {campaign.first_message_template || campaign.First_Message}
                  </p>
                ) : (
                  <p className="text-[11px] text-muted-foreground italic">{t("config.noTemplateSet")}</p>
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
            <SectionHeader icon={<DollarSign className="w-3.5 h-3.5" />} title={t("panel.costAndRoi")} />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow
                label={t("panel.totalCost")}
                value={
                  <span data-testid="campaign-detail-direct-total-cost">
                    ${Number(campaign.total_cost ?? 0).toFixed(2)}
                  </span>
                }
              />
              <InfoRow
                label={t("panel.costPerLead")}
                value={
                  <span data-testid="campaign-detail-direct-cost-per-lead">
                    ${Number(campaign.cost_per_lead ?? 0).toFixed(2)}
                  </span>
                }
              />
              <InfoRow
                label={t("panel.costPerBooking")}
                value={
                  <span data-testid="campaign-detail-direct-cost-per-booking">
                    ${Number(campaign.cost_per_booking ?? 0).toFixed(2)}
                  </span>
                }
              />
              <div className="flex items-start justify-between gap-3 py-1.5 border-b border-border/40 last:border-0">
                <span className="text-[11px] text-muted-foreground shrink-0 pt-0.5">{t("panel.roi")}</span>
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
            <SectionHeader icon={<Link2 className="w-3.5 h-3.5" />} title={t("panel.integrations")} />
            <div className="rounded-xl border border-border bg-card p-3 space-y-0">
              <InfoRow
                label={t("panel.n8nWorkflowId")}
                value={campaign.n8n_workflow_id || "—"}
                mono
              />
              <InfoRow
                label={t("panel.calendarLink")}
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
                label={t("panel.webhookUrl")}
                value={campaign.webhook_url || "—"}
                mono
              />
            </div>
          </section>

          {/* QUALIFICATION CRITERIA ─────────────────────────── */}
          <section data-testid="campaign-detail-section-qualification">
            <SectionHeader icon={<ListChecks className="w-3.5 h-3.5" />} title={t("panel.qualificationCriteria")} />
            <div className="rounded-xl border border-border bg-card p-3">
              <QualificationCriteriaDisplay raw={campaign.qualification_criteria} />
            </div>
          </section>

          {/* AUDIENCE ────────────────────────────────────────── */}
          {(campaign.target_audience || campaign.niche || campaign.campaign_service) && (
            <section data-testid="campaign-detail-section-audience">
              <SectionHeader icon={<Users className="w-3.5 h-3.5" />} title={t("panel.audienceTargeting")} />
              <div className="rounded-xl border border-border bg-card p-3 space-y-0">
                <InfoRow label={t("panel.targetAudience")} value={campaign.target_audience} />
                <InfoRow label={t("panel.niche")} value={campaign.niche} />
                <InfoRow label={t("panel.serviceLabel")} value={campaign.campaign_service} />
                <InfoRow label={t("panel.usp")} value={campaign.campaign_usp} />
                <InfoRow label={t("panel.inquiryTimeframe")} value={campaign.inquiry_timeframe} />
              </div>
            </section>
          )}

          {/* DEMO: A/B TESTING ───────────────────────────── */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">Teste A/B</CardTitle>
                <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Em execução</Badge>
              </div>
              <p className="text-xs text-muted-foreground">Duração: 14 dias · Confiança estatística: 94%</p>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">A — Mensagem Padrão</span>
                  <span className="font-medium">18.3% · 45 leads</span>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div className="h-2 bg-muted-foreground/40 rounded-full" style={{ width: '18.3%' }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">B — Mensagem Personalizada</span>
                  <span className="font-medium text-emerald-600">27.6% · 43 leads 🏆</span>
                </div>
                <div className="h-2 bg-muted rounded-full">
                  <div className="h-2 bg-emerald-500 rounded-full" style={{ width: '27.6%' }} />
                </div>
              </div>
              <p className="text-xs text-emerald-600 font-medium">Variante B vencedora — +51% de melhoria</p>
            </CardContent>
          </Card>

          {/* DEMO: FINANCIAL SUMMARY ─────────────────────── */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Resumo Financeiro</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">ROI</p>
                  <p className="text-lg font-bold text-emerald-600">284%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Receita Gerada</p>
                  <p className="text-lg font-bold text-emerald-600">R$ 47.200</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Custo da Campanha</p>
                  <p className="text-base font-semibold">R$ 1.650</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Economia por Lead</p>
                  <p className="text-base font-semibold text-emerald-600">R$ 312</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* DEMO: AI ANALYSIS ───────────────────────────── */}
          <Card className="mb-4">
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-purple-500" />
                <CardTitle className="text-sm font-medium">Análise de IA</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Com base nos dados desta campanha, identificamos que leads com consumo de energia acima de R$350/mês têm 3× mais probabilidade de conversão. A taxa de resposta de 27,6% da Variante B sugere que mensagens personalizadas com menção ao custo atual da conta de luz geram maior engajamento. Recomendamos escalar a Variante B e focar nos horários de envio entre 14h e 16h, quando a taxa de abertura é 42% maior.
              </p>
            </CardContent>
          </Card>

          {/* Bottom spacer for mobile chrome */}
          <div className="h-4" />
        </div>
      </div>
    </>
  );
}
