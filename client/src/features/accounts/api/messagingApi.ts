import { apiFetch } from "@/lib/apiUtils";

export type SmsState = "ready" | "none";
export type WhatsappState = "none" | "pending" | "approved" | "rejected";

export interface MessagingStatus {
  sms: SmsState;
  whatsapp: WhatsappState;
  fromNumber: string | null;
  displayName: string | null;
  provisionedAt: string | null;
  managed: boolean;
  alreadyProvisioned?: boolean;
  provisioned?: boolean;
}

export const fetchMessagingStatus = async (accountId: number): Promise<MessagingStatus> => {
  const res = await apiFetch(`/api/accounts/${accountId}/messaging/status`);
  if (!res.ok) throw new Error("Failed to load messaging status");
  return res.json();
};

/** Provisions a Twilio subaccount + NL number + messaging service (real charge). */
export const provisionMessaging = async (accountId: number): Promise<MessagingStatus> => {
  const res = await apiFetch(`/api/accounts/${accountId}/messaging/provision`, { method: "POST" });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to set up messaging");
  }
  return res.json();
};

/** Releases the number, closes the subaccount, and clears the stored creds. */
export const deprovisionMessaging = async (accountId: number): Promise<void> => {
  const res = await apiFetch(`/api/accounts/${accountId}/messaging`, { method: "DELETE" });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to release messaging");
  }
};
