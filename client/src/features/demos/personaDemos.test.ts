import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ACTIVITY_WINDOW_MS,
  NO_PERSONA_KEY,
  WEBSITE_KEY,
  activityDot,
  activityDots,
  isSpecialKey,
  prospectSummary,
  rowsForKey,
  splitRowsByPersona,
  visibleSpecialKeys,
  type ActivityDot,
} from "./personaDemos";
import { row } from "./demoTestFixtures";

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
const plain = { filtersActive: false, followUp: false, selected: null };

test("visibleSpecialKeys: No persona first, then Website visitors, each only with rows", () => {
  assert.deepEqual(visibleSpecialKeys(specialSplit(2, 1), dotMap([]), plain), [NO_PERSONA_KEY, WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(0, 1), dotMap([]), plain), [WEBSITE_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(2, 0), dotMap([]), plain), [NO_PERSONA_KEY]);
  assert.deepEqual(visibleSpecialKeys(specialSplit(0, 0), dotMap([]), plain), []);
});

test("visibleSpecialKeys: an active persona filter hides both (they have no language or category)", () => {
  assert.deepEqual(visibleSpecialKeys(specialSplit(2, 1), dotMap([]), { ...plain, filtersActive: true }), []);
});

test("visibleSpecialKeys: Needs follow-up keeps the cards with an unseen dot and the open one", () => {
  const split = specialSplit(2, 1);
  const on = { filtersActive: false, followUp: true, selected: null as string | null };
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
