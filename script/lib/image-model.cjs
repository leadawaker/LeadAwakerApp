// Picks the newest OpenAI image model the account can use, by role. Twin of server/lib/imageModel.ts (keep in sync).
//   "quality": the best model, for photos with edits and anything that ships (the newest "sunburst")
//   "draft":   the fast, cheap model, for previews and throwaway images (the newest "flare")
// Only unversioned aliases are considered (no -YYYY-MM-DD suffix), so the choice floats to new releases.
// If the model list can't be read, or has nothing that fits, the pinned fallback is used.
const FALLBACK = { quality: 'gpt-image-2.5-sunburst', draft: 'gpt-image-2.5-flare' };
const VARIANT = { quality: 'sunburst', draft: 'flare' };
const cache = {};

function pick(ids, role) {
  let best = null;
  for (const id of ids) {
    const m = /^gpt-image-(\d+(?:\.\d+)?)(?:-([a-z]+))?$/.exec(id);
    if (!m) continue;
    const v = parseFloat(m[1]);
    // a generation's named variant is preferred; a plain generation (e.g. gpt-image-2) counts for "quality" only
    const fits = m[2] === VARIANT[role] || (role === 'quality' && !m[2]);
    if (!fits) continue;
    if (!best || v > best.v || (v === best.v && m[2] && !best.variant)) best = { id, v, variant: m[2] };
  }
  return best && best.id;
}

async function resolveImageModel(role, apiKey) {
  const hit = cache[role];
  if (hit && Date.now() - hit.at < 6 * 3600 * 1000) return hit.id;
  let id = null;
  try {
    const res = await fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(8000) });
    if (res.ok) id = pick(((await res.json()).data || []).map((m) => m.id), role);
  } catch (e) { /* use the fallback */ }
  id = id || FALLBACK[role];
  cache[role] = { id, at: Date.now() };
  return id;
}

module.exports = { resolveImageModel, pickImageModel: pick, FALLBACK };
