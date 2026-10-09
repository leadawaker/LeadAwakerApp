import { test } from "node:test";
import assert from "node:assert/strict";
import { scheduledHealth, eventHealth, buildOverviewRows, overviewTotals } from "./health";
import { AUTOMATION_CATALOGUE, findEntry } from "@shared/automationCatalogue";
import { EMPTY_COUNTS, emptyPulse, type EngineJobsHealth } from "@shared/automationTypes";

const NOW = Date.parse("2026-10-09T12:00:00Z");
const bump = findEntry("bump_scheduler")!;
const iso = (msAgo: number) => new Date(NOW - msAgo).toISOString();
const inFuture = new Date(NOW + 60_000).toISOString();

test("engine unreachable → unknown", () => {
  assert.equal(scheduledHealth(undefined, bump, { now: NOW, engineReachable: false }), "unknown");
});

test("catalogued scheduled job not registered → late", () => {
  assert.equal(scheduledHealth(undefined, bump, { now: NOW, engineReachable: true }), "late");
});

test("last run raised → failing", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture, last_run_at: iso(60_000), last_ok: false, last_error: "KeyError", errors_24h: 1 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "failing");
});

test("next run overdue by more than one interval → late", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: iso(301_000 + 300_000), last_run_at: iso(900_000), last_ok: true, errors_24h: 0 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "late");
});

test("no run since restart → waiting", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture, last_run_at: null, last_ok: null, errors_24h: 0 };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "waiting");
});

test("old engine payload without last_* fields → healthy when on schedule", () => {
  const job = { id: "bump_scheduler", name: "", next_run_at: inFuture };
  assert.equal(scheduledHealth(job, bump, { now: NOW, engineReachable: true }), "healthy");
});

test("event health", () => {
  assert.equal(eventHealth(EMPTY_COUNTS), "idle");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 10 }), "healthy");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 10, failed: 1 }), "warning");
  assert.equal(eventHealth({ ...EMPTY_COUNTS, success: 1, failed: 3 }), "failing");
});

test("unlisted job and diary name appear as rows with entry null", () => {
  const engine: EngineJobsHealth = { scheduler_running: true, jobs: [{ id: "brand_new_job", name: "New", next_run_at: inFuture }] };
  const counts = new Map([["mystery_flow", { ...EMPTY_COUNTS, success: 2 }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine, counts24h: counts, clientsOn: new Map(), now: NOW });
  const unlisted = rows.filter((r) => r.entry === null).map((r) => r.id).sort();
  assert.deepEqual(unlisted, ["brand_new_job", "mystery_flow"]);
});

test("alias diary names fold into their entry", () => {
  const counts = new Map([["review_drafter", { ...EMPTY_COUNTS, success: 4 }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: counts, clientsOn: new Map(), now: NOW });
  assert.equal(rows.find((r) => r.id === "review_response")!.counts24h.success, 4);
  assert.equal(rows.some((r) => r.id === "review_drafter"), false);
});

test("quiet flag when last action older than quietAfterHours", () => {
  const counts = new Map([["inbound_handler", { ...EMPTY_COUNTS, success: 1, lastActionAt: iso(80 * 3600_000) }]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: counts, clientsOn: new Map(), now: NOW });
  assert.equal(rows.find((r) => r.id === "inbound_handler")!.quiet, true);
});

test("totals", () => {
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: new Map([["bump_scheduler", { ...EMPTY_COUNTS, failed: 2 }]]), clientsOn: new Map(), now: NOW });
  const t = overviewTotals(rows);
  assert.equal(t.automations, AUTOMATION_CATALOGUE.length);
  assert.equal(t.failures24h, 2);
});

test("send_queue_worker (3s interval) tolerates jitter via a 120s grace", () => {
  const sq = findEntry("send_queue_worker")!;
  const mk = (overdueMs: number) => ({ id: "send_queue_worker", name: "", next_run_at: iso(overdueMs), last_run_at: iso(overdueMs + 3000), last_ok: true, errors_24h: 0 });
  assert.equal(scheduledHealth(mk(30_000), sq, { now: NOW, engineReachable: true }), "healthy");
  assert.equal(scheduledHealth(mk(200_000), sq, { now: NOW, engineReachable: true }), "late");
});

test("hourly pulse folds aliases onto their entry and defaults to zeros", () => {
  const a = emptyPulse(); a.ok[23] = 2;
  const b = emptyPulse(); b.failed[23] = 1; b.ok[0] = 4;
  const pulse = new Map([["review_response", a], ["review_drafter", b]]);
  const rows = buildOverviewRows({ catalogue: AUTOMATION_CATALOGUE, engine: null, counts24h: new Map(), clientsOn: new Map(), pulse, now: NOW });
  const r = rows.find((x) => x.id === "review_response")!;
  assert.equal(r.pulse.ok[23], 2);
  assert.equal(r.pulse.failed[23], 1);
  assert.equal(r.pulse.ok[0], 4);
  assert.equal(rows.find((x) => x.id === "bump_scheduler")!.pulse.ok.length, 24);
});
