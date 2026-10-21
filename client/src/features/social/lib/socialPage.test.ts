import { test } from "node:test";
import assert from "node:assert/strict";
import { parseSocialDeepLink, pickSocialAccount, socialAccountOptions, socialSections } from "./socialPage";

const rows = [
  { id: 1, name: "Lead Awaker", social_enabled: false },
  { id: 56, name: "Augusto", social_enabled: true, timezone: "America/Sao_Paulo", language: "Portuguese" },
  { id: 12, name: "Bakkerij", social_enabled: true },
  { id: 13, name: "Kozijn", social_enabled: null },
];

test("the picker lists only accounts with Social on, by name", () => {
  const opts = socialAccountOptions(rows);
  assert.deepEqual(opts.map((o) => o.id), [56, 12]);
  assert.equal(opts[0].timeZone, "America/Sao_Paulo");
  assert.equal(opts[1].timeZone, "Europe/Amsterdam");
});

test("agency: the switcher's account when it has Social on, else the first one", () => {
  const options = socialAccountOptions(rows);
  assert.equal(pickSocialAccount({ isAgency: true, currentAccountId: 12, options })?.id, 12);
  assert.equal(pickSocialAccount({ isAgency: true, currentAccountId: 1, options })?.id, 56);
  assert.equal(pickSocialAccount({ isAgency: true, currentAccountId: 0, options })?.id, 56);
  assert.equal(pickSocialAccount({ isAgency: true, currentAccountId: 0, options: [] }), null);
});

test("client: always their own account, never another", () => {
  const own = { id: 56, name: "Augusto", timezone: "America/Sao_Paulo" };
  const picked = pickSocialAccount({ isAgency: false, currentAccountId: 56, options: [], ownAccount: own });
  assert.equal(picked?.id, 56);
  assert.equal(picked?.timeZone, "America/Sao_Paulo");
  assert.equal(pickSocialAccount({ isAgency: false, currentAccountId: 56, options: socialAccountOptions(rows), ownAccount: { id: 12 } })?.id, 56);
  assert.equal(pickSocialAccount({ isAgency: false, currentAccountId: 0, options: [] }), null);
});

test("deep links: account and section, junk ignored", () => {
  assert.deepEqual(parseSocialDeepLink("?account=56&section=studio"), { accountId: 56, section: "studio" });
  assert.deepEqual(parseSocialDeepLink("account=12"), { accountId: 12, section: null });
  assert.deepEqual(parseSocialDeepLink("?account=-3&section=<script>"), { accountId: null, section: null });
  assert.deepEqual(parseSocialDeepLink(""), { accountId: null, section: null });
});

test("sections: agency opens on posts with the studio and settings; clients open on their home, no studio or settings", () => {
  assert.deepEqual(socialSections({ isAgency: true, userRole: "Owner" }), ["posts", "studio", "calendar", "comments", "insights", "about", "settings"]);
  for (const role of ["Manager", "Viewer"]) {
    const s = socialSections({ isAgency: false, userRole: role });
    assert.equal(s[0], "home");
    assert.ok(s.includes("insights"), "clients see their own insights");
    assert.ok(!s.includes("studio") && !s.includes("settings") && !s.includes("comments"));
  }
});
