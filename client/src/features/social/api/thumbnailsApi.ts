// Thumbnail creator API (server/social/thumbnailRoutes.ts): reference images, saved styles and the
// generated covers. Image URLs are API paths: prefix them with API_BASE (imageSrc) for <img>.
import type { RefKind, ThumbFormat, ThumbKind, ThumbStatus } from "@shared/socialThumbnails";
import { apiFetch, API_BASE } from "@/lib/apiUtils";
import { jsonInit, throwUnlessOk } from "./socialApi";

const base = (accountId: number) => `/api/social/accounts/${accountId}`;

async function getJson<T>(url: string): Promise<T> {
  return (await throwUnlessOk(await apiFetch(url))).json();
}

async function sendJson<T>(url: string, method: string, body?: unknown): Promise<T> {
  return (await throwUnlessOk(await apiFetch(url, jsonInit(method, body)))).json();
}

export const imageSrc = (path: string) => `${API_BASE}${path}`;

export interface ThumbnailConfig { configured: boolean; canCreate: boolean }

export interface ThumbnailView {
  id: number;
  batchId: string;
  styleId: number | null;
  scriptId: number | null;
  postId: number | null;
  kind: ThumbKind;
  format: ThumbFormat;
  title: string;
  prompt: string;
  refIds: number[];
  status: ThumbStatus;
  error: string | null;
  starred: boolean;
  imageUrl: string | null;
  /** The thumbnail this one was edited from; review is "pending" until the edit is approved. */
  parentId: number | null;
  review: "pending" | "approved" | null;
  createdAt: string;
}

export interface RefView { id: number; kind: RefKind; label: string; imageUrl: string; createdAt: string }

export interface StyleView { id: number; name: string; kind: ThumbKind; prompt: string; format: ThumbFormat; refIds: number[] }

export interface GenerateInput {
  kind: ThumbKind;
  format: ThumbFormat;
  title: string;
  prompt: string;
  refIds: number[];
  styleId: number | null;
  scriptId: number | null;
  postId: number | null;
  variants: number;
}

export const thumbnailConfigKey = (accountId: number) => ["social-thumbnail-config", accountId] as const;
export const thumbnailsKey = (accountId: number) => ["social-thumbnails", accountId] as const;
export const thumbnailRefsKey = (accountId: number) => ["social-thumbnail-refs", accountId] as const;
export const thumbnailStylesKey = (accountId: number) => ["social-thumbnail-styles", accountId] as const;

export const fetchThumbnailConfig = (accountId: number) => getJson<ThumbnailConfig>(`${base(accountId)}/thumbnails/config`);
export const fetchThumbnails = (accountId: number) => getJson<ThumbnailView[]>(`${base(accountId)}/thumbnails`);
export const generateThumbnails = (accountId: number, input: GenerateInput) => sendJson<ThumbnailView[]>(`${base(accountId)}/thumbnails`, "POST", input);
export const starThumbnail = (accountId: number, id: number, starred: boolean) => sendJson<ThumbnailView>(`${base(accountId)}/thumbnails/${id}`, "PATCH", { starred });
export const deleteThumbnail = (accountId: number, id: number) => sendJson<{ ok: true }>(`${base(accountId)}/thumbnails/${id}`, "DELETE");
export interface EditInput { instruction: string; format: ThumbFormat | null; variants: number }
export const editThumbnail = (accountId: number, id: number, input: EditInput) => sendJson<ThumbnailView[]>(`${base(accountId)}/thumbnails/${id}/edit`, "POST", input);
export const approveThumbnail = (accountId: number, id: number) => sendJson<ThumbnailView>(`${base(accountId)}/thumbnails/${id}`, "PATCH", { review: "approved" });
export const downloadUrl = (t: ThumbnailView) => (t.imageUrl ? `${imageSrc(t.imageUrl)}?download=1` : "");

export const fetchThumbnailRefs = (accountId: number) => getJson<RefView[]>(`${base(accountId)}/thumbnail-refs`);
/** data: a data URL (lib/thumbnails.ts prepareReference makes one). */
export const uploadThumbnailRef = (accountId: number, input: { kind: RefKind; label: string; data: string }) =>
  sendJson<RefView>(`${base(accountId)}/thumbnail-refs`, "POST", input);
export const deleteThumbnailRef = (accountId: number, id: number) => sendJson<{ ok: true }>(`${base(accountId)}/thumbnail-refs/${id}`, "DELETE");

export const fetchThumbnailStyles = (accountId: number) => getJson<StyleView[]>(`${base(accountId)}/thumbnail-styles`);
export const createThumbnailStyle = (accountId: number, input: Omit<StyleView, "id">) => sendJson<StyleView>(`${base(accountId)}/thumbnail-styles`, "POST", input);
export const deleteThumbnailStyle = (accountId: number, id: number) => sendJson<{ ok: true }>(`${base(accountId)}/thumbnail-styles/${id}`, "DELETE");
