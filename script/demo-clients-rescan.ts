// One-off re-scan of website-built demo Clients, to fill the products, stock
// page, city and phone fields that did not exist when they were scanned. Dry
// run by default: SELECTs only, prints the count and what is empty per Client.
//
//   npx tsx --env-file=.env script/demo-clients-rescan.ts                         (dry run)
//   npx tsx --env-file=.env script/demo-clients-rescan.ts --execute --confirm=<N> (re-scans)
//
// N is the "clients to re-scan" count the dry run printed. --execute calls the
// engine's /api/site-kb per Client and language and fills only what is empty
// today (saveScanFields with overwrite false: nothing is replaced or blanked).
// It needs the Task 6 engine change live first: an engine without it returns no
// products, so the script stops at the first answer that lacks them.
import { db, pool } from "../server/db";
import { nicheVocabulary } from "@shared/schema";
import type { ProductsByLang } from "@shared/demoProducts";
import { clientLanguages, saveScanFields, type ClientRow, type DemoLang } from "../server/demo-clients";
import { scanFieldsFromScrape } from "../server/demoSiteFacts";
import { parseCleanupArgs } from "../server/demoProspects/cleanupPlan";

const USAGE = "Usage: npx tsx --env-file=.env script/demo-clients-rescan.ts [--execute --confirm=<N>]";
const DEFAULT_NICHE = "__default__";
const SCAN_TIMEOUT_MS = 120_000;

const blank = (v: string | null | undefined) => !(v ?? "").trim();

/** The languages whose product list is empty, and the three single-value fields that are. */
function gapsOf(row: ClientRow, languages: DemoLang[]) {
  const products = (row.products as ProductsByLang | null) ?? {};
  return {
    products: languages.filter((l) => !Array.isArray(products[l]) || (products[l] ?? []).length === 0),
    stockUrl: blank(row.stockUrl),
    city: blank(row.city),
    phone: blank(row.phone),
  };
}
type Gaps = ReturnType<typeof gapsOf>;

const hasGap = (g: Gaps) => g.products.length > 0 || g.stockUrl || g.city || g.phone;

/**
 * The languages worth a scan: each one with an empty product list. When only
 * the single-value fields are empty any one scan fills them, so the first
 * language is enough. Nothing when nothing is empty.
 */
function languagesToScan(languages: DemoLang[], gaps: Gaps): DemoLang[] {
  if (gaps.products.length > 0) return gaps.products;
  return gaps.stockUrl || gaps.city || gaps.phone ? languages.slice(0, 1) : [];
}

function describeGaps(g: Gaps): string {
  const parts: string[] = [];
  if (g.products.length > 0) parts.push(`products (${g.products.join(", ")})`);
  if (g.stockUrl) parts.push("stock url");
  if (g.city) parts.push("city");
  if (g.phone) parts.push("phone");
  return parts.length > 0 ? parts.join(", ") : "nothing";
}

class OldEngineError extends Error {}

/** One engine scan of a site in one language; null when the scan failed. */
async function scanSite(url: string, language: DemoLang): Promise<Record<string, unknown> | null> {
  const engineBase = process.env.ENGINE_URL || "http://localhost:8100";
  const resp = await fetch(`${engineBase}/api/site-kb`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
    body: JSON.stringify({ url, language }),
    signal: AbortSignal.timeout(SCAN_TIMEOUT_MS),
  });
  if (!resp.ok) {
    console.error(`    engine returned ${resp.status}`);
    return null;
  }
  const scraped = (await resp.json()) as Record<string, unknown>;
  // The Task 6 engine always answers with a products key (empty after a failed scan).
  if (!("products" in scraped)) {
    throw new OldEngineError("The engine's answer has no products key: the Task 6 engine change is not live. Stopping.");
  }
  return scraped.scrape_failed ? null : scraped;
}

async function main(): Promise<number> {
  const args = parseCleanupArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`${args.error}\n${USAGE}`);
    return 1;
  }

  const all = await db.select().from(nicheVocabulary);
  if (all.length === 0) {
    console.error("Aborting: Niche_Vocabulary returned no rows. Check DATABASE_URL and the schema. Nothing was changed.");
    return 1;
  }
  const targets = all
    .filter((r) => r.niche !== DEFAULT_NICHE && !r.isLive && !blank(r.websiteUrl))
    .sort((a, b) => a.niche.localeCompare(b.niche))
    .map((row) => {
      const languages = clientLanguages(row);
      const gaps = gapsOf(row, languages);
      return { row, languages, gaps, scan: languagesToScan(languages, gaps) };
    });

  console.log(args.execute ? "Demo client re-scan (EXECUTE)" : "Demo client re-scan (DRY RUN: nothing is scanned or written)");
  console.log(`clients to re-scan: ${targets.length}`);
  console.log(`  with something empty: ${targets.filter((t) => hasGap(t.gaps)).length}`);
  for (const t of targets) {
    const langs = t.languages.length > 0 ? t.languages.join(", ") : "none";
    console.log(`  ${t.row.niche} | ${t.row.websiteUrl} | languages: ${langs} | empty: ${describeGaps(t.gaps)}`);
  }

  if (!args.execute) return 0;

  console.warn(
    "WARNING: this needs the Task 6 engine change live first (the /api/site-kb answer must carry products, " +
      "stock_url and city). Each scan costs a site fetch and model calls; Clients with nothing empty are skipped.",
  );
  if (args.confirm !== targets.length) {
    console.error(`Refusing to re-scan: ${targets.length} clients are planned, so pass --execute --confirm=${targets.length}.`);
    return 1;
  }

  let written = 0;
  let failed = 0;
  for (const t of targets) {
    if (t.scan.length === 0) {
      console.log(`  skipped (nothing empty or no language): ${t.row.niche}`);
      continue;
    }
    for (const lang of t.scan) {
      try {
        const scraped = await scanSite(t.row.websiteUrl ?? "", lang);
        if (!scraped) {
          failed++;
          console.log(`  failed: ${t.row.niche} (${lang})`);
          continue;
        }
        const changed = await saveScanFields(t.row.niche, lang, scanFieldsFromScrape(scraped), false);
        if (changed) written++;
        console.log(`  ${changed ? "filled" : "nothing new"}: ${t.row.niche} (${lang})`);
      } catch (err) {
        if (err instanceof OldEngineError) {
          console.error(err.message);
          return 1;
        }
        failed++;
        console.error(`  failed: ${t.row.niche} (${lang})`, err);
      }
    }
  }
  console.log(`done: ${written} scans filled something, ${failed} failed`);
  return failed > 0 ? 1 : 0;
}

main()
  .then((code) => {
    process.exitCode = code;
  })
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
