/**
 * Contact discovery: Firecrawl search + Haiku assessment.
 * Used by companyEnricher (to auto-populate 2 contacts after company scrape)
 * and by linkedinEnricher (discover-by-name path when only a name is known).
 *
 * Was Google CSE -- swapped 2026-07-30 after confirming Google Custom Search
 * JSON API is closed to new customers and fully sunsets 2027-01-01 (a 403
 * "does not have the access" persisted on two brand-new keys/projects even
 * with the API "Enabled" and billing linked; only a pre-existing grandfathered
 * key still works, and it's also quota-capped at 100 free/day). Firecrawl's
 * /search endpoint returned near-identical results for the same query
 * ("Eigenaar" OR "Founder" "Climotec" site:linkedin.com/in" -> same top 2
 * hits, same order), reuses the Firecrawl key pool already built for
 * scraping, and needs no new signups.
 */

import { completeText, stripFences } from "./aiTextHelper";

// Comma-separated pool, same rotation shape as hubspot_enricher.py's
// firecrawl_scrape() -- each key is a separate free account (1,000
// credits/mo), rolled to the next on 402 (out of credits) or 429 (rate
// limited). Search is cheap: 2 credits per 10 results.
function firecrawlKeys(): string[] {
  return (process.env.FIRECRAWL_API_KEYS || "").split(",").map(k => k.trim()).filter(Boolean);
}

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
  const keys = firecrawlKeys();
  if (keys.length === 0) {
    console.error("[ContactDiscovery] FIRECRAWL_API_KEYS not set");
    return [];
  }
  for (const key of keys) {
    try {
      const response = await fetch("https://api.firecrawl.dev/v1/search", {
        method: "POST",
        headers: { "Authorization": `Bearer ${key}`, "Content-Type": "application/json" },
        body: JSON.stringify({ query, limit }),
      });
      if (response.status === 402 || response.status === 429) continue; // this key's credits/rate are exhausted -- try the next
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        console.error(`[ContactDiscovery] Firecrawl search ${response.status} on "${query}": ${body.slice(0, 300)}`);
        return [];
      }
      const data = await response.json();
      // Map Firecrawl's {url, title, description} to the {link, title, snippet}
      // shape parseCandidate() already expects, so nothing downstream changes.
      return (data.data || []).map((r: any) => ({ link: r.url, title: r.title, snippet: r.description }));
    } catch (err: any) {
      console.error(`[ContactDiscovery] Firecrawl search failed on "${query}":`, err.message);
      continue;
    }
  }
  console.error(`[ContactDiscovery] All Firecrawl keys exhausted on "${query}"`);
  return [];
}

// LinkedIn renders a blank/placeholder headline as a bare "--" in Google's
// title tag (e.g. "Ralf Van Uden - -- | LinkedIn") -- that's not a real role,
// treat it the same as no role so we fall through to the snippet, which
// usually still has the real "Ervaring: Mede-eigenaar ..." text.
const BLANK_ROLE = /^[-–—\s]*$/;

function parseCandidate(item: any, source: string): DiscoveredContact | null {
  const linkedinUrl = item.link;
  if (!linkedinUrl || !linkedinUrl.includes("linkedin.com/in/")) return null;
  const title = item.title || "";
  const snippet = item.snippet || "";
  const nameMatch = title.match(/^([^-|]+)/);
  const roleMatch = title.match(/-\s*([^|]+)/);
  const name = nameMatch ? nameMatch[1].trim() : "";
  let role = roleMatch ? roleMatch[1].trim().replace(/\s*at\s+.+$/i, "") : "";
  if (BLANK_ROLE.test(role)) role = "";
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

// Dutch/Belgian legal-form suffixes. Quoting the full legal name ("Climotec
// B.V.") as a Google phrase match fails almost every time -- LinkedIn bios
// say "Climotec", not "Climotec B.V." Confirmed live 2026-07-30: quoting
// "Climotec B.V." returned 0 results; dropping the suffix surfaced the
// company's two actual co-owners on the first query.
const LEGAL_SUFFIX = /\s+(B\.?V\.?|N\.?V\.?|V\.?O\.?F\.?|Holding|Groep|Group)\.?$/i;

function stripLegalSuffix(company: string): string {
  return company.replace(LEGAL_SUFFIX, "").trim();
}

async function runRoleQueries(company: string): Promise<DiscoveredContact[]> {
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

// Company names also carry descriptive trade-name suffixes ("installatie en
// onderhoud", "klimaattechniek", ...) that don't appear in LinkedIn bios
// either, same problem as the legal suffix but with no fixed list to strip.
// Confirmed live 2026-07-30: "Imbrego installatie en onderhoud" returned 0
// results on every query bucket except a weak/wrong one; "Imbrego" alone (the
// brand name, always the first word in these names) recovered both the
// Algemeen directeur and the Mede-eigenaar immediately. Common leading
// articles are skipped so we don't end up searching for just "De" or "Van".
const LEADING_STOPWORDS = new Set(["de", "het", "van", "der"]);

function firstBrandWord(company: string): string | null {
  const word = company.split(/\s+/)[0];
  if (!word || word.length < 3 || LEADING_STOPWORDS.has(word.toLowerCase())) return null;
  return word;
}

/**
 * Gather ~9 decision-maker candidates at a company using role-targeted Google
 * queries. Runs the name at progressively broader forms -- full legal name,
 * legal-suffix stripped, then just the brand's first word -- and merges all
 * of them into one deduped pool, rather than stopping at the first form that
 * returns *anything*. A narrow form can return a couple of weak/wrong
 * candidates while a broader form holds the real decision maker (confirmed
 * live 2026-07-30 on Imbrego: the full name surfaced a technician and an
 * unrelated owner, and only got merged with the real Algemeen directeur /
 * Mede-eigenaar once "Imbrego" alone was also searched). Trusts
 * assessDecisionMaker's rejection step to sort the combined pool out.
 */
async function searchCompanyDecisionMakers(company: string, niche?: string | null): Promise<DiscoveredContact[]> {
  const stripped = stripLegalSuffix(company);
  const brandWord = firstBrandWord(stripped);
  const forms = Array.from(new Set([company, stripped, ...(brandWord ? [brandWord] : [])]));

  const merged: DiscoveredContact[] = [];
  for (const name of forms) {
    if (name !== company) console.log(`[ContactDiscovery] also trying "${company}" as "${name}"`);
    const results = await runRoleQueries(name);
    for (const c of results) {
      if (!merged.some(x => x.linkedinUrl === c.linkedinUrl)) merged.push(c);
    }
  }
  return merged;
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

Role priority for this pitch (stalled-quote / quote-to-close follow-up):
1. Owner, Founder, Director, Managing Director, CEO -- final say, especially at owner-operator companies. Prefer these.
2. Head of Sales, Sales Manager, Commercial Manager -- feels this specific pain directly even without budget authority. Second choice.
3. Marketing Manager, Business Development -- adjacent, rarely owns this number. Only pick these if nothing in tiers 1-2 clears the bar.

For each candidate, assess:
- Does the snippet/role suggest they STILL work at ${ctx.company}? ("ex-", "former", "previously", "was" are red flags)
- Which role tier (above) do they fall into?
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

// Rising confidence bar per additional pick -- each extra contact past the
// first has to clear a stricter score than the last, so a company with only
// one real decision maker naturally yields 1 pick instead of padding out to
// the cap with weak matches. Array length = the hard cap (3). To allow a 4th,
// append one more threshold (e.g. 8) -- deliberately not raised past 3 for
// now: the 3rd/4th pick is always the weakest, and each extra name is one
// more manual LeadIQ lookup, so the cap trades Abbi's time against marginal
// gatekeeper-bypass value.
const PICK_THRESHOLDS = [5, 6, 7];

/**
 * Find up to `count` decision makers at a company (hard-capped at
 * PICK_THRESHOLDS.length regardless of `count`). Stops as soon as a pass
 * clears no candidate above that pass's threshold -- never pads to the cap
 * with a weak pick. If AI rejects all or returns nothing usable, writes
 * NOTHING (no fallback).
 */
export async function discoverCompanyContacts(
  company: string | null,
  niche: string | null,
  companySummary: string | null,
  count: number = PICK_THRESHOLDS.length,
  excludeLinkedinUrls: string[] = [],
): Promise<DiscoveredContact[]> {
  if (!company || count <= 0) return [];
  const maxCount = Math.min(count, PICK_THRESHOLDS.length);
  let pool = await searchCompanyDecisionMakers(company, niche);
  if (excludeLinkedinUrls.length > 0) {
    const excl = new Set(excludeLinkedinUrls.map(u => u.toLowerCase()));
    pool = pool.filter(c => !excl.has(c.linkedinUrl.toLowerCase()));
  }
  if (pool.length === 0) return [];

  const ctx: DiscoverCtx = { company, niche, companySummary };
  const picks: DiscoveredContact[] = [];
  let remaining = pool;

  for (let i = 0; i < maxCount; i++) {
    if (remaining.length === 0) break;
    const threshold = PICK_THRESHOLDS[i];
    const result = await assessDecisionMaker(remaining, ctx, threshold);
    console.log(`[ContactDiscovery] Pass ${i + 1} (threshold ${threshold}): pickIndex=${result.pickIndex} score=${result.bestScore} (${result.reasoning})`);
    if (result.pickIndex < 0) break; // nothing left clears the bar -- stop, don't force a weak pick
    picks.push(remaining[result.pickIndex]);
    remaining = remaining.filter((_, idx) => idx !== result.pickIndex);
  }

  return picks;
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
