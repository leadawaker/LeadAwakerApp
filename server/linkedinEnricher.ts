/**
 * LinkedIn profile enrichment via RapidAPI (professional-network-data).
 * Rotates through all available API keys to stay within rate limits.
 */

import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";

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

interface LinkedInResult {
  headline: string | null;
  connectionCount: number | null;
  followerCount: number | null;
  photoUrl: string | null;
  topPost: string | null;
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

      // Extract top post text (first post with text content)
      let topPost: string | null = null;
      const posts = json.posts || data.posts || [];
      if (Array.isArray(posts) && posts.length > 0) {
        topPost = posts[0]?.text || posts[0]?.commentary || null;
        if (topPost && topPost.length > 500) topPost = topPost.slice(0, 497) + "...";
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

  // Generate person_brief via Claude CLI (best-effort)
  let personBrief: string | null = null;
  if (result.headline || result.topPost) {
    const briefPrompt = `You are creating a sales intelligence brief about a business contact. Based on their LinkedIn data, create a well-categorized person brief.

Name: ${name || "Unknown"}
Role: ${role || "Unknown"}
Company: ${prospectData?.company || "Unknown"}
Industry: ${prospectData?.niche || "Unknown"}
LinkedIn Headline: ${result.headline || "N/A"}
Connections: ${result.connectionCount || "N/A"}
Followers: ${result.followerCount || "N/A"}
Recent LinkedIn Post: ${result.topPost || "N/A"}

Generate 6-10 bullet points organized into these categories:
- ROLE: Their current position, responsibilities, and seniority level
- BACKGROUND: Career trajectory, specializations, expertise areas
- CONTENT: What they post about, their thought leadership topics, tone of their posts (translate any non-English posts to English for the summary)
- ENGAGEMENT: Their network size, influence level, how active they are
- RAPPORT: Anything useful for building connection (interests, values, communication style visible from their content)

Rules:
- Each bullet is one concise sentence
- Be specific, not generic
- If a post is in another language, translate the key points to English
- Skip categories where no data is available
- Format as a flat JSON array of strings: ["ROLE: ...", "BACKGROUND: ...", ...]

Return ONLY the JSON array, no markdown fences.`;

    const { execFile } = await import("child_process");
    const CLAUDE_BIN = "/home/gabriel/.npm-global/bin/claude";

    try {
      const briefResult = await new Promise<string>((resolve, reject) => {
        execFile(
          CLAUDE_BIN,
          ["-p", briefPrompt, "--model", "haiku", "--max-turns", "1"],
          { timeout: 60000, maxBuffer: 1024 * 1024 },
          (error, stdout) => {
            if (error) reject(error);
            else resolve(stdout);
          }
        );
      });
      let cleaned = briefResult.trim();
      if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(?:json)?\s*/, "").replace(/\s*```$/, "");
      }
      const parsed = JSON.parse(cleaned);
      if (Array.isArray(parsed)) personBrief = JSON.stringify(parsed);
    } catch (err: any) {
      console.error("[LinkedIn] Person brief generation failed:", err.message);
    }
  }

  const linkedinFields = contactSlot === 2
    ? {
        contact2Headline: result.headline,
        contact2ConnectionCount: result.connectionCount,
        contact2FollowerCount: result.followerCount,
        contact2PhotoUrl: result.photoUrl,
        contact2TopPost: result.topPost,
        contact2PersonBrief: personBrief,
      }
    : {
        headline: result.headline,
        connectionCount: result.connectionCount,
        followerCount: result.followerCount,
        photoUrl: result.photoUrl,
        topPost: result.topPost,
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
