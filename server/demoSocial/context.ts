import type { PublicSocialPost, SocialPost } from "./types";

// English on purpose: it is prompt context, and prompt 108 is written in English
// with {language} deciding the reply language.
export function socialContextFields(post: SocialPost) {
  const { image_prompt: _ip, dm_opener, ...rest } = post;
  const social_post: PublicSocialPost = rest;
  const social_context =
    `They commented "${post.keyword}" on your Instagram post offering ${post.offer}.\n` +
    `The post said: "${post.caption}"\n` +
    `Under it: "${post.cta_line}"`;
  return {
    social_post,
    social_dm_opener: dm_opener,
    lead_source: "social_comment" as const,
    social_context,
    enquiry_context: `Commented ${post.keyword} on the Instagram post offering ${post.offer}.`,
  };
}
