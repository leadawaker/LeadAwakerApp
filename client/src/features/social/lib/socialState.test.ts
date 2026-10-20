import { test } from "node:test";
import assert from "node:assert/strict";
import {
  canActOnSocial,
  connectCardMode,
  instagramTileState,
  integrationGroupsFor,
  parseInstagramReturn,
  stripInstagramParams,
} from "./socialState";

const conn = (status: "connected" | "needs_attention" | "disconnected") => ({
  status, username: "dr.augusto", profilePictureUrl: null, accountType: "MEDIA_CREATOR", tokenExpiresAt: null, lastError: null, scopes: [],
});

test("card mode follows the connection; disconnected is the same as never connected", () => {
  assert.equal(connectCardMode({ enabled: true, connection: null }), "not_connected");
  assert.equal(connectCardMode({ enabled: true, connection: conn("disconnected") }), "not_connected");
  assert.equal(connectCardMode({ enabled: true, connection: conn("connected") }), "connected");
  assert.equal(connectCardMode({ enabled: true, connection: conn("needs_attention") }), "needs_attention");
  assert.equal(connectCardMode(undefined), "not_connected");
});

test("tile state: on when connected, pending when it needs attention, off otherwise", () => {
  assert.equal(instagramTileState({ enabled: true, connection: conn("connected") }), "on");
  assert.equal(instagramTileState({ enabled: true, connection: conn("needs_attention") }), "pending");
  assert.equal(instagramTileState({ enabled: true, connection: null }), "off");
  assert.equal(instagramTileState(undefined), "off");
});

test("agency sees every group; client users see bookings, plus social only when it is on", () => {
  assert.deepEqual(integrationGroupsFor({ isAgency: true, socialEnabled: false }), ["phone", "messaging", "website", "bookings", "social"]);
  assert.deepEqual(integrationGroupsFor({ isAgency: false, socialEnabled: false }), ["bookings"]);
  assert.deepEqual(integrationGroupsFor({ isAgency: false, socialEnabled: true }), ["bookings", "social"]);
});

test("only agency and Managers act; Viewers never", () => {
  assert.equal(canActOnSocial({ isAgency: true, userRole: "Owner" }), true);
  assert.equal(canActOnSocial({ isAgency: false, userRole: "Manager" }), true);
  assert.equal(canActOnSocial({ isAgency: false, userRole: "Viewer" }), false);
  assert.equal(canActOnSocial({ isAgency: false, userRole: "Agent" }), false);
});

test("the OAuth return is read from the URL, and an unknown reason is 'failed'", () => {
  assert.equal(parseInstagramReturn("?tab=x"), null);
  assert.deepEqual(parseInstagramReturn("?instagram=connected"), { kind: "connected" });
  assert.deepEqual(parseInstagramReturn("?instagram=error&reason=not_professional"), { kind: "error", reason: "not_professional" });
  assert.deepEqual(parseInstagramReturn("?instagram=error&reason=<script>"), { kind: "error", reason: "failed" });
  assert.deepEqual(parseInstagramReturn("?instagram=weird"), { kind: "error", reason: "failed" });
});

test("the return params are stripped, others kept", () => {
  assert.equal(stripInstagramParams("?instagram=error&reason=failed&tab=social"), "?tab=social");
  assert.equal(stripInstagramParams("?instagram=connected"), "");
});
