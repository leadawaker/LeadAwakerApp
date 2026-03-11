// ── Shared user types ─────────────────────────────────────────────────────────
export interface AppUser {
  id: number;
  accountsId: number | null;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  timezone: string | null;
  role: "Admin" | "Operator" | "Manager" | "Agent" | "Viewer" | null;
  status: string | null;
  avatarUrl: string | null;
  n8nWebhookUrl: string | null;
  notificationEmail: boolean | null;
  notificationSms: boolean | null;
  lastLoginAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  ncOrder: string | null;
  preferences: string | null;
  [key: string]: any;
}

export type AccountMap = Record<number, string>;
