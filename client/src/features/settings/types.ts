import { CheckCircle, Clock, AlertTriangle, CalendarCheck, MessageSquareWarning, Bot, Megaphone } from "lucide-react";

// ── User profile type ────────────────────────────────────────────────
export type UserProfile = {
  id: number;
  fullName1: string | null;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  timezone: string | null;
  role: string | null;
  status: string | null;
  accountsId: number | null;
  lastLoginAt: string | null;
  preferences?: string | Record<string, unknown> | null;
};

// ── Notification types ───────────────────────────────────────────────
export type NotificationPreferences = {
  telegram_enabled: boolean;
  telegram_chat_id: string;
  push_enabled: boolean;
  email_enabled: boolean;
  type_overrides: Record<string, { telegram: boolean; web_push: boolean; email: boolean }>;
};

export type PushDevice = {
  id?: number;
  endpoint: string;
  device_label: string;
  created_at: string;
};

export const NOTIF_TYPE_KEYS = [
  { key: "task_assigned", labelKey: "notifications.types.taskAssigned", icon: CheckCircle },
  { key: "task_due_soon", labelKey: "notifications.types.taskDueSoon", icon: Clock },
  { key: "task_overdue", labelKey: "notifications.types.taskOverdue", icon: AlertTriangle },
  { key: "booking_confirmed", labelKey: "notifications.types.bookingConfirmed", icon: CalendarCheck },
  { key: "lead_responded", labelKey: "notifications.types.leadResponded", icon: MessageSquareWarning },
  { key: "lead_manual_takeover", labelKey: "notifications.types.leadManualTakeover", icon: Bot },
  { key: "critical_automation_failure", labelKey: "notifications.types.criticalAutomationFailure", icon: AlertTriangle },
  { key: "campaign_finished", labelKey: "notifications.types.campaignFinished", icon: Megaphone },
] as const;

export function getDefaultNotifPrefs(): NotificationPreferences {
  const type_overrides: Record<string, { telegram: boolean; web_push: boolean; email: boolean }> = {};
  for (const t of NOTIF_TYPE_KEYS)
    type_overrides[t.key] = { telegram: true, web_push: true, email: true };
  return {
    telegram_enabled: false,
    telegram_chat_id: "",
    push_enabled: false,
    email_enabled: true,
    type_overrides,
  };
}

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}
