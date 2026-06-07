import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const TAG_LENGTH = 16;
const IV_LENGTH = 12;

const getEncryptionKey = (): Buffer => {
  const keyEnv = process.env.CLAUDE_ENCRYPTION_KEY;
  if (!keyEnv) {
    throw new Error("CLAUDE_ENCRYPTION_KEY environment variable is not set");
  }
  // Key should be 64 hex characters (256 bits)
  if (keyEnv.length !== 64) {
    throw new Error("CLAUDE_ENCRYPTION_KEY must be 64 hex characters (256 bits)");
  }
  return Buffer.from(keyEnv, "hex");
};

export function encryptApiKey(apiKey: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(apiKey, "utf8", "hex");
  encrypted += cipher.final("hex");

  const authTag = cipher.getAuthTag();

  // Format: IV (hex) + authTag (hex) + encrypted (hex)
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted}`;
}

export function decryptApiKey(encryptedData: string): string {
  const key = getEncryptionKey();
  const parts = encryptedData.split(":");

  if (parts.length !== 3) {
    throw new Error("Invalid encrypted data format");
  }

  const iv = Buffer.from(parts[0], "hex");
  const authTag = Buffer.from(parts[1], "hex");
  const encrypted = parts[2];

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted, "hex", "utf8");
  decrypted += decipher.final("utf8");

  return decrypted;
}
