import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { ScanError, buildFromNiche, saveScanReview, scanWebsite } from "./demoScanApi";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

function stubFetch(status: number, body: unknown) {
  const calls: { url: string; init: RequestInit }[] = [];
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
  }) as typeof fetch;
  return calls;
}

test("scanWebsite posts to from-website and fills missing fields", async () => {
  const calls = stubFetch(200, { client: "Garage Smit", languages: ["nl"], pages_scraped: ["/"], provider_used: "claude", products: [{ name: "Golf 8", detail: "2021", price: "24950" }], city: "Rosmalen" });
  const r = await scanWebsite({ url: "https://smit.nl", language: "nl", provider: "claude", claudeModel: "sonnet" });
  assert.equal(calls[0].url, "/api/demo/clients/from-website");
  assert.equal(calls[0].init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), { url: "https://smit.nl", language: "nl", provider: "claude", claudeModel: "sonnet" });
  assert.equal(r.client, "Garage Smit");
  assert.equal(r.products.length, 1);
  assert.equal(r.stock_url, "");
  assert.equal(r.business_description, "");
  assert.equal(r.screenshot, null);
});

test("a failed scan throws the server's message with retryable copied on", async () => {
  stubFetch(502, { message: "Generation failed", stage: "generate", retryable: true });
  await assert.rejects(scanWebsite({ text: "x", language: "en", provider: "openai" }), (e: unknown) => e instanceof ScanError && e.message === "Generation failed" && e.retryable === true);
  stubFetch(400, { message: "Give a website URL" });
  await assert.rejects(scanWebsite({ language: "en", provider: "claude" }), (e: unknown) => e instanceof ScanError && e.retryable === false);
  stubFetch(500, {});
  await assert.rejects(scanWebsite({ language: "en", provider: "claude" }), /Request failed \(500\)/);
});

test("buildFromNiche posts to from-niche and returns the client key and whether it was stored", async () => {
  const calls = stubFetch(200, { client: "Dog groomer", saved: true, provider_used: "claude" });
  assert.deepEqual(await buildFromNiche({ niche: "Dog groomer", language: "en", market: "uk", provider: "claude" }), { client: "Dog groomer", saved: true });
  assert.equal(calls[0].url, "/api/demo/clients/from-niche");
  assert.equal(JSON.parse(String(calls[0].init.body)).market, "uk");
  stubFetch(200, { client: "Dog groomer", saved: false });
  assert.equal((await buildFromNiche({ niche: "Dog groomer", language: "en", provider: "claude" })).saved, false);
});

test("scanWebsite reports saved unless the server said it stored nothing", async () => {
  stubFetch(200, { client: "A" });
  assert.equal((await scanWebsite({ url: "https://a.nl", language: "nl", provider: "claude" })).saved, true);
  stubFetch(200, { client: "A", saved: false });
  assert.equal((await scanWebsite({ url: "https://a.nl", language: "nl", provider: "claude" })).saved, false);
});

test("saveScanReview patches the summary, products, city and stock URL for one language", async () => {
  const calls = stubFetch(200, { client: {} });
  const products = [{ name: "Cake", detail: "", price: "5" }];
  await saveScanReview("Bakkerij / Jansen", "nl", { summary: "Bakery in Breda.", products, city: "Breda", stockUrl: "https://b.nl/shop" });
  assert.equal(calls[0].url, "/api/demo/clients/Bakkerij%20%2F%20Jansen");
  assert.equal(calls[0].init.method, "PATCH");
  assert.deepEqual(JSON.parse(String(calls[0].init.body)), {
    text: { descriptionTemplate: { nl: "Bakery in Breda." } },
    products: { nl: products },
    city: "Breda",
    stockUrl: "https://b.nl/shop",
  });
});
