import type { Express } from "express";
import { storage } from "../storage";
import { requireOwner } from "../auth";
import { wrapAsync, getEngineUrl } from "./_helpers";
import { AUTOMATION_CATALOGUE, findEntry } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, type ClientAutomationsResponse, type EngineJobsHealth, type OverviewResponse, type ResolveFailuresBody } from "@shared/automationTypes";
import { buildOverviewRows, overviewTotals } from "../automations/health";
import { buildClientLines } from "../automations/clientGates";

const ENGINE_BASE = getEngineUrl();

let overviewCache: { data: OverviewResponse; ts: number } | null = null;
const OVERVIEW_TTL_MS = 25_000;

async function fetchEngineHealth(): Promise<EngineJobsHealth | null> {
  try {
    const r = await fetch(ENGINE_BASE + "/api/jobs-health", { signal: AbortSignal.timeout(3000) });
    return r.ok ? ((await r.json()) as EngineJobsHealth) : null;
  } catch {
    return null;
  }
}

/** Every workflow_name an automation writes its diary under. */
function namesFor(id: string): string[] {
  const entry = findEntry(id);
  return entry ? [entry.id, ...(entry.aliases ?? []), ...(entry.jobId ? [entry.jobId] : [])] : [id];
}

export function registerAutomationRoutes(app: Express) {
  app.get("/api/automations/overview", requireOwner, wrapAsync(async (_req, res) => {
    if (overviewCache && Date.now() - overviewCache.ts < OVERVIEW_TTL_MS) return res.json(overviewCache.data);
    const [engine, counts24h, clientsOn, pulse] = await Promise.all([
      fetchEngineHealth(),
      storage.getActionCountsByWorkflow(24),
      storage.getClientsOnCounts(),
      storage.getHourlyPulseByWorkflow(),
    ]);
    const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine, counts24h, clientsOn, pulse, now: Date.now() });
    const data: OverviewResponse = {
      engineReachable: engine !== null,
      schedulerRunning: engine?.scheduler_running ?? false,
      engineStartedAt: engine?.started_at ?? null,
      rows,
      totals: overviewTotals(rows),
    };
    overviewCache = { data, ts: Date.now() };
    res.json(data);
  }));

  app.get("/api/automations/:id/diary", requireOwner, wrapAsync(async (req, res) => {
    const id = String(req.params.id);
    const names = namesFor(id);
    const page = Math.min(10_000, Math.max(1, Math.floor(Number(req.query.page)) || 1));
    const rawAccountId = req.query.accountId ? Number(req.query.accountId) : undefined;
    const accountId = rawAccountId !== undefined && Number.isInteger(rawAccountId) && rawAccountId > 0 ? rawAccountId : undefined;
    res.json(await storage.getDiaryPage({
      names, page, limit: 50,
      accountId,
      failedOnly: req.query.failedOnly === "1",
    }));
  }));

  // Clear failures that were already fixed. Non-destructive: sets resolved_at, the diary rows stay.
  app.post("/api/automations/resolve", requireOwner, wrapAsync(async (req, res) => {
    const body = (req.body ?? {}) as Partial<ResolveFailuresBody>;
    const ids = Array.isArray(body.automationIds) ? body.automationIds.filter((x): x is string => typeof x === "string").slice(0, 100) : [];
    if (ids.length === 0) return res.status(400).json({ message: "automationIds required" });
    const posInt = (v: unknown) => (Number.isInteger(v) && (v as number) > 0 ? (v as number) : undefined);
    const names = Array.from(new Set(ids.flatMap(namesFor)));
    const resolved = await storage.resolveFailures({ names, accountId: posInt(body.accountId), campaignId: posInt(body.campaignId) });
    overviewCache = null;
    res.json({ resolved });
  }));

  app.post("/api/automations/diary/:lineId/resolve", requireOwner, wrapAsync(async (req, res) => {
    const id = Number(req.params.lineId);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "Invalid line id" });
    const ok = await storage.setFailureResolved(id, req.body?.resolved !== false);
    if (!ok) return res.status(404).json({ message: "Not a failure line" });
    overviewCache = null;
    res.json({ ok: true });
  }));

  app.get("/api/accounts/:id/automations", requireOwner, wrapAsync(async (req, res) => {
    const accountId = Number(req.params.id);
    if (!Number.isInteger(accountId) || accountId <= 0) return res.status(400).json({ message: "Invalid account id" });
    const [inputs, counts] = await Promise.all([
      storage.getGateInputs(accountId),
      storage.getActionCountsForAccount(accountId, 7),
    ]);
    const countsFor = (automationId: string, campaignId: number | null) => {
      const entry = findEntry(automationId);
      const names = entry ? [entry.id, ...(entry.aliases ?? [])] : [automationId];
      // Campaign lines read their campaign's rows; account lines read every row of that automation.
      let acc = { ...EMPTY_COUNTS };
      counts.forEach((c, key) => {
        const [name, camp] = key.split("|");
        if (!names.includes(name)) return;
        if (campaignId !== null && camp !== String(campaignId)) return;
        acc = {
          success: acc.success + c.success, failed: acc.failed + c.failed, skipped: acc.skipped + c.skipped,
          lastActionAt: !acc.lastActionAt || (c.lastActionAt && c.lastActionAt > acc.lastActionAt) ? c.lastActionAt : acc.lastActionAt,
          topFailureReason: acc.topFailureReason ?? c.topFailureReason,
        };
      });
      return acc;
    };
    const lines = buildClientLines(inputs).map((l) => ({ ...l, counts7d: countsFor(l.automationId, l.campaignId) }));
    const onIds = new Set(lines.filter((l) => l.state !== "off").map((l) => l.automationId));
    const allIds = new Set(lines.map((l) => l.automationId));
    const data: ClientAutomationsResponse = {
      accountId,
      lines,
      totals: {
        on: onIds.size,
        total: allIds.size,
        actions7d: lines.reduce((n, l) => n + l.counts7d.success + l.counts7d.failed + l.counts7d.skipped, 0),
        failed7d: lines.reduce((n, l) => n + l.counts7d.failed, 0),
      },
    };
    res.json(data);
  }));
}
