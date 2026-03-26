import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "wouter";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import {
  getLeadStatusAvatarColor,
  getCampaignAvatarColor,
  getAccountAvatarColor,
} from "@/lib/avatarUtils";
import { CAMPAIGN_STICKERS } from "@/assets/campaign-stickers/index";
import { ExecutionProgressBar } from "./ExecutionProgressBar";
import type { ExecutionGroup } from "../hooks/useExecutionGroups";
import {
  STATUS_CONFIG,
  STATUS_ICON_HEX,
  AUTOMATION_TYPE_COLORS,
  formatExecutionTime,
  getGroupCurrentStepIdx,
  getLeadName,
} from "../automationConstants";

interface Props {
  group: ExecutionGroup;
  idx: number;
  isAgencyView: boolean;
}

export function MobileExecutionCard({ group, idx, isAgencyView }: Props) {
  const { t } = useTranslation("automation");
  const [, navigate] = useLocation();
  const base = isAgencyView ? "/agency" : "/subaccount";
  const [expanded, setExpanded] = useState(false);

  const autoType = group.automationType;
  const status = group.overallStatus;
  const currentStepIdx = getGroupCurrentStepIdx(group);

  const iconStatus = status === "running" ? "started" : status === "partial" ? "started" : status;
  const config = STATUS_CONFIG[iconStatus] || STATUS_CONFIG.success;
  const StatusIcon = config.icon;
  const iconHex = STATUS_ICON_HEX[iconStatus] || "#9CA3AF";
  const isCritical = group.failedStep?.raw?.is_critical_error === true ||
    group.failedStep?.raw?.is_critical_error === 1;

  const leadName = getLeadName(group.lead) || group.leadName;
  const leadId = group.lead?.id || group.lead?.Id;
  const leadStatus = group.lead?.conversion_status || group.lead?.Conversion_Status || "";
  const leadAvatarColor = getLeadStatusAvatarColor(leadStatus);

  const campaignName = group.campaign?.name || group.campaign?.Name || group.campaignName;
  const campaignId = group.campaign?.id || group.campaign?.Id;
  const stickerSlug = group.campaign?.campaign_sticker ?? null;
  const campaignSticker = stickerSlug
    ? CAMPAIGN_STICKERS.find((s: any) => s.slug === stickerSlug) ?? null
    : null;
  const campaignAvatarColor = getCampaignAvatarColor(group.campaign?.status || "");

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
        <div className="flex items-center gap-2">
          <span className={cn("text-[11px] font-medium", AUTOMATION_TYPE_COLORS[autoType.id] || "text-muted-foreground")}>
            {autoType.label}
          </span>
          <span className="text-[10px] text-muted-foreground">· {group.steps.length} steps</span>
          <span className="text-[10px] text-muted-foreground ml-auto font-mono tabular-nums">
            {formatExecutionTime(group.totalDurationMs)}
          </span>
        </div>
        <ExecutionProgressBar steps={group.steps} currentStepIndex={currentStepIdx} automationTypeId={autoType.id} />
      </button>

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
