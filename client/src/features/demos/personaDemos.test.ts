import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_WINDOW_MS,
  NO_PERSONA_KEY,
  WEBSITE_KEY,
  activityDot,
  activityDots,
  followUpCount,
  isSpecialKey,
  prospectSummary,
  prospectTexts,
  rowsForKey,
  splitRowsByPersona,
  visibleSpecialKeys,
  type ActivityDot,
} from "./personaDemos";
import { row } from "./demoTestFixtures";
import { DEFAULT_PERSONA_FILTERS } from "../campaigns/components/clients/personaFilters";

const now = Date.parse("2026-10-28T12:00:00Z");
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const ago = (ms: number) => new Date(now - ms).toISOString();

test("isSpecialKey recognises the two special card keys only", () => {
  assert.equal(isSpecialKey(NO_PERSONA_KEY), true);
  assert.equal(isSpecialKey(WEBSITE_KEY), true);
  assert.equal(isSpecialKey("robben"), false);
  assert.equal(isSpecialKey(null), false);
  assert.equal(isSpecialKey(undefined), false);
});

test("splitRowsByPersona: a row goes to the persona named by its niche, trimmed", () => {
  const a = row({ key: "a", clientNiche: "robben" });
  const b = row({ key: "b", clientNiche: " robben " });
  const split = splitRowsByPersona([a, b], ["robben", "bakkerij"]);
  assert.deepEqual(split.byNiche.get("robben"), [a, b]);
  assert.deepEqual(split.noPersona, []);
  assert.deepEqual(split.website, []);
});

test("splitRowsByPersona: an empty niche and a deleted persona go to No persona", () => {
  const empty = row({ key: "empty", clientNiche: "" });
  const gone = row({ key: "gone", clientNiche: "gone" });
  const split = splitRowsByPersona([empty, gone], ["robben"]);
  assert.deepEqual(split.noPersona, [empty, gone]);
  assert.equal(split.byNiche.size, 0);
});

test("splitRowsByPersona: a public website demo goes to website whatever its niche", () => {
  const w = row({ key: "w", publicDemo: true, clientNiche: "robben" });
  const split = splitRowsByPersona([w], ["robben"]);
  assert.deepEqual(split.website, [w]);
  assert.equal(split.byNiche.has("robben"), false);
  assert.deepEqual(split.noPersona, []);
});

test("rowsForKey: special keys, personas with rows, and personas without", () => {
  const a = row({ key: "a", clientNiche: "robben" });
  const n = row({ key: "n" });
  const w = row({ key: "w", publicDemo: true });
  const split = splitRowsByPersona([a, n, w], ["robben", "bakkerij"]);
  assert.equal(split.byNiche.has("bakkerij"), false);
  assert.deepEqual(rowsForKey(split, "bakkerij"), []);
  assert.equal(rowsForKey(split, NO_PERSONA_KEY), split.noPersona);
  assert.equal(rowsForKey(split, WEBSITE_KEY), split.website);
  assert.deepEqual(rowsForKey(split, "robben"), [a]);
});

test("splitRowsByPersona keeps input order inside every bucket", () => {
  const a = row({ key: "a", clientNiche: "robben" });
  const x = row({ key: "x" });
  const b = row({ key: "b", clientNiche: "robben" });
  const y = row({ key: "y" });
  const split = splitRowsByPersona([a, x, b, y], new Set(["robben"]));
  assert.deepEqual(split.byNiche.get("robben")!.map((r) => r.key), ["a", "b"]);
  assert.deepEqual(split.noPersona.map((r) => r.key), ["x", "y"]);
});

test("activityDot: no rows, no dot", () => {
  assert.equal(activityDot([], null, now), null);
});

test("activityDot: a reply in the window is a reply, an open an open", () => {
  assert.equal(activityDot([row({ lastReplyAt: ago(2 * DAY) })], null, now), "reply");
  assert.equal(activityDot([row({ lastOpenAt: ago(DAY) })], null, now), "open");
});

test("activityDot: a reply wins over a newer open", () => {
  assert.equal(activityDot([row({ lastReplyAt: ago(2 * DAY), lastOpenAt: ago(HOUR) })], null, now), "reply");
});

test("activityDot: the window is 7 days, inclusive", () => {
  assert.equal(ACTIVITY_WINDOW_MS, 7 * DAY);
  assert.equal(activityDot([row({ lastReplyAt: ago(8 * DAY) })], null, now), null);
  assert.equal(activityDot([row({ lastReplyAt: ago(ACTIVITY_WINDOW_MS) })], null, now), "reply");
});

test("activityDot: only activity after the seen time counts", () => {
  assert.equal(activityDot([row({ lastReplyAt: ago(2 * DAY) })], ago(DAY), now), null);
  assert.equal(activityDot([row({ lastReplyAt: ago(2 * DAY), lastOpenAt: ago(HOUR) })], ago(DAY), now), "open");
  assert.equal(activityDot([row({ lastReplyAt: ago(3 * DAY) })], ago(5 * DAY), now), "reply");
});

test("activityDot: a bad seen time means never seen, a bad row time is ignored", () => {
  assert.equal(activityDot([row({ lastReplyAt: ago(DAY) })], "garbage", now), "reply");
  assert.equal(activityDot([row({ lastReplyAt: "not a date" })], null, now), null);
});

test("activityDot looks across every row", () => {
  const rows = [row({ key: "a" }), row({ key: "b", lastOpenAt: ago(HOUR) }), row({ key: "c", lastReplyAt: ago(DAY) })];
  assert.equal(activityDot(rows, null, now), "reply");
});

test("activityDots: only cards with a dot, replies and opens", () => {
  const split = splitRowsByPersona(
    [row({ key: "a", clientNiche: "robben", lastReplyAt: ago(DAY) }), row({ key: "n", lastOpenAt: ago(DAY) }), row({ key: "w", publicDemo: true })],
    ["robben", "bakkerij"],
  );
  const dots = activityDots(split, ["robben", "bakkerij"], {}, now);
  assert.deepEqual(Object.fromEntries(dots), { robben: "reply", [NO_PERSONA_KEY]: "open" });
  assert.equal(dots.size, 2);
});

test("activityDots: a seen card loses its dot", () => {
  const split = splitRowsByPersona(
    [row({ key: "a", clientNiche: "robben", lastReplyAt: ago(DAY) }), row({ key: "n", lastOpenAt: ago(DAY) })],
    ["robben"],
  );
  const dots = activityDots(split, ["robben"], { robben: ago(HOUR) }, now);
  assert.deepEqual(Object.fromEntries(dots), { [NO_PERSONA_KEY]: "open" });
});

test("prospectSummary counts prospects, repliers, and opened without a reply", () => {
  assert.deepEqual(prospectSummary([row({ replies: 2, opened: true }), row({ opened: true }), row()]), { prospects: 3, replied: 1, opened: 1 });
  assert.deepEqual(prospectSummary([]), { prospects: 0, replied: 0, opened: 0 });
});

// visibleSpecialKeys: which of the two special cards the list shows.
const specialSplit = (noPersona: number, website: number) =>
  splitRowsByPersona(
    [
      ...Array.from({ length: noPersona }, (_, i) => row({ key: `n${i}`, clientNiche: "" })),
      ...Array.from({ length: website }, (_, i) => row({ key: `w${i}`, publicDemo: true })),
    ],
    ["robben"],
  );
const dotMap = (entries: [string, ActivityDot][]) => new Map<string, ActivityDot>(entries);
const plain = { filters: DEFAULT_PERSONA_FILTERS, followUp: false, selected: null };

test("visibleSpecialKeys: No persona first, then Website visitors, each only with rows", () => {
  assert.deepEqual(visibleSpecialKeys(specialSplit(2, 1), dotMap([]), plain), [NO_PERSONA_KEY, WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(0, 1), dotMap([]), plain), [WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(2, 0), dotMap([]), plain), [NO_PERSONA_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(0, 0), dotMap([]), plain), []);
});

test("visibleSpecialKeys: a language, source or category filter hides both (they have none of those)", () => {
  const split = specialSplit(2, 1);
  for (const f of [{ lang: "nl" }, { source: "manual" }, { category: "Automotive" }]) {
    assert.deepEqual(visibleSpecialKeys(split, dotMap([]), { ...plain, filters: { ...DEFAULT_PERSONA_FILTERS, ...f } as any }), []);
  }
});

test("visibleSpecialKeys: a search keeps only the cards with a prospect whose name or company matches", () => {
  const split = splitRowsByPersona(
    [row({ key: "n", clientNiche: "", firstName: "Anna" }), row({ key: "w", publicDemo: true, companyName: "Acme" })],
    ["robben"],
  );
  const search = (q: string) => ({ ...plain, filters: { ...DEFAULT_PERSONA_FILTERS, search: q } });
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), search(" ann ")), [NO_PERSONA_KEY]);
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), search("ACME")), [WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), search("zzz")), []);
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), search("   ")), [NO_PERSONA_KEY, WEBSITE_KEY]);
});

test("visibleSpecialKeys: Needs follow-up keeps the cards with an unseen dot and the open one", () => {
  const split = specialSplit(2, 1);
  const on = { filters: DEFAULT_PERSONA_FILTERS, followUp: true, selected: null as string | null };
  assert.deepEqual(visibleSpecialKeys(split, dotMap([[WEBSITE_KEY, "open"]]), on), [WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), on), []);
  assert.deepEqual(visibleSpecialKeys(split, dotMap([]), { ...on, selected: NO_PERSONA_KEY }), [NO_PERSONA_KEY]);
  assert.deepEqual(
    visibleSpecialKeys(split, dotMap([[NO_PERSONA_KEY, "reply"], [WEBSITE_KEY, "open"]]), on),
    [NO_PERSONA_KEY, WEBSITE_KEY],
  );
});

test("visibleSpecialKeys: an open card with no rows left stays hidden", () => {
  assert.deepEqual(visibleSpecialKeys(specialSplit(0, 0), dotMap([]), { ...plain, selected: NO_PERSONA_KEY }), []);
});

test("prospectTexts: first names and companies of the rows, blanks left out", () => {
  assert.deepEqual(prospectTexts([row({ firstName: "Anna", companyName: "Smit" }), row({ firstName: "", companyName: "Acme" })]), ["Anna", "Smit", "Acme"]);
  assert.deepEqual(prospectTexts([]), []);
});

// followUpCount: the topbar's number is what the list would show with the page's search and filters.
const persona = (niche: string, over: object = {}) =>
  ({ niche, label: niche, companyName: "", category: null, languages: ["en"], source: "manual", liveTokens: 0, ...over }) as any;
const countSplit = splitRowsByPersona(
  [
    row({ key: "r", clientNiche: "robben", firstName: "Anna" }),
    row({ key: "b", clientNiche: "bakkerij", firstName: "Bo" }),
    row({ key: "n", clientNiche: "", firstName: "Cas" }),
    row({ key: "w", publicDemo: true, companyName: "Acme" }),
  ],
  ["robben", "bakkerij"],
);
const allDots = dotMap([["robben", "reply"], ["bakkerij", "open"], [NO_PERSONA_KEY, "open"], [WEBSITE_KEY, "reply"]]);
const clients = [persona("robben", { languages: ["nl"] }), persona("bakkerij")];

test("followUpCount: every card with an unseen dot when nothing is filtered", () => {
  assert.equal(followUpCount(clients, countSplit, allDots, DEFAULT_PERSONA_FILTERS), 4);
  assert.equal(followUpCount(clients, countSplit, dotMap([["robben", "reply"]]), DEFAULT_PERSONA_FILTERS), 1);
  assert.equal(followUpCount(clients, countSplit, dotMap([]), DEFAULT_PERSONA_FILTERS), 0);
});

test("followUpCount: a language filter drops the other personas and both special cards", () => {
  assert.equal(followUpCount(clients, countSplit, allDots, { ...DEFAULT_PERSONA_FILTERS, lang: "nl" }), 1);
});

test("followUpCount: a search counts the personas and special cards it would show, prospects included", () => {
  const search = (q: string) => ({ ...DEFAULT_PERSONA_FILTERS, search: q });
  assert.equal(followUpCount(clients, countSplit, allDots, search("anna")), 1);
  assert.equal(followUpCount(clients, countSplit, allDots, search("cas")), 1);
  assert.equal(followUpCount(clients, countSplit, allDots, search("acme")), 1);
  assert.equal(followUpCount(clients, countSplit, allDots, search("zzz")), 0);
});

test("followUpCount: a persona that is not in the list does not count", () => {
  assert.equal(followUpCount([persona("robben")], countSplit, dotMap([["gone", "reply"]]), DEFAULT_PERSONA_FILTERS), 0);
});
