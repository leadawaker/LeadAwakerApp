/**
 * The database side of the Demos page's prospect rows (Demo_Prospects). The
 * grouping and mapping rules are pure and live in ./rows.ts; this file is the
 * thin queries around them.
 */

import { db } from "../db";
import { demoProspects, leads, nicheVocabulary, type DemoProspectRow } from "@shared/schema";
import { eq, or, like, desc } from "drizzle-orm";
import type { DemoProspectDto, DemoProspectSettings } from "@shared/demoProspects";
import type { DemoLeadLite } from "../demoSessionsFold";
import { prospectDto } from "./rows";

type ClientFields = { screenshotPath: string | null; websiteUrl: string | null };

/** The Client a prospect points at, for its screenshot and fallback website. */
async function clientFor(niche: string): Promise<ClientFields | null> {
  if (!niche) return null;
  const [client] = await db
    .select({ screenshotPath: nicheVocabulary.screenshotPath, websiteUrl: nicheVocabulary.websiteUrl })
    .from(nicheVocabulary)
    .where(eq(nicheVocabulary.niche, niche))
    .limit(1);
  return client ?? null;
}

const toDto = async (row: DemoProspectRow) => prospectDto(row, await clientFor(row.clientNiche));

/** Every prospect row, newest first, each with its Client's screenshot. */
export async function listProspects(): Promise<DemoProspectDto[]> {
  const rows = await db
    .select({
      row: demoProspects,
      screenshotPath: nicheVocabulary.screenshotPath,
      clientWebsiteUrl: nicheVocabulary.websiteUrl,
    })
    .from(demoProspects)
    .leftJoin(nicheVocabulary, eq(nicheVocabulary.niche, demoProspects.clientNiche))
    .orderBy(desc(demoProspects.createdAt), desc(demoProspects.id));
  return rows.map((r) =>
    prospectDto(r.row, { screenshotPath: r.screenshotPath, websiteUrl: r.clientWebsiteUrl }),
  );
}

export async function getProspect(group: string): Promise<DemoProspectDto | undefined> {
  const [row] = await db.select().from(demoProspects).where(eq(demoProspects.prospectGroup, group)).limit(1);
  return row ? toDto(row) : undefined;
}

/** Insert a row; `exists` when the group already has one (the unique key decides, not a prior read). */
export async function createProspect(
  input: DemoProspectSettings & { prospectGroup: string; notes: string; websiteUrl: string },
): Promise<{ ok: true; prospect: DemoProspectDto } | { ok: false; reason: "exists" }> {
  const now = new Date();
  const [row] = await db
    .insert(demoProspects)
    .values({ ...input, createdAt: now, updatedAt: now })
    .onConflictDoNothing({ target: demoProspects.prospectGroup })
    .returning();
  if (!row) return { ok: false, reason: "exists" };
  return { ok: true, prospect: await toDto(row) };
}

/**
 * Create the group's row or update it in place. `notes` and `websiteUrl` are
 * left alone on an existing row when omitted.
 */
export async function upsertProspect(
  group: string,
  values: DemoProspectSettings & { notes?: string; websiteUrl?: string },
): Promise<DemoProspectDto> {
  const now = new Date();
  const { notes, websiteUrl, ...settings } = values;
  const [row] = await db
    .insert(demoProspects)
    .values({ prospectGroup: group, ...settings, notes: notes ?? "", websiteUrl: websiteUrl ?? "", createdAt: now, updatedAt: now })
    .onConflictDoUpdate({
      target: demoProspects.prospectGroup,
      set: {
        ...settings,
        ...(notes !== undefined ? { notes } : {}),
        ...(websiteUrl !== undefined ? { websiteUrl } : {}),
        updatedAt: now,
      },
    })
    .returning();
  return toDto(row);
}

/** Delete the group's row. The number of rows removed (0 when it had none). */
export async function deleteProspectRow(group: string): Promise<number> {
  const removed = await db
    .delete(demoProspects)
    .where(eq(demoProspects.prospectGroup, group))
    .returning({ id: demoProspects.id });
  return removed.length;
}

/**
 * Every demo lead (both surfaces of every token) with the columns the Demos
 * page folds over, newest first. Shared by the sessions list, settings, delete
 * and the persona and script tooling, so each reads links the same way.
 * `limit` caps the rows (the sessions list wants the newest N tokens).
 */
export async function loadDemoLeadsLite(limit?: number): Promise<DemoLeadLite[]> {
  const query = db
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
    .where(or(like(leads.channelIdentifier, "wa-demo:%"), like(leads.channelIdentifier, "web-demo:%")))
    .orderBy(desc(leads.id))
    .$dynamic();
  const rows = await (limit ? query.limit(limit) : query);
  return rows.map((r) => ({ ...r, id: r.id as number }));
}
