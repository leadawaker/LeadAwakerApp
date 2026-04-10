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

  const linkedinFields = contactSlot === 2
    ? {
        contact2Headline: result.headline,
        contact2ConnectionCount: result.connectionCount,
        contact2FollowerCount: result.followerCount,
        contact2PhotoUrl: result.photoUrl,
        contact2TopPost: result.topPost,
      }
    : {
        headline: result.headline,
        connectionCount: result.connectionCount,
        followerCount: result.followerCount,
        photoUrl: result.photoUrl,
        topPost: result.topPost,
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
