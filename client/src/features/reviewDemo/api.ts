import { apiFetch } from "@/lib/apiUtils";
import type { ReviewDemoState } from "./types";

async function json<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((body as { message?: string }).message || `HTTP ${res.status}`);
  return body as T;
}

const base = (token: string) => `/api/web-demo/${encodeURIComponent(token)}`;
const post = (url: string, body: unknown) =>
  apiFetch(url, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

export const getState = (token: string) => apiFetch(base(token)).then((r) => json<ReviewDemoState>(r));
export const sendMessage = (token: string, text: string) => post(`${base(token)}/message`, { text }).then((r) => json<unknown>(r));
export const restart = (token: string) => post(`${base(token)}/restart`, {}).then((r) => json<unknown>(r));
export const reviewDraft = (token: string, stars: number, text: string) =>
  post(`${base(token)}/review-draft`, { stars, text }).then((r) => json<{ draft: string }>(r));
