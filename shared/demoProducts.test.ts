import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PRODUCTS, PRODUCT_LIMITS, normalizeProducts, pickProducts, putProducts } from "./demoProducts";

test("the caps are pinned", () => {
  assert.equal(MAX_PRODUCTS, 20);
  assert.deepEqual(PRODUCT_LIMITS, { name: 120, detail: 200, price: 40 });
});

test("normalizeProducts trims, drops empty names and dedupes by lowercased name", () => {
  assert.deepEqual(
    normalizeProducts([
      { name: " Golf 8 ", detail: "2021, 45.000 km", price: "€ 24.950" },
      { name: "golf 8", detail: "dup" },
      { name: "" },
    ]),
    [{ name: "Golf 8", detail: "2021, 45.000 km", price: "€ 24.950" }],
  );
});

test("normalizeProducts caps the list at 20 and each field at its limit", () => {
  assert.equal(normalizeProducts(Array.from({ length: 30 }, (_, i) => ({ name: `P${i}` }))).length, 20);
  const long = normalizeProducts([{ name: "x".repeat(300), detail: "d".repeat(500), price: "p".repeat(100) }])[0];
  assert.equal(long.name.length, 120);
  assert.equal(long.detail.length, 200);
  assert.equal(long.price.length, 40);
});

test("normalizeProducts strips control characters and tolerates junk", () => {
  assert.equal(normalizeProducts([{ name: "A\u0000B" }])[0].name, "AB");
  assert.equal(normalizeProducts([{ name: "A\tB\nC", detail: "x\u0007y" }])[0].name, "A B C");
  assert.equal(normalizeProducts([{ name: "A", detail: "x\u0007y" }])[0].detail, "xy");
  assert.deepEqual(normalizeProducts("nope"), []);
  assert.deepEqual(normalizeProducts(null), []);
  assert.deepEqual(normalizeProducts({}), []);
  assert.deepEqual(normalizeProducts([null, 3, "x", { detail: "no name" }, { name: "   " }, { name: {} }]), []);
});

test("normalizeProducts keeps a numeric price as text", () => {
  assert.deepEqual(normalizeProducts([{ name: "Golf", price: 24950 }]), [{ name: "Golf", detail: "", price: "24950" }]);
});

test("normalizeProducts fills missing detail and price with empty strings", () => {
  assert.deepEqual(normalizeProducts([{ name: "Solo" }]), [{ name: "Solo", detail: "", price: "" }]);
});

test("pickProducts prefers the link language, else the first non-empty of en, nl, pt", () => {
  const a = { name: "A", detail: "", price: "" };
  const b = { name: "B", detail: "", price: "" };
  assert.deepEqual(pickProducts({ nl: [a] }, "en"), [a]);
  assert.deepEqual(pickProducts({ en: [b], nl: [a] }, "nl"), [a]);
  assert.deepEqual(pickProducts({ en: [], nl: [a], pt: [b] }, "pt"), [b]);
  assert.deepEqual(pickProducts({ en: [], nl: [], pt: [b] }, "en"), [b]);
  assert.deepEqual(pickProducts({ en: [], nl: [] }, "pt"), []);
  assert.deepEqual(pickProducts(null, "en"), []);
  assert.deepEqual(pickProducts(undefined, "nl"), []);
});

test("putProducts returns a normalized copy and leaves other languages alone", () => {
  const input = { nl: [{ name: "A", detail: "", price: "" }] };
  const out = putProducts(input, "en", [{ name: " B ", detail: "", price: "" }, { name: "b", detail: "", price: "" }]);
  assert.equal(out.nl?.length, 1);
  assert.deepEqual(out.en, [{ name: "B", detail: "", price: "" }]);
  assert.equal("en" in input, false);
  assert.notEqual(out, input);
  assert.deepEqual(putProducts(null, "pt", [{ name: "C", detail: "", price: "" }]), { pt: [{ name: "C", detail: "", price: "" }] });
});

test("pickProducts returns a copy, never the stored array or its items", () => {
  const stored = { nl: [{ name: "A", detail: "", price: "" }] };
  const out = pickProducts(stored, "nl");
  assert.notEqual(out, stored.nl);
  assert.notEqual(out[0], stored.nl[0]);
  out[0].name = "changed";
  assert.equal(stored.nl[0].name, "A");
});
