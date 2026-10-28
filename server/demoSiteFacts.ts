/**
 * What a website scan hands to the rest of the CRM: the facts the niche
 * generator is told to use, and the fields saved onto the Client (products,
 * stock page, city, phone). Pure on purpose (no db import) so the unit tests can
 * run it; server/demo-clients.ts holds the database calls and only calls into
 * this. The scan itself is the engine's /api/site-kb response.
 */
import { MAX_PRODUCTS, normalizeProducts, putProducts, type DemoProduct, type ProductLang, type ProductsByLang } from "@shared/demoProducts";
import { isPublicHttpUrl, normalizeUrl } from "./siteShot";

export interface SiteFacts { summary: string; products: DemoProduct[]; city: string }

/** How much of the scraped description and kb the generator prompt carries. */
export const SITE_FACTS_SUMMARY_MAX = 3000;

// Same ceilings as the zod fields the editor's PATCH accepts (productPatchShape).
const CITY_MAX = 120;
const PHONE_MAX = 60;
const STOCK_URL_MAX = 500;

/** A scraped string, trimmed; anything else is empty. */
function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

/** `s` cut to `max` characters without leaving half a surrogate pair at the end. */
function cut(s: string, max: number): string {
  if (s.length <= max) return s;
  let out = s.slice(0, max);
  const last = out.charCodeAt(out.length - 1);
  if (last >= 0xd800 && last <= 0xdbff) out = out.slice(0, -1);
  return out.trim();
}

/**
 * The stock page URL to store, or "" when the value is not one. Only an
 * absolute http(s) URL on a public host is accepted: the engine quotes this
 * address in prompts (it never fetches it), so a relative path, another scheme
 * or an internal address must never be stored. Returned in the canonical form
 * normalizeUrl gives (no fragment).
 */
export function cleanStockUrl(raw: unknown): string {
  const value = str(raw);
  if (!/^https?:\/\//i.test(value)) return "";
  if (!isPublicHttpUrl(value)) return "";
  const normalized = normalizeUrl(value);
  return normalized.length <= STOCK_URL_MAX ? normalized : "";
}

/**
 * The scrape as the niche generator should see it: the site's description and
 * kb (capped), the products it lists and its city. Undefined when the scrape
 * said none of those, so the generator prompt stays as it was.
 */
export function siteFactsFrom(scraped: Record<string, unknown>): SiteFacts | undefined {
  const summary = cut([str(scraped.business_description), str(scraped.kb)].filter(Boolean).join("\n"), SITE_FACTS_SUMMARY_MAX);
  const products = normalizeProducts(scraped.products);
  const city = cut(str(scraped.city), CITY_MAX);
  if (!summary && products.length === 0 && !city) return undefined;
  return { summary, products, city };
}

function productLine(p: DemoProduct): string {
  return `- ${p.name}${p.detail ? ` (${p.detail})` : ""}${p.price ? `: ${p.price}` : ""}`;
}

/** The part of the generator's user prompt that carries the site's real facts; "" when there are none. */
export function siteFactsBlock(facts?: SiteFacts): string {
  if (!facts) return "";
  const products = facts.products.slice(0, MAX_PRODUCTS);
  return (
    "\n\nReal facts from this business's own website (use them, never contradict them):" +
    (facts.summary ? "\n" + facts.summary : "") +
    (products.length ? "\nProducts and services they list:\n" + products.map(productLine).join("\n") : "") +
    (facts.city ? "\nCity: " + facts.city : "") +
    "\nReference these real items in enquiry_context, first_message, scoping_ladder and niche_objection_examples. Never invent products, models or prices that are not listed."
  );
}

/** The scan's values for the Client's own columns. Empty string means the scan found nothing. */
export interface ScanFields { products: DemoProduct[]; stockUrl: string; city: string; phone: string }

export function scanFieldsFromScrape(scraped: Record<string, unknown>): ScanFields {
  return {
    products: normalizeProducts(scraped.products),
    stockUrl: cleanStockUrl(scraped.stock_url),
    city: cut(str(scraped.city), CITY_MAX),
    phone: cut(str(scraped.phone), PHONE_MAX),
  };
}

function isEmpty(value: string | null): boolean {
  return !(value ?? "").trim();
}

/**
 * The column values to write for one language's scan, as a Drizzle .set() part
 * ({} when there is nothing to write). A scan never blanks anything.
 *  - overwrite=true (a fresh scan): every non-empty scan value is set; the
 *    language's product list is replaced and the other languages' lists stay.
 *  - overwrite=false (backfill of a Client that already exists): a value is set
 *    only where the Client has none today; products only when this language's
 *    list is empty.
 */
export function planScanFieldUpdate(
  existing: { products: ProductsByLang | null; stockUrl: string | null; city: string | null; phone: string | null },
  lang: ProductLang,
  scan: ScanFields,
  overwrite: boolean,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  const current = existing.products?.[lang];
  if (scan.products.length > 0 && (overwrite || !Array.isArray(current) || current.length === 0)) {
    out.products = putProducts(existing.products, lang, scan.products);
  }

  // The last gate before the database: the engine quotes this address in prompts.
  const stockUrl = cleanStockUrl(scan.stockUrl);
  if (stockUrl && (overwrite || isEmpty(existing.stockUrl))) out.stockUrl = stockUrl;
  const city = scan.city.trim();
  if (city && (overwrite || isEmpty(existing.city))) out.city = city;
  const phone = scan.phone.trim();
  if (phone && (overwrite || isEmpty(existing.phone))) out.phone = phone;

  return out;
}
