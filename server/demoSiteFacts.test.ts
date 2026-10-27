import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_PRODUCTS, type ProductsByLang } from "@shared/demoProducts";
import {
  cleanStockUrl,
  planScanFieldUpdate,
  scanFieldsFromScrape,
  siteFactsBlock,
  siteFactsFrom,
} from "./demoSiteFacts";

const scraped = {
  business_description: "Dealer in Rosmalen.",
  kb: "Open ma-za.",
  products: [{ name: "Golf 8", detail: "2021", price: "€ 24.950" }],
  stock_url: "https://g.nl/occasions",
  city: "Rosmalen",
  phone: "073 123",
};

test("siteFactsFrom joins the description and the kb, and is undefined when the scrape has nothing", () => {
  const f = siteFactsFrom(scraped)!;
  assert.equal(f.summary, "Dealer in Rosmalen.\nOpen ma-za.");
  assert.equal(f.products.length, 1);
  assert.equal(f.city, "Rosmalen");
  assert.equal(siteFactsFrom({}), undefined);
  assert.equal(siteFactsFrom({ products: "nope", city: 5, kb: "  " }), undefined);
});

test("siteFactsFrom caps the summary and does not leave a stray newline for one empty half", () => {
  assert.equal(siteFactsFrom({ kb: "x".repeat(5000) })!.summary.length, 3000);
  assert.equal(siteFactsFrom({ kb: "Only the kb." })!.summary, "Only the kb.");
  assert.equal(siteFactsFrom({ business_description: "Only the description." })!.summary, "Only the description.");
});

test("siteFactsFrom keeps products or a city alone as facts", () => {
  assert.equal(siteFactsFrom({ city: "Utrecht" })!.summary, "");
  assert.equal(siteFactsFrom({ products: [{ name: "Polo" }] })!.products[0].name, "Polo");
});

test("siteFactsBlock is empty for no facts and carries the listed items, the city and the no-inventing rule", () => {
  assert.equal(siteFactsBlock(undefined), "");
  const b = siteFactsBlock(siteFactsFrom(scraped));
  assert.match(b, /- Golf 8 \(2021\): € 24\.950/);
  assert.match(b, /City: Rosmalen/);
  assert.match(b, /Never invent/);
  assert.match(b, /Dealer in Rosmalen\.\nOpen ma-za\./);
});

test("siteFactsBlock leaves out the parts that are empty and writes a bare product name on its own", () => {
  const b = siteFactsBlock({ summary: "", products: [{ name: "Polo", detail: "", price: "" }, { name: "Up", detail: "", price: "€ 9" }], city: "" });
  assert.match(b, /\n- Polo\n- Up: € 9\n/);
  assert.doesNotMatch(b, /City:/);
  const cityOnly = siteFactsBlock({ summary: "S", products: [], city: "Breda" });
  assert.doesNotMatch(cityOnly, /Products and services/);
  assert.match(cityOnly, /City: Breda/);
});

test("siteFactsBlock lists at most MAX_PRODUCTS items", () => {
  const products = Array.from({ length: MAX_PRODUCTS + 5 }, (_, i) => ({ name: `Item ${i}`, detail: "", price: "" }));
  const lines = siteFactsBlock({ summary: "S", products, city: "" }).split("\n").filter((l) => l.startsWith("- "));
  assert.equal(lines.length, MAX_PRODUCTS);
});

test("scanFieldsFromScrape normalizes the scrape into the four stored fields", () => {
  assert.deepEqual(scanFieldsFromScrape(scraped), {
    products: [{ name: "Golf 8", detail: "2021", price: "€ 24.950" }],
    stockUrl: "https://g.nl/occasions",
    city: "Rosmalen",
    phone: "073 123",
  });
  assert.deepEqual(scanFieldsFromScrape({}), { products: [], stockUrl: "", city: "", phone: "" });
  assert.deepEqual(scanFieldsFromScrape({ products: 7, stock_url: 3, city: null, phone: [] }), { products: [], stockUrl: "", city: "", phone: "" });
});

test("cleanStockUrl accepts only an absolute public http(s) URL", () => {
  assert.equal(cleanStockUrl("https://g.nl/occasions"), "https://g.nl/occasions");
  assert.equal(cleanStockUrl("  http://g.nl/voorraad#top "), "http://g.nl/voorraad");
  for (const bad of ["g.nl/occasions", "/occasions", "javascript:alert(1)", "ftp://g.nl/x", "file:///etc/passwd", "http://localhost:5001/x", "http://127.0.0.1/x", "http://192.168.1.4/x", "https://x.internal/y", "", "   ", null, undefined, 5]) {
    assert.equal(cleanStockUrl(bad), "", String(bad));
  }
  assert.equal(cleanStockUrl(`https://g.nl/${"a".repeat(600)}`), "");
});

test("scanFieldsFromScrape drops a stock url that is not an absolute public http(s) URL", () => {
  assert.equal(scanFieldsFromScrape({ stock_url: "g.nl/occasions" }).stockUrl, "");
  assert.equal(scanFieldsFromScrape({ stock_url: "http://10.0.0.5/stock" }).stockUrl, "");
});

test("planScanFieldUpdate backfill never overwrites what the Client already has", () => {
  const scan = scanFieldsFromScrape(scraped);
  const keep = planScanFieldUpdate({ products: { nl: [{ name: "Handmade", detail: "", price: "" }] }, stockUrl: null, city: "Den Bosch", phone: null }, "nl", scan, false);
  assert.equal("city" in keep, false);
  assert.equal("products" in keep, false);
  assert.equal(keep.stockUrl, "https://g.nl/occasions");
  assert.equal(keep.phone, "073 123");
});

test("planScanFieldUpdate backfill fills another language's empty list only", () => {
  const scan = scanFieldsFromScrape(scraped);
  const en = planScanFieldUpdate({ products: { nl: [{ name: "A", detail: "", price: "" }] }, stockUrl: "s", city: "c", phone: "p" }, "en", scan, false);
  assert.equal((en.products as ProductsByLang).en?.[0].name, "Golf 8");
  assert.equal((en.products as ProductsByLang).nl?.[0].name, "A");
  assert.deepEqual(Object.keys(en), ["products"]);
});

test("planScanFieldUpdate treats whitespace and an empty list as empty when backfilling", () => {
  const scan = scanFieldsFromScrape(scraped);
  const out = planScanFieldUpdate({ products: { nl: [] }, stockUrl: "  ", city: "", phone: null }, "nl", scan, false);
  assert.equal((out.products as ProductsByLang).nl?.[0].name, "Golf 8");
  assert.equal(out.stockUrl, "https://g.nl/occasions");
  assert.equal(out.city, "Rosmalen");
  assert.equal(out.phone, "073 123");
});

test("planScanFieldUpdate with a fresh scan sets non-empty values and never blanks", () => {
  assert.equal(planScanFieldUpdate({ products: {}, stockUrl: "old", city: "old", phone: "old" }, "nl", { products: [], stockUrl: "", city: "New", phone: "" }, true).city, "New");
  assert.deepEqual(planScanFieldUpdate({ products: {}, stockUrl: null, city: null, phone: null }, "nl", { products: [], stockUrl: "", city: "", phone: "" }, true), {});
  const kept = planScanFieldUpdate({ products: { nl: [{ name: "Old", detail: "", price: "" }] }, stockUrl: "old", city: "old", phone: "old" }, "nl", { products: [], stockUrl: "", city: "", phone: "" }, true);
  assert.deepEqual(kept, {});
});

test("planScanFieldUpdate with a fresh scan replaces this language's list and keeps the other languages", () => {
  const scan = scanFieldsFromScrape(scraped);
  const out = planScanFieldUpdate({ products: { nl: [{ name: "Old", detail: "", price: "" }], en: [{ name: "Kept", detail: "", price: "" }] }, stockUrl: null, city: null, phone: null }, "nl", scan, true);
  assert.equal((out.products as ProductsByLang).nl?.[0].name, "Golf 8");
  assert.equal((out.products as ProductsByLang).en?.[0].name, "Kept");
});

test("planScanFieldUpdate gates the stock url again before it is stored", () => {
  const scan = { products: [], stockUrl: "javascript:alert(1)", city: "", phone: "" };
  assert.deepEqual(planScanFieldUpdate({ products: null, stockUrl: null, city: null, phone: null }, "en", scan, true), {});
});
