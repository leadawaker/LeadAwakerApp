/**
 * LinkedIn profile enrichment via RapidAPI (professional-network-data).
 *
 * Three paths:
 *  A) Manual slot + has LinkedIn URL -> scrape profile; write ONLY output fields (no name/role/email/phone overwrite)
 *  B) Manual slot + name only (no URL) -> Google+Haiku name-match to find URL, then scrape; preserve typed name/role
 *  C) Non-manual slot + has LinkedIn URL -> scrape profile; write all fields (overwrite OK)
 *
 * Discovery-by-role (finding decision makers from scratch) now lives in contactDiscovery.ts
 * and runs automatically as part of company enrichment. Contact enrichment no longer
 * does role-based Google searches.
 */

import { db } from "./db";
import { prospects } from "@shared/schema";
import { eq } from "drizzle-orm";
import { completeText, stripFences } from "./aiTextHelper";
import { discoverContactByName } from "./contactDiscovery";

const RAPIDAPI_HOST = "professional-network-data.p.rapidapi.com";
const ENDPOINT = `https://${RAPIDAPI_HOST}/profile-data-connection-count-posts`;

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

export function extractUsername(url: string): string | null {
  if (!url) return null;
  url = url.trim();
  if (!url.includes("/") && !url.includes(".")) return url;
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
        const firstText = sorted[0]?.text || sorted[0]?.commentary || null;
        topPost = firstText ? (firstText.length > 500 ? firstText.slice(0, 497) + "..." : firstText) : null;
      }

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

async function generatePersonBrief(
  name: string | null,
  role: string | null,
  company: string | null,
  niche: string | null,
  result: LinkedInResult,
): Promise<string | null> {
  if (!result.headline && !result.topPost && result.topPosts.length === 0) {
    return null;
  }

  const postsBlock = result.topPosts.length > 0
    ? result.topPosts.map((p, i) => `Post ${i + 1} (${p.reactions} reactions, ${p.date}): ${p.title}`).join("\n")
    : (result.topPost || "N/A");

  const briefPrompt = `You are creating a sales intelligence brief about a business contact based on their LinkedIn data.

Name: ${name || "Unknown"}
Role: ${role || "Unknown"}
Company: ${company || "Unknown"}
Industry: ${niche || "Unknown"}
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
    const lines = cleaned.split(/\r?\n/).filter((l) => /^[A-Z][A-Z0-9 /&-]{1,40}:\s/.test(l.trim()));
    if (lines.length > 0) return lines.map((l) => l.trim()).join("\n");
  }
  return null;
}

interface OutputFields {
  headline: string | null;
  connectionCount: number | null;
  followerCount: number | null;
  photoUrl: string | null;
  topPost: string | null;
  topPostData: CarouselPost[] | null;
  personBrief: string | null;
}

function buildOutputFields(slot: 1 | 2, r: LinkedInResult, personBrief: string | null): Record<string, unknown> {
  const topPostDataJson = r.topPosts.length > 0 ? r.topPosts : null;
  return slot === 2
    ? {
        contact2Headline: r.headline,
        contact2ConnectionCount: r.connectionCount,
        contact2FollowerCount: r.followerCount,
        contact2PhotoUrl: r.photoUrl,
        contact2TopPost: r.topPost,
        contact2TopPostData: topPostDataJson,
        contact2PersonBrief: personBrief,
      }
    : {
        headline: r.headline,
        connectionCount: r.connectionCount,
        followerCount: r.followerCount,
        photoUrl: r.photoUrl,
        topPost: r.topPost,
        topPostData: topPostDataJson,
        personBrief,
      };
}

export async function enrichLinkedIn(prospectId: number, contactSlot: 1 | 2 = 1): Promise<LinkedInResult> {
  const [prospect] = await db
    .select({
      contactLinkedin: prospects.contactLinkedin,
      contact2Linkedin: prospects.contact2Linkedin,
      contactName: prospects.contactName,
      contactRole: prospects.contactRole,
      contact2Name: prospects.contact2Name,
      contact2Role: prospects.contact2Role,
      contactManual: prospects.contactManual,
      contact2Manual: prospects.contact2Manual,
      company: prospects.company,
      niche: prospects.niche,
      companySummary: prospects.companySummary,
    })
    .from(prospects)
    .where(eq(prospects.id, prospectId))
    .limit(1);

  if (!prospect) {
    throw new Error(`Prospect ${prospectId} not found`);
  }

  const linkedinUrl = contactSlot === 2 ? prospect.contact2Linkedin : prospect.contactLinkedin;
  const isManual = contactSlot === 2 ? prospect.contact2Manual : prospect.contactManual;
  const name = contactSlot === 2 ? prospect.contact2Name : prospect.contactName;
  const role = contactSlot === 2 ? prospect.contact2Role : prospect.contactRole;

  // Path B: manual + name only -> discover URL by name, then scrape
  let effectiveUrl = linkedinUrl;
  if (isManual && !linkedinUrl) {
    if (!name) {
      console.warn(`[LinkedIn] Manual contact ${contactSlot} on prospect ${prospectId} has neither URL nor name, marking not_found`);
      await db
        .update(prospects)
        .set({ enrichmentStatus: "not_found", enrichedAt: new Date() })
        .where(eq(prospects.id, prospectId));
      throw new Error(`Manual contact slot ${contactSlot} has no name to search by`);
    }
    console.log(`[LinkedIn] Manual contact ${contactSlot} has name "${name}" but no URL, searching by name...`);
    const match = await discoverContactByName(name, prospect.company, prospect.niche, prospect.companySummary);
    if (!match) {
      await db
        .update(prospects)
        .set({ enrichmentStatus: "not_found", enrichedAt: new Date() })
        .where(eq(prospects.id, prospectId));
      throw new Error(`No LinkedIn profile matched name "${name}" at ${prospect.company}`);
    }
    // Save the discovered URL only (preserve typed name/role)
    const urlField = contactSlot === 2 ? { contact2Linkedin: match.linkedinUrl } : { contactLinkedin: match.linkedinUrl };
    await db.update(prospects).set(urlField).where(eq(prospects.id, prospectId));
    effectiveUrl = match.linkedinUrl;
  }

  // Path A or C and fall-through from B: require URL
  if (!effectiveUrl) {
    // Non-manual slot with no URL: discovery now lives in company enrichment, not here.
    await db
      .update(prospects)
      .set({ enrichmentStatus: "not_found", enrichedAt: new Date() })
      .where(eq(prospects.id, prospectId));
    throw new Error(
      `Contact ${contactSlot} has no LinkedIn URL. Run Enrich Company to auto-discover contacts first.`,
    );
  }

  const username = extractUsername(effectiveUrl);
  if (!username) {
    throw new Error(`Could not extract username from: ${effectiveUrl}`);
  }

  const result = await fetchLinkedInProfile(username);
  const personBrief = await generatePersonBrief(name, role, prospect.company, prospect.niche, result);
  const outputFields = buildOutputFields(contactSlot, result, personBrief);

  if (isManual) {
    console.log(`[LinkedIn] Manual contact ${contactSlot}, writing output fields only for prospect ${prospectId}`);
  }

  await db
    .update(prospects)
    .set({
      ...outputFields,
      enrichmentStatus: "enriched",
      enrichedAt: new Date(),
    })
    .where(eq(prospects.id, prospectId));

  return result;
}
