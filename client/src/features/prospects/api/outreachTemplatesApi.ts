import { apiRequest } from "@/lib/queryClient";

export interface OutreachTemplate {
  id: number;
  created_at?: string;
  updated_at?: string;
  name: string;
  niche: string;
  template_type: string;
  subject: string;
  body: string;
  channel: string;
  language: string;
  Accounts_id?: number;
}

export async function getOutreachTemplates(): Promise<OutreachTemplate[]> {
  const res = await apiRequest("GET", "/api/outreach-templates");
  return res.json();
}

export async function createOutreachTemplate(
  data: Partial<OutreachTemplate>
): Promise<OutreachTemplate> {
  const res = await apiRequest("POST", "/api/outreach-templates", data);
  return res.json();
}

export async function updateOutreachTemplate(
  id: number,
  data: Partial<OutreachTemplate>
): Promise<OutreachTemplate> {
  const res = await apiRequest("PATCH", `/api/outreach-templates/${id}`, data);
  return res.json();
}

export async function deleteOutreachTemplate(id: number): Promise<void> {
  await apiRequest("DELETE", `/api/outreach-templates/${id}`);
}
