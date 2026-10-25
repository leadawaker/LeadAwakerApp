import test from "node:test";
import assert from "node:assert/strict";
import { guarded, tickWeeklyReviews, type WeeklyDeps } from "./scheduler";
import type { ReviewJob } from "./runReview";
import type { ReviewWeek } from "./weekWindow";

const MONDAY_0630Z = new Date("2026-10-26T06:30:00Z"); // 07:30 in Amsterdam (CET): last week is due

function deps(over: Partial<WeeklyDeps> = {}) {
  const calls = { accounts: [] as [Date, Date][], claims: [] as [number, ReviewWeek][], runs: [] as ReviewJob[], stalled: 0 };
  const d: WeeklyDeps = {
    now: () => MONDAY_0630Z,
    accountsWithCalls: async (s, e) => { calls.accounts.push([s, e]); return [53, 60]; },
    claim: async (accountId, week) => { calls.claims.push([accountId, week]); return accountId === 60 ? null : 500 + accountId; },
    run: async (job) => { calls.runs.push(job); return "done"; },
    failStalled: async () => { calls.stalled++; return 0; },
    ...over,
  };
  return { d, calls };
}

// One account's error is logged, not shown: keep the test output clean.
async function quiet<T>(fn: () => Promise<T>): Promise<T> {
  const original = console.error;
  console.error = () => {};
  try { return await fn(); } finally { console.error = original; }
}

test("tickWeeklyReviews runs the claimed account for last week and skips the one it could not claim", async () => {
  const { d, calls } = deps();
  assert.equal(await tickWeeklyReviews(d), 1);
  assert.deepEqual(calls.runs, [{
    reviewId: 553, accountId: 53,
    periodStart: new Date("2026-10-18T22:00:00Z"), periodEnd: new Date("2026-10-25T23:00:00Z"),
  }]);
  assert.deepEqual(calls.claims.map((c) => c[0]), [53, 60]);
  assert.equal(calls.claims[0][1].weekKey, "2026-W43");
  assert.deepEqual(calls.accounts, [[new Date("2026-10-18T22:00:00Z"), new Date("2026-10-25T23:00:00Z")]]);
});

test("tickWeeklyReviews: a run that throws does not stop the next account", async () => {
  const seen: number[] = [];
  const { d } = deps({
    claim: async (accountId) => accountId,
    run: async (job) => { seen.push(job.accountId); if (job.accountId === 53) throw new Error("boom"); return "done"; },
  });
  assert.equal(await quiet(() => tickWeeklyReviews(d)), 1);
  assert.deepEqual(seen, [53, 60]);
});

test("tickWeeklyReviews: a claim that throws does not stop the next account", async () => {
  const { d, calls } = deps({
    claim: async (accountId) => { if (accountId === 53) throw new Error("db"); return accountId; },
  });
  assert.equal(await quiet(() => tickWeeklyReviews(d)), 1);
  assert.deepEqual(calls.runs.map((j) => j.accountId), [60]);
});

test("tickWeeklyReviews: a failed review still counts as run", async () => {
  const { d } = deps({ claim: async (accountId) => accountId, run: async () => "failed" });
  assert.equal(await tickWeeklyReviews(d), 2);
});

test("tickWeeklyReviews: no accounts gives 0 and no claim", async () => {
  const { d, calls } = deps({ accountsWithCalls: async () => [] });
  assert.equal(await tickWeeklyReviews(d), 0);
  assert.equal(calls.claims.length, 0);
  assert.equal(calls.runs.length, 0);
});

test("tickWeeklyReviews: before Monday 07:00 the week before last is still the due one", async () => {
  const { d, calls } = deps({ now: () => new Date("2026-10-26T05:30:00Z"), accountsWithCalls: async () => [53], claim: async () => 1 });
  await tickWeeklyReviews(d);
  assert.equal(calls.runs[0].periodStart.toISOString(), "2026-10-11T22:00:00.000Z");
  assert.equal(calls.runs[0].periodEnd.toISOString(), "2026-10-18T22:00:00.000Z");
});

test("tickWeeklyReviews fails the stalled reviews first, on every tick", async () => {
  const order: string[] = [];
  const { d } = deps({
    failStalled: async () => { order.push("stalled"); return 2; },
    accountsWithCalls: async () => { order.push("accounts"); return []; },
  });
  await quiet(() => tickWeeklyReviews(d));
  await quiet(() => tickWeeklyReviews(d));
  assert.deepEqual(order, ["stalled", "accounts", "stalled", "accounts"]);
});

test("tickWeeklyReviews: failStalled throwing is logged and the reviews still run", async () => {
  const { d, calls } = deps({ failStalled: async () => { throw new Error("db"); } });
  assert.equal(await quiet(() => tickWeeklyReviews(d)), 1);
  assert.equal(calls.runs.length, 1);
});

test("tickWeeklyReviews works without a failStalled dependency", async () => {
  const { d } = deps({ failStalled: undefined });
  assert.equal(await tickWeeklyReviews(d), 1);
});

test("guarded: a call while the previous one is still running returns at once", async () => {
  let runs = 0;
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const fn = guarded(async () => { runs++; await gate; });
  const first = fn();
  await fn();
  await fn();
  assert.equal(runs, 1);
  release();
  await first;
  await fn();
  assert.equal(runs, 2, "free again once the first call finished");
});

test("guarded: a throwing function is logged and does not block the next call", async () => {
  let runs = 0;
  const fn = guarded(async () => { runs++; throw new Error("boom"); });
  await quiet(async () => { await fn(); await fn(); });
  assert.equal(runs, 2);
});
