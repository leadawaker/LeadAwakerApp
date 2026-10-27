/**
 * Which tables hold a demo lead's rows, and the SQL that removes or counts them.
 *
 * Pure (no db import) so the order and the WHERE clauses are tested on their
 * own. Mirrors the engine's nightly purge, `_CHILD_TABLES` in
 * src/automations/demo_data_purge.py: keep the two lists in step. Child tables
 * go first and Leads last, because Tasks and Lead_Score_History hold real
 * foreign keys (ON DELETE NO ACTION) and the rest would silently orphan.
 */

import type { DemoDeleteResult } from "@shared/demoProspects";

export const DEMO_SCHEMA = "p2mxx34fvbf3ll6";

/** [table, the columns that point at a lead id], in delete order. */
export const DEMO_CHILD_TABLES: ReadonlyArray<readonly [string, readonly string[]]> = [
  ["Interactions", ["Leads_id", "lead_id"]],
  ["Leads_Tags", ["Leads_id", "lead_id"]],
  ["Automation_Logs", ["Leads_id", "lead_id"]],
  ["Send_Queue", ["Leads_id"]],
  ["Booking_Links", ["lead_id"]],
  ["Notifications", ["lead_id"]],
  ["Lead_Score_History", ["leads_id"]],
  ["Tasks", ["Leads_id"]],
];

const anyOf = (column: string) => `"${column}" = ANY($1::int[])`;

/** [table, WHERE clause over $1::int[]] for every table, Leads last. */
function targets(): { table: string; where: string }[] {
  return [
    ...DEMO_CHILD_TABLES.map(([table, columns]) => ({ table, where: columns.map(anyOf).join(" OR ") })),
    { table: "Leads", where: anyOf("id") },
  ];
}

/** The DELETE for each table, in the order they must run. Every sql takes the lead ids as $1::int[]. */
export function purgeStatements(schema: string = DEMO_SCHEMA): { table: string; sql: string }[] {
  return targets().map(({ table, where }) => ({
    table,
    sql: `DELETE FROM "${schema}"."${table}" WHERE ${where}`,
  }));
}

/** The same WHERE clauses as purgeStatements, as row counts (a dry run's numbers). */
export function countStatements(schema: string = DEMO_SCHEMA): { table: string; sql: string }[] {
  return targets().map(({ table, where }) => ({
    table,
    sql: `SELECT count(*)::int AS n FROM "${schema}"."${table}" WHERE ${where}`,
  }));
}

/** Per-table delete counts (Leads included) as the result the Demos page reads. */
export function toDeleteResult(tokens: string[], counts: Record<string, number>): DemoDeleteResult {
  const { Leads, ...children } = counts;
  return { tokens, leads: Leads ?? 0, children };
}
