// Per-client WhatsApp (Meta Cloud API) on the account page: the sender details
// and its message templates. Spec: specs/receptionist-channels, Phase 4.
// Secrets are write-only: the server answers hasAppSecret / hasToken, never the values.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "@/lib/apiUtils";

export type SenderStatus = "pending" | "connected" | "error" | "disabled";

export interface WhatsappSender {
  accountId: number;
  wabaId: string;
  phoneNumberId: string;
  appId: string;
  hasAppSecret: boolean;
  hasToken: boolean;
  onboardingMode: "app" | "new" | null;
  aiScope: "all" | "new_only" | "off";
  resumeAfterHours: number | null;
  resumeCommand: string;
  displayPhoneNumber: string | null;
  verifiedName: string | null;
  nameStatus: string | null;
  qualityRating: string | null;
  status: SenderStatus;
  lastErrorCode: string | null;
  lastError: string | null;
  connectedAt: string | null;
  updatedAt: string | null;
}

export interface SenderInput {
  wabaId: string;
  phoneNumberId: string;
  appId: string;
  /** Empty keeps the stored value. */
  appSecret: string;
  accessToken: string;
}

export interface TestResult {
  ok: boolean;
  errorCode: string | null;
  error: string | null;
  metaDetail: string | null;
  checks: Partial<Record<"number" | "waba" | "app" | "webhook", boolean | null>>;
  warnings: string[];
  sender: WhatsappSender | null;
}

export type TemplateStatus = "not_submitted" | "pending" | "approved" | "rejected" | "paused" | "disabled";

export interface TemplateRow {
  name: string;
  language: string;
  version: number;
  category: string | null;
  status: TemplateStatus;
  /** Submitted with an older text than the catalog has now. */
  outdated: boolean;
  canResubmit: boolean;
  rejectedReason: string | null;
  body: string;
  /** The body with the sample values filled in. */
  preview: string;
  submittedAt: string | null;
  updatedAt: string | null;
}

export interface TemplatesResponse { catalogAvailable: boolean; rows: TemplateRow[] }

export interface TemplateActionResult {
  ok: boolean;
  errorCode: string | null;
  error: string | null;
  submitted?: number;
  failed?: number;
  results?: { name: string; language: string; action: string; ok: boolean; error: string | null }[];
  rows: TemplateRow[] | null;
}

/** An error that carries the server's machine code (e.g. "engine_unavailable"). */
export class WhatsappApiError extends Error {
  constructor(message: string, public code: string | null) {
    super(message);
  }
}

async function call<T>(url: string, method = "GET", body?: unknown): Promise<T> {
  const res = await apiFetch(url, {
    method,
    headers: body === undefined ? undefined : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const first = Array.isArray(data?.errors) ? data.errors[0]?.message : null;
    throw new WhatsappApiError(first || data?.message || `HTTP ${res.status}`, data?.code ?? null);
  }
  return data as T;
}

const base = (accountId: number) => `/api/accounts/${accountId}`;
export const senderKey = (accountId: number) => ["whatsapp-sender", accountId] as const;
export const templatesKey = (accountId: number) => ["whatsapp-templates", accountId] as const;

/** The account's sender (null when nothing is saved yet), with save and test. */
export function useWhatsappSender(accountId: number) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: senderKey(accountId),
    queryFn: () => call<{ sender: WhatsappSender | null }>(`${base(accountId)}/whatsapp-sender`).then((r) => r.sender),
    enabled: accountId > 0,
    staleTime: 15_000,
  });
  const put = (sender: WhatsappSender | null) => qc.setQueryData(senderKey(accountId), sender);

  const save = useMutation({
    mutationFn: (input: SenderInput) =>
      call<{ sender: WhatsappSender }>(`${base(accountId)}/whatsapp-sender`, "PUT", input).then((r) => r.sender),
    onSuccess: put,
  });
  const test = useMutation({
    mutationFn: () => call<TestResult>(`${base(accountId)}/whatsapp-sender/test`, "POST"),
    onSuccess: (result) => {
      if (result.sender) put(result.sender);
      // A fresh connection is the moment the templates become usable.
      qc.invalidateQueries({ queryKey: templatesKey(accountId) });
    },
  });
  // Meta's signup popup answered: the server swaps the code for the client's
  // token and stores the sender, so nothing has to be pasted by hand.
  const connect = useMutation({
    mutationFn: (input: { mode: "app" | "new"; code: string; wabaId: string; phoneNumberId: string | null }) =>
      call<{ sender: WhatsappSender }>(`${base(accountId)}/whatsapp-sender/connect`, "POST", input).then((r) => r.sender),
    onSuccess: put,
  });
  const behaviour = useMutation({
    mutationFn: (patch: Partial<Pick<WhatsappSender, "aiScope" | "resumeAfterHours" | "resumeCommand">>) =>
      call<{ sender: WhatsappSender }>(`${base(accountId)}/whatsapp-sender/behaviour`, "PUT", patch).then((r) => r.sender),
    onSuccess: put,
  });
  return { sender: query.data ?? null, loading: query.isLoading, loadError: query.error as Error | null, save, test, connect, behaviour };
}

/** The catalog rows with their status, plus submit (all, or one row) and refresh. */
export function useWhatsappTemplates(accountId: number, enabled: boolean) {
  const qc = useQueryClient();
  const query = useQuery({
    queryKey: templatesKey(accountId),
    queryFn: () => call<TemplatesResponse>(`${base(accountId)}/whatsapp-templates`),
    enabled: enabled && accountId > 0,
    staleTime: 15_000,
  });
  const adopt = (result: TemplateActionResult) => {
    if (result.rows) qc.setQueryData(templatesKey(accountId), { catalogAvailable: true, rows: result.rows });
  };
  const submit = useMutation({
    mutationFn: (row?: { name: string; language: string }) =>
      call<TemplateActionResult>(`${base(accountId)}/whatsapp-templates/submit`, "POST", row ?? {}),
    onSuccess: adopt,
  });
  const refresh = useMutation({
    mutationFn: () => call<TemplateActionResult>(`${base(accountId)}/whatsapp-templates/refresh`, "POST"),
    onSuccess: adopt,
  });
  return {
    rows: query.data?.rows ?? [],
    catalogAvailable: query.data?.catalogAvailable ?? true,
    loading: query.isLoading,
    submit,
    refresh,
  };
}
