// Website chat widget configuration (Accounts → Integrations).
// Spec: specs/website-widget. The key a client pastes into their site is public
// by design; the domain allowlist below is what actually protects the account.
import { apiFetch } from "@/lib/apiUtils";

export interface WidgetConfigRow {
  id: number;
  accountsId: number;
  campaignsId: number | null;
  publicKey: string;
  name: string | null;
  enabled: boolean | null;
  allowedDomains: string[] | null;
  greeting: string | null;
  launcherPosition: string | null;
  agentName: string | null;
  avatarUrl: string | null;
  language: string | null;
  maxTurnsPerVisitor: number | null;
  maxMessagesPerDay: number | null;
  messagesToday: number | null;
  messagesDay: string | null;
}

export interface WidgetConfigsResponse {
  configs: WidgetConfigRow[];
  campaigns: Array<{ id: number; name: string | null; campaignType: string | null }>;
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await apiFetch(url, init);
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || `Request failed (${res.status})`);
  }
  return res.status === 204 ? (undefined as T) : res.json();
}

export const fetchWidgetConfigs = (accountId: number) =>
  request<WidgetConfigsResponse>(`/api/widget-configs?accountId=${accountId}`);

export const createWidgetConfig = (body: Partial<WidgetConfigRow> & { accountsId: number }) =>
  request<WidgetConfigRow>("/api/widget-configs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const updateWidgetConfig = (id: number, body: Partial<WidgetConfigRow>) =>
  request<WidgetConfigRow>(`/api/widget-configs/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

export const deleteWidgetConfig = (id: number) =>
  request<void>(`/api/widget-configs/${id}`, { method: "DELETE" });

/** The snippet the client pastes. Built from the browser's own API origin so a
 *  copied snippet always points at the host that served the CRM. */
export function widgetSnippet(publicKey: string, apiOrigin: string): string {
  return `<script src="${apiOrigin}/widget/v1.js" data-key="${publicKey}" async></script>`;
}
