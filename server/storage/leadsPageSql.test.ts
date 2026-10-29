/** The Chats list leaves phone turns out of its order and preview; every other list keeps them. */
import { test } from "node:test";
import assert from "node:assert/strict";

process.env.DATABASE_URL ??= "postgres://test@127.0.0.1:1/none"; // never connected: nothing here queries

const { baseSql } = await import("./leadsPage");

const NO_PHONE = "FILTER (WHERE i.channel IS DISTINCT FROM 'phone')";

test("Chats: last message, last direction and last activity skip phone turns", () => {
  const sql = baseSql(true).replace(/\s+/g, " ");
  assert.match(sql, /ORDER BY i\.created_at DESC NULLS LAST\) FILTER \(WHERE i\.channel IS DISTINCT FROM 'phone'\)\)\[1\] AS last_message/);
  assert.match(sql, /\) FILTER \(WHERE i\.channel IS DISTINCT FROM 'phone'\)\)\[1\] AS last_dir/);
  assert.match(sql, /max\(i\.created_at\) FILTER \(WHERE i\.channel IS DISTINCT FROM 'phone'\) AS any_at/);
});

test("the Leads directory keeps calls in its order and preview", () => {
  const sql = baseSql(false);
  assert.match(sql, /max\(i\.created_at\) AS any_at/);
  assert.match(sql, /\)\[1\] AS last_message/);
  assert.equal(sql.split(NO_PHONE).length - 1, 2); // only the two older phone-free fields (message direction and AI flag)
});

test("every lead says whether it is demo", () => {
  assert.match(baseSql(true), /AS is_demo/);
});
