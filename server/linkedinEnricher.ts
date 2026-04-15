/**
 * LinkedIn profile enrichment via RapidAPI (professional-network-data).
 * Rotates through all available API keys to stay within rate limits.
 */

import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { completeText, stripFences } from "./aiTextHelper";

const RAPIDAPI_HOST = "professional-network-data.p.rapidapi.com";
const ENDPOINT = `https://${RAPIDAPI_HOST}/profile-data-connection-count-posts`;

// Load all RAPIDAPI_KEY_N from env
const API_KEYS: string[] = [];
for (let i = 1; i <= 12; i++) {
  const key = process.env[`RAPIDAPI_KEY_${i}`];
  if (key) API_KEYS.push(key);
}

let keyIndex = 0;
function nextKey(): string {
  if (API_KEYS.length === 0) throw new Error("No RAPIDAPI_KEY_* found in env");
  const key = API_KEYS[keyIndex % API_KEYS.length];
  keyIndex++;
  return key;
}

/**
 * Extract LinkedIn username from a profile URL.
 * Handles: linkedin.com/in/username, linkedin.com/in/username/, full URLs with query params.
 */
export function extractUsername(url: string): string | null {
  if (!url) return null;
  url = url.trim();
  // Direct username (no slashes or dots)
  if (!url.includes("/") && !url.includes(".")) return url;
  // URL pattern
  const match = url.match(/linkedin\.com\/in\/([^/?#]+)/i);
  return match ? match[1] : null;
}

interface CarouselPost {
  title: string;
  date: string;
  reactions: number;
  url?: string;
}

interface LinkedInResult {
  headline: string | null;
  connectionCount: number | null;
  followerCount: number | null;
  photoUrl: string | null;
  topPost: string | null;
  topPosts: CarouselPost[];
}

/**
 * Fetch a LinkedIn profile from RapidAPI.
 * Rotates through all available keys on 429/403 errors.
 */
export async function fetchLinkedInProfile(username: string): Promise<LinkedInResult> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < API_KEYS.length; attempt++) {
    const key = nextKey();
    try {
      const res = await fetch(`${ENDPOINT}?username=${encodeURIComponent(username)}`, {
        headers: {
          "x-rapidapi-key": key,
          "x-rapidapi-host": RAPIDAPI_HOST,
        },
      });

      if (res.status === 429 || res.status === 403) {
        console.log(`[LinkedIn] Key ${keyIndex - 1} rate-limited (${res.status}), rotating...`);
        lastError = new Error(`Key rate-limited: ${res.status}`);
        continue;
      }

      if (!res.ok) {
        throw new Error(`RapidAPI ${res.status}: ${await res.text()}`);
      }

      const json = await res.json() as any;
      const data = json.data || json;

      // Extract top posts — take top 3 by reactions from the last batch
      const posts = json.posts || data.posts || [];
      const topPosts: CarouselPost[] = [];
      let topPost: string | null = null;
      if (Array.isArray(posts) && posts.length > 0) {
        const sorted = [...posts].sort((a, b) => (b?.totalReactionCount ?? 0) - (a?.totalReactionCount ?? 0));
        for (const p of sorted.slice(0, 3)) {
          const rawText = (p?.text || p?.commentary || "").toString();
          if (!rawText.trim()) continue;
          const title = rawText.length > 120 ? rawText.slice(0, 117) + "..." : rawText;
          const date = (p?.postedDate || "").toString().slice(0, 10);
          topPosts.push({
            title,
            date,
            reactions: Number(p?.totalReactionCount ?? 0),
            url: p?.postUrl || undefined,
          });
        }
        // Legacy text field (backwards compat): use the highest-engagement post text
        const firstText = sorted[0]?.text || sorted[0]?.commentary || null;
        topPost = firstText ? (firstText.length > 500 ? firstText.slice(0, 497) + "..." : firstText) : null;
      }

      // Parse counts as integers
      const connectionCount = parseInt(String(data.connection ?? data.connectionCount ?? ""), 10) || null;
      const followerCount = parseInt(String(data.follower ?? data.followerCount ?? ""), 10) || null;

      return {
        headline: data.headline || null,
        connectionCount,
        followerCount,
        photoUrl: data.profilePicture || data.photo_url || null,
        topPost,
        topPosts,
      };
    } catch (err: any) {
      lastError = err;
      console.error(`[LinkedIn] Attempt ${attempt + 1} failed:`, err.message);
    }
  }

  throw lastError || new Error("All LinkedIn API attempts failed");
}

/**
 * Enrich a prospect's LinkedIn data and store results in the database.
 * contactSlot: 1 = contact_linkedin, 2 = contact2_linkedin
 */
export async function enrichLinkedIn(prospectId: number, contactSlot: 1 | 2 = 1): Promise<LinkedInResult> {
  const [prospect] = await db
    .select({ contactLinkedin: prospects.contactLinkedin, contact2Linkedin: prospects.contact2Linkedin })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  const linkedinUrl = contactSlot === 2 ? prospect?.contact2Linkedin : prospect?.contactLinkedin;

  if (!linkedinUrl) {
    const field = contactSlot === 2 ? "contact2_linkedin" : "contact_linkedin";
    throw new Error(`Prospect has no LinkedIn URL in ${field}`);
  }

  const username = extractUsername(linkedinUrl);
  if (!username) {
    throw new Error(`Could not extract username from: ${linkedinUrl}`);
  }

  const result = await fetchLinkedInProfile(username);

  // Fetch prospect context for person_brief generation
  const [prospectData] = await db
    .select({
      company: prospects.company,
      niche: prospects.niche,
      contactName: prospects.contactName,
      contactRole: prospects.contactRole,
      contact2Name: prospects.contact2Name,
      contact2Role: prospects.contact2Role,
    })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  const name = contactSlot === 2 ? prospectData?.contact2Name : prospectData?.contactName;
  const role = contactSlot === 2 ? prospectData?.contact2Role : prospectData?.contactRole;

  // Generate structured person_brief (labeled ROLE/BACKGROUND/CONTENT/RAPPORT format)
  // Tries Claude Haiku first, falls back to Groq on failure. Best-effort.
  let personBrief: string | null = null;
  if (result.headline || result.topPost || result.topPosts.length > 0) {
    const postsBlock = result.topPosts.length > 0
      ? result.topPosts.map((p, i) => `Post ${i + 1} (${p.reactions} reactions, ${p.date}): ${p.title}`).join("\n")
      : (result.topPost || "N/A");

    const briefPrompt = `You are creating a sales intelligence brief about a business contact based on their LinkedIn data.

Name: ${name || "Unknown"}
Role: ${role || "Unknown"}
Company: ${prospectData?.company || "Unknown"}
Industry: ${prospectData?.niche || "Unknown"}
LinkedIn Headline: ${result.headline || "N/A"}
Connections: ${result.connectionCount || "N/A"}
Followers: ${result.followerCount || "N/A"}
Recent Posts:
${postsBlock}

Write a categorized brief using EXACTLY this labeled format — one fact per line, multiple lines per category allowed:

ROLE: <one line: current role at company, capacity, availability if mentioned>
BACKGROUND: <fact 1 about expertise, methodologies, years of experience>
BACKGROUND: <fact 2>
BACKGROUND: <fact 3 if relevant>
CONTENT: <fact 1: what they post about, themes, positioning in their content>
CONTENT: <fact 2 if relevant>
RAPPORT: <fact 1: communication style, values, how to approach them>
RAPPORT: <fact 2 if relevant>

Rules:
- Output ONLY the labeled lines, no preamble, no markdown, no code fences.
- Each line starts with an uppercase label followed by a colon and a space.
- If content is in Dutch/Portuguese/etc., synthesize the meaning in English.
- Be specific and useful for outreach, not generic.
- Skip any category that has no data.`;

    const briefOut = await completeText(briefPrompt);
    if (briefOut) {
      const cleaned = stripFences(briefOut);
      // Keep only lines that start with an uppercase label pattern — drop any stray preamble
      const lines = cleaned.split(/\r?\n/).filter((l) => /^[A-Z][A-Z0-9 /&-]{1,40}:\s/.test(l.trim()));
      if (lines.length > 0) personBrief = lines.map((l) => l.trim()).join("\n");
    }
  }

  const topPostDataJson = result.topPosts.length > 0 ? result.topPosts : null;

  const linkedinFields = contactSlot === 2
    ? {
        contact2Headline: result.headline,
        contact2ConnectionCount: result.connectionCount,
        contact2FollowerCount: result.followerCount,
        contact2PhotoUrl: result.photoUrl,
        contact2TopPost: result.topPost,
        contact2TopPostData: topPostDataJson as any,
        contact2PersonBrief: personBrief,
      }
    : {
        headline: result.headline,
        connectionCount: result.connectionCount,
        followerCount: result.followerCount,
        photoUrl: result.photoUrl,
        topPost: result.topPost,
        topPostData: topPostDataJson as any,
        personBrief: personBrief,
      };

  await db
    .update(prospects)
    .set({
      ...linkedinFields,
      enrichmentStatus: "enriched",
      enrichedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  return result;
}
