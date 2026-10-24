/**
 * Gabriel's tests on a client's line never reach the client (plan Task 10):
 * the unread chat badge, the billing booking stats and the Voice tab's
 * unwanted calls. The database is faked: each test reads the SQL a query sends.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test@127.0.0.1:1/none"; // never connected: every query is faked

const { db } = await import("../db");
const { notificationsStorage } = await import("./notifications");
const { billingStorage } = await import("./billing");
const { voiceLinesStorage } = await import("./voiceLines");

const dialect = new PgDialect();
const text = (q: SQL) => dialect.sqlToQuery(q).sql.replace(/\s+/g, " ");

/** Fakes db.select chains and db.execute; returns every WHERE and every executed query, as text. */
function capture(rows: unknown[] = []) {
  const wheres: string[] = [];
  const executed: string[] = [];
  const chain: any = {
    from: () => chain,
    where: (w: SQL) => { wheres.push(text(w)); return chain; },
    orderBy: () => chain,
    limit: async () => rows,
    then: (ok: (v: unknown[]) => unknown) => Promise.resolve(rows).then(ok),
  };
  const saved = { select: db.select, execute: db.execute };
  (db as any).select = () => chain;
  (db as any).execute = async (q: SQL) => { executed.push(text(q)); return { rows }; };
  const restore = () => { (db as any).select = saved.select; (db as any).execute = saved.execute; };
  return { wheres, executed, restore };
}

const TEST_LEAD = /COALESCE\("p2mxx34fvbf3ll6"\."Leads"\."is_test", false\) = false/;
const TEST_THREAD = /tv\.call_id = "p2mxx34fvbf3ll6"\."Interactions"\."conversation_thread_id" AND tv\.is_test = true/;

test("the unread chat badge leaves out test calls and test leads for a client", async () => {
  const c = capture();
  try {
    await notificationsStorage.getRecentNotifications(53, 20, true);
  } finally { c.restore(); }
  const [inbound, booked] = c.wheres;
  assert.match(inbound, TEST_THREAD);
  assert.match(inbound, /tl\.is_test = true/);
  assert.match(booked, TEST_LEAD);
});

test("the agency's badge still counts everything", async () => {
  const c = capture();
  try {
    await notificationsStorage.getRecentNotifications(undefined);
  } finally { c.restore(); }
  for (const w of c.wheres) assert.doesNotMatch(w, /is_test/);
});

test("booking stats never count a test lead, month detail or summary", async () => {
  for (const opts of [{ month: "2026-10" }, { months: 2 }]) {
    const c = capture();
    try {
      await billingStorage.getAccountBookingStats(53, opts);
    } finally { c.restore(); }
    const leadsQuery = c.executed.find((q) => q.includes('"Leads"'));
    assert.ok(leadsQuery, JSON.stringify(opts));
    assert.match(leadsQuery!, /AND COALESCE\(is_test, false\) = false/);
  }
});

test("a client does not see an abuse strike raised on a test call", async () => {
  const c = capture();
  try {
    await voiceLinesStorage.listBlockedCallers(53, true);
  } finally { c.restore(); }
  assert.match(c.executed[0], /tv\.call_id = b\.call_id AND tv\.is_test = true/);
});

test("the agency sees every strike", async () => {
  const c = capture();
  try {
    await voiceLinesStorage.listBlockedCallers(53);
  } finally { c.restore(); }
  assert.doesNotMatch(c.executed[0], /is_test/);
});
