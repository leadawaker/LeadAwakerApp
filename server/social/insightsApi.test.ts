import { test } from "node:test";
import assert from "node:assert/strict";
import { IgApiError } from "./instagramApi";
import { fetchMetrics, getAccountDayTotals, getMediaInsights, listRecentMedia, parseInsights, parseMediaList } from "./insightsApi";

test("parses values and total_value shapes", () => {
  assert.deepEqual(parseInsights({ data: [{ name: "views", values: [{ value: 120 }] }, { name: "reach", total_value: { value: "90" } }, { name: "bad", values: [] }, { nope: 1 }] }), { views: 120, reach: 90 });
  assert.deepEqual(parseInsights(null), {});
});

test("media list keeps what it needs and never the paging URL", () => {
  const media = parseMediaList({
    data: [{ id: "1", media_type: "VIDEO", media_product_type: "REELS", permalink: "https://ig/r/1", caption: "Oi", timestamp: "2026-10-18T13:00:00+0000", like_count: 5, comments_count: "2" }, { no: "id" }],
    paging: { next: "https://graph.instagram.com/v26.0/x/media?access_token=SECRET&after=abc" },
  });
  assert.equal(media.length, 1);
  assert.equal(media[0].postedAt?.toISOString(), "2026-10-18T13:00:00.000Z");
  assert.equal(media[0].commentsCount, 2);
  assert.ok(!JSON.stringify(media).includes("SECRET"));
});

test("a refused batch is asked one by one: good metrics come back, refused ones become skips", async () => {
  const asked: string[][] = [];
  const call = async (m: string[]) => {
    asked.push(m);
    if (m.includes("reels_skip_rate")) throw new IgApiError("(#100) metric[0] must be one of the following values: ...", 100, "http");
    return { data: m.map((name) => ({ name, values: [{ value: name.length }] })) };
  };
  const r = await fetchMetrics(call, ["views", "reach", "reels_skip_rate"]);
  assert.deepEqual(r.values, { views: 5, reach: 5 });
  assert.match(r.skipped.reels_skip_rate, /#100/);
  assert.deepEqual(asked, [["views", "reach", "reels_skip_rate"], ["views"], ["reach"], ["reels_skip_rate"]]);
});

test("a metric missing from the answer is a skip; a network problem is thrown (the next run tries again)", async () => {
  assert.deepEqual(await fetchMetrics(async () => ({ data: [{ name: "views", values: [{ value: 1 }] }] }), ["views", "saved"]), { values: { views: 1 }, skipped: { saved: "not returned" } });
  await assert.rejects(fetchMetrics(async () => { throw new IgApiError("timeout", undefined, "network"); }, ["views"]), IgApiError);
  assert.deepEqual(await fetchMetrics(async () => ({}), []), { values: {}, skipped: {} });
});

test("requests: GET, token in the header never the URL, the right paths and params", async () => {
  const urls: string[] = [];
  const fetch = (async (url: any, init?: RequestInit) => {
    urls.push(String(url));
    assert.equal(init?.method, "GET");
    assert.equal((init?.headers as Record<string, string>).Authorization, "Bearer TOKEN");
    return new Response(JSON.stringify({ data: [] }), { status: 200 });
  }) as typeof globalThis.fetch;
  await listRecentMedia({ fetch }, "17841", "TOKEN", 500);
  await getMediaInsights({ fetch }, "m1", "TOKEN", ["views", "reach"]);
  await getAccountDayTotals({ fetch }, "17841", "TOKEN", ["reach"], "2026-10-19");
  assert.match(urls[0], /\/17841\/media\?fields=.+&limit=100$/);
  assert.match(urls[1], /\/m1\/insights\?metric=views%2Creach$/);
  assert.match(urls[2], /metric_type=total_value/);
  assert.match(urls[2], new RegExp(`since=${Date.parse("2026-10-19T00:00:00Z") / 1000}&until=${Date.parse("2026-10-20T00:00:00Z") / 1000}`));
  assert.ok(urls.every((u) => !u.includes("TOKEN")));
});
