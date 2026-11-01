// US texting (A2P 10DLC) for one account: server/routes/usSms.ts.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export interface UsSmsRegistration {
  entityType: string | null; brandId: string | null; brandStatus: string | null; brandIdentityStatus: string | null;
  campaignId: string | null; tcrCampaignId: string | null; campaignStatus: string | null; usecase: string | null;
  numberStatus: string | null; details: Record<string, any>; lastError: string | null; updatedAt: string | null;
}
export interface UsSmsState { registration: UsSmsRegistration | null; number: string | null; messagingProfileId: string | null; enabled: boolean }
export interface UsNumber { phoneNumber: string; locality: string | null; region: string | null; monthly: string | null; upfront: string | null }

export const usSmsKey = (accountId: number) => ["/api/accounts", accountId, "us-sms"];

export function useUsSms(accountId: number) {
  return useQuery<UsSmsState>({
    queryKey: usSmsKey(accountId),
    queryFn: async () => {
      const res = await apiFetch(`/api/accounts/${accountId}/us-sms`);
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    },
    staleTime: 30_000,
  });
}

/** POST a step; the answer is the new state. Throws with Telnyx's (or our) message. */
export function useUsSmsAction(accountId: number) {
  const qc = useQueryClient();
  return async (path: string, body?: unknown): Promise<UsSmsState> => {
    const res = await apiFetch(`/api/accounts/${accountId}/us-sms${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body ?? {}),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.message || String(res.status));
    qc.setQueryData(usSmsKey(accountId), data);
    return data as UsSmsState;
  };
}

export async function searchUsNumbers(accountId: number, areaCode: string): Promise<UsNumber[]> {
  const res = await apiFetch(`/api/accounts/${accountId}/us-sms/numbers?areaCode=${encodeURIComponent(areaCode)}`);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.message || String(res.status));
  return data.numbers ?? [];
}

export type StepState = "todo" | "pending" | "done" | "failed";

const upper = (v: unknown) => String(v ?? "").toUpperCase();

export function brandState(r: UsSmsRegistration | null): StepState {
  if (!r?.brandId) return "todo";
  const s = upper(r.brandStatus);
  if (s.includes("FAIL")) return "failed";
  if (s === "OK" || ["VERIFIED", "VETTED_VERIFIED"].includes(upper(r.brandIdentityStatus))) return "done";
  return "pending";
}

export function campaignState(r: UsSmsRegistration | null): StepState {
  if (!r?.campaignId) return "todo";
  const s = upper(r.campaignStatus);
  if (/FAIL|REJECT|SUSPEND|EXPIRED/.test(s)) return "failed";
  if (["MNO_PROVISIONED", "MNO_ACCEPTED", "ACTIVE"].includes(s)) return "done";
  return "pending";
}

export function numberState(st: UsSmsState | undefined): StepState {
  if (st?.number) return "done";
  const s = String(st?.registration?.numberStatus ?? "");
  if (s.startsWith("order_failure")) return "failed";
  return s.startsWith("order_") ? "pending" : "todo";
}

export function assignState(st: UsSmsState | undefined): StepState {
  const s = String(st?.registration?.numberStatus ?? "");
  if (!s.startsWith("assignment_")) return "todo";
  if (s.includes("fail")) return "failed";
  if (s.includes("pending")) return "pending";
  return s.includes("assigned") ? "done" : "pending";
}
