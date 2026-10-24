import { test } from "node:test";
import assert from "node:assert/strict";
import {
  humanizeTool, insertToolsAfterLines, insertToolsByTime, latestUnderstood, toolTag, understoodFromArgs,
} from "./toolTags";

const KNOWN = [
  "search_stock", "car_details", "check_availability", "book_appointment",
  "cancel_appointment", "request_callback", "update_call_summary", "end_call",
];

test("every known tool maps to its own key, an icon and a tone", () => {
  for (const name of KNOWN) {
    const tag = toolTag(name);
    assert.equal(tag.key, name);
    assert.equal(tag.known, true);
    assert.ok(tag.icon, `${name} has an icon`);
    assert.match(tag.tone, /^var\(--/);
  }
});

test("tool names are matched ignoring case, spaces and a namespace prefix", () => {
  assert.equal(toolTag("  Search_Stock ").key, "search_stock");
  assert.equal(toolTag("functions.book_appointment").key, "book_appointment");
});

test("an unknown tool gets the neutral tag with its name humanized", () => {
  const tag = toolTag("get_opening_hours");
  assert.equal(tag.known, false);
  assert.equal(tag.key, "other");
  assert.equal(tag.label, "Get opening hours");
  assert.equal(tag.tone, "var(--mute)");
  assert.equal(toolTag("rdwPlateLookup").label, "Rdw plate lookup");
});

test("humanizeTool handles odd and empty names", () => {
  assert.equal(humanizeTool("do-the-thing"), "Do the thing");
  assert.equal(humanizeTool("  "), "");
  assert.equal(humanizeTool("x"), "X");
});

test("insertToolsByTime puts a tool between the turns around its time", () => {
  const turns = [{ atS: 0 }, { atS: 10 }, { atS: 20 }];
  const items = insertToolsByTime(turns, [{ atS: 12 }]);
  assert.deepEqual(items.map((x) => x.kind), ["turn", "turn", "tool", "turn"]);
});

test("insertToolsByTime keeps a tool at the same second after that turn, and early or late tools at the ends", () => {
  const turns = [{ atS: 5 }, { atS: 10 }];
  const items = insertToolsByTime(turns, [{ atS: 10 }, { atS: 1 }, { atS: 99 }]);
  assert.deepEqual(
    items.map((x) => (x.kind === "tool" ? `t${x.tool.atS}` : `u${x.turn.atS}`)),
    ["t1", "u5", "u10", "t10", "t99"],
  );
});

test("insertToolsByTime is stable: tools at one time keep their order, turns are never reordered", () => {
  const tools = [{ atS: 3, n: "a" }, { atS: 3, n: "b" }];
  const items = insertToolsByTime([{ atS: 0 }, { atS: 9 }], tools);
  const names = items.filter((x) => x.kind === "tool").map((x) => (x.kind === "tool" ? x.tool.n : ""));
  assert.deepEqual(names, ["a", "b"]);
  assert.deepEqual(items.map((x) => x.kind), ["turn", "tool", "tool", "turn"]);
  assert.deepEqual(insertToolsByTime([], []), []);
});

test("insertToolsAfterLines places a tool after the first n lines", () => {
  const lines = ["a", "b", "c"];
  const items = insertToolsAfterLines(lines, [{ afterLines: 2 }, { afterLines: 0 }, { afterLines: 9 }]);
  assert.deepEqual(
    items.map((x) => (x.kind === "tool" ? `T${x.tool.afterLines}` : x.turn)),
    ["T0", "a", "b", "T2", "c", "T9"],
  );
});

test("understoodFromArgs reads the recap items and a flat intent/interest/notes", () => {
  assert.deepEqual(
    understoodFromArgs({ items: [{ intent: "book_appointment", interest: "Golf", notes: "Tue" }, { intent: "ask_advice" }] }),
    [{ intent: "book_appointment", interest: "Golf", notes: "Tue" }, { intent: "ask_advice", interest: "", notes: "" }],
  );
  assert.deepEqual(understoodFromArgs({ intent: "request_quote", interest: "Tyres" }), [{ intent: "request_quote", interest: "Tyres", notes: "" }]);
  assert.deepEqual(understoodFromArgs(JSON.stringify({ intent: "callback_now" })), [{ intent: "callback_now", interest: "", notes: "" }]);
  assert.deepEqual(understoodFromArgs("not json"), []);
  assert.deepEqual(understoodFromArgs(null), []);
  assert.deepEqual(understoodFromArgs({ items: [{ nope: 1 }] }), []);
});

test("latestUnderstood takes the newest finished update_call_summary with content", () => {
  const tools = [
    { name: "update_call_summary", args: { intent: "ask_advice" }, pending: false },
    { name: "search_stock", args: {}, pending: false },
    { name: "update_call_summary", args: { items: [{ intent: "book_appointment" }] }, pending: false },
    { name: "update_call_summary", args: { items: [] }, pending: false },
  ];
  assert.deepEqual(latestUnderstood(tools)?.map((x) => x.intent), ["book_appointment"]);
  assert.equal(latestUnderstood([{ name: "search_stock", args: {}, pending: false }]), null);
});
