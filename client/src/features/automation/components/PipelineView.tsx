import { useState } from "react";
import { useTranslation } from "react-i18next";
import { GitBranch, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { EntityAvatar } from "@/components/ui/entity-avatar";
import { getAutomationTypeAvatarColor } from "@/lib/avatarUtils";
import { ExecutionProgressBar } from "./ExecutionProgressBar";
import type { TFunction } from "i18next";

// ── Local types (mirrors hook exports to avoid import coupling) ─────────────

interface AutomationTypeInfo {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
}

interface ExecutionStep {
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

interface ExecutionGroup {
  executionId: string;
  workflowName: string;
  automationType: AutomationTypeInfo;
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

interface PipelineViewProps {
  executions: ExecutionGroup[];
}

// ── Dark mode detection ─────────────────────────────────────────────────────

function isDarkMode(): boolean {
  return typeof document !== "undefined" && document.documentElement.classList.contains("dark");
}

// ── Status colors (pill badges) ─────────────────────────────────────────────

const STATUS_COLORS: Record<string, { color: string }> = {
  success:  { color: "text-emerald-600 bg-emerald-50 border-emerald-200 dark:text-emerald-400 dark:bg-emerald-900/30 dark:border-emerald-800/50" },
  failed:   { color: "text-rose-600 bg-rose-50 border-rose-200 dark:text-rose-400 dark:bg-rose-900/30 dark:border-rose-800/50" },
  skipped:  { color: "text-muted-foreground bg-muted/50 border-border" },
  waiting:  { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50" },
  retrying: { color: "text-indigo-600 bg-indigo-50 border-indigo-200 dark:text-indigo-400 dark:bg-indigo-900/30 dark:border-indigo-800/50" },
  started:  { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50" },
  running:  { color: "text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/30 dark:border-blue-800/50" },
  partial:  { color: "text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/30 dark:border-amber-800/50" },
};

// ── Step circle / line hex colors ───────────────────────────────────────────

const STEP_HEX: Record<string, { light: string; dark: string }> = {
  success:  { light: "#10B981", dark: "#059669" },
  failed:   { light: "#F43F5E", dark: "#E11D48" },
  skipped:  { light: "#D1D5DB", dark: "#4B5563" },
  waiting:  { light: "#F59E0B", dark: "#D97706" },
  retrying: { light: "#6366F1", dark: "#4F46E5" },
  started:  { light: "#3B82F6", dark: "#2563EB" },
};

function getStepHex(status: string): string {
  const entry = STEP_HEX[status] ?? STEP_HEX.skipped;
  return isDarkMode() ? entry.dark : entry.light;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function relativeTime(dateStr: string, t: TFunction): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return t("time.justNow");
  if (mins < 60) return t("time.minutesAgo", { count: mins });
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return t("time.hoursAgo", { count: hrs });
  const days = Math.floor(hrs / 24);
  return t("time.daysAgo", { count: days });
}

function formatExecTime(ms: number | null): string {
  if (ms == null) return "\u2014";
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatJson(raw: string | null): string {
  if (!raw) return "";
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}

function getStatusPillColor(status: string): string {
  return STATUS_COLORS[status]?.color ?? STATUS_COLORS.skipped.color;
}

// ── Status pill (reused in both panels) ─────────────────────────────────────

function StatusPill({ status }: { status: string }) {
  const { t } = useTranslation("automation");
  return (
    <span
      className={cn(
        "inline-flex items-center text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border",
        getStatusPillColor(status),
      )}
    >
      {t(`pipeline.status.${status}`, status)}
    </span>
  );
}

// ── Metadata separator dot ──────────────────────────────────────────────────

function Dot() {
  return <span className="text-muted-foreground/40 mx-0.5">&middot;</span>;
}

// ── Main component ──────────────────────────────────────────────────────────

export function PipelineView({ executions }: PipelineViewProps) {
  const { t } = useTranslation("automation");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [expandedSteps, setExpandedSteps] = useState<Set<number>>(new Set());

  const selected = executions.find((e) => e.executionId === selectedId) ?? null;

  function toggleStep(stepId: number) {
    setExpandedSteps((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) next.delete(stepId);
      else next.add(stepId);
      return next;
    });
  }

  function handleSelect(executionId: string) {
    setSelectedId(executionId);
    setExpandedSteps(new Set());
  }

  return (
    <div className="flex gap-3 h-full min-h-0">
      {/* ── Left Panel: execution list ──────────────────────────── */}
      <div className="w-[340px] shrink-0 flex flex-col bg-muted rounded-lg overflow-hidden">
        {/* Header */}
        <div className="px-3.5 pt-5 pb-1 flex items-center justify-between">
          <h2 className="text-sm font-semibold">{t("pipeline.executions")}</h2>
          <span className="text-[12px] font-medium text-muted-foreground tabular-nums">
            {executions.length}
          </span>
        </div>

        {/* Card list */}
        <div className="flex-1 overflow-y-auto p-[3px]">
          <div className="flex flex-col gap-[3px]">
            {executions.map((exec) => {
              const isSelected = selectedId === exec.executionId;
              const avatarColors = getAutomationTypeAvatarColor(exec.automationType.id);

              return (
                <button
                  key={exec.executionId}
                  type="button"
                  onClick={() => handleSelect(exec.executionId)}
                  className={cn(
                    "rounded-xl p-3 cursor-pointer text-left w-full transition-[background-color] duration-150",
                    isSelected
                      ? "bg-[#FFF9D9]"
                      : "bg-card hover:bg-card-hover",
                  )}
                >
                  {/* Row 1: Avatar + name + time */}
                  <div className="flex items-center gap-2">
                    <EntityAvatar
                      size={36}
                      bgColor={avatarColors.bg}
                      textColor={avatarColors.text}
                      name={exec.automationType.label}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-medium truncate">
                        {exec.workflowName}
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {exec.automationType.label}
                      </div>
                    </div>
                    <span className="text-[10px] text-muted-foreground shrink-0 ml-1">
                      {relativeTime(exec.latestTimestamp, t)}
                    </span>
                  </div>

                  {/* Row 2: Progress bar */}
                  <div className="mt-2">
                    <ExecutionProgressBar steps={exec.steps} />
                  </div>

                  {/* Row 3: Status + lead + step count */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <StatusPill status={exec.overallStatus} />
                    {exec.leadName && (
                      <span className="text-[11px] text-muted-foreground truncate">
                        {exec.leadName}
                      </span>
                    )}
                    <span className="text-[10px] text-muted-foreground ml-auto shrink-0">
                      {exec.steps.length} {exec.steps.length !== 1 ? t("pipeline.steps") : t("pipeline.step")}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Right Panel: step timeline ──────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col bg-muted rounded-lg overflow-hidden">
        {!selected ? (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground gap-3">
            <GitBranch className="h-10 w-10 opacity-30" />
            <p className="text-sm">{t("pipeline.selectExecution")}</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 pt-5 pb-3 border-b border-border/20">
              <h2 className="text-lg font-semibold">{selected.workflowName}</h2>
              <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                <StatusPill status={selected.overallStatus} />
                <span className="text-[11px] font-mono text-muted-foreground">
                  {formatExecTime(selected.totalDurationMs)}
                </span>
                {selected.leadName && (
                  <>
                    <Dot />
                    <span className="text-[11px] text-muted-foreground">
                      {selected.leadName}
                    </span>
                  </>
                )}
                {selected.accountName && (
                  <>
                    <Dot />
                    <span className="text-[11px] text-muted-foreground">
                      {selected.accountName}
                    </span>
                  </>
                )}
                {selected.campaignName && (
                  <>
                    <Dot />
                    <span className="text-[11px] text-muted-foreground">
                      {selected.campaignName}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {selected.steps.map((step, idx) => {
                const isLast = idx === selected.steps.length - 1;
                const hex = getStepHex(step.status);
                const isFailed = step.status === "failed" || step.status === "error";
                const hasErrorData = isFailed && (step.errorCode || step.inputData || step.outputData);
                const isExpanded = expandedSteps.has(step.id);

                return (
                  <div key={step.id} className="flex">
                    {/* Left gutter: circle + line */}
                    <div className="w-8 shrink-0 flex flex-col items-center">
                      <div
                        className="h-6 w-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: hex }}
                      >
                        {step.stepNumber}
                      </div>
                      {!isLast && (
                        <div
                          className="flex-1 w-0.5 rounded-full"
                          style={{ backgroundColor: hex, opacity: 0.4 }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className={cn("flex-1 min-w-0 ml-3", !isLast && "pb-6")}>
                      <div className="text-[13px] font-medium">{step.stepName}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <StatusPill status={step.status} />
                        <span className="text-[11px] font-mono text-muted-foreground">
                          {formatExecTime(step.executionTimeMs)}
                        </span>
                        {step.retryCount != null && step.retryCount > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            ({step.retryCount} {step.retryCount === 1 ? t("pipeline.retry") : t("pipeline.retries")})
                          </span>
                        )}
                      </div>

                      {/* Expandable error details */}
                      {hasErrorData && (
                        <div className="mt-2">
                          <button
                            type="button"
                            onClick={() => toggleStep(step.id)}
                            className="inline-flex items-center gap-1 text-[11px] text-rose-500 cursor-pointer hover:text-rose-600 transition-colors duration-150"
                          >
                            {isExpanded ? (
                              <ChevronDown className="h-3 w-3" />
                            ) : (
                              <ChevronRight className="h-3 w-3" />
                            )}
                            {isExpanded ? t("pipeline.hideErrorDetails") : t("pipeline.showErrorDetails")}
                          </button>

                          {isExpanded && (
                            <div className="mt-2 space-y-2">
                              {step.errorCode && (
                                <div>
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                    {t("pipeline.errorCode")}
                                  </span>
                                  <div className="mt-0.5">
                                    <span className="text-[11px] font-mono text-rose-600 bg-rose-500/8 px-2 py-1 rounded-lg border border-rose-500/20 inline-block">
                                      {step.errorCode}
                                    </span>
                                  </div>
                                </div>
                              )}

                              {step.inputData && (
                                <div>
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                    {t("pipeline.inputData")}
                                  </span>
                                  <pre className="mt-0.5 text-[11px] font-mono bg-muted/60 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all">
                                    {formatJson(step.inputData)}
                                  </pre>
                                </div>
                              )}

                              {step.outputData && (
                                <div>
                                  <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wide">
                                    {t("pipeline.outputData")}
                                  </span>
                                  <pre className="mt-0.5 text-[11px] font-mono bg-muted/60 p-3 rounded-lg overflow-auto max-h-48 border border-border whitespace-pre-wrap break-all">
                                    {formatJson(step.outputData)}
                                  </pre>
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
