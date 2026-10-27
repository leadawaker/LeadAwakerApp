import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_CHILD_TABLES, DEMO_SCHEMA, countStatements, purgeStatements, toDeleteResult } from "./purge";

test("purgeStatements: child tables in the engine's order, Leads last", () => {
  const s = purgeStatements();
  assert.deepEqual(
    s.map((x) => x.table),
    ["Interactions", "Leads_Tags", "Automation_Logs", "Send_Queue", "Booking_Links", "Notifications", "Lead_Score_History", "Tasks", "Leads"],
  );
  assert.match(
    s[0].sql,
    /^DELETE FROM "p2mxx34fvbf3ll6"\."Interactions" WHERE "Leads_id" = ANY\(\$1::int\[\]\) OR "lead_id" = ANY\(\$1::int\[\]\)$/,
  );
  assert.match(s.at(-1)!.sql, /"Leads" WHERE "id" = ANY\(\$1::int\[\]\)$/);
});

test("purgeStatements: every statement takes the one id array", () => {
  for (const { sql } of purgeStatements()) {
    assert.match(sql, /^DELETE FROM "p2mxx34fvbf3ll6"\."[A-Za-z_]+" WHERE /);
    assert.doesNotMatch(sql, /\$2/);
  }
});

test("purgeStatements: one column per child table gives a single condition", () => {
  const send = purgeStatements().find((x) => x.table === "Send_Queue")!;
  assert.equal(send.sql, 'DELETE FROM "p2mxx34fvbf3ll6"."Send_Queue" WHERE "Leads_id" = ANY($1::int[])');
  const scores = purgeStatements().find((x) => x.table === "Lead_Score_History")!;
  assert.match(scores.sql, /WHERE "leads_id" = ANY\(\$1::int\[\]\)$/);
});

test("purgeStatements: the schema is a parameter", () => {
  assert.match(purgeStatements("other")[0].sql, /^DELETE FROM "other"\."Interactions"/);
  assert.equal(DEMO_SCHEMA, "p2mxx34fvbf3ll6");
});

test("countStatements: the same tables and WHERE clauses as the deletes, as counts", () => {
  const del = purgeStatements();
  const cnt = countStatements();
  assert.deepEqual(cnt.map((x) => x.table), del.map((x) => x.table));
  assert.match(cnt[6].sql, /^SELECT count\(\*\)::int AS n FROM "p2mxx34fvbf3ll6"\."Lead_Score_History" WHERE "leads_id"/);
  for (let i = 0; i < del.length; i++) {
    assert.equal(cnt[i].sql.split(" WHERE ")[1], del[i].sql.split(" WHERE ")[1]);
  }
  assert.match(cnt.at(-1)!.sql, /"Leads" WHERE "id" = ANY\(\$1::int\[\]\)$/);
});

test("DEMO_CHILD_TABLES: every child table has at least one lead-id column", () => {
  for (const [table, cols] of DEMO_CHILD_TABLES) {
    assert.ok(cols.length > 0, table);
  }
});

test("toDeleteResult: Leads is the lead count, every other table is a child count", () => {
  assert.deepEqual(toDeleteResult(["aaaa1111"], { Interactions: 12, Tasks: 1, Leads: 2 }), {
    tokens: ["aaaa1111"],
    leads: 2,
    children: { Interactions: 12, Tasks: 1 },
  });
  assert.deepEqual(toDeleteResult([], {}), { tokens: [], leads: 0, children: {} });
});
