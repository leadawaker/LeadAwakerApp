import { test } from "node:test";
import assert from "node:assert/strict";
import { z } from "zod";
import type { ProductsByLang } from "@shared/demoProducts";
import { contextProductFields, productPatchShape, productPatchValues } from "./demoClientProducts";

test("contextProductFields picks the link language's products and carries the stock url and city", () => {
  assert.deepEqual(
    contextProductFields(
      { products: { nl: [{ name: "Golf", detail: "", price: "€ 1" }] }, stockUrl: "https://x.nl/occasions", city: "Rosmalen" },
      "nl",
    ),
    { products: [{ name: "Golf", detail: "", price: "€ 1" }], stock_url: "https://x.nl/occasions", city: "Rosmalen" },
  );
});

test("contextProductFields omits empty fields instead of setting them to undefined", () => {
  assert.deepEqual(contextProductFields({ products: {}, stockUrl: null, city: null }, "en"), { products: [] });
  assert.deepEqual(contextProductFields({ stockUrl: "  ", city: "" }, "pt"), { products: [] });
});

test("contextProductFields falls back to another language's list and tolerates junk", () => {
  const out = contextProductFields({ products: { pt: [{ name: "Fusca", detail: "", price: "" }] } }, "en");
  assert.equal(out.products[0].name, "Fusca");
  assert.deepEqual(contextProductFields({ products: "nope" }, "en"), { products: [] });
  assert.deepEqual(contextProductFields({ products: [1, 2] }, "en"), { products: [] });
  assert.deepEqual(contextProductFields({ products: null }, "en"), { products: [] });
});

test("contextProductFields does not hand out the stored array", () => {
  const stored: ProductsByLang = { en: [{ name: "A", detail: "", price: "" }] };
  const out = contextProductFields({ products: stored }, "en");
  assert.notEqual(out.products, stored.en);
});

test("productPatchValues writes the given languages, keeps the rest, nulls blank scalars and skips absent ones", () => {
  const v = productPatchValues(
    { nl: [{ name: "A", detail: "", price: "" }] },
    { products: { en: [{ name: "B", detail: "", price: "" }] }, city: "  ", stockUrl: "https://x.nl/v" },
  );
  assert.equal((v.products as ProductsByLang).nl?.length, 1);
  assert.equal((v.products as ProductsByLang).en?.[0].name, "B");
  assert.equal(v.city, null);
  assert.equal(v.stockUrl, "https://x.nl/v");
  assert.equal("phone" in v, false);
});

test("productPatchValues normalizes a language's list and can empty it", () => {
  const v = productPatchValues(
    { nl: [{ name: "A", detail: "", price: "" }], en: [{ name: "B", detail: "", price: "" }] },
    { products: { nl: [], en: [{ name: " C ", detail: "x\ny", price: "" }, { name: "c" }] } },
  );
  assert.deepEqual((v.products as ProductsByLang).nl, []);
  assert.deepEqual((v.products as ProductsByLang).en, [{ name: "C", detail: "x y", price: "" }]);
});

test("productPatchValues ignores an unknown language key and works from no stored products", () => {
  const v = productPatchValues(null, { products: { fr: [{ name: "X", detail: "", price: "" }] } as unknown as ProductsByLang });
  assert.deepEqual(v.products, {});
  const w = productPatchValues(null, { phone: " +31 6 1234 5678 ", stockUrl: null });
  assert.equal(w.phone, "+31 6 1234 5678");
  assert.equal(w.stockUrl, null);
  assert.equal("products" in w, false);
  assert.equal("city" in w, false);
});

test("productPatchValues does not modify the stored products it was given", () => {
  const stored: ProductsByLang = { nl: [{ name: "A", detail: "", price: "" }] };
  productPatchValues(stored, { products: { nl: [{ name: "Z", detail: "", price: "" }] } });
  assert.equal(stored.nl?.[0].name, "A");
});

test("productPatchShape accepts a patch, fills detail and price, and rejects bad input", () => {
  const schema = z.object(productPatchShape);
  const ok = schema.parse({ products: { nl: [{ name: "Golf" }] }, stockUrl: " https://x.nl ", city: null });
  assert.deepEqual(ok.products, { nl: [{ name: "Golf", detail: "", price: "" }] });
  assert.equal(ok.stockUrl, "https://x.nl");
  assert.equal(schema.safeParse({}).success, true);
  assert.equal(schema.safeParse({ products: { fr: [] } }).success, false);
  assert.equal(schema.safeParse({ products: { en: Array.from({ length: 41 }, (_, i) => ({ name: `P${i}` })) } }).success, false);
  assert.equal(schema.safeParse({ products: { en: Array.from({ length: 40 }, (_, i) => ({ name: `P${i}` })) } }).success, true);
  assert.equal(schema.safeParse({ products: { en: [{ name: "x".repeat(201) }] } }).success, false);
  assert.equal(schema.safeParse({ stockUrl: "x".repeat(501) }).success, false);
  assert.equal(schema.safeParse({ city: "x".repeat(121) }).success, false);
  assert.equal(schema.safeParse({ phone: "x".repeat(61) }).success, false);
});
