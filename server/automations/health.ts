// Health + overview rules for the Automations page (specs/automation-overview).
// Pure functions: no DB, no fetch. Scheduled health comes from the engine's
// /api/jobs-health; event health from the last 24h of diary lines.
import { findEntry, entryJobId, type AutomationEntry, type AutomationTrigger } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, type ActionCounts, type EngineJob, type EngineJobsHealth, type HealthState, type OverviewResponse, type OverviewRow } from "@shared/automationTypes";

export function intervalSeconds(t: AutomationTrigger): number | null {
  if (t.type === "schedule") return t.everySeconds;
  if (t.type === "daily") return 86_400;
  return null;
}

export function scheduledHealth(job: EngineJob | undefined, entry: AutomationEntry, opts: { now: number; engineReachable: boolean }): HealthState {
  if (!opts.engineReachable) return "unknown";
  if (!job) return "late";
  if (job.last_ok === false) return "failing";
  const interval = intervalSeconds(entry.trigger) ?? 86_400;
  if (job.next_run_at && opts.now - Date.parse(job.next_run_at) > interval * 1000) return "late";
  if ("last_run_at" in job && job.last_run_at == null) return "waiting";
  return "healthy";
}

export function eventHealth(c: ActionCounts): HealthState {
  const total = c.success + c.failed + c.skipped;
  if (total === 0) return "idle";
  if (c.failed >= 3 && c.failed > c.success) return "failing";
  if (c.failed > 0) return "warning";
  return "healthy";
}

function mergeCounts(a: ActionCounts, b: ActionCounts): ActionCounts {
  const later = (x: string | null, y: string | null) => (!x ? y : !y ? x : x > y ? x : y);
  return {
    success: a.success + b.success,
    failed: a.failed + b.failed,
    skipped: a.skipped + b.skipped,
    lastActionAt: later(a.lastActionAt, b.lastActionAt),
    topFailureReason: a.topFailureReason ?? b.topFailureReason,
  };
}

export function buildOverviewRows(args: {
  catalogue: AutomationEntry[];
  engine: EngineJobsHealth | null;
  counts24h: Map<string, ActionCounts>;
  clientsOn: Map<string, number>;
  now: number;
}): OverviewRow[] {
  const { catalogue, engine, counts24h, clientsOn, now } = args;
  const engineReachable = engine !== null;
  const jobs = new Map((engine?.jobs ?? []).map((j) => [j.id, j]));

  // Fold diary names (ids + aliases) into catalogue ids; collect unknown names.
  const byId = new Map<string, ActionCounts>();
  const unlistedCounts = new Map<string, ActionCounts>();
  counts24h.forEach((c, name) => {
    const e = findEntry(name);
    const target = e ? byId : unlistedCounts;
    const key = e ? e.id : name;
    target.set(key, mergeCounts(target.get(key) ?? EMPTY_COUNTS, c));
  });

  const rows: OverviewRow[] = catalogue.map((entry) => {
    const counts = byId.get(entry.id) ?? EMPTY_COUNTS;
    const jobId = entryJobId(entry);
    const job = jobId ? jobs.get(jobId) : undefined;
    let health = jobId ? scheduledHealth(job, entry, { now, engineReachable }) : eventHealth(counts);
    if (jobId && health === "healthy" && counts.failed > 0) health = "warning";
    const quiet = !!entry.quietAfterHours && !!counts.lastActionAt
      && now - Date.parse(counts.lastActionAt) > entry.quietAfterHours * 3600_000;
    return {
      id: entry.id,
      entry,
      health,
      lastRunAt: job?.last_run_at ?? counts.lastActionAt ?? null,
      lastError: job?.last_error ?? null,
      counts24h: counts,
      clientsOn: entry.audience === "client" ? (clientsOn.get(entry.id) ?? 0) : null,
      quiet,
    };
  });

  const listedJobIds = new Set(catalogue.map(entryJobId).filter(Boolean) as string[]);
  const unlistedIds = new Set<string>(unlistedCounts.keys());
  jobs.forEach((_j, id) => { if (!listedJobIds.has(id) && !findEntry(id)) unlistedIds.add(id); });
  unlistedIds.forEach((id) => {
    const job = jobs.get(id);
    const counts = unlistedCounts.get(id) ?? EMPTY_COUNTS;
    rows.push({
      id,
      entry: null,
      health: job ? (job.last_ok === false ? "failing" : "healthy") : eventHealth(counts),
      lastRunAt: job?.last_run_at ?? counts.lastActionAt ?? null,
      lastError: job?.last_error ?? null,
      counts24h: counts,
      clientsOn: null,
      quiet: false,
    });
  });
  return rows;
}

export function overviewTotals(rows: OverviewRow[]): OverviewResponse["totals"] {
  return {
    automations: rows.length,
    healthy: rows.filter((r) => r.health === "healthy" || r.health === "idle").length,
    late: rows.filter((r) => r.health === "late" || r.health === "warning").length,
    failing: rows.filter((r) => r.health === "failing").length,
    failures24h: rows.reduce((n, r) => n + r.counts24h.failed, 0),
  };
}
