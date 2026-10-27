import { test } from "node:test";
import assert from "node:assert/strict";
import { visitorCountry } from "./country";

test("visitorCountry reads Cloudflare's two-letter code", () => {
  assert.equal(visitorCountry({ headers: { "cf-ipcountry": "GB" } }), "GB");
  assert.equal(visitorCountry({ headers: { "cf-ipcountry": " nl " } }), "NL");
});

test("visitorCountry is null without a usable country", () => {
  assert.equal(visitorCountry({ headers: {} }), null);
  assert.equal(visitorCountry({ headers: { "cf-ipcountry": "XX" } }), null);
  assert.equal(visitorCountry({ headers: { "cf-ipcountry": "T1" } }), null);
  assert.equal(visitorCountry({ headers: { "cf-ipcountry": "GBR" } }), null);
});
