import crypto from "crypto";
import { hmacHex } from "./crypto";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no I, O, 0, 1
const COUNT = 10;

/** Ten codes shown as XXXXX-XXXXX. */
export function generateBackupCodes(): string[] {
  return Array.from({ length: COUNT }, () => {
    let raw = "";
    for (let i = 0; i < 10; i++) raw += ALPHABET[crypto.randomInt(0, ALPHABET.length)];
    return `${raw.slice(0, 5)}-${raw.slice(5)}`;
  });
}

export function normalizeBackupCode(code: string): string {
  return String(code ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

export function hashBackupCode(userId: number, code: string): string {
  return hmacHex(`backup:${userId}:${normalizeBackupCode(code)}`);
}
