// Unused home-improvement demo persona prune. Dry run by default: SELECTs only,
// prints the count and one line per candidate.
//
//   npx tsx --env-file=.env script/demo-personas-prune.ts                         (dry run)
//   npx tsx --env-file=.env script/demo-personas-prune.ts --execute --confirm=<N> (deletes)
//
// N is the "personas to delete" count the dry run printed. Selection rules live
// in server/demoProspects/personaPrune.ts (tested, Builder decision 18); each
// delete goes through deleteDemoClient, which also refuses curated packs.
import { pool } from "../server/db";
import { listDemoClients, deleteDemoClient } from "../server/demo-clients";
import { loadDemoLeadsLite, listProspects } from "../server/demoProspects/store";
import { liveTokensByClient } from "../server/demoProspects/clientUsage";
import { selectPrunablePersonas, tokensEverByClient } from "../server/demoProspects/personaPrune";
import { parseCleanupArgs } from "../server/demoProspects/cleanupPlan";

const USAGE = "Usage: npx tsx --env-file=.env script/demo-personas-prune.ts [--execute --confirm=<N>]";

async function main(): Promise<number> {
  const args = parseCleanupArgs(process.argv.slice(2));
  if (args.error) {
    console.error(`${args.error}\n${USAGE}`);
    return 1;
  }

  // The lead rows are loaded here, not through listDemoClients' own live count,
  // because that count swallows a failure and would read as "no live links".
  const demoLeads = await loadDemoLeadsLite();
  if (demoLeads.length === 0) {
    console.error(
      "Aborting: no demo lead rows were found, so the live-link guard would be empty. " +
        "Check DATABASE_URL and the schema before running this again. Nothing was deleted.",
    );
    return 1;
  }
  const clients = await listDemoClients();
  if (clients.length === 0) {
    console.error("Aborting: no personas were found in Niche_Vocabulary. Check DATABASE_URL and the schema. Nothing was deleted.");
    return 1;
  }
  const prospects = await listProspects();

  const liveTokens = liveTokensByClient(demoLeads, Date.now());
  const everTokens = tokensEverByClient(demoLeads);
  const prospectClients = new Set(prospects.map((p) => p.clientNiche).filter(Boolean));
  const candidates = selectPrunablePersonas(clients, liveTokens, prospectClients, everTokens);

  console.log(args.execute ? "Demo persona prune (EXECUTE)" : "Demo persona prune (DRY RUN: nothing is deleted)");
  console.log(`personas scanned: ${clients.length}, demo lead rows: ${demoLeads.length}, prospects: ${prospects.length}`);
  console.log(`personas to delete: ${candidates.length}`);
  for (const c of candidates) {
    console.log(`  ${c.niche} | ${c.label} | ${c.category} | tokens ever minted: ${c.tokensEver}`);
  }

  if (!args.execute) return 0;

  if (args.confirm !== candidates.length) {
    console.error(`Refusing to delete: ${candidates.length} personas are planned, so pass --execute --confirm=${candidates.length}.`);
    return 1;
  }
  if (candidates.length === 0) {
    console.log("Nothing to delete.");
    return 0;
  }
  let failed = 0;
  for (const c of candidates) {
    const result = await deleteDemoClient(c.niche);
    if (result !== "deleted") failed++;
    console.log(`  ${result}: ${c.niche}`);
  }
  console.log(`deleted ${candidates.length - failed} of ${candidates.length}`);
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
