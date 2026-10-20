// Token refresh and upload cleanup against in-memory rows and a temp dir. No database, no network.
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, rmSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { cleanupOrphanUploads, runTokenRefreshOnce, type RefresherDeps, type RefreshableConnection } from "./tokenRefresher";

const now = new Date("2026-10-19T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 86_400_000);

let conns: RefreshableConnection[];
let tokens: Map<number, string>;
let notes: string[];
let refreshResult: (() => Promise<{ accessToken: string; expiresAt: Date }>) | null;

function deps(): RefresherDeps {
  return {
    now: () => now,
    listConnections: async () => conns.map((c) => ({ ...c })),
    getToken: (c) => tokens.get(c.id) ?? null,
    refresh: async () => refreshResult!(),
    updateToken: async (id, token, expiresAt) => {
      tokens.set(id, token);
      Object.assign(conns.find((c) => c.id === id)!, { tokenExpiresAt: expiresAt, tokenRefreshedAt: now });
    },
    setStatus: async (id, status, lastError) => {
      const c = conns.find((x) => x.id === id)!;
      if (c.status === "disconnected") return false;
      Object.assign(c, { status, lastError });
      return true;
    },
    markWarned: async (id, at) => { conns.find((c) => c.id === id)!.expiryWarnedAt = at; },
    notifyAgency: async (n) => { notes.push(n.body); },
  };
}

const conn = (over: Partial<RefreshableConnection>): RefreshableConnection => ({
  id: 1, accountsId: 7, username: "dr.augusto", status: "connected", tokenExpiresAt: days(19), tokenRefreshedAt: days(-41),
  createdAt: days(-41), expiryWarnedAt: null, lastError: null, ...over,
});

beforeEach(() => {
  conns = [];
  tokens = new Map([[1, "old"]]);
  notes = [];
  refreshResult = async () => ({ accessToken: "new", expiresAt: days(60) });
});

test("a token expiring within 20 days is refreshed and the connection stays connected", async () => {
  conns = [conn({ status: "needs_attention" })];
  await runTokenRefreshOnce(deps());
  assert.equal(tokens.get(1), "new");
  assert.equal(conns[0].status, "connected");
  assert.equal(notes.length, 0);
});

test("a failed refresh needs attention and tells the agency once", async () => {
  conns = [conn({})];
  refreshResult = async () => { throw new Error("Session has expired"); };
  await runTokenRefreshOnce(deps());
  await runTokenRefreshOnce(deps());
  assert.equal(conns[0].status, "needs_attention");
  assert.match(conns[0].lastError!, /Session has expired/);
  assert.equal(notes.length, 1);
  assert.ok(!notes[0].includes("old"), "the token never appears in a notification");
});

test("an expired token needs a reconnect", async () => {
  conns = [conn({ tokenExpiresAt: days(-1) })];
  await runTokenRefreshOnce(deps());
  assert.equal(conns[0].status, "needs_attention");
  assert.match(conns[0].lastError!, /reconnect/i);
  assert.equal(tokens.get(1), "old");
});

test("within 7 days of expiry and not refreshed: one warning a day", async () => {
  conns = [conn({ status: "needs_attention", tokenExpiresAt: days(6), lastError: "x" })];
  refreshResult = async () => { throw new Error("still broken"); };
  await runTokenRefreshOnce(deps());
  await runTokenRefreshOnce(deps());
  assert.equal(notes.filter((n) => /expires/.test(n)).length, 1);
  assert.ok(conns[0].expiryWarnedAt instanceof Date);
});

test("a disconnect while the refresh is in flight stays disconnected", async () => {
  conns = [conn({})];
  refreshResult = async () => { conns[0].status = "disconnected"; return { accessToken: "new", expiresAt: days(60) }; };
  await runTokenRefreshOnce(deps());
  assert.equal(conns[0].status, "disconnected");
  assert.equal(notes.length, 0);
});

test("after expiry the agency is told once, not every day", async () => {
  conns = [conn({ tokenExpiresAt: days(-1) })];
  await runTokenRefreshOnce(deps());
  conns[0].expiryWarnedAt = null; // a day later
  await runTokenRefreshOnce(deps());
  assert.equal(notes.length, 1);
});

const tmp = mkdtempSync(join(tmpdir(), "social-cleanup-"));
after(() => rmSync(tmp, { recursive: true, force: true }));

test("orphan uploads older than 24 h are deleted; fresh ones and ones with a post stay", async () => {
  const dir = join(tmp, "7");
  mkdirSync(dir, { recursive: true });
  const old = new Date(now.getTime() - 25 * 3_600_000);
  const files = {
    orphanOld: join(dir, "0b9f1c1e-0000-4000-8000-00000000000a.mp4"),
    orphanNew: join(dir, "0b9f1c1e-0000-4000-8000-00000000000b.mp4"),
    usedOld: join(dir, "0b9f1c1e-0000-4000-8000-00000000000c.mov"),
    other: join(dir, "notes.txt"),
  };
  for (const f of Object.values(files)) writeFileSync(f, "x");
  for (const f of [files.orphanOld, files.usedOld, files.other]) utimesSync(f, old, old);
  const deleted = await cleanupOrphanUploads(tmp, async (id) => id.endsWith("c"), now);
  assert.equal(deleted, 1);
  assert.equal(existsSync(files.orphanOld), false);
  assert.equal(existsSync(files.orphanNew), true);
  assert.equal(existsSync(files.usedOld), true);
  assert.equal(existsSync(files.other), true);
});

test("cleanup of a missing upload dir is a no-op", async () => {
  assert.equal(await cleanupOrphanUploads(join(tmp, "nope"), async () => false, now), 0);
});
