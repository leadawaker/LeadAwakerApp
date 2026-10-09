// Shared API types for the Automations overview (specs/automation-overview).
import type { AutomationEntry } from "./automationCatalogue";

export type HealthState = "healthy" | "warning" | "late" | "failing" | "waiting" | "idle" | "unknown";

export interface EngineJob {
  id: string;
  name: string;
  next_run_at: string | null;
  last_run_at?: string | null;
  last_ok?: boolean | null;
  last_error?: string | null;
  errors_24h?: number;
}

export interface EngineJobsHealth {
  scheduler_running: boolean;
  started_at?: string | null;
  jobs: EngineJob[];
}

export interface ActionCounts {
  success: number;
  failed: number;
  skipped: number;
  lastActionAt: string | null;
  topFailureReason: string | null;
}

export interface OverviewRow {
  id: string;
  entry: AutomationEntry | null;
  health: HealthState;
  lastRunAt: string | null;
  lastError: string | null;
  counts24h: ActionCounts;
  clientsOn: number | null;
  quiet: boolean;
  /** Last 24 hours of diary lines in hourly buckets, oldest first (index 23 = the current hour). */
  pulse: HourlyPulse;
}

export interface HourlyPulse {
  ok: number[];
  failed: number[];
}

export interface OverviewResponse {
  engineReachable: boolean;
  schedulerRunning: boolean;
  engineStartedAt: string | null;
  rows: OverviewRow[];
  totals: { automations: number; healthy: number; late: number; failing: number; failures24h: number };
}

export interface DiaryLine {
  id: number;
  createdAt: string;
  automationId: string;
  action: string;
  outcome: "success" | "failed" | "skipped";
  reason: string | null;
  accountId: number | null;
  accountName: string | null;
  campaignId: number | null;
  campaignName: string | null;
  leadId: number | null;
  leadName: string | null;
  interactionId: number | null;
  voiceCallId: number | null;
}

export interface DiaryPage {
  lines: DiaryLine[];
  page: number;
  hasMore: boolean;
}

export type ClientState = "on" | "off" | "always_on";

export type ChangeTarget =
  | { kind: "account_tab"; tab: "integrations" | "communication" | "voice" }
  | { kind: "campaign_section"; campaignId: number; section: "business" | "ai" | "behavior" }
  | { kind: "settings_account" };

export interface SummaryToken {
  key: string;
  values?: Record<string, string | number>;
}

export interface ClientLine {
  automationId: string;
  campaignId: number | null;
  campaignName: string | null;
  state: ClientState;
  summary: SummaryToken[];
  counts7d: ActionCounts;
  change: ChangeTarget | null;
  warning: { key: "paused_followups"; count: number } | null;
}

export interface ClientAutomationsResponse {
  accountId: number;
  lines: ClientLine[];
  totals: { on: number; total: number; actions7d: number; failed7d: number };
}

export const emptyPulse = (): HourlyPulse => ({ ok: Array(24).fill(0), failed: Array(24).fill(0) });

export const EMPTY_COUNTS: ActionCounts = { success: 0, failed: 0, skipped: 0, lastActionAt: null, topFailureReason: null };
