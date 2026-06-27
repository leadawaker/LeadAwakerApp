// Shared OAuth CSRF-state helper for the per-account Google flows (reviews,
// calendar). Instead of putting the (guessable) accountId straight into the
// OAuth `state` param, we mint a random nonce, stash {accountId, flow} against
// it in the user's authenticated session, and recover the accountId on the
// callback by verifying the returned nonce. This blocks the classic OAuth CSRF
// where an attacker forges a callback to bind their Google account to a victim's
// account id, and rejects callbacks that weren't initiated by this session.

import crypto from "crypto";
import type { Request } from "express";

export interface PendingOAuthState {
  accountId: number;
  flow: string; // e.g. "reviews", "calendar:google" — scopes a nonce to one flow
  createdAt: number; // epoch ms, for expiry
}

declare module "express-session" {
  interface SessionData {
    oauthStates?: Record<string, PendingOAuthState>;
  }
}

const STATE_TTL_MS = 10 * 60 * 1000; // 10 min — generous for the consent screen

/** Mint + persist a random state nonce bound to this session. Returns the nonce. */
export function createOAuthState(req: Request, flow: string, accountId: number): string {
  const nonce = crypto.randomBytes(32).toString("base64url");
  const store = (req.session.oauthStates ||= {});
  // Evict expired entries so the session map can't grow unbounded across retries.
  const now = Date.now();
  for (const [k, v] of Object.entries(store)) {
    if (now - v.createdAt > STATE_TTL_MS) delete store[k];
  }
  store[nonce] = { accountId, flow, createdAt: now };
  return nonce;
}

/**
 * Verify + consume a returned state nonce. Returns the bound accountId, or null
 * if the nonce is missing, unknown, for a different flow, or expired. Single-use:
 * a valid nonce is deleted on read so it can't be replayed.
 */
export function consumeOAuthState(req: Request, flow: string, returnedState: unknown): number | null {
  if (typeof returnedState !== "string" || !returnedState) return null;
  const store = req.session?.oauthStates;
  const entry = store?.[returnedState];
  if (!entry) return null;
  delete store![returnedState];
  if (entry.flow !== flow) return null;
  if (Date.now() - entry.createdAt > STATE_TTL_MS) return null;
  return entry.accountId;
}

/**
 * Persist the session, then run `next`. Used before redirecting to the provider
 * so the nonce is durably stored before the user can complete consent (the PG
 * session store writes asynchronously on response end otherwise).
 */
export function saveSessionThen(req: Request, next: () => void): void {
  req.session.save((err) => {
    if (err) console.error("[oauthState] session save failed:", err);
    next();
  });
}
