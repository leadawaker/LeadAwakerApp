import { apiFetch } from "@/lib/apiUtils";

export const fetchProspects = async () => {
  const res = await apiFetch("/api/prospects");
  if (!res.ok) {
    if (res.status === 401) throw new Error("Session expired — please log in again.");
    if (res.status === 403) throw new Error("Access denied — agency account required.");
    throw new Error(`Failed to fetch prospects (${res.status})`);
  }
  const data = await res.json();
  return Array.isArray(data) ? data : data?.list || [];
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
