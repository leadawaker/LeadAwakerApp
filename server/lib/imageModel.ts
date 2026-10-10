// Picks the newest OpenAI image model the account can use, by role. Twin of script/lib/image-model.cjs (keep in sync).
//   "quality": the best model, for photos with edits and anything that ships (the newest "sunburst")
//   "draft":   the fast, cheap model, for previews and throwaway images (the newest "flare")
// Only unversioned aliases are considered (no -YYYY-MM-DD suffix), so the choice floats to new releases.
// If the model list can't be read, or has nothing that fits, the pinned fallback is used.
export type ImageRole = "quality" | "draft";

export const FALLBACK: Record<ImageRole, string> = { quality: "gpt-image-2.5-sunburst", draft: "gpt-image-2.5-flare" };
const VARIANT: Record<ImageRole, string> = { quality: "sunburst", draft: "flare" };
const cache: Partial<Record<ImageRole, { id: string; at: number }>> = {};

export function pickImageModel(ids: string[], role: ImageRole): string | null {
  let best: { id: string; v: number; variant?: string } | null = null;
  for (const id of ids) {
    const m = /^gpt-image-(\d+(?:\.\d+)?)(?:-([a-z]+))?$/.exec(id);
    if (!m) continue;
    const v = parseFloat(m[1]);
    // a generation's named variant is preferred; a plain generation (e.g. gpt-image-2) counts for "quality" only
    const fits = m[2] === VARIANT[role] || (role === "quality" && !m[2]);
    if (!fits) continue;
    if (!best || v > best.v || (v === best.v && m[2] && !best.variant)) best = { id, v, variant: m[2] };
  }
  return best ? best.id : null;
}

export async function resolveImageModel(role: ImageRole, apiKey: string, fetchFn: typeof fetch = globalThis.fetch): Promise<string> {
  const hit = cache[role];
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.id;
  let id: string | null = null;
  try {
    const res = await fetchFn("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) id = pickImageModel(((await res.json()) as any).data?.map((m: any) => m.id) ?? [], role);
  } catch {
    /* use the fallback */
  }
  id = id || FALLBACK[role];
  cache[role] = { id, at: Date.now() };
  return id;
}
