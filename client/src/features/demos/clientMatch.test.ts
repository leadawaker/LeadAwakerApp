import { test } from "node:test";
import assert from "node:assert/strict";
import type { DemoClientSummary } from "@/features/campaigns/api/demoClientsApi";
import { clientLabel, findClient, lacksLanguage, matchingClients } from "./clientMatch";

function client(over: Partial<DemoClientSummary> = {}): DemoClientSummary {
  return { id: 1, niche: "dental", label: "", companyName: "", languages: ["en"], ...over } as DemoClientSummary;
}

const dental = client({ id: 1, niche: "dental", label: "Family dentist", companyName: "Smile BV", languages: ["en", "nl"] });
const bakery = client({ id: 2, niche: "bakery", label: "", companyName: "", languages: ["pt"] });
const cars = client({ id: 3, niche: "cars", label: "Car dealer", companyName: "Auto Jansen", languages: ["en"] });
const all = [dental, bakery, cars];

test("an empty or blank search keeps every client in order", () => {
  assert.deepEqual(matchingClients(all, ""), all);
  assert.deepEqual(matchingClients(all, "   "), all);
});

test("search is trimmed, case-insensitive and reads the label, the company and the key", () => {
  assert.deepEqual(matchingClients(all, " DENT "), [dental]);
  assert.deepEqual(matchingClients(all, "jansen"), [cars]);
  assert.deepEqual(matchingClients(all, "bakery"), [bakery]);
});

test("a search with no hit is an empty list", () => {
  assert.deepEqual(matchingClients(all, "zzz"), []);
});

test("the label falls back to the niche key", () => {
  assert.equal(clientLabel(dental), "Family dentist");
  assert.equal(clientLabel(bakery), "bakery");
});

test("findClient returns the chosen client, or undefined for none, empty or unknown", () => {
  assert.equal(findClient(all, "cars"), cars);
  assert.equal(findClient(all, ""), undefined);
  assert.equal(findClient(all, "gone"), undefined);
  assert.equal(findClient(undefined, "cars"), undefined);
});

test("a client lacks a language when it has no version in it", () => {
  assert.equal(lacksLanguage(dental, "nl"), false);
  assert.equal(lacksLanguage(dental, "pt"), true);
  assert.equal(lacksLanguage(client({ languages: undefined as never }), "en"), true);
});
