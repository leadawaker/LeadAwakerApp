// One language of a Client built from a prospect's website: scrape the site in
// that language, generate the niche shape in that language, lay the site's
// facts over the generated stand-ins. Used by POST /api/demo/clients/from-website,
// which runs it once per language and saves the results onto one Client row.
import { generateNicheContextStrict, type DemoScenario, type NicheContext } from "./demo-session";
import { GenerationError } from "./demoGenerator/providers";
import type { DemoLang } from "./demo-clients";

/**
 * The language a country domain implies, or null for a generic one.
 * ".br" covers ".com.br", which is how nearly every Brazilian business site ends.
 * Accepts a bare host ("robbenrosmalen.nl") as well as a full URL.
 */
export function languageFromDomain(url: string): DemoLang | null {
  let host: string;
  try {
    host = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `https://${url}`).hostname.toLowerCase();
  } catch {
    return null;
  }
  if (host.endsWith(".nl")) return "nl";
  if (host.endsWith(".br")) return "pt";
  return null;
}

export type SiteBuildResult =
  | { ok: true; scraped: Record<string, any>; ctx: NicheContext; providerUsed: string; nicheKey: string }
  | { ok: false; status: number; body: { message: string; stage?: string; retryable?: boolean } };

export async function buildClientFromSite(opts: {
  url: string;
  text: string;
  language: DemoLang;
  niche?: string;
  scenario: DemoScenario;
  market?: "uk" | "us" | "nl";
  provider: "claude" | "openai";
  claudeModel: "opus" | "sonnet";
}): Promise<SiteBuildResult> {
  const { url, text, language, niche, scenario, market, provider, claudeModel } = opts;

  const engineBase = process.env.ENGINE_URL || "http://localhost:8100";
  let scraped: Record<string, any> | null = null;
  try {
    const resp = await fetch(`${engineBase}/api/site-kb`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Key": process.env.INTERNAL_API_KEY || "",
      },
      body: JSON.stringify(text ? { text, language } : { url, language }),
      // A cold site with six subpages can take a while; the model call is
      // on top of that. Below any sensible proxy timeout, above the p95.
      signal: AbortSignal.timeout(120_000),
    });
    if (resp.ok) scraped = (await resp.json()) as Record<string, any>;
    else console.error("[demo-website] engine returned", resp.status, await resp.text());
  } catch (err) {
    console.error("[demo-website] scrape call failed", err);
  }

  if (!scraped || scraped.scrape_failed || !scraped.kb) {
    return {
      ok: false,
      status: 422,
      body: {
        message: text
          ? "Could not build a Client from that text. Add a few more details about the business and try again."
          : "Could not read that website. It may block bots or be JavaScript-only. Paste the business details into the notes box instead.",
      },
    };
  }

  // The niche the generator is asked to theme. The site's own label beats a
  // guess from the domain, and an explicit one from the caller beats both.
  const nicheKey = (niche || scraped.company_name || "").trim();
  const nicheForGeneration = (scraped.niche_label || niche || scraped.company_name || "").trim();
  if (!nicheKey) {
    return { ok: false, status: 422, body: { message: "Could not determine a name for this Client. Pass `niche` explicitly." } };
  }

  // No template fallback here: a failed generation used to save the generic
  // template as if it were the Client (65 and 67 were saved that way).
  // Now it fails loudly and saves nothing, and the page offers a retry.
  let ctx: NicheContext;
  let providerUsed: string;
  try {
    ({ ctx, providerUsed } = await generateNicheContextStrict(
      nicheForGeneration, language, scenario, market, { provider, claudeModel },
    ));
  } catch (err) {
    return {
      ok: false,
      status: 502,
      body: {
        message: (err as Error).message,
        stage: err instanceof GenerationError ? err.stage : "generate",
        retryable: true,
      },
    };
  }

  // Facts from the site override the generated stand-ins. Empty scrape
  // fields deliberately leave the generated value in place.
  const overlay: Array<[keyof typeof ctx, string]> = [
    ["company_name", scraped.company_name],
    ["kb", scraped.kb],
    ["business_description", scraped.business_description],
    ["service_name", scraped.service_name],
    ["usp", scraped.usp],
    ["niche_label", scraped.niche_label],
  ];
  for (const [field, value] of overlay) {
    if (typeof value === "string" && value.trim()) (ctx as Record<string, unknown>)[field] = value.trim();
  }

  return { ok: true, scraped, ctx, providerUsed, nicheKey };
}
