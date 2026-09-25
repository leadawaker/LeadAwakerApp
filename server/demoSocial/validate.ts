import type { SocialPost } from "./types";

export function normalizeKeyword(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
}

const TEXT_FIELDS = ["handle", "caption", "keyword", "cta_line", "dm_opener", "offer", "image_prompt"] as const;

export function validateSocialPost(data: unknown): string | null {
  if (!data || typeof data !== "object") return "not an object";
  const d = data as Record<string, unknown>;
  for (const k of TEXT_FIELDS) {
    if (typeof d[k] !== "string" || !(d[k] as string).trim()) return `missing ${k}`;
  }
  const kw = String(d.keyword).trim();
  if (!/^[A-Za-zÀ-ÿ]{3,10}$/.test(kw) || normalizeKeyword(kw).length < 3) return "keyword must be 3-10 letters";
  if (!normalizeKeyword(String(d.cta_line)).includes(normalizeKeyword(kw))) return "cta_line must contain the keyword";
  const opener = String(d.dm_opener);
  if (!opener.includes("{agent_name}{disclosure_clause}")) {
    return "dm_opener must contain {agent_name}{disclosure_clause}";
  }
  // {disclosure_clause} already carries the company (" from X" or ", the AI
  // assistant at X"), so {company_name} anywhere in the opener names it twice.
  if (opener.includes("{company_name}")) return "dm_opener must not contain {company_name}";
  if (String(d.caption).length > 400) return "caption too long";
  return null;
}

/** An Instagram-style username: lowercase, [a-z0-9._] only, max 30. Accents
 *  are folded first so "Telhados São Paulo" keeps its letters. */
export function toHandle(raw: string): string {
  return String(raw || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9._]/g, "")
    .slice(0, 30);
}

export function coerceSocialPost(data: any): SocialPost {
  const likes = Math.round(Number(data.likes));
  return {
    handle: toHandle(data.handle),
    caption: String(data.caption).trim(),
    keyword: normalizeKeyword(data.keyword),
    cta_line: String(data.cta_line).trim(),
    dm_opener: String(data.dm_opener).trim(),
    offer: String(data.offer).trim(),
    image_prompt: String(data.image_prompt).trim(),
    likes: Number.isFinite(likes) ? Math.min(5000, Math.max(40, likes)) : 327,
  };
}
