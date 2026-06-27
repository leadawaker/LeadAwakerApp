import { apiFetch } from "@/lib/apiUtils";

export type DnsRecordKind = "spf" | "dkim" | "dmarc";

export interface DnsRecord {
  kind: DnsRecordKind;
  host: string;
  type: "TXT";
  value: string;
  /** Present after a verify attempt: whether this record resolved correctly. */
  ok?: boolean;
  /** Present after a verify attempt: the record we actually found (or null). */
  found?: string | null;
}

export interface EmailSenderStatus {
  fromName: string | null;
  fromAddress: string | null;
  sendingDomain: string | null;
  verified: boolean;
  verifiedAt: string | null;
  records: DnsRecord[];
}

export interface VerifyResult {
  verified: boolean;
  verifiedAt: string | null;
  records: DnsRecord[];
}

export const fetchEmailSenderStatus = async (accountId: number): Promise<EmailSenderStatus> => {
  const res = await apiFetch(`/api/accounts/${accountId}/email-sender/status`);
  if (!res.ok) throw new Error("Failed to load email sender status");
  return res.json();
};

/** Saves the From identity, (re)generates the DKIM keypair, and resets verification. */
export const saveEmailSender = async (
  accountId: number,
  payload: { fromName: string; fromAddress: string },
): Promise<EmailSenderStatus> => {
  const res = await apiFetch(`/api/accounts/${accountId}/email-sender`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to save email sender");
  }
  return res.json();
};

/** Runs the SPF + DKIM + DMARC DNS checks; flips verified only when all three pass. */
export const verifyEmailDomain = async (accountId: number): Promise<VerifyResult> => {
  const res = await apiFetch(`/api/accounts/${accountId}/email-sender/verify`, { method: "POST" });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to verify domain");
  }
  return res.json();
};
