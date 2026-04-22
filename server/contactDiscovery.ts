/**
 * Contact discovery: Google Custom Search + Haiku assessment.
 * Used by companyEnricher (to auto-populate 2 contacts after company scrape)
 * and by linkedinEnricher (discover-by-name path when only a name is known).
 *
 * Zero RapidAPI credits: uses Google CSE + Haiku only.
 */

import { completeText, stripFences } from "./aiTextHelper";

const GOOGLE_API_KEY = "AIzaSyBY2T7MgSHJ9afz9P-XyFMARN2QjVj2rqg";
const GOOGLE_CX = "22a0a37f3005d416f";

export interface DiscoveredContact {
  name: string;
  role: string;
  linkedinUrl: string;
  source: string;
  snippet?: string;
}

interface DiscoverCtx {
  company: string | null;
  niche: string | null;
  companySummary: string | null;
}

async function googleSearch(query: string, limit = 3): Promise<any[]> {
  const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(query)}&num=${limit}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.items || [];
}

function parseCandidate(item: any, source: string): DiscoveredContact | null {
  const linkedinUrl = item.link;
  if (!linkedinUrl || !linkedinUrl.includes("linkedin.com/in/")) return null;
  const title = item.title || "";
  const snippet = item.snippet || "";
  const nameMatch = title.match(/^([^-|]+)/);
  const roleMatch = title.match(/-\s*([^|]+)/);
  const name = nameMatch ? nameMatch[1].trim() : "";
  let role = roleMatch ? roleMatch[1].trim().replace(/\s*at\s+.+$/i, "") : "";
  if (!role && snippet) {
    const m = snippet.match(/(CEO|Directeur|Founder|Manager|Head of|Director|Eigenaar|Owner)/i);
    role = m ? m[1] : "Decision Maker";
  }
  if (!name) return null;
  return {
    name,
    role: role || "Decision Maker",
    linkedinUrl,
    source,
    snippet: snippet.slice(0, 240),
  };
}

/**
 * Gather ~9 decision-maker candidates at a company using role-targeted Google queries.
 */
async function searchCompanyDecisionMakers(company: string, niche?: string | null): Promise<DiscoveredContact[]> {
  const roleQueries = [
    `"CEO" OR "Directeur" "${company}" site:linkedin.com/in`,
    `"Eigenaar" OR "Founder" "${company}" site:linkedin.com/in`,
    `"Head of Sales" OR "Sales Manager" "${company}" site:linkedin.com/in`,
    `"Marketing Manager" OR "Commercial Manager" "${company}" site:linkedin.com/in`,
    `"Managing Director" "${company}" site:linkedin.com/in`,
    `"Business Development" "${company}" site:linkedin.com/in`,
  ];

  const MAX_CANDIDATES = 9;
  const contacts: DiscoveredContact[] = [];

  try {
    for (const query of roleQueries) {
      if (contacts.length >= MAX_CANDIDATES) break;
      const items = await googleSearch(query, 3);
      for (const item of items) {
        if (contacts.length >= MAX_CANDIDATES) break;
        const c = parseCandidate(item, `Search: ${query.split('"')[1] || "Alternative"}`);
        if (c && !contacts.some(x => x.linkedinUrl === c.linkedinUrl)) contacts.push(c);
      }
      await new Promise(r => setTimeout(r, 200));
    }
  } catch (err) {
    console.error("[ContactDiscovery] Google search error:", err);
  }
  return contacts;
}

interface AssessmentResult {
  pickIndex: number;
  bestScore: number;
  reasoning: string;
  aiSucceeded: boolean;
}

async function assessDecisionMaker(
  candidates: DiscoveredContact[],
  ctx: DiscoverCtx,
  minScore: number,
): Promise<AssessmentResult> {
  if (candidates.length === 0) {
    return { pickIndex: -1, bestScore: 0, reasoning: "no candidates", aiSucceeded: true };
  }

  const numbered = candidates
    .map((c, i) => `${i}. ${c.name} - ${c.role}\n   URL: ${c.linkedinUrl}\n   Snippet: ${c.snippet || "(none)"}`)
    .join("\n\n");
  const summaryBlock = ctx.companySummary ? `\nCompany summary:\n${ctx.companySummary.slice(0, 800)}` : "";

  const systemPrompt = `You rank LinkedIn candidates for a B2B cold-outreach CRM. You are ruthlessly pragmatic: the goal is to find the person who CURRENTLY makes decisions at the target company and would plausibly respond to a reactivation message. Reject candidates who left the company, work at a different company with a similar name, or hold a role too junior to be a decision maker. Output only valid JSON, no prose, no code fences.`;

  const userPrompt = `Target company: ${ctx.company}
Industry/niche: ${ctx.niche || "unknown"}${summaryBlock}

Candidates (indexed from 0):
${numbered}

For each candidate, assess:
- Does the snippet/role suggest they STILL work at ${ctx.company}? ("ex-", "former", "previously", "was" are red flags)
- Is the role a decision maker (CEO, founder, owner, director, head of sales/marketing, managing director)?
- Does the company in their profile match the target exactly, or is it a similarly-named but different company?
- Is this the kind of person who handles business-development inbound?

Return JSON with this exact shape:
{
  "best_index": <number, 0-based index, or -1 if no candidate is acceptable>,
  "best_score": <number 1-10, confidence the best pick is a good primary contact>,
  "reasoning": "<one short sentence explaining the pick>"
}

Scoring guide:
- 9-10: clearly current senior decision maker at the exact company
- 7-8: current but role fit uncertain, or senior but tenure unclear
- 5-6: plausible but weak signal
- 1-4: red flags (left, wrong company, too junior)
- best_index = -1 and best_score = 0 if every candidate has a red flag.`;

  const raw = await completeText(userPrompt, systemPrompt);
  if (!raw) {
    return { pickIndex: -1, bestScore: 0, reasoning: "AI unavailable", aiSucceeded: false };
  }

  const cleaned = stripFences(raw);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return { pickIndex: -1, bestScore: 0, reasoning: "JSON parse failed", aiSucceeded: false };
  }

  let parsed: any;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return { pickIndex: -1, bestScore: 0, reasoning: "JSON parse failed", aiSucceeded: false };
  }

  const idx = typeof parsed.best_index === "number" ? parsed.best_index : -1;
  const score = typeof parsed.best_score === "number" ? parsed.best_score : 0;
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";

  if (idx < 0 || idx >= candidates.length || score < minScore) {
    return { pickIndex: -1, bestScore: score, reasoning: reasoning || "below threshold", aiSucceeded: true };
  }
  return { pickIndex: idx, bestScore: score, reasoning, aiSucceeded: true };
}

async function assessNameMatch(
  name: string,
  candidates: DiscoveredContact[],
  ctx: DiscoverCtx,
  minScore: number,
): Promise<AssessmentResult> {
  if (candidates.length === 0) {
    return { pickIndex: -1, bestScore: 0, reasoning: "no candidates", aiSucceeded: true };
  }

  const numbered = candidates
    .map((c, i) => `${i}. ${c.name} - ${c.role}\n   URL: ${c.linkedinUrl}\n   Snippet: ${c.snippet || "(none)"}`)
    .join("\n\n");
  const summaryBlock = ctx.companySummary ? `\nCompany summary:\n${ctx.companySummary.slice(0, 400)}` : "";

  const systemPrompt = `You match a specific person's name to LinkedIn search results. The goal is to pick the single profile that matches the user-provided name AND works at the target company. Output only valid JSON, no prose, no code fences.`;

  const userPrompt = `Target person name: "${name}"
Target company: ${ctx.company}
Industry/niche: ${ctx.niche || "unknown"}${summaryBlock}

Candidates (indexed from 0):
${numbered}

Pick the candidate whose name matches "${name}" AND currently works at ${ctx.company}.
- Minor spelling variations or missing middle names are OK if the rest matches.
- Reject if the name clearly refers to a different person, or if the candidate works at a different company.
- Reject if the candidate's profile shows they LEFT ${ctx.company} (ex-, former, previously).

Return JSON with this exact shape:
{
  "best_index": <number, 0-based index, or -1 if no candidate is a match>,
  "best_score": <number 1-10, confidence the pick is the right person at the right company>,
  "reasoning": "<one short sentence>"
}

Scoring guide:
- 9-10: exact name match, clearly at target company now
- 7-8: name matches, company match implied but not explicit
- 5-6: partial name match or weak company signal
- 1-4: wrong person or wrong company
- -1 / 0 if no candidate matches`;

  const raw = await completeText(userPrompt, systemPrompt);
  if (!raw) return { pickIndex: -1, bestScore: 0, reasoning: "AI unavailable", aiSucceeded: false };
  const cleaned = stripFences(raw);
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { pickIndex: -1, bestScore: 0, reasoning: "JSON parse failed", aiSucceeded: false };
  let parsed: any;
  try { parsed = JSON.parse(jsonMatch[0]); }
  catch { return { pickIndex: -1, bestScore: 0, reasoning: "JSON parse failed", aiSucceeded: false }; }

  const idx = typeof parsed.best_index === "number" ? parsed.best_index : -1;
  const score = typeof parsed.best_score === "number" ? parsed.best_score : 0;
  const reasoning = typeof parsed.reasoning === "string" ? parsed.reasoning : "";
  if (idx < 0 || idx >= candidates.length || score < minScore) {
    return { pickIndex: -1, bestScore: score, reasoning: reasoning || "below threshold", aiSucceeded: true };
  }
  return { pickIndex: idx, bestScore: score, reasoning, aiSucceeded: true };
}

/**
 * Find up to `count` decision makers at a company.
 * First pick requires score >= 5; second pick requires >= 6 (stricter).
 * If AI rejects all or returns nothing usable, writes NOTHING (no fallback).
 */
export async function discoverCompanyContacts(
  company: string | null,
  niche: string | null,
  companySummary: string | null,
  count: number = 2,
  excludeLinkedinUrls: string[] = [],
): Promise<DiscoveredContact[]> {
  if (!company || count <= 0) return [];
  let pool = await searchCompanyDecisionMakers(company, niche);
  if (excludeLinkedinUrls.length > 0) {
    const excl = new Set(excludeLinkedinUrls.map(u => u.toLowerCase()));
    pool = pool.filter(c => !excl.has(c.linkedinUrl.toLowerCase()));
  }
  if (pool.length === 0) return [];

  const ctx: DiscoverCtx = { company, niche, companySummary };
  const picks: DiscoveredContact[] = [];
  const usedIdx = new Set<number>();

  // Pass 1: best decision maker, threshold 5
  const first = await assessDecisionMaker(pool, ctx, 5);
  console.log(`[ContactDiscovery] Pass 1: pickIndex=${first.pickIndex} score=${first.bestScore} (${first.reasoning})`);
  if (first.pickIndex >= 0) {
    picks.push(pool[first.pickIndex]);
    usedIdx.add(first.pickIndex);
  }

  // Pass 2: second-best, threshold 6
  if (picks.length < count) {
    const remaining = pool.filter((_, i) => !usedIdx.has(i));
    if (remaining.length > 0) {
      const second = await assessDecisionMaker(remaining, ctx, 6);
      console.log(`[ContactDiscovery] Pass 2: pickIndex=${second.pickIndex} score=${second.bestScore} (${second.reasoning})`);
      if (second.pickIndex >= 0) picks.push(remaining[second.pickIndex]);
    }
  }

  return picks.slice(0, count);
}

/**
 * Given a known name and company, find the matching LinkedIn profile URL.
 * Returns null if no candidate scores >= 5 on name-match assessment.
 */
export async function discoverContactByName(
  name: string,
  company: string | null,
  niche: string | null,
  companySummary: string | null,
): Promise<DiscoveredContact | null> {
  if (!name) return null;

  const candidates: DiscoveredContact[] = [];
  const pushUnique = (items: any[], source: string) => {
    for (const item of items) {
      const c = parseCandidate(item, source);
      if (c && !candidates.some(x => x.linkedinUrl === c.linkedinUrl)) candidates.push(c);
    }
  };

  try {
    if (company) {
      pushUnique(await googleSearch(`"${name}" "${company}" site:linkedin.com/in`, 5), "name+company");
    }
    if (candidates.length === 0) {
      pushUnique(await googleSearch(`"${name}" site:linkedin.com/in`, 5), "name-only");
    }
  } catch (err) {
    console.error("[ContactDiscovery] name search error:", err);
  }

  if (candidates.length === 0) return null;

  const ctx: DiscoverCtx = { company, niche, companySummary };
  const result = await assessNameMatch(name, candidates, ctx, 5);
  console.log(`[ContactDiscovery] NameMatch "${name}": pickIndex=${result.pickIndex} score=${result.bestScore} (${result.reasoning})`);
  if (result.pickIndex < 0) return null;
  return candidates[result.pickIndex];
}
