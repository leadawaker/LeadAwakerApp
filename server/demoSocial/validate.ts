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
  if (!opener.includes("{agent_name}") || !opener.includes("{company_name}")) {
    return "dm_opener must contain {agent_name} and {company_name}";
  }
  if (String(d.caption).length > 400) return "caption too long";
  return null;
}

export function coerceSocialPost(data: any): SocialPost {
  const likes = Math.round(Number(data.likes));
  return {
    handle: String(data.handle).toLowerCase().replace(/[^a-z0-9._]/g, "").slice(0, 30),
    caption: String(data.caption).trim(),
    keyword: normalizeKeyword(data.keyword),
    cta_line: String(data.cta_line).trim(),
    dm_opener: String(data.dm_opener).trim(),
    offer: String(data.offer).trim(),
    image_prompt: String(data.image_prompt).trim(),
    likes: Number.isFinite(likes) ? Math.min(5000, Math.max(40, likes)) : 327,
  };
}
