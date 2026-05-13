/**
 * Company enrichment via OpenAI — fallback when Claude subscription hits limits.
 * Activate by setting COMPANY_ENRICH_PROVIDER=openai in .env.
 *
 * Replicates what the Claude agent does in companyEnricher.ts:
 *   - RapidAPI /get-company-details + /get-company-posts
 *   - OpenAI gpt-4o to generate company_summary and audit_insights
 *   - Single DB UPDATE with enrichment results
 */

import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";

const RAPIDAPI_HOST = "professional-network-data.p.rapidapi.com";
const OPENAI_MODEL = "gpt-4o";
const OPENAI_TIMEOUT_MS = 60_000;

// Same key cascade as linkedinEnricher.ts
const API_KEYS: string[] = [];
for (let i = 1; i <= 12; i++) {
  const key = process.env[`RAPIDAPI_KEY_${i}`];
  if (key) API_KEYS.push(key);
}
let keyIndex = 0;
function nextKey(): string | null {
  if (API_KEYS.length === 0) return null;
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

async function rapidapiFetch(path: string, params: Record<string, string>): Promise<any | null> {
  const url = new URL(`https://${RAPIDAPI_HOST}${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  for (let attempt = 0; attempt < Math.max(API_KEYS.length, 1); attempt++) {
    const key = nextKey();
    if (!key) return null;
    try {
      const res = await fetch(url.toString(), {
        headers: { "x-rapidapi-key": key, "x-rapidapi-host": RAPIDAPI_HOST },
      });
      if (res.status === 429 || res.status === 403) {
        console.log(`[companyEnricherOpenAI] RapidAPI key rate-limited (${res.status}), rotating...`);
        continue;
      }
      if (!res.ok) {
        console.warn(`[companyEnricherOpenAI] RapidAPI ${path} error: ${res.status}`);
        return null;
      }
      return await res.json();
    } catch (err: any) {
      console.warn(`[companyEnricherOpenAI] RapidAPI fetch failed: ${err.message}`);
      return null;
    }
  }
  return null;
}

function extractCompanySlug(url: string): string | null {
  const match = url.match(/linkedin\.com\/company\/([^/?#]+)/i);
  return match ? match[1] : null;
}

async function openaiComplete(systemPrompt: string, userPrompt: string): Promise<string | null> {
  const apiKey = process.env.OPEN_AI_API_KEY;
  if (!apiKey) return null;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), OPENAI_TIMEOUT_MS);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 2000,
        temperature: 0.4,
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      console.warn("[companyEnricherOpenAI] OpenAI error:", res.status);
      return null;
    }
    const json = await res.json() as any;
    return json.choices?.[0]?.message?.content?.trim() || null;
  } catch (err: any) {
    console.warn("[companyEnricherOpenAI] OpenAI fetch failed:", err.message);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export async function startCompanyEnrichmentOpenAI(prospectId: number): Promise<void> {
  let enrichmentFailed = false;
  try {
    const [row] = await db
      .select({
        id: prospects.id,
        company: prospects.company,
        website: prospects.website,
        companyLinkedin: prospects.companyLinkedin,
      })
      .from(prospects)
      .where(eq(prospects.id, prospectId))
      .limit(1);

    if (!row) {
      console.warn(`[companyEnricherOpenAI] Prospect ${prospectId} not found`);
      enrichmentFailed = true;
      await db.update(prospects)
        .set({ companyEnrichmentStatus: "not_found", companyEnrichedAt: new Date() })
        .where(eq(prospects.id, prospectId));
      return;
    }

    const slug = row.companyLinkedin ? extractCompanySlug(row.companyLinkedin) : null;
    if (!slug) {
      console.warn(`[companyEnricherOpenAI] No valid company_linkedin for prospect ${prospectId}`);
      enrichmentFailed = true;
      await db.update(prospects)
        .set({ companyEnrichmentStatus: "failed", companyEnrichedAt: new Date() })
        .where(eq(prospects.id, prospectId));
      return;
    }

    const [detailsRaw, postsRaw] = await Promise.all([
      rapidapiFetch("/get-company-details", { company_slug: slug }),
      rapidapiFetch("/get-company-posts", { company_slug: slug, count: "10" }),
    ]);

    const details = detailsRaw?.data ?? detailsRaw ?? null;
    const postsList: any[] = Array.isArray(postsRaw?.data) ? postsRaw.data : (Array.isArray(postsRaw) ? postsRaw : []);

    const topPosts = [...postsList]
      .sort((a, b) => (b.totalReactionCount ?? 0) - (a.totalReactionCount ?? 0))
      .slice(0, 3)
      .map(p => ({
        title: (p.text ?? p.commentary ?? "").slice(0, 120),
        date: p.postedAt ?? p.publishedAt ?? null,
        reactions: p.totalReactionCount ?? 0,
        url: p.postUrl ?? p.url ?? null,
      }));

    const phone: string | null = details?.phone ?? null;

    const contextText = JSON.stringify({ details, topPosts }, null, 2).slice(0, 8000);

    const systemPrompt = `You are a B2B analyst writing enrichment data for a sales CRM. Output ONLY valid JSON, no markdown fences or explanation.`;
    const userPrompt = `Based on this company data from LinkedIn, generate two fields:

1. company_summary: A single cohesive paragraph (4-6 sentences) covering what the company does, core services/products, market/positioning, notable history or milestones, and recent signals from posts. Write it as a concise analyst briefing, not bullet points.

2. audit_insights: A structured JSONB object with shape:
{"strengths":[{"title":"...","detail":"..."}],"opportunities":[{"title":"...","detail":"...","quick_win":true}],"gaps":[{"title":"...","detail":"..."}],"lead_awaker_fit":{"fit_score":"high|medium|low","angle":"...","pitch_hook":"..."},"generated_at":"${new Date().toISOString()}"}

Ground everything strictly in the scraped data below. Return ONLY this JSON (no other text):
{"company_summary":"...","audit_insights":{...}}

COMPANY DATA:
${contextText}`;

    const aiResponse = await openaiComplete(systemPrompt, userPrompt);
    let companySummary: string | null = null;
    let auditInsights: any = null;

    if (aiResponse) {
      try {
        const parsed = JSON.parse(aiResponse);
        companySummary = parsed.company_summary ?? null;
        auditInsights = parsed.audit_insights ?? null;
      } catch {
        console.warn("[companyEnricherOpenAI] Failed to parse OpenAI JSON response");
      }
    }

    await db.update(prospects).set({
      companySummary,
      auditInsights,
      companyTopPostData: topPosts.length > 0 ? topPosts : null,
      phone: phone ?? undefined,
      companyEnrichmentStatus: "enriched",
      companyEnrichedAt: new Date(),
    }).where(eq(prospects.id, prospectId));

    console.log(`[companyEnricherOpenAI] Prospect ${prospectId} enriched via OpenAI.`);
  } catch (err: any) {
    console.error(`[companyEnricherOpenAI] Error for prospect ${prospectId}:`, err.message);
    if (!enrichmentFailed) {
      await db.update(prospects)
        .set({ companyEnrichmentStatus: "failed", companyEnrichedAt: new Date() })
        .where(eq(prospects.id, prospectId));
    }
  }
}
