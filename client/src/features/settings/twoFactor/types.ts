export type TwoFactorStatus = {
  totp: boolean;
  email: boolean;
  passkeys: number;
  backupCodes: number;
  required: boolean;
  graceEndsAt: string | null;
  enrollRequired: boolean;
  stepUp: boolean;
  passkeyList: { id: number; label: string | null; createdAt: string; lastUsedAt: string | null }[];
  devices: { id: number; userAgent: string | null; createdAt: string; lastUsedAt: string | null; expiresAt: string; current: boolean }[];
};

export type ApiResult<T = any> = { ok: boolean; status: number; data: T };
