import type { Express } from "express";
import { storage } from "../storage";
import { requireAgency } from "../auth";
import { wrapAsync, getEngineUrl } from "./_helpers";

const JOB_GRACE_MAP: Record<string, number> = {
  campaign_launcher:      60 * 2,
  bump_scheduler:         60 * 5 * 2,
  demo_bump_scheduler:    60 * 5 * 2,
  lead_scorer:            60 * 30 * 2,
  task_reminders:         60 * 15 * 2,
  buying_signal_followup: 60 * 5 * 2,
  metrics_aggregator:     60 * 60 * 26,
  nightly_summary:        60 * 60 * 26,
};

const JOB_CADENCE_LABEL: Record<string, string> = {
  campaign_launcher:      "every 60s",
  bump_scheduler:         "every 5m",
  demo_bump_scheduler:    "every 5m",
  lead_scorer:            "every 30m",
  task_reminders:         "every 15m",
  buying_signal_followup: "every 5m",
  metrics_aggregator:     "daily 00:00",
  nightly_summary:        "daily 00:00",
};

let _healthCache: { data: any; ts: number } | null = null;
const HEALTH_CACHE_TTL = 25_000;

export function registerAutomationRoutes(app: Express) {
  app.get("/api/automation-health", requireAgency, wrapAsync(async (_req, res) => {
    if (_healthCache && Date.now() - _healthCache.ts < HEALTH_CACHE_TTL) {
      return res.json(_healthCache.data);
    }

    const KNOWN_JOBS = Object.keys(JOB_GRACE_MAP);
    let engineHealthy = false;
    let schedulerRunning = false;
    let engineJobs: Array<{ id: string; name: string; next_run_at: string | null }> = [];

    try {
      const r = await fetch(getEngineUrl() + "/api/jobs-health", { signal: AbortSignal.timeout(5000) });
      if (r.ok) {
        const body = await r.json() as { scheduler_running: boolean; jobs: typeof engineJobs };
        engineHealthy = true;
        schedulerRunning = body.scheduler_running;
        engineJobs = body.jobs ?? [];
      }
    } catch {
      // engine unreachable — engineHealthy stays false
    }

    const dbRows = await storage.getSchedulerJobHealth();
    const dbByWorkflow = new Map(dbRows.map(r => [r.workflow_name, r]));
    const engineById = new Map(engineJobs.map(j => [j.id, j]));

    const now = Date.now();
    const jobs = KNOWN_JOBS.map(id => {
      const db = dbByWorkflow.get(id);
      const eng = engineById.get(id);
      const lastRunAt = db?.last_run_at ?? null;
      const lastRunStatus = db?.last_status ?? null;
      const errors24h = Number(db?.errors_24h ?? 0);
      const nextRunAt = eng?.next_run_at ?? null;

      let status: "healthy" | "overdue" | "error";
      if (!engineHealthy || !eng) {
        status = "error";
      } else if (lastRunStatus === "Failure") {
        status = "error";
      } else if (lastRunAt) {
        const age = (now - new Date(lastRunAt).getTime()) / 1000;
        status = age > JOB_GRACE_MAP[id] ? "overdue" : "healthy";
      } else {
        status = "overdue";
      }

      return {
        id,
        name: eng?.name ?? id,
        cadenceLabel: JOB_CADENCE_LABEL[id] ?? "",
        status,
        lastRunAt,
        lastRunStatus,
        nextRunAt,
        errors24h,
      };
    });

    const data = {
      engineHealthy,
      schedulerRunning,
      generatedAt: new Date().toISOString(),
      jobs,
    };
    _healthCache = { data, ts: Date.now() };
    res.json(data);
  }));

  app.get("/api/automation-logs/summary", requireAgency, wrapAsync(async (req, res) => {
    const accountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const data = await storage.getAutomationLogsSummary(accountId);
    res.json(data);
  }));

  app.get("/api/automation-logs", requireAgency, wrapAsync(async (req, res) => {
    const { page = '0', limit = '50', accountId, status, workflowName, dateFrom, dateTo } = req.query;
    const data = await storage.getAutomationLogsPaginated({
      page: Number(page),
      limit: Number(limit),
      accountId: accountId ? Number(accountId) : undefined,
      status: status as string | undefined,
      workflowName: workflowName as string | undefined,
      dateFrom: dateFrom as string | undefined,
      dateTo: dateTo as string | undefined,
    });
    res.json(data);
  }));
}
