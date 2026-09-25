import { runJson } from "../demoGenerator/providers";
import type { SocialLang, SocialPost } from "./types";
import { coerceSocialPost, validateSocialPost } from "./validate";

export interface SocialPostInput {
  language: SocialLang;
  companyName: string;
  serviceName: string;
  nicheLabel: string;
  usp: string;
  kb: string;
  area: string;
}

const LANGUAGE_NAME: Record<SocialLang, string> = {
  en: "English",
  nl: "Dutch (informal, 'je', never 'u')",
  pt: "Brazilian Portuguese (você, never European Portuguese)",
};

export function buildSocialPostPrompt(input: SocialPostInput): { system: string; user: string } {
  const lang = LANGUAGE_NAME[input.language];
  const system = `You write one Instagram post for a small local business, the kind the owner posts to get enquiries: "Comment ROOF and we'll DM you".
Return ONLY a JSON object with these keys:
- handle: an Instagram username for the business, lowercase, letters, digits, dots or underscores only, max 30 characters.
- caption: 1 to 3 sentences in ${lang}, written like the owner really posts: names the service and the area, one emoji at most, no hashtags.
- keyword: ONE short word in capitals tied to the service, 3 to 10 letters, easy to type on a phone, in ${lang} (ROOF, KEUKEN, TELHADO).
- cta_line: one sentence in ${lang} telling people to comment the keyword and they will get a DM to arrange the next step. It must contain the keyword exactly.
- dm_opener: the first DM the business sends after someone comments, in ${lang}: thanks them for commenting on the post, says who is writing, asks how they are. Write the literal token {agent_name} for the writer and put {disclosure_clause} straight after it with no space; that token already adds the company (\"from <company>\"), so never write the company name or {company_name} yourself. Example shape: \"this is {agent_name}{disclosure_clause}\". One or two short sentences, casual.
- offer: a short phrase in ${lang} naming what the post offers.
- image_prompt: in English, a realistic photo for this post: the work, the tradesperson or the product in a real local setting, natural light, phone-camera look. It must ask for no text, no logos, no watermarks and no signs.
- likes: an integer between 80 and 2500.`;
  const user = `Business: ${input.companyName}
Service: ${input.serviceName}
Niche: ${input.nicheLabel}
What makes them different: ${input.usp || "(not given)"}
Area: ${input.area || "(not given, keep it general)"}
Knowledge base excerpt:
${(input.kb || "").slice(0, 1500) || "(none)"}`;
  return { system, user };
}

export async function generateSocialPost(
  input: SocialPostInput,
  opts: { provider?: "claude" | "openai"; claudeModel?: "opus" | "sonnet" } = {},
): Promise<SocialPost> {
  const { system, user } = buildSocialPostPrompt(input);
  const { data } = await runJson({
    system,
    user,
    provider: opts.provider ?? "claude",
    claudeModel: opts.claudeModel ?? "sonnet",
    validate: validateSocialPost,
    openai: { model: "gpt-5.6-terra", maxTokens: 900, timeoutMs: 30000 },
    stage: "social_post",
  });
  return coerceSocialPost(data);
}
