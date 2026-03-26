import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  getLeadStatusAvatarColor,
  getCampaignAvatarColor,
  getAccountAvatarColor,
} from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { ExecutionProgressBar, getGradientColor } from "./ExecutionProgressBar";
import { DataEmptyState } from "@/components/crm/DataEmptyState";
import type { ExecutionGroup } from "../hooks/useExecutionGroups";
import {
  STATUS_CONFIG,
  STATUS_ICON_HEX,
  AUTOMATION_TYPE_COLORS,
  COLUMNS_EXECUTIONS,
  formatExecutionTime,
  getGroupCurrentStepIdx,
  getLeadName,
} from "../automationConstants";

interface Props {
  groups: ExecutionGroup[];
  page: number;
  pageSize: number;
  isAgencyView: boolean;
}

export function ExecutionTableRows({ groups, page, pageSize, isAgencyView }: Props) {
  const { t } = useTranslation("automation");
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";

  if (groups.length === 0) {
    return (
      <tr>
        <td colSpan={COLUMNS_EXECUTIONS.length} className="py-12">
          <DataEmptyState variant="automation" compact />
        </td>
      </tr>
    );
  }

  return (
    <>
      {groups.map((group, idx) => {
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
                  <span className="text-[10px] font-medium mt-0.5 block truncate text-foreground" title={group.steps[0].stepName}>
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
  );
}
