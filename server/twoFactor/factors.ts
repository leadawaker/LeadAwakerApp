/** Checks for the individual second factors, shared by the login challenge and step-up. */
import type { Users } from "@shared/schema";
import { storage } from "../storage";
import { decryptSecret } from "../encryption";
import { verifyTotp } from "./totp";
import { hashBackupCode, normalizeBackupCode } from "./backupCodes";
import { hashEmailCode } from "./emails";
import { safeEqualHex } from "./crypto";

export async function checkTotp(user: Users, code: unknown): Promise<boolean> {
  if (!user.totpSecretEnc || !user.totpEnabledAt) return false;
  const step = verifyTotp(decryptSecret(user.totpSecretEnc), String(code ?? ""));
  if (step === null) return false;
  return storage.claimTotpStep(user.id!, step); // false on replay of an already used step
}

export async function checkBackupCode(user: Users, code: unknown): Promise<boolean> {
  const norm = normalizeBackupCode(String(code ?? ""));
  if (norm.length !== 10) return false;
  return storage.consumeBackupCode(user.id!, hashBackupCode(user.id!, norm), new Date());
}

export function checkEmailCode(record: { hash: string; expiresAt: number } | undefined, userId: number, code: unknown): boolean {
  if (!record || Date.now() > record.expiresAt) return false;
  const clean = String(code ?? "").replace(/\s+/g, "");
  if (!/^\d{6}$/.test(clean)) return false;
  return safeEqualHex(record.hash, hashEmailCode(userId, clean));
}
