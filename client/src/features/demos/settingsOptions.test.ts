import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_OPTION, DISCLOSURES, MARKETS, fromOption, marketApplies, toOption } from "./settingsOptions";

test("the market only applies to English", () => {
  assert.equal(marketApplies("en"), true);
  assert.equal(marketApplies("nl"), false);
  assert.equal(marketApplies("pt"), false);
});

test("the empty setting travels as the default option and back", () => {
  assert.equal(toOption(""), DEFAULT_OPTION);
  assert.equal(toOption("opener"), "opener");
  assert.equal(fromOption(DEFAULT_OPTION), "");
  assert.equal(fromOption("uk"), "uk");
});

test("the choices cover what the server accepts, without the empty one", () => {
  assert.deepEqual([...DISCLOSURES], ["off", "opener", "second_message"]);
  assert.deepEqual(MARKETS.map((m) => m.id), ["uk", "us", "nl"]);
});
