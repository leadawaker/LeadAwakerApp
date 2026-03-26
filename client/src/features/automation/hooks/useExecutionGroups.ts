import { useMemo } from "react";
import { resolveAutomationType, type AutomationType } from "../automationRegistry";

export interface ExecutionStep {
  id: number;
  stepName: string;
  stepNumber: number;
  status: string;
  executionTimeMs: number | null;
  errorCode: string | null;
  inputData: string | null;
  outputData: string | null;
  retryCount: number | null;
  createdAt: string;
  raw: any;
}

export interface ExecutionGroup {
  executionId: string;
  workflowName: string;
  automationType: AutomationType;
  steps: ExecutionStep[];
  overallStatus: "success" | "failed" | "running" | "partial";
  totalDurationMs: number;
  failedStep: ExecutionStep | null;
  leadName: string | null;
  accountName: string | null;
  campaignName: string | null;
  lead: any;
  account: any;
  campaign: any;
  latestTimestamp: string;
}

function normalizeStatus(status: string | null | undefined): string {
  if (!status) return "unknown";
  const s = status.toLowerCase();
  if (s === "error") return "failed";
  return s;
}

function computeOverallStatus(steps: ExecutionStep[]): ExecutionGroup["overallStatus"] {
  const statuses = steps.map((s) => s.status);
  if (statuses.some((s) => s === "failed")) return "failed";
  if (statuses.some((s) => s === "started" || s === "waiting" || s === "retrying")) return "running";
  if (statuses.every((s) => s === "success" || s === "skipped")) return "success";
  return "partial";
}

export function useExecutionGroups(rows: any[]): ExecutionGroup[] {
  return useMemo(() => {
    if (!rows || rows.length === 0) return [];

    // Group rows by workflow_execution_id
    const groupMap = new Map<string, any[]>();

    for (const r of rows) {
      const execId = r.workflow_execution_id || r.workflowExecutionId;
      const key = execId ? String(execId) : `solo_${r.id}`;
      const existing = groupMap.get(key);
      if (existing) {
        existing.push(r);
      } else {
        groupMap.set(key, [r]);
      }
    }

    const groups: ExecutionGroup[] = [];

    for (const [executionId, groupRows] of Array.from(groupMap.entries())) {
      // Sort steps by step_number ASC, tiebreak by created_at
      const sorted = [...groupRows].sort((a, b) => {
        const aNum = a.step_number ?? a.stepNumber ?? 0;
        const bNum = b.step_number ?? b.stepNumber ?? 0;
        if (aNum !== bNum) return aNum - bNum;
        const aDate = a.created_at || a.createdAt || a.CreatedAt || "";
        const bDate = b.created_at || b.createdAt || b.CreatedAt || "";
        return aDate < bDate ? -1 : aDate > bDate ? 1 : 0;
      });

      const steps: ExecutionStep[] = sorted.map((r) => ({
        id: r.id,
        stepName: r.step_name || r.stepName || "Unknown Step",
        stepNumber: r.step_number ?? r.stepNumber ?? 0,
        status: normalizeStatus(r.status),
        executionTimeMs: r.execution_time_ms ?? r.executionTimeMs ?? null,
        errorCode: r.error_code || r.errorCode || null,
        inputData: r.input_data || r.inputData || null,
        outputData: r.output_data || r.outputData || null,
        retryCount: r.retry_count ?? r.retryCount ?? null,
        createdAt: r.created_at || r.createdAt || r.CreatedAt || "",
        raw: r,
      }));

      const workflowName = sorted[0].workflow_name || sorted[0].workflowName || "";
      const overallStatus = computeOverallStatus(steps);
      const failedStep = steps.find((s) => s.status === "failed") ?? null;
      const totalDurationMs = steps.reduce(
        (sum, s) => sum + (s.executionTimeMs ?? 0),
        0,
      );

      // Entity data: try denormalized columns first, then JOIN fields, propagate from siblings
      const entityRow = sorted.find((r) =>
        (r.lead_name || r.leadName || r.leadFirstName || r.Leads_id || r.leadsId) &&
        (r.campaign_name || r.campaignName || r.campaignJoinName || r.Campaigns_id || r.campaignsId)
      ) || sorted[0];
      const first = entityRow;
      const leadFirst = first.leadFirstName || first.lead_first_name || "";
      const leadLast = first.leadLastName || first.lead_last_name || "";
      const leadFullJoin = [leadFirst, leadLast].filter(Boolean).join(" ") || null;
      const leadName = first.lead_name || first.leadName || leadFullJoin || null;
      const accountName = first.account_name || first.accountName || first.accountJoinName || null;
      const campaignName = first.campaign_name || first.campaignName || first.campaignJoinName || null;

      // Latest timestamp across all steps
      const latestTimestamp = steps.reduce((latest, s) => {
        if (!latest) return s.createdAt;
        return s.createdAt > latest ? s.createdAt : latest;
      }, "");

      groups.push({
        executionId,
        workflowName,
        automationType: resolveAutomationType(workflowName),
        steps,
        overallStatus,
        totalDurationMs,
        failedStep,
        leadName,
        accountName,
        campaignName,
        lead: first.lead ?? (first.Leads_id || first.leadsId ? {
          id: first.Leads_id || first.leadsId,
          firstName: first.leadFirstName, lastName: first.leadLastName,
          conversion_status: first.lead_conversion_status || "",
        } : null),
        account: first.account ?? (first.Accounts_id || first.accountsId ? {
          id: first.Accounts_id || first.accountsId,
          name: first.accountJoinName || accountName,
          logo_url: first.accountLogoUrl || null,
        } : null),
        campaign: first.campaign ?? (first.Campaigns_id || first.campaignsId ? {
          id: first.Campaigns_id || first.campaignsId,
          name: first.campaignJoinName || campaignName,
          campaign_sticker: first.campaign_sticker || null,
        } : null),
        latestTimestamp,
      });
    }

    // Sort groups by latestTimestamp DESC
    groups.sort((a, b) =>
      a.latestTimestamp > b.latestTimestamp ? -1 : a.latestTimestamp < b.latestTimestamp ? 1 : 0,
    );

    return groups;
  }, [rows]);
}
