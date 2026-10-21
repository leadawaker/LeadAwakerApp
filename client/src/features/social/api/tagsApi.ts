// Studio tags API (server/social/tagRoutes.ts): the account's tags, and the tags on an idea or a script.
import type { TagColor } from "@shared/socialStudio";
import { apiFetch } from "@/lib/apiUtils";
import { jsonInit, SocialApiError, throwUnlessOk } from "./socialApi";
import type { ScriptView, TopicView } from "./studioApi";

export interface TagView { id: number; name: string; color: TagColor }

const base = (accountId: number) => `/api/social/accounts/${accountId}`;
const send = async <T,>(url: string, method: string, body?: unknown): Promise<T> =>
  (await throwUnlessOk(await apiFetch(url, jsonInit(method, body)))).json();

/** social:tags message for a failed tag save: a name already in use has its own. */
export const tagErrorKey = (err: unknown) => (err instanceof SocialApiError && err.reason === "tag_exists" ? "tags.exists" : "tags.failed");

export const socialTagsKey = (accountId: number) => ["social-tags", accountId] as const;
export const fetchTags = async (accountId: number): Promise<TagView[]> => (await throwUnlessOk(await apiFetch(`${base(accountId)}/tags`))).json();
export const createTag = (accountId: number, name: string, color: TagColor) => send<TagView>(`${base(accountId)}/tags`, "POST", { name, color });
export const updateTag = (accountId: number, tagId: number, body: { name?: string; color?: TagColor }) => send<TagView>(`${base(accountId)}/tags/${tagId}`, "PATCH", body);
export async function deleteTag(accountId: number, tagId: number): Promise<void> {
  await throwUnlessOk(await apiFetch(`${base(accountId)}/tags/${tagId}`, jsonInit("DELETE")));
}
export const setTopicTags = (accountId: number, topicId: number, tagIds: number[]) => send<TopicView>(`${base(accountId)}/topics/${topicId}/tags`, "PUT", { tagIds });
export const setScriptTags = (accountId: number, scriptId: number, tagIds: number[]) => send<ScriptView>(`${base(accountId)}/scripts/${scriptId}/tags`, "PUT", { tagIds });
