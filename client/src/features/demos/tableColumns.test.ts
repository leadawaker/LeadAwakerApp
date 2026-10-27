import { test } from "node:test";
import assert from "node:assert/strict";
import { LINK_COLUMNS, formatSent, mintInputForRow } from "./tableColumns";
import { SERVICES } from "./services";
import { row } from "./demoTestFixtures";

const svc = (key: string) => SERVICES.find((s) => s.key === key)!;

test("mintInputForRow carries the row's settings", () => {
  const r = row({ key: "g1", firstName: "Anna", language: "en", clientNiche: "Bakery", aiDisclosure: "second_message", market: "us" });
  assert.deepEqual(mintInputForRow(r, svc("quote")), {
    firstName: "Anna", language: "en", campaignId: 60, scenario: "deciding", service: "quote",
    prospectGroup: "g1", clientNiche: "Bakery", aiDisclosure: "second_message", market: "us",
  });
});

test("market only goes with English; unset fields are left out; the name falls back to there", () => {
  const r = row({ key: "g1", firstName: "Anna", language: "nl", market: "us" });
  assert.equal("market" in mintInputForRow(r, SERVICES[0]), false);
  const bare = mintInputForRow(row({ key: "g2", language: "en" }), svc("speed"));
  assert.deepEqual(bare, { firstName: "there", language: "en", campaignId: 67, scenario: "inquired", service: "speed", prospectGroup: "g2" });
  assert.equal(mintInputForRow(row({ companyName: "Jansen BV" }), svc("dbr")).companyName, "Jansen BV");
});

test("a service with no campaign cannot be minted", () => {
  assert.throws(() => mintInputForRow(row(), { ...svc("dbr"), campaignId: null }), /no campaign/);
});

test("formatSent prints day and month, and the year only when it differs", () => {
  assert.equal(formatSent("2026-10-27T10:00:00Z", new Date("2026-10-28"), "en"), "27 Oct");
  assert.match(formatSent("2025-03-03T10:00:00Z", new Date("2026-10-28"), "en"), /2025/);
  assert.equal(formatSent("not a date", new Date("2026-10-28"), "en"), "");
});

test("LINK_COLUMNS: DBR and Quote share a column, then one column per service", () => {
  assert.deepEqual(LINK_COLUMNS[0].services, ["dbr", "quote"]);
  assert.equal(LINK_COLUMNS.length, 6);
  assert.deepEqual(LINK_COLUMNS.map((c) => c.key), ["dbrQuote", "speed", "widget", "voice", "reputation", "socials"]);
  assert.deepEqual(LINK_COLUMNS.map((c) => c.labelKey), ["table.svc.dbrQuote", "table.svc.speed", "table.svc.widget", "table.svc.voice", "table.svc.reputation", "table.svc.socials"]);
  // Every service has a column.
  assert.deepEqual(LINK_COLUMNS.flatMap((c) => c.services).sort(), SERVICES.map((s) => s.key).sort());
});
