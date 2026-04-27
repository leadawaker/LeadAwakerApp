/**
 * Company-level enrichment.
 *
 * Spawns a detached Claude Code agent that runs the `/prospect` skill's
 * "Company Enrichment" section against a given prospect ID. The agent
 * combines LinkedIn company scraping (via RapidAPI), conditional website
 * scraping, and Google Custom Search to populate:
 *   - company_summary, company_services, company_history, audit_insights
 *   - company_top_post_data (top 3 posts from the company LinkedIn page)
 *   - prospects.phone, prospects.email (company main line + role email)
 *   - company_enrichment_status = 'enriched', company_enriched_at = NOW()
 *
 * Runs fire-and-forget. The client polls `company_enriched_at` to detect completion.
 */

import { spawn } from "child_process";
import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { generateOfferIdeas } from "./offerIdeasGenerator";
import { discoverCompanyContacts } from "./contactDiscovery";

const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

/**
 * Kick off an async company enrichment agent for a prospect.
 * Returns immediately once the child is spawned.
 */
export async function startCompanyEnrichment(prospectId: number): Promise<{ started: boolean }> {
  // Mark in-progress so the UI can show a spinner before polling starts
  await db
    .update(prospects)
    .set({ companyEnrichmentStatus: "in_progress" })
    .where(eq(prospects.id, prospectId));

  const prompt = buildPrompt(prospectId);

  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS;
  delete env.CLAUDE_CODE_ENTRYPOINT;
  delete env.CLAUDE_AGENT_SDK_VERSION;
  delete env.CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING;

  const child = spawn(
    CLAUDE_BIN,
    [
      "-p", prompt,
      "--model", "sonnet",
      "--dangerously-skip-permissions",
    ],
    {
      cwd: "/home/gabriel",
      env,
      detached: true,
      stdio: "ignore",
    },
  );
  child.unref();
  child.on("error", (err) => {
    console.error(`[companyEnricher] spawn error for prospect ${prospectId}:`, err.message);
  });

  // Background poller: when the detached agent flips status to 'enriched',
  // auto-generate offer_ideas. Fire-and-forget; dies if the process restarts.
  (async () => {
    const POLL_INTERVAL_MS = 10_000;
    const MAX_WAIT_MS = 5 * 60_000;
    const start = Date.now();

    while (Date.now() - start < MAX_WAIT_MS) {
      await new Promise(r => setTimeout(r, POLL_INTERVAL_MS));
      const [row] = await db
        .select({ status: prospects.companyEnrichmentStatus })
        .from(prospects)
        .where(eq(prospects.id, prospectId))
        .limit(1);

      if (!row) return;
      if (row.status === "enriched") {
        // Step 1: auto-discover 2 contacts (cheap, Google + Haiku, 0 RapidAPI credits)
        if (process.env.ENABLE_CONTACT_DISCOVERY_IN_COMPANY_ENRICH !== "false") {
          try {
            const [p] = await db
              .select({
                company: prospects.company,
                niche: prospects.niche,
                companySummary: prospects.companySummary,
                contactManual: prospects.contactManual,
                contact2Manual: prospects.contact2Manual,
                contactLinkedin: prospects.contactLinkedin,
                contact2Linkedin: prospects.contact2Linkedin,
              })
              .from(prospects)
              .where(eq(prospects.id, prospectId))
              .limit(1);

            if (p) {
              const needContact1 = !p.contactManual && !p.contactLinkedin;
              const needContact2 = !p.contact2Manual && !p.contact2Linkedin;
              const needed = (needContact1 ? 1 : 0) + (needContact2 ? 1 : 0);
              if (needed > 0 && p.company) {
                console.log(`[ContactDiscovery] Running for prospect ${prospectId} (need=${needed})...`);
                // Avoid picking a URL already assigned to the other (non-empty) slot
                const exclude: string[] = [];
                if (p.contactLinkedin) exclude.push(p.contactLinkedin);
                if (p.contact2Linkedin) exclude.push(p.contact2Linkedin);
                const discovered = await discoverCompanyContacts(p.company, p.niche, p.companySummary, needed, exclude);
                const updates: Record<string, string | null> = {};
                let di = 0;
                if (needContact1 && discovered[di]) {
                  updates.contactName = discovered[di].name;
                  updates.contactRole = discovered[di].role;
                  updates.contactLinkedin = discovered[di].linkedinUrl;
                  di++;
                }
                if (needContact2 && discovered[di]) {
                  updates.contact2Name = discovered[di].name;
                  updates.contact2Role = discovered[di].role;
                  updates.contact2Linkedin = discovered[di].linkedinUrl;
                }
                if (Object.keys(updates).length > 0) {
                  await db.update(prospects).set(updates).where(eq(prospects.id, prospectId));
                  console.log(`[ContactDiscovery] Wrote ${Object.keys(updates).length / 3} contact(s) for ${prospectId}`);
                } else {
                  console.log(`[ContactDiscovery] No valid picks for ${prospectId}, leaving contacts empty`);
                }
              } else {
                console.log(`[ContactDiscovery] Skipping ${prospectId}, both slots manual or already have LinkedIn URL`);
              }
            }
          } catch (e) {
            console.error(`[ContactDiscovery] Failed for ${prospectId}:`, e);
          }
        }

        // Step 2: generate offer ideas (existing)
        console.log(`[OfferIdeas] Company enrichment complete for ${prospectId}, generating offer ideas...`);
        try {
          const result = await generateOfferIdeas(prospectId);
          console.log(`[OfferIdeas] Prospect ${prospectId}: generated=${result.generated} ${result.reason || ""}`);
        } catch (e) {
          console.error(`[OfferIdeas] Failed for ${prospectId}:`, e);
        }
        return;
      }
      if (row.status === "failed" || row.status === "not_found") {
        console.log(`[OfferIdeas] Skipping ${prospectId}, company enrichment ${row.status}`);
        return;
      }
    }

    console.warn(`[OfferIdeas] Timeout waiting for company enrichment on prospect ${prospectId}`);
  })();

  return { started: true };
}

function buildPrompt(prospectId: number): string {
  return `Run company enrichment for LeadAwaker prospect ID ${prospectId}.

Read the skill at /home/gabriel/.claude/skills/prospect/SKILL.md and follow the "Company Enrichment" section strictly. Key requirements:

1. Fetch the prospect's company info from the DB:
   sudo -u postgres psql -d nocodb -t -c "SELECT id, company, website, company_linkedin FROM p2mxx34fvbf3ll6.\\"Prospects\\" WHERE id = ${prospectId};"

2. Scrape the company LinkedIn page via RapidAPI (use the key cascade in the skill):
   - /get-company-details for structured facts (industry, staffCount, founded, specialities, phone, description)
   - /get-company-posts for top 3 posts by totalReactionCount

3. DO NOT run the website scrape. Only use LinkedIn data (and Google Custom Search if gaps remain). Website scrape is a separate on-demand step.

4. Populate with a single UPDATE SQL:
   - company_summary (structured INDUSTRY/SIZE/MARKET/POSITIONING/SIGNALS/ACTIVITY labels, one fact per line)
   - company_services (labeled categorized format; include products here too if the company sells them, since products was merged into services)
   - company_history (FOUNDED/MILESTONES/EVOLUTION)
   - audit_insights (JSONB) structured audit with shape: {"strengths":[{"title","detail"}], "opportunities":[{"title","detail","quick_win":true|false}], "gaps":[{"title","detail"}], "lead_awaker_fit":{"fit_score":"high|medium|low","angle","pitch_hook"}, "generated_at":"<ISO>"}. Ground everything strictly in scraped content. Pass via psql as a JSON string (e.g. '{"strengths":[...]}'::jsonb).
   - company_top_post_data (JSONB array of up to 3 posts: [{title, date, reactions, url}], title = first 120 chars of text)
   - phone (company main line from LinkedIn /get-company-details response)
   - email (role-based address like info@company.nl from website scrape; leave NULL if website was skipped)
   - company_enrichment_status = 'enriched'
   - company_enriched_at = NOW()

5. DO NOT write to the \`notes\` column. It is human-only.

6. If something fails (no company_linkedin, RapidAPI quota exhausted, etc.), update company_enrichment_status to 'failed' or 'not_found' and still set company_enriched_at = NOW() so the UI stops spinning.

Work efficiently, write one consolidated UPDATE at the end. Report back with one short sentence summarizing what was written.`;
}
