import { test } from "node:test";
import assert from "node:assert/strict";
import type { DemoProspectDto } from "@shared/demoProspects";
import { buildProspectRows, lastActivity, linkChannel, linkStatus } from "./prospectRows";
import { session, surface } from "./demoTestFixtures";

const p: DemoProspectDto = {
  prospectGroup: "g1", firstName: "Anna", companyName: "Bakkerij Jansen", clientNiche: "Bakery", language: "nl",
  aiDisclosure: "off", market: "", notes: "n", websiteUrl: "", screenshot: "", createdAt: "2026-10-27T10:00:00Z", updatedAt: null,
};

test("a prospect with no links is an empty row", () => {
  const rows = buildProspectRows([p], []);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].hasLinks, false);
  assert.equal(rows[0].expired, false);
  assert.equal(rows[0].hasRecord, true);
  assert.equal(rows[0].createdAt, "2026-10-27T10:00:00Z");
  assert.equal(rows[0].lastActivityAt, null);
});

test("a link with no group keys the row by its token and has no record", () => {
  const legacy = buildProspectRows([], [session({ token: "abcd1234", prospectGroup: "" })]);
  assert.equal(legacy[0].key, "token:abcd1234");
  assert.equal(legacy[0].hasRecord, false);
  assert.equal(legacy[0].firstName, "Sam");
});

test("the prospect record wins every settings field and the notes", () => {
  const rows = buildProspectRows(
    [p],
    [
      session({ prospectGroup: "g1", service: "dbr", firstName: "Old", companyName: "Old Co", language: "en", aiDisclosure: "opener", market: "us" }),
      session({ prospectGroup: "g1", service: "dbr", token: "rev00001", revokedAt: "2026-10-26T00:00:00Z", expired: true }),
    ],
  );
  assert.equal(rows.length, 1);
  assert.equal(rows[0].firstName, "Anna");
  assert.equal(rows[0].companyName, "Bakkerij Jansen");
  assert.equal(rows[0].language, "nl");
  assert.equal(rows[0].aiDisclosure, "off");
  assert.equal(rows[0].market, "");
  assert.equal(rows[0].notes, "n");
  assert.equal(rows[0].history.length, 1);
  assert.equal(rows[0].extra.length, 0);
  assert.equal(rows[0].byService.dbr.token, "tok00001");
});

test("without a record the settings come from the links", () => {
  const r = buildProspectRows([], [session({ prospectGroup: "gx", firstName: "Bo", companyName: "Bo BV", clientNiche: "Dental", language: "pt", aiDisclosure: "second_message", market: "" })])[0];
  assert.deepEqual([r.firstName, r.companyName, r.clientNiche, r.language, r.aiDisclosure], ["Bo", "Bo BV", "Dental", "pt", "second_message"]);
  assert.equal(r.notes, "");
});

test("an unknown language falls back to English", () => {
  assert.equal(buildProspectRows([], [session({ language: "de" })])[0].language, "en");
});

test("the newest non-revoked link per service takes the cell, older ones and unknown campaigns go to extra", () => {
  const newest = session({ token: "new00001", service: "dbr", prospectGroup: "g1", createdAt: "2026-10-25T00:00:00Z" });
  const older = session({ token: "old00001", service: "dbr", prospectGroup: "g1", createdAt: "2026-10-20T00:00:00Z" });
  const stray = session({ token: "str00001", service: "", campaignId: 999, prospectGroup: "g1", createdAt: "2026-10-21T00:00:00Z" });
  const r = buildProspectRows([p], [older, stray, newest])[0];
  assert.equal(r.byService.dbr.token, "new00001");
  assert.deepEqual(r.extra.map((s) => s.token).sort(), ["old00001", "str00001"]);
  assert.equal(r.createdAt, "2026-10-25T00:00:00Z");
});

test("revoked links go to history only, but still count for tokens, replies and opened", () => {
  const live = session({ token: "live0001", service: "speed", campaignId: 67, prospectGroup: "g1" });
  const dead = session({
    token: "dead0001", service: "speed", campaignId: 67, prospectGroup: "g1", revokedAt: "2026-10-26T00:00:00Z", expired: true,
    whatsapp: { ...surface, opened: true, replies: 4, lastAt: "2026-10-24T10:00:00Z" },
  });
  const r = buildProspectRows([p], [live, dead])[0];
  assert.equal(r.byService.speed.token, "live0001");
  assert.deepEqual(r.history.map((s) => s.token), ["dead0001"]);
  assert.deepEqual(r.tokens.sort(), ["dead0001", "live0001"]);
  assert.equal(r.replies, 4);
  assert.equal(r.opened, true);
  assert.equal(r.hasLinks, true);
  assert.equal(r.lastActivityAt, "2026-10-24T10:00:00Z");
});

test("a row is expired when it has links and every live link is expired", () => {
  const a = session({ token: "aaaa0001", service: "dbr", prospectGroup: "g1", expired: true });
  const b = session({ token: "bbbb0001", service: "speed", campaignId: 67, prospectGroup: "g1", expired: true });
  assert.equal(buildProspectRows([p], [a, b])[0].expired, true);
  assert.equal(buildProspectRows([p], [a, { ...b, expired: false }])[0].expired, false);
  const onlyRevoked = session({ token: "cccc0001", prospectGroup: "g1", revokedAt: "2026-10-26T00:00:00Z", expired: true });
  const r = buildProspectRows([p], [onlyRevoked])[0];
  assert.equal(r.hasLinks, false);
  assert.equal(r.expired, false);
});

test("a record row and a legacy row can sit side by side; the screenshot falls back to the links", () => {
  const rows = buildProspectRows([p], [session({ prospectGroup: "g1", screenshot: "shot.png", websiteUrl: "https://b.nl" }), session({ token: "zzzz0001", prospectGroup: "" })]);
  assert.deepEqual(rows.map((r) => r.key), ["g1", "token:zzzz0001"]);
  assert.equal(rows[0].screenshot, "shot.png");
  assert.equal(rows[0].websiteUrl, "https://b.nl");
});

test("a public website demo marks its row", () => {
  assert.equal(buildProspectRows([], [session({ publicDemo: true })])[0].publicDemo, true);
});

test("linkStatus: expired wins, then replies, then opened on either surface, else never", () => {
  assert.equal(linkStatus(session({ expired: true, browser: { ...surf(), replies: 3 } })), "expired");
  assert.equal(linkStatus(session({ whatsapp: { ...surf(), opened: true, replies: 2 } })), "replied");
  assert.equal(linkStatus(session({ browser: { ...surf(), opened: true } })), "opened");
  assert.equal(linkStatus(session({ whatsapp: { ...surf(), opened: true } })), "opened");
  assert.equal(linkStatus(session()), "never");
});

test("linkChannel is whatsapp when that surface opened, else browser", () => {
  assert.equal(linkChannel(session({ whatsapp: { ...surf(), opened: true } })), "whatsapp");
  assert.equal(linkChannel(session({ browser: { ...surf(), opened: true } })), "browser");
  assert.equal(linkChannel(session()), "browser");
});

test("lastActivity is the newest of both lastAt and openedAt on both surfaces", () => {
  assert.equal(lastActivity(session()), null);
  assert.equal(
    lastActivity(session({
      browser: { ...surf(), opened: true, openedAt: "2026-10-22T08:00:00Z", lastAt: "2026-10-23T08:00:00Z" },
      whatsapp: { ...surf(), opened: true, openedAt: "2026-10-24T08:00:00Z", lastAt: null },
    })),
    "2026-10-24T08:00:00Z",
  );
});

test("lastReplyAt is the newest lastAt of a surface that has replies; a surface with none is ignored", () => {
  const r = buildProspectRows([], [session({
    prospectGroup: "g1",
    browser: { ...surf(), replies: 2, lastAt: "2026-10-27T10:00:00Z" },
    whatsapp: { ...surf(), replies: 0, lastAt: "2026-10-28T10:00:00Z" },
  })])[0];
  assert.equal(r.lastReplyAt, "2026-10-27T10:00:00Z");
});

test("lastReplyAt takes the newest time over every link", () => {
  const a = session({ token: "aaa00001", prospectGroup: "g1", createdAt: "2026-10-20T00:00:00Z", browser: { ...surf(), replies: 1, lastAt: "2026-10-26T10:00:00Z" } });
  const b = session({ token: "bbb00001", prospectGroup: "g1", createdAt: "2026-10-25T00:00:00Z", whatsapp: { ...surf(), replies: 3, lastAt: "2026-10-22T10:00:00Z" } });
  assert.equal(buildProspectRows([], [a, b])[0].lastReplyAt, "2026-10-26T10:00:00Z");
});

test("lastOpenAt is the newest openedAt over both surfaces", () => {
  const r = buildProspectRows([], [session({
    prospectGroup: "g1",
    browser: { ...surf(), opened: true, openedAt: "2026-10-26T08:00:00Z" },
    whatsapp: { ...surf(), opened: true, openedAt: "2026-10-27T08:00:00Z" },
  })])[0];
  assert.equal(r.lastOpenAt, "2026-10-27T08:00:00Z");
});

test("a revoked link with a reply still counts for lastReplyAt", () => {
  const dead = session({ token: "dead0001", prospectGroup: "g1", revokedAt: "2026-10-26T00:00:00Z", whatsapp: { ...surf(), replies: 1, lastAt: "2026-10-24T10:00:00Z" } });
  assert.equal(buildProspectRows([], [dead])[0].lastReplyAt, "2026-10-24T10:00:00Z");
});

test("a prospect with no links has no reply or open time", () => {
  const r = buildProspectRows([p], [])[0];
  assert.equal(r.lastReplyAt, null);
  assert.equal(r.lastOpenAt, null);
});

function surf() { return { ...surface }; }
