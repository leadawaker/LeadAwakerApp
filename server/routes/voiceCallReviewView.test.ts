import { test } from "node:test";
import assert from "node:assert/strict";
import { clientReview, respondReview, reviewCallQuery, reviewForViewer } from "./voiceCallReviewView";
import { demoCallVisible, resolveVoiceAccess } from "./voiceCallsAccess";
import type { CallReview } from "../storage/voiceCallReview";

const CLIENT = resolveVoiceAccess({ role: "Manager", accountsId: 7, impersonatedAccountId: null });
const ADMIN = resolveVoiceAccess({ role: "Admin", accountsId: 1, impersonatedAccountId: null });
const OWNER = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: null });
const OWNER_AS_CLIENT = resolveVoiceAccess({ role: "Owner", accountsId: 1, impersonatedAccountId: 7 });

const REVIEW: CallReview = {
  callId: "el_conv_1",
  engine: "elevenlabs",
  startedAt: "2026-10-23T10:00:00.000Z",
  durationSeconds: 90,
  recordingUrl: "/api/voice-calls/el_conv_1/recording",
  stereo: false,
  turns: [{ i: 0, role: "agent", text: "Goedemiddag", atS: 0.5, delayMs: null }],
  tools: [{ name: "check_availability", atS: 12, ms: 340, args: "{\"day\":\"monday\"}", result: "{\"slots\":[\"16:45\"]}", facts: { state: "ok", query: "2026-10-26", items: ["2026-10-26T09:00"], total: 1 } }],
  summary: { medianDelayMs: 900, slowestDelayMs: 1400, toolCount: 1 },
  cost: { total: 0.12, minutes: 1.5, ai: 0.08, recap: 0.01, telephony: 0.03, estimate: true },
  recap: { intents: ["book"], interests: ["APK"], notes: ["Prefers mornings"], outcome: "booked" },
};

/** A stand-in for storage.getVoiceCall: the account pin and the test/demo rules as the real one applies them. */
interface FakeCall { callId: string; accountsId: number; isDemo: boolean; testAccountId: number | null; isTest: boolean }
const CALLS: FakeCall[] = [
  { callId: "own", accountsId: 7, isDemo: false, testAccountId: null, isTest: false },
  { callId: "other", accountsId: 9, isDemo: false, testAccountId: null, isTest: false },
  { callId: "test", accountsId: 7, isDemo: false, testAccountId: null, isTest: true },
  { callId: "browser-test", accountsId: 2, isDemo: true, testAccountId: 7, isTest: false },
  { callId: "demo", accountsId: 2, isDemo: true, testAccountId: null, isTest: false },
];
async function fakeGetCall(callId: string, opts: ReturnType<typeof reviewCallQuery>): Promise<FakeCall | undefined> {
  const c = CALLS.find((x) => x.callId === callId);
  if (!c) return undefined;
  if (opts.hideTest && c.isTest) return undefined;
  if (!demoCallVisible(c, opts)) return undefined;
  if (opts.accountId !== null && c.accountsId !== opts.accountId) return undefined;
  return c;
}
const load = async (c: FakeCall): Promise<CallReview> => ({ ...REVIEW, callId: c.callId });

test("client query: pinned to their account, no test or demo calls, events loaded to place the tools", () => {
  assert.deepEqual(reviewCallQuery(CLIENT), { accountId: 7, allowDemo: false, allowTest: false, hideTest: true, includeEvents: true });
  assert.deepEqual(reviewCallQuery(OWNER_AS_CLIENT), { accountId: 7, allowDemo: false, allowTest: false, hideTest: true, includeEvents: true });
});

test("agency query keeps the Calls page reach: test calls any agency user, real demo calls the Owner", () => {
  assert.deepEqual(reviewCallQuery(ADMIN), { accountId: null, allowDemo: false, allowTest: true, hideTest: false, includeEvents: true });
  assert.deepEqual(reviewCallQuery(OWNER), { accountId: null, allowDemo: true, allowTest: true, hideTest: false, includeEvents: true });
});

test("client opens their own call's review", async () => {
  const out = await respondReview(CLIENT, "own", fakeGetCall, load);
  assert.equal(out.status, 200);
  assert.equal((out.body as CallReview).callId, "own");
});

test("client gets 404 for another account's call, a test call, a browser test call and a demo call", async () => {
  for (const id of ["other", "test", "browser-test", "demo", "missing"]) {
    const out = await respondReview(CLIENT, id, fakeGetCall, load);
    assert.equal(out.status, 404, id);
    assert.deepEqual(out.body, { message: "Call not found" });
  }
});

test("owner viewing as a client is held to the client's reach and view", async () => {
  assert.equal((await respondReview(OWNER_AS_CLIENT, "other", fakeGetCall, load)).status, 404);
  const out = await respondReview(OWNER_AS_CLIENT, "own", fakeGetCall, load);
  assert.equal(out.status, 200);
  assert.equal(out.body && "engine" in out.body, false);
  assert.equal((out.body as CallReview).cost, null);
});

test("agency keeps test call reach, only the Owner opens real demo calls", async () => {
  assert.equal((await respondReview(ADMIN, "browser-test", fakeGetCall, load)).status, 200);
  assert.equal((await respondReview(ADMIN, "demo", fakeGetCall, load)).status, 404);
  assert.equal((await respondReview(OWNER, "demo", fakeGetCall, load)).status, 200);
});

test("client view strips tool arguments and results, the engine and the cost, keeps the tool facts", () => {
  const r = clientReview(REVIEW);
  assert.deepEqual(r.tools, [{ name: "check_availability", atS: 12, ms: 340, args: "", result: "", facts: REVIEW.tools[0].facts }]);
  assert.equal("engine" in r, false);
  assert.equal("stereo" in r, false);
  assert.equal(r.cost, null);
  // The timeline itself stays.
  assert.deepEqual(r.turns, REVIEW.turns);
  assert.deepEqual(r.summary, REVIEW.summary);
  assert.equal(r.recordingUrl, REVIEW.recordingUrl);
  assert.deepEqual(r.recap, REVIEW.recap);
  // Nothing of the arguments or results anywhere in the body.
  const json = JSON.stringify(r);
  assert.equal(json.includes("monday"), false);
  assert.equal(json.includes("16:45"), false);
});

test("agency view: full tools, cost for the Owner only", () => {
  const admin = reviewForViewer(ADMIN, REVIEW) as CallReview;
  assert.equal(admin.tools[0].args, REVIEW.tools[0].args);
  assert.equal(admin.engine, "elevenlabs");
  assert.equal(admin.cost, null);
  assert.deepEqual((reviewForViewer(OWNER, REVIEW) as CallReview).cost, REVIEW.cost);
  assert.equal((reviewForViewer(CLIENT, REVIEW) as CallReview).cost, null);
});
