// What a demo business sells, per language. Stored in Niche_Vocabulary.products
// and read by the demo prompts. Pure: safe in the client bundle.
export type ProductLang = "en" | "nl" | "pt";
export interface DemoProduct { name: string; detail: string; price: string }
export type ProductsByLang = Partial<Record<ProductLang, DemoProduct[]>>;

/** The one cap on a language's list, for the editor, the scan and the prompts. */
export const MAX_PRODUCTS = 20;
export const PRODUCT_LIMITS = { name: 120, detail: 200, price: 40 } as const;

const LANG_ORDER: ProductLang[] = ["en", "nl", "pt"];

/** A string (or a finite number, which a model sometimes returns for a price)
 *  with line breaks as spaces, other control characters removed, trimmed and cut. */
function clean(value: unknown, limit: number): string {
  const s = typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : "";
  return s
    .replace(/[\t\n\r]+/g, " ")
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, "")
    .trim()
    .slice(0, limit)
    .trim();
}

export function normalizeProducts(raw: unknown): DemoProduct[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: DemoProduct[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = clean(rec.name, PRODUCT_LIMITS.name);
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, detail: clean(rec.detail, PRODUCT_LIMITS.detail), price: clean(rec.price, PRODUCT_LIMITS.price) });
    if (out.length >= MAX_PRODUCTS) break;
  }
  return out;
}

/** The link language's list when it has items, else the first non-empty of en, nl, pt, else none. A copy, never the stored array. */
export function pickProducts(byLang: ProductsByLang | null | undefined, lang: ProductLang): DemoProduct[] {
  if (!byLang) return [];
  for (const l of [lang, ...LANG_ORDER]) {
    const list = byLang[l];
    if (Array.isArray(list) && list.length > 0) return list.map((p) => ({ ...p }));
  }
  return [];
}

/** A copy of `byLang` with `lang` replaced by the normalized list. */
export function putProducts(byLang: ProductsByLang | null | undefined, lang: ProductLang, list: DemoProduct[]): ProductsByLang {
  return { ...(byLang || {}), [lang]: normalizeProducts(list) };
}
