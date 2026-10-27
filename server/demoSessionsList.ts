/**
 * The Demos page's index: the database read behind /api/demo/sessions. The
 * folding of lead rows into one row per token is pure and lives in
 * demoSessionsFold.ts.
 */

import { db } from "./db";
import { leads, interactions } from "@shared/schema";
import { eq, and, or, like, desc, inArray, count, max, min } from "drizzle-orm";
import { buildDemoPageLink, buildWhatsAppLink } from "./demo-session";
import { foldDemoLeads, type DemoLeadLite, type DemoSessionRow, type ReplyCounts } from "./demoSessionsFold";

export type { DemoSessionRow, DemoSurfaceRow } from "./demoSessionsFold";

/**
 * Every demo link, newest first, one row per token (see foldDemoLeads).
 *
 * Reply counts come from one grouped Interactions query rather than a per-row
 * lookup: at 200 tokens the naive version is 400 round trips.
 */
export async function listDemoSessions(limit = 200): Promise<DemoSessionRow[]> {
  const rows = await db
    .select({
      id: leads.id,
      channelIdentifier: leads.channelIdentifier,
      firstName: leads.firstName,
      language: leads.language,
      demoNiche: leads.demoNiche,
      demoInvited: leads.demoInvited,
      source: leads.source,
      phone: leads.phone,
      campaignsId: leads.campaignsId,
      createdAt: leads.createdAt,
      conversionStatus: leads.conversionStatus,
      demoRevokedAt: leads.demoRevokedAt,
    })
    .from(leads)
    .where(
      or(
        like(leads.channelIdentifier, "wa-demo:%"),
        like(leads.channelIdentifier, "web-demo:%"),
      ),
    )
    .orderBy(desc(leads.id))
    // Two surfaces per token, so the row budget is double the token budget.
    .limit(limit * 2);

  if (!rows.length) return [];

  const replyCounts: ReplyCounts = new Map();
  const ids = rows.map((r) => r.id as number);
  const counted = await db
    .select({
      leadsId: interactions.leadsId,
      n: count(),
      // First inbound is when a WhatsApp demo actually began (see the fold);
      // last is how recently it moved.
      first: min(interactions.createdAt),
      last: max(interactions.createdAt),
    })
    .from(interactions)
    .where(and(inArray(interactions.leadsId, ids), eq(interactions.direction, "inbound")))
    .groupBy(interactions.leadsId);
  for (const c of counted) {
    replyCounts.set(c.leadsId as number, {
      n: Number(c.n) || 0,
      first: (c.first as Date) ?? null,
      last: (c.last as Date) ?? null,
    });
  }

  const lite: DemoLeadLite[] = rows.map((r) => ({ ...r, id: r.id as number }));
  return foldDemoLeads(lite, replyCounts, {
    now: Date.now(),
    linksFor: (token) => ({
      demoUrl: buildDemoPageLink({ token }),
      whatsappUrl: buildWhatsAppLink({ token }),
    }),
  }).slice(0, limit);
}
