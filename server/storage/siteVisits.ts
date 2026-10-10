// server/storage/siteVisits.ts
// The public site's visit counter: writes from POST /api/site/visit, reads for
// the Owner-only Traffic page. Days are Europe/Amsterdam days.
import { sql } from "drizzle-orm";
import { db } from "../db";
import { siteVisits } from "@shared/schema";
import type { TrafficDays, VisitTotals, VisitsResponse } from "@shared/trafficTypes";
import { classifyVisit } from "../traffic/sources";

const T = sql.raw(`"p2mxx34fvbf3ll6"."Site_Visits"`);
const DAY = sql.raw(`(created_at AT TIME ZONE 'Europe/Amsterdam')::date`);
const TODAY = sql.raw(`(NOW() AT TIME ZONE 'Europe/Amsterdam')::date`);

export interface NewSiteVisit {
  path: string;
  lang: string | null;
  isEntry: boolean;
  referrerHost: string | null;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
  device: string | null;
  timezone: string | null;
}

const ZERO: VisitTotals = { visits: 0, views: 0, ai: 0 };

export const siteVisitsStorage = {
  async recordSiteVisit(visit: NewSiteVisit): Promise<void> {
    await db.insert(siteVisits).values(visit);
  },

  /** Rows older than 25 months are dropped: enough for a year-on-year look. */
  async pruneSiteVisits(): Promise<void> {
    await db.execute(sql`DELETE FROM ${T} WHERE created_at < NOW() - INTERVAL '25 months'`);
  },

  /** The last `days` days including today, with the `days` before them for comparison. */
  async getSiteVisitsOverview(days: TrafficDays): Promise<VisitsResponse> {
    const current = sql`${DAY} > ${TODAY} - ${days}::int`;
    const bothPeriods = sql`${DAY} > ${TODAY} - ${days * 2}::int`;
    const breakdown = (column: "lang" | "device" | "timezone") => db.execute(sql`
      SELECT COALESCE(${sql.raw(column)}, '') AS key, COUNT(*) AS visits
      FROM ${T} WHERE is_entry AND ${current}
      GROUP BY 1 ORDER BY 2 DESC LIMIT 8
    `);

    const [since, daily, totals, origins, pages, languages, devices, timezones] = await Promise.all([
      db.execute(sql`SELECT MIN(created_at) AS since FROM ${T}`),
      db.execute(sql`
        SELECT to_char(d.day, 'YYYY-MM-DD') AS date, COALESCE(v.views, 0) AS views, COALESCE(v.visits, 0) AS visits
        FROM generate_series(${TODAY} - ${days - 1}::int, ${TODAY}, INTERVAL '1 day') AS d(day)
        LEFT JOIN (
          SELECT ${DAY} AS day, COUNT(*) AS views, COUNT(*) FILTER (WHERE is_entry) AS visits
          FROM ${T} WHERE ${current} GROUP BY 1
        ) v ON v.day = d.day::date
        ORDER BY d.day
      `),
      db.execute(sql`
        SELECT (${current}) AS is_current, COUNT(*) AS views, COUNT(*) FILTER (WHERE is_entry) AS visits
        FROM ${T} WHERE ${bothPeriods} GROUP BY 1
      `),
      db.execute(sql`
        SELECT (${current}) AS is_current, referrer_host, utm_source, utm_medium, COUNT(*) AS visits
        FROM ${T} WHERE is_entry AND ${bothPeriods} GROUP BY 1, 2, 3, 4
      `),
      db.execute(sql`
        SELECT path, COUNT(*) AS views, COUNT(*) FILTER (WHERE is_entry) AS visits
        FROM ${T} WHERE ${current} GROUP BY 1 ORDER BY 2 DESC, 1 LIMIT 20
      `),
      breakdown("lang"),
      breakdown("device"),
      breakdown("timezone"),
    ]);

    const now: VisitTotals = { ...ZERO };
    const before: VisitTotals = { ...ZERO };
    for (const r of totals.rows as any[]) {
      const target = r.is_current ? now : before;
      target.views = Number(r.views);
      target.visits = Number(r.visits);
    }

    // Several referrer/utm combinations fold into one source ("google.com" and
    // "google.nl" are both Google), so the grouping finishes here.
    const sources = new Map<string, VisitsResponse["sources"][number]>();
    for (const r of origins.rows as any[]) {
      const source = classifyVisit({ referrerHost: r.referrer_host, utmSource: r.utm_source, utmMedium: r.utm_medium });
      const visits = Number(r.visits);
      if (source.channel === "ai") (r.is_current ? now : before).ai += visits;
      if (!r.is_current) continue;
      const key = `${source.channel}|${source.label ?? ""}`;
      const row = sources.get(key) ?? { ...source, visits: 0 };
      row.visits += visits;
      sources.set(key, row);
    }

    const keyed = (res: { rows: unknown[] }) => (res.rows as any[]).map((r) => ({ key: String(r.key), visits: Number(r.visits) }));
    const first = (since.rows[0] as any)?.since;
    return {
      days,
      since: first ? new Date(first).toISOString() : null,
      totals: now,
      previous: before,
      daily: (daily.rows as any[]).map((r) => ({ date: r.date, views: Number(r.views), visits: Number(r.visits) })),
      sources: [...sources.values()].sort((a, b) => b.visits - a.visits).slice(0, 20),
      pages: (pages.rows as any[]).map((r) => ({ path: r.path, views: Number(r.views), visits: Number(r.visits) })),
      languages: keyed(languages),
      devices: keyed(devices),
      timezones: keyed(timezones),
    };
  },
};
