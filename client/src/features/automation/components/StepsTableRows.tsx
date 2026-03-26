import React from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { XCircle, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  getLeadStatusAvatarColor,
  getCampaignAvatarColor,
  getAccountAvatarColor,
} from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { resolveAutomationType } from "../automationRegistry";
import { ExecutionProgressBar, getGradientColor } from "./ExecutionProgressBar";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { ExecutionGroup } from "../hooks/useExecutionGroups";
import {
  STATUS_CONFIG,
  STATUS_ICON_HEX,
  AUTOMATION_TYPE_COLORS,
  COLUMNS_STEPS,
  formatExecutionTime,
  formatDuration,
  formatJson,
  getLeadName,
} from "../automationConstants";

interface Props {
  rows: any[];
  page: number;
  pageSize: number;
  expandedRows: Set<string | number>;
  toggleRow: (id: string | number) => void;
  executionByRow: Map<string | number, ExecutionGroup>;
  isAgencyView: boolean;
}

export function StepsTableRows({ rows, page, pageSize, expandedRows, toggleRow, executionByRow, isAgencyView }: Props) {
  const { t } = useTranslation("automation");
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";

  if (rows.length === 0) {
    return (
      <tr>
        <td colSpan={COLUMNS_STEPS.length} className="py-12">
          <DataEmptyState variant="automation" compact />
        </td>
      </tr>
    );
  }

  return (
    <>
      {rows.map((r: any, idx: number) => {
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
              <td className="px-1" style={{ width: 36 }}>
                {isFailed && (
                  <button
                    onClick={() => toggleRow(rowId)}
                    className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    data-testid="btn-expand-log"
                    aria-label={isExpanded ? t("detail.collapseError") : t("detail.expandError")}
                    aria-expanded={isExpanded}
                  >
                    {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                )}
              </td>

              <td className="px-3" style={{ width: 44 }}>
                <span className="text-[11px] font-mono text-muted-foreground/60 tabular-nums">
                  {page * pageSize + idx + 1}
                </span>
              </td>

              <td className="px-3" style={{ width: 130 }}>
                <span className="text-[11px] text-muted-foreground">
                  {(r.createdAt || r.created_at || r.CreatedAt)
                    ? new Date(r.createdAt || r.created_at || r.CreatedAt).toLocaleString([], {
                        month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
                      })
                    : "N/A"}
                </span>
              </td>

              <td className="px-2 text-center" style={{ width: 36 }}>
                <StatusIcon
                  className="h-4 w-4"
                  style={{ color: STATUS_ICON_HEX[status] || "#9CA3AF" }}
                  data-testid="icon-status-inline"
                />
              </td>

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
                        <span className="text-[13px] font-medium text-foreground truncate block" title={wfName}>{wfName}</span>
                        <span className={cn("text-[10px] font-medium truncate block", AUTOMATION_TYPE_COLORS[autoType.id] || "text-muted-foreground")}>
                          {autoType.label}
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </td>

              <td className="px-3" style={{ width: 240, minWidth: 240 }}>
                {(() => {
                  const group = executionByRow.get(r.id);
                  if (!group) return <span className="text-muted-foreground/30">{"\u2014"}</span>;
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
                        {r.stepName || r.step_name || "\u2014"}
                      </span>
                    </div>
                  );
                })()}
              </td>

              <td className="px-3" style={{ width: 70 }} data-testid="cell-exec-time">
                <span className={cn(
                  "text-[11px] font-mono",
                  (r.executionTimeMs ?? r.execution_time_ms) != null ? "text-foreground" : "text-muted-foreground/50",
                )}>
                  {formatExecutionTime(r.executionTimeMs ?? r.execution_time_ms)}
                </span>
              </td>

              <td className="px-3" style={{ width: 65 }} data-testid="cell-duration">
                {(() => {
                  const dur = r.durationSeconds ?? r.duration_seconds ?? ((r.executionTimeMs ?? r.execution_time_ms) != null ? (r.executionTimeMs ?? r.execution_time_ms) / 1000 : null);
                  return (
                    <span className={cn("text-[11px] font-mono", dur != null ? "text-foreground" : "text-muted-foreground/50")}>
                      {formatDuration(dur) ?? "\u2014"}
                    </span>
                  );
                })()}
              </td>

              <td className="px-3" style={{ width: 160, minWidth: 160 }}>
                {(() => {
                  const joinName = [r.leadFirstName, r.leadLastName].filter(Boolean).join(" ") || null;
                  const name = getLeadName(r.lead) || r.leadName || r.lead_name || joinName;
                  const id = r.lead?.id || r.lead?.Id || r.leadsId || r.Leads_id;
                  const leadStatus = r.lead?.conversion_status || r.lead?.Conversion_Status || r.lead?.pipelineStatus || r.lead?.pipeline_status || "";
                  const avatarColor = getLeadStatusAvatarColor(leadStatus);
                  return (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {name && <EntityAvatar name={name} bgColor={avatarColor.bg} textColor={avatarColor.text} size={28} />}
                      {name && id ? (
                        <button
                          onClick={() => { try { localStorage.setItem("selected-lead-id", String(id)); } catch {} navigate(`${base}/leads`); }}
                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                        >{name}</button>
                      ) : name ? (
                        <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                      ) : null}
                    </div>
                  );
                })()}
              </td>

              <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                {(() => {
                  const name = r.campaign?.name || r.campaign?.Name || r.campaignName || r.campaign_name || r.campaignJoinName;
                  const id = r.campaign?.id || r.campaign?.Id || r.campaignsId || r.Campaigns_id;
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
                          onClick={() => { try { localStorage.setItem("selected-campaign-id", String(id)); } catch {} navigate(`${base}/campaigns`); }}
                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                        >{name}</button>
                      ) : name ? (
                        <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                      ) : null}
                    </div>
                  );
                })()}
              </td>

              <td className="px-3" style={{ width: 150, minWidth: 150 }}>
                {(() => {
                  const name = r.account?.name || r.account?.Name || r.accountName || r.account_name || r.accountJoinName;
                  const id = r.account?.id || r.account?.Id || r.accountsId || r.Accounts_id;
                  const logoUrl = r.account?.logo_url || r.account?.logoUrl || r.accountLogoUrl || null;
                  const avatarColor = getAccountAvatarColor(r.account?.status || "");
                  return (
                    <div className="flex items-center gap-1.5 min-w-0">
                      {name && <EntityAvatar name={name} photoUrl={logoUrl} bgColor={avatarColor.bg} textColor={avatarColor.text} size={28} />}
                      {name && id ? (
                        <button
                          onClick={() => { try { localStorage.setItem("selected-account-id", String(id)); } catch {} navigate(`${base}/accounts`); }}
                          className="text-[12px] font-medium text-foreground underline truncate text-left"
                        >{name}</button>
                      ) : name ? (
                        <span className="text-[12px] text-muted-foreground truncate">{name}</span>
                      ) : null}
                    </div>
                  );
                })()}
              </td>
            </tr>

            {isFailed && isExpanded && (
              <tr>
                <td colSpan={COLUMNS_STEPS.length} className="bg-muted/40 border-b border-border/30" data-testid="log-error-detail">
                  <div className="px-8 py-4 space-y-3">
                    <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">{t("detail.errorDetails")}</div>
                    {errorCode && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("detail.errorCode")}</div>
                        <div data-testid="error-code" className="inline-flex items-center gap-1.5 text-sm font-mono text-rose-600 dark:text-rose-400 bg-rose-500/8 px-3 py-1.5 rounded-lg border border-rose-500/20">
                          <XCircle className="h-3.5 w-3.5 shrink-0" />
                          {errorCode}
                        </div>
                      </div>
                    )}
                    {inputData && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("detail.inputData")}</div>
                        <pre data-testid="input-data" className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all">
                          {formatJson(inputData)}
                        </pre>
                      </div>
                    )}
                    {outputData && (
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">{t("detail.outputData")}</div>
                        <pre data-testid="output-data" className="text-xs font-mono bg-muted/60 text-foreground/80 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all">
                          {formatJson(outputData)}
                        </pre>
                      </div>
                    )}
                    {!errorCode && !inputData && !outputData && (
                      <div className="text-sm text-muted-foreground italic">{t("detail.noErrorDetails")}</div>
                    )}
                  </div>
                </td>
              </tr>
            )}
          </React.Fragment>
        );
      })}
    </>
  );
}
