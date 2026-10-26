// Pure rules behind the Social screens (no React, no fetch), so they are unit tested with node:test.
import type { SocialStatus } from "../api/socialApi";

export type IntegrationGroup = "phone" | "messaging" | "website" | "bookings" | "social";
export type ConnectCardMode = "not_connected" | "connected" | "needs_attention";
export type ConnectErrorReason = "access_denied" | "missing_code" | "invalid_state" | "not_professional" | "already_connected" | "failed";

const CONNECT_ERRORS: ConnectErrorReason[] = ["access_denied", "missing_code", "invalid_state", "not_professional", "already_connected", "failed"];
const AGENCY_GROUPS: IntegrationGroup[] = ["phone", "messaging", "website", "bookings", "social"];

/** A disconnected connection reads as never connected: the card offers Connect again. */
export function connectCardMode(status: SocialStatus | undefined): ConnectCardMode {
  const c = status?.connection;
  if (!c || c.status === "disconnected") return "not_connected";
  return c.status === "needs_attention" ? "needs_attention" : "connected";
}

export function instagramTileState(status: SocialStatus | undefined): "on" | "pending" | "off" {
  const mode = connectCardMode(status);
  return mode === "connected" ? "on" : mode === "needs_attention" ? "pending" : "off";
}

/** Agency sees every group. Client users see bookings, and Social once the agency switched it on. */
export function integrationGroupsFor(p: { isAgency: boolean; socialEnabled: boolean; isManager?: boolean }): IntegrationGroup[] {
  if (p.isAgency) return AGENCY_GROUPS;
  // A Manager connects the account's own WhatsApp number (Meta's signup needs their login).
  const groups: IntegrationGroup[] = p.isManager ? ["messaging", "bookings"] : ["bookings"];
  return p.socialEnabled ? [...groups, "social"] : groups;
}

/** Connect, disconnect, approve, reject: agency, or a Manager of the account (the server checks again). */
export function canActOnSocial(p: { isAgency: boolean; userRole: string }): boolean {
  return p.isAgency || p.userRole === "Manager";
}

/** What the Instagram OAuth callback put in the URL (server/routes/social.ts), or null. */
export function parseInstagramReturn(search: string): { kind: "connected" } | { kind: "error"; reason: ConnectErrorReason } | null {
  const params = new URLSearchParams(search);
  const value = params.get("instagram");
  if (value === null) return null;
  if (value === "connected") return { kind: "connected" };
  const reason = params.get("reason") as ConnectErrorReason | null;
  return { kind: "error", reason: reason && CONNECT_ERRORS.includes(reason) ? reason : "failed" };
}

/** The query string without the callback's params ("" when nothing is left). */
export function stripInstagramParams(search: string): string {
  const params = new URLSearchParams(search);
  params.delete("instagram");
  params.delete("reason");
  const qs = params.toString();
  return qs ? `?${qs}` : "";
}
