import { apiFetch } from "@/lib/apiUtils";

export interface ProspectsListParams {
  limit?: number;
  offset?: number;
  search?: string;
  niche?: string[];
  status?: string[];
  country?: string[];
  priority?: string[];
  source?: string[];
  overdue?: boolean;
  sortBy?: string;
  groupBy?: string;
  groupDirection?: "asc" | "desc";
  all?: boolean;
}

export interface ProspectsPage {
  items: any[];
  total: number;
  hasMore: boolean;
}

const buildProspectsQuery = (params: ProspectsListParams): string => {
  const qp = new URLSearchParams();
  if (params.limit != null) qp.set("limit", String(params.limit));
  if (params.offset != null) qp.set("offset", String(params.offset));
  if (params.search) qp.set("search", params.search);
  if (params.niche?.length) qp.set("niche", params.niche.join(","));
  if (params.status?.length) qp.set("status", params.status.join(","));
  if (params.country?.length) qp.set("country", params.country.join(","));
  if (params.priority?.length) qp.set("priority", params.priority.join(","));
  if (params.source?.length) qp.set("source", params.source.join(","));
  if (params.overdue) qp.set("overdue", "true");
  if (params.sortBy) qp.set("sortBy", params.sortBy);
  if (params.groupBy) qp.set("groupBy", params.groupBy);
  if (params.groupDirection) qp.set("groupDirection", params.groupDirection);
  if (params.all) qp.set("all", "true");
  const s = qp.toString();
  return s ? `?${s}` : "";
};

export const fetchProspectsPage = async (params: ProspectsListParams = {}): Promise<ProspectsPage> => {
  const res = await apiFetch(`/api/prospects${buildProspectsQuery(params)}`);
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please log in again.");
    if (res.status === 403) throw new Error("Access denied — agency account required.");
    throw new Error(`Failed to fetch prospects (${res.status})`);
  }
  const data = await res.json();
  // Backend always returns { items, total, hasMore }. Old server responses (array) tolerated.
  if (Array.isArray(data)) return { items: data, total: data.length, hasMore: false };
  return { items: data.items || data.data || [], total: data.total ?? 0, hasMore: !!data.hasMore };
};

// Legacy: returns flat array (for views that haven't adopted pagination). Uses all=true.
export const fetchProspects = async () => {
  const page = await fetchProspectsPage({ all: true });
  return page.items;
};

export const fetchProspectsByIds = async (ids: number[]): Promise<any[]> => {
  if (ids.length === 0) return [];
  const res = await apiFetch(`/api/prospects/by-ids?ids=${ids.join(",")}`);
  if (!res.ok) throw new Error(`Failed to fetch prospects by ids (${res.status})`);
  const data = await res.json();
  return data.items || [];
};

export const fetchProspectsFilterOptions = async (): Promise<{ niches: string[]; countries: string[]; sources: string[] }> => {
  const res = await apiFetch("/api/prospects/filter-options");
  if (!res.ok) throw new Error(`Failed to fetch filter options (${res.status})`);
  return await res.json();
};

export const updateProspect = async (rowId: number | string, patch: Record<string, unknown>) => {
  const res = await apiFetch(`/api/prospects/${rowId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error("Failed to update prospect");
  return await res.json();
};

export const createProspect = async (payload: Record<string, unknown>) => {
  const res = await apiFetch("/api/prospects", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Failed to create prospect");
  return await res.json();
};

export const convertProspectToAccount = async (rowId: number | string) => {
  const res = await apiFetch(`/api/prospects/${rowId}/convert-to-account`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to convert prospect" }));
    throw new Error(err.message || "Failed to convert prospect");
  }
  return await res.json();
};

export const deleteProspect = async (rowId: number | string) => {
  const res = await apiFetch(`/api/prospects/${rowId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete prospect");
};

export class WhatsAppWindowExpiredError extends Error {
  code = "window_expired";
  constructor() {
    super("WhatsApp 24-hour window expired");
  }
}

export const sendWhatsAppMessage = async (prospectId: number, message: string) => {
  const res = await apiFetch(`/api/prospects/${prospectId}/whatsapp/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to send" }));
    if (err.code === "window_expired") throw new WhatsAppWindowExpiredError();
    throw new Error(err.message || "Failed to send WhatsApp message");
  }
  return await res.json();
};

/** Fire-and-forget — never throws, best-effort */
export const sendTypingIndicator = (prospectId: number): void => {
  apiFetch(`/api/prospects/${prospectId}/whatsapp/typing`, { method: "POST" }).catch(() => {});
};

export interface WhatsAppTemplate {
  name: string;
  language: string;
  category: string;
  status: string;
  components: Array<{
    type: string;
    text?: string;
    parameters?: Array<{ type: string; text?: string }>;
  }>;
}

export const fetchWhatsAppTemplates = async (): Promise<WhatsAppTemplate[]> => {
  const res = await apiFetch("/api/whatsapp/templates");
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
};

export const sendWhatsAppTemplate = async (
  prospectId: number,
  templateName: string,
  languageCode: string,
  variables: { body?: string[]; header?: string[]; button?: string[] }
) => {
  const res = await apiFetch(`/api/prospects/${prospectId}/whatsapp/send-template`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ templateName, languageCode, variables }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to send template" }));
    throw new Error(err.message || "Failed to send template");
  }
  return await res.json();
};

export const sendWhatsAppImage = async (prospectId: number, imageData: string, mimeType: string, caption?: string) => {
  const res = await apiFetch(`/api/prospects/${prospectId}/whatsapp/send-image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ imageData, mimeType, caption }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ message: "Failed to send" }));
    if (err.code === "window_expired") throw new WhatsAppWindowExpiredError();
    throw new Error(err.message || "Failed to send image");
  }
  return await res.json();
};
