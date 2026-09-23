import type { SocialPostText } from "@shared/schema";

export type SocialLang = "en" | "nl" | "pt";
export type SocialPost = SocialPostText;
/** What the page receives: never the image prompt, and the opener stays server-side. */
export type PublicSocialPost = Omit<SocialPost, "image_prompt" | "dm_opener">;
