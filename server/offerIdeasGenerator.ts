/**
 * Generate 5 campaign offer ideas per prospect, based on company enrichment.
 * Called after the company enrichment agent flips status to 'enriched'.
 * Uses Haiku via completeText(). Skips if offer_ideas is already populated.
 */

import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { completeText, stripFences } from "./aiTextHelper";

export async function generateOfferIdeas(prospectId: number): Promise<{
  generated: boolean;
  ideas: string | null;
  reason?: string;
}> {
  const [prospect] = await db
    .select({
      niche: prospects.niche,
      company: prospects.company,
      companySummary: prospects.companySummary,
      companyServices: prospects.companyServices,
      companyHistory: prospects.companyHistory,
      contactName: prospects.contactName,
      contactRole: prospects.contactRole,
      contact2Name: prospects.contact2Name,
      contact2Role: prospects.contact2Role,
      offerIdeas: prospects.offerIdeas,
      companyEnrichmentStatus: prospects.companyEnrichmentStatus,
    })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (!prospect) return { generated: false, ideas: null, reason: "prospect not found" };

  if (prospect.companyEnrichmentStatus !== "enriched") {
    return { generated: false, ideas: null, reason: "company not enriched yet" };
  }

  if (prospect.offerIdeas && prospect.offerIdeas.trim().length > 0) {
    return { generated: false, ideas: prospect.offerIdeas, reason: "offer_ideas already populated" };
  }

  const contacts = [
    prospect.contactName ? `${prospect.contactName} (${prospect.contactRole || "unknown role"})` : null,
    prospect.contact2Name ? `${prospect.contact2Name} (${prospect.contact2Role || "unknown role"})` : null,
  ].filter(Boolean);

  const contactsBlock = contacts.length > 0
    ? `\nKey contacts:\n${contacts.map(c => `- ${c}`).join("\n")}`
    : "";

  const systemPrompt = `You generate campaign ideas for Lead Awaker, a service that reactivates dormant leads via WhatsApp AI for B2B companies. The user (Gabriel) sells this on a no-cure-no-pay basis. Your job is to brainstorm 5 specific, actionable campaign angles tailored to the target company. Each idea should describe WHO the campaign targets in their database and WHAT the hook is. Output exactly 5 lines, each one a single-sentence idea, no numbering, no bullets, no preamble. ALWAYS write the output in English, regardless of the company's country or language.`;

  const userPrompt = `Target company: ${prospect.company}
Niche: ${prospect.niche || "unknown"}

Company summary:
${(prospect.companySummary || "(not available)").slice(0, 800)}

Services offered:
${prospect.companyServices || "(not available)"}

Company history:
${prospect.companyHistory || "(not available)"}${contactsBlock}

Generate 5 campaign ideas Gabriel could pitch to this company. Each idea should be:
- Specific to THIS company's services and market (not generic solar/legal/renovation advice)
- Focused on a distinct slice of their dormant lead database (old quote requesters, cold follow-ups, past customers, aborted checkouts, etc.)
- Describable in one single sentence
- Framed as an outbound reactivation angle (what message do we send to whom)

Output 5 lines. No numbering. No bullets. Plain text.`;

  const raw = await completeText(userPrompt, systemPrompt);
  if (!raw) return { generated: false, ideas: null, reason: "AI unavailable" };

  const cleaned = stripFences(raw);
  const lines = cleaned
    .split(/\r?\n/)
    .map(l => l.trim())
    .map(l => l.replace(/^\s*(\d+[\.\)]\s*|[-*+]\s*)/, ""))
    .filter(l => l.length > 10);

  if (lines.length < 3) return { generated: false, ideas: null, reason: "AI returned fewer than 3 usable lines" };

  const offerIdeas = lines.slice(0, 5).join("\n");
  await db.update(prospects).set({ offerIdeas }).where(eq(prospects.id, prospectId));
  return { generated: true, ideas: offerIdeas };
}
