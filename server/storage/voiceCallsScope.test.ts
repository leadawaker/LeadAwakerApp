/**
 * Every call lives in exactly one tab (Tests, else Demo, else Live): the SQL each scope
 * sends, and which tab a call row reads as. The database is never touched.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

process.env.DATABASE_URL ??= "postgres://test@127.0.0.1:1/none"; // never connected: nothing here queries

const { scopeOf, scopeWhere } = await import("./voiceCalls");

const dialect = new PgDialect();
const text = (q: SQL) => dialect.sqlToQuery(q).sql.replace(/\s+/g, " ");

const IS_TEST_CALL = /^\("p2mxx34fvbf3ll6"\."Voice_Calls"\."test_account_id" IS NOT NULL\)$/;

test("Live holds neither demo nor test calls", () => {
  const sql = text(scopeWhere("live", null));
  assert.match(sql, /^NOT \(/);
  assert.match(sql, /AND NOT \(\"p2mxx34fvbf3ll6\"\.\"Voice_Calls\"\."test_account_id" IS NOT NULL/);
});

test("Demo holds demo calls that are not tests", () => {
  const sql = text(scopeWhere("demo", null));
  assert.match(sql, /^\(\s*EXISTS/);
  assert.match(sql, /AND NOT \(\"p2mxx34fvbf3ll6\"\.\"Voice_Calls\"\."test_account_id" IS NOT NULL/);
});

test("Tests holds only the Test call button's calls, not calls marked as test data", () => {
  const sql = text(scopeWhere("test", null));
  assert.match(sql, IS_TEST_CALL);
  assert.doesNotMatch(sql, /is_test|is_demo/);
});

test("hideTest (clients) also drops marked test data; agency does not", () => {
  assert.match(text(scopeWhere("live", null, true)), /"is_test", false\) = false/);
  assert.doesNotMatch(text(scopeWhere("live", null)), /is_test/);
});

test("an account pins every scope (Tests by the tested client, not the demo account)", () => {
  for (const scope of ["live", "demo"] as const) {
    assert.match(text(scopeWhere(scope, 53)), /"Voice_Calls"\."accounts_id" = \$1$/);
  }
  assert.match(text(scopeWhere("test", 53)), /"Voice_Calls"\."test_account_id" = \$1$/);
});

test("a call row reads as test first, then demo, else live", () => {
  assert.equal(scopeOf({ isDemo: true, testCall: true }), "test");
  assert.equal(scopeOf({ isDemo: false, testCall: true }), "test");
  assert.equal(scopeOf({ isDemo: true, testCall: false }), "demo");
  assert.equal(scopeOf({ isDemo: false, testCall: false }), "live");
});
