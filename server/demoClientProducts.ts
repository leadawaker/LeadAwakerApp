/**
 * What the persona editor and the demo prompts need for a Client's products,
 * stock page URL, city and phone. Pure on purpose (no db import) so the unit
 * tests can run it; server/demo-clients.ts holds the database calls and only
 * calls into this.
 */
import { z } from "zod";
import {
  pickProducts,
  putProducts,
  type DemoProduct,
  type ProductLang,
  type ProductsByLang,
} from "@shared/demoProducts";

const PRODUCT_LANGS: readonly ProductLang[] = ["en", "nl", "pt"];

function isProductLang(value: string): value is ProductLang {
  return (PRODUCT_LANGS as readonly string[]).includes(value);
}

/** The product-related part of an edit from the Clients tab. */
export interface ProductPatch {
  /** Replaced per language given; languages not in the patch stay. */
  products?: ProductsByLang;
  stockUrl?: string | null;
  city?: string | null;
  phone?: string | null;
}

/** The persona fields the demo prompts read (NicheContext.products, stock_url, city). */
export interface ContextProductFields {
  products: DemoProduct[];
  stock_url?: string;
  city?: string;
}

/**
 * The product fields of a rebuilt NicheContext. Keys with nothing to say are
 * left out (not set to undefined), so the overlay that reads the context sees
 * only what the Client really has.
 */
export function contextProductFields(
  row: { products?: unknown; stockUrl?: string | null; city?: string | null },
  lang: ProductLang,
): ContextProductFields {
  const raw = row.products;
  const byLang = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as ProductsByLang) : null;
  const out: ContextProductFields = { products: pickProducts(byLang, lang) };
  const stockUrl = (row.stockUrl ?? "").trim();
  const city = (row.city ?? "").trim();
  if (stockUrl) out.stock_url = stockUrl;
  if (city) out.city = city;
  return out;
}

/** A scalar from the editor: trimmed, and "" (or null) stored as null. */
function scalar(value: string | null): string | null {
  return (value ?? "").trim() || null;
}

/**
 * The column values for the product part of a patch. Only the fields the patch
 * names are returned, so an absent field leaves its column alone. Products are
 * written per language through putProducts (normalized, capped); unknown
 * language keys are ignored because the result goes straight into a Drizzle
 * .set().
 */
export function productPatchValues(existing: ProductsByLang | null, patch: ProductPatch): Record<string, unknown> {
  const values: Record<string, unknown> = {};
  if (patch.products !== undefined) {
    let next: ProductsByLang = { ...(existing ?? {}) };
    for (const [lang, list] of Object.entries(patch.products ?? {})) {
      if (!isProductLang(lang)) continue;
      next = putProducts(next, lang, list ?? []);
    }
    values.products = next;
  }
  if (patch.stockUrl !== undefined) values.stockUrl = scalar(patch.stockUrl);
  if (patch.city !== undefined) values.city = scalar(patch.city);
  if (patch.phone !== undefined) values.phone = scalar(patch.phone);
  return values;
}

const productSchema = z.object({
  name: z.string().max(200),
  detail: z.string().max(400).default(""),
  price: z.string().max(80).default(""),
});

/**
 * The route's zod fields for a Client patch. The limits are looser than the
 * real ones on purpose: normalizeProducts cuts each field to its true limit and
 * each language to MAX_PRODUCTS, so an over-long paste is trimmed, not refused.
 * The 40 only bounds the request size.
 */
export const productPatchShape = {
  products: z.record(z.enum(["en", "nl", "pt"]), z.array(productSchema).max(40)).optional(),
  stockUrl: z.string().trim().max(500).nullable().optional(),
  city: z.string().trim().max(120).nullable().optional(),
  phone: z.string().trim().max(60).nullable().optional(),
};
