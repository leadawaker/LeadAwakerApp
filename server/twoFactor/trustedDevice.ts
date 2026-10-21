/** "Trust this device for 30 days" (specs/two-factor-auth Phase 5). */
import crypto from "crypto";
import type { Request, Response } from "express";
import { storage } from "../storage";
import { sha256Hex } from "./crypto";
import { logSecurityEvent } from "./audit";

const COOKIE = "la_td";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function readCookie(req: Request, name: string): string | null {
  const header = req.headers.cookie;
  if (!header) return null;
  for (const part of header.split(";")) {
    const i = part.indexOf("=");
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch { return null; }
    }
  }
  return null;
}

// Mirrors the session cookie in setupAuth() so it travels the same cross-origin path.
function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production" || !!process.env.CORS_ORIGIN,
    sameSite: process.env.CORS_ORIGIN ? ("none" as const) : ("lax" as const),
    domain: process.env.COOKIE_DOMAIN || undefined,
    path: "/",
  };
}

/** Id of the matching trusted-device row for this user, or null. */
export async function findTrustedDevice(req: Request, userId: number): Promise<number | null> {
  const token = readCookie(req, COOKIE);
  if (!token || token.length > 200) return null;
  return storage.findTrustedDevice(userId, sha256Hex(token), new Date());
}

export async function markTrustedDeviceUsed(req: Request, userId: number, deviceId: number): Promise<void> {
  await storage.touchTrustedDevice(deviceId, new Date());
  logSecurityEvent(req, "trusted_device_used", { userId, actorId: userId });
}

export async function trustThisDevice(req: Request, res: Response, userId: number): Promise<void> {
  const token = crypto.randomBytes(32).toString("base64url");
  await storage.addTrustedDevice({
    userId,
    tokenHash: sha256Hex(token),
    userAgent: String(req.headers["user-agent"] ?? "").slice(0, 300) || null,
    ip: req.ip || req.socket.remoteAddress || null,
    expiresAt: new Date(Date.now() + TTL_MS),
  });
  res.cookie(COOKIE, token, { ...cookieOptions(), maxAge: TTL_MS });
  logSecurityEvent(req, "trusted_device_added", { userId, actorId: userId });
}

/** Hash of the cookie on this request, so the device list can flag "this browser". */
export function currentDeviceHash(req: Request): string | null {
  const token = readCookie(req, COOKIE);
  return token ? sha256Hex(token) : null;
}

export function clearTrustedDeviceCookie(res: Response): void {
  res.clearCookie(COOKIE, cookieOptions());
}
