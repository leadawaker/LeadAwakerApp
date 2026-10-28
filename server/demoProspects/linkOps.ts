/**
 * Delete a link or a whole prospect, revoke a link, and re-mint it.
 *
 * What gets deleted (which tables, in which order) is the pure list in
 * ./purge.ts; which tokens a prospect owns is ./rows.ts. This file runs them:
 * a delete is one transaction, so a link is gone entirely or not at all.
 *
 * A manual delete is a hard delete of both lead rows and their child rows, the
 * same as the engine's nightly purge. Revoking keeps every row: it only stamps
 * Leads.demo_revoked_at, which every token lookup honours. Public website demos
 * refuse revoke and re-mint (the visitor made them, not Gabriel) but can be deleted.
 */

import { pool } from "../db";
import type { DemoDeleteResult, RemintResult } from "@shared/demoProspects";
import { buildDemoPageLink, buildWhatsAppLink, createPendingDemoLead, generateToken } from "../demo-session";
import { holdsPublicDemo, remintRefusal } from "./linkGuards";
import { DEMO_SCHEMA, purgeStatements, toDeleteResult } from "./purge";
import { remintSource, tokenOf, tokensInGroup } from "./rows";
import { deleteProspectRow, loadDemoLeadsLite, loadTokenLeads } from "./store";

export type LinkRefusal = { ok: false; reason: "missing" | "public_demo" | "revoked" };

/**
 * Hard-delete these lead rows and everything that hangs off them, in one
 * transaction. The rows removed per table: every child table that had rows,
 * and Leads always. Empty ids return {} without touching the database.
 */
export async function deleteDemoLeads(leadIds: number[]): Promise<Record<string, number>> {
  const ids = Array.from(new Set(leadIds));
  if (!ids.length) return {};

  const deleted: Record<string, number> = {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const { table, sql } of purgeStatements()) {
      const res = await client.query(sql, [ids]);
      const n = res.rowCount ?? 0;
      if (n || table === "Leads") deleted[table] = n;
    }
    await client.query("COMMIT");
    return deleted;
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

/** Delete one link (both of its lead rows). Null when the token has no rows. */
export async function deleteLink(token: string): Promise<DemoDeleteResult | null> {
  const rows = await loadTokenLeads(token);
  if (!rows.length) return null;
  const counts = await deleteDemoLeads(rows.map((r) => r.id));
  return toDeleteResult([token], counts);
}

/**
 * Delete a prospect: every link in its group, then the prospect's own row. A
 * group with nothing left deletes nothing and still succeeds, so a retry after
 * a half-finished delete just finishes it.
 */
export async function deleteProspect(group: string): Promise<DemoDeleteResult> {
  const demoLeads = await loadDemoLeadsLite();
  const tokens = tokensInGroup(demoLeads, group);
  const owned = new Set(tokens);
  const ids = demoLeads.filter((l) => owned.has(tokenOf(l.channelIdentifier))).map((l) => l.id);

  const counts = await deleteDemoLeads(ids);
  await deleteProspectRow(group);
  return toDeleteResult(tokens, counts);
}

/**
 * Mark both rows of a token revoked, so every token lookup stops honouring it.
 * Rows already revoked keep their first revoke time. `revoked` is the number of
 * rows marked now.
 */
export async function revokeToken(token: string): Promise<{ ok: true; revoked: number } | LinkRefusal> {
  const rows = await loadTokenLeads(token);
  if (!rows.length) return { ok: false, reason: "missing" };
  if (holdsPublicDemo(rows)) return { ok: false, reason: "public_demo" };

  // One statement: both rows change together.
  const res = await pool.query(
    `UPDATE "${DEMO_SCHEMA}"."Leads" SET demo_revoked_at = now(), updated_at = now() ` +
      `WHERE channel_identifier IN ($1, $2) AND demo_revoked_at IS NULL`,
    [`wa-demo:${token}`, `web-demo:${token}`],
  );
  return { ok: true, revoked: res.rowCount ?? 0 };
}

/**
 * Replace a link: mint a fresh token with the old link's persona, then revoke
 * the old one. The old rows and their conversation stay (revoked, not deleted).
 *
 * The new link is made first, so a failure never leaves the prospect with no
 * working link; if the revoke then fails, the unused new rows are removed again
 * so no live link is left that nobody was told about.
 *
 * A link that was already replaced is refused (`revoked`): minting from it
 * again would leave a second live link nobody was told about. A second
 * re-mint racing the first loses at the revoke (it marks no rows) and is
 * refused the same way, its new rows removed.
 */
export async function remintToken(token: string): Promise<{ ok: true; result: RemintResult } | LinkRefusal> {
  const rows = await loadTokenLeads(token);
  const refusal = remintRefusal(rows);
  if (refusal) return { ok: false, reason: refusal };

  const source = remintSource(rows);
  if (!source) return { ok: false, reason: "missing" };

  const { token: fresh } = generateToken();
  const freshLeadId = await createPendingDemoLead({
    token: fresh,
    firstName: source.firstName,
    language: source.language,
    campaignId: source.campaignId,
    demoNiche: source.demoNiche || undefined,
    invited: source.invited,
    source: source.source,
  });

  const discardFresh = () =>
    deleteDemoLeads([freshLeadId]).catch((e) =>
      console.error("[demo-links] could not remove an unused re-minted link", (e as Error).message),
    );

  let revoked: Awaited<ReturnType<typeof revokeToken>>;
  try {
    revoked = await revokeToken(token);
  } catch (err) {
    await discardFresh();
    throw err;
  }
  if (!revoked.ok) {
    await discardFresh();
    return revoked;
  }
  if (revoked.revoked === 0) {
    await discardFresh();
    return { ok: false, reason: "revoked" };
  }

  return {
    ok: true,
    result: {
      oldToken: token,
      token: fresh,
      demoUrl: buildDemoPageLink({ token: fresh }),
      whatsappUrl: buildWhatsAppLink({ token: fresh }),
    },
  };
}
