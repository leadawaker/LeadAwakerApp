/**
 * Company-level enrichment.
 *
 * Spawns a detached Claude Code agent that runs the `/prospect` skill's
 * "Company Enrichment" section against a given prospect ID. The agent
 * combines LinkedIn company scraping (via RapidAPI), conditional website
 * scraping, and Google Custom Search to populate:
 *   - company_summary, company_services, company_products, company_history
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

3. Apply the conditional website enrichment rule: ONLY run website scrape if LinkedIn description is empty OR specialities has fewer than 3 entries OR fewer than 3 posts returned. Otherwise skip it to save Haiku credits.

4. Populate with a single UPDATE SQL:
   - company_summary (structured INDUSTRY/SIZE/MARKET/POSITIONING/SIGNALS/ACTIVITY labels, one fact per line)
   - company_services (labeled categorized format)
   - company_products (labeled, or NULL if services-only)
   - company_history (FOUNDED/MILESTONES/EVOLUTION)
   - company_top_post_data (JSONB array of up to 3 posts: [{title, date, reactions, url}], title = first 120 chars of text)
   - phone (company main line from LinkedIn /get-company-details response)
   - email (role-based address like info@company.nl from website scrape; leave NULL if website was skipped)
   - company_enrichment_status = 'enriched'
   - company_enriched_at = NOW()

5. DO NOT write to the \`notes\` column. It is human-only.

6. If something fails (no company_linkedin, RapidAPI quota exhausted, etc.), update company_enrichment_status to 'failed' or 'not_found' and still set company_enriched_at = NOW() so the UI stops spinning.

Work efficiently, write one consolidated UPDATE at the end. Report back with one short sentence summarizing what was written.`;
}
