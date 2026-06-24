// Google Business Profile adapter for Reputation v2 (public review response).
//
// Reuses the existing Google Cloud OAuth app (GOOGLE_CLIENT_ID/SECRET) and the
// calendar token-encryption helper. Only the redirect URI + scope differ. The
// connection is stored in the same Calendar_Connections table under
// provider="gbp" (so we get token storage + refresh for free); externalId holds
// the chosen location resource name `accounts/{a}/locations/{l}`.
//
// ⚠️ LIVE ACCESS NOT YET GRANTED: the Google Business Profile APIs require an
// approved API access request + quota (Gabriel is filing it). Until that lands,
// listLocations / listReviews / postReply will return 403 from Google. The code
// path is complete and exercised against the real endpoints the moment access is
// approved; set REVIEWS_MOCK=1 to short-circuit Google calls with fixtures for
// local UI/pipeline testing.

import { google } from "googleapis";
import type { CalendarConnection } from "@shared/schema";
import { encryptSecret, decryptSecret } from "../calendar/crypto";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID || "";
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || "";
const REDIRECT_URI =
  process.env.GOOGLE_REVIEWS_REDIRECT_URI ||
  "https://app.leadawaker.com/api/reviews/oauth/google/callback";

// business.manage covers reading + replying to reviews via the Business Profile APIs.
const SCOPES = [
  "https://www.googleapis.com/auth/business.manage",
  "https://www.googleapis.com/auth/userinfo.email",
];

// Business Profile REST hosts (no first-class googleapis client for the v4
// reviews surface, so we call REST directly with a refreshed access token).
const ACCOUNT_MGMT = "https://mybusinessaccountmanagement.googleapis.com/v1";
const BUSINESS_INFO = "https://mybusinessbusinessinformation.googleapis.com/v1";
const REVIEWS_API = "https://mybusiness.googleapis.com/v4";

export const REVIEWS_PROVIDER = "gbp";
export const MOCK = process.env.REVIEWS_MOCK === "1";

/** 4-5★ = positive (the only sentiment eligible for auto-posting). */
export function isPositiveRating(rating: number | null): boolean {
  return (rating ?? 0) >= 4;
}

export class ReviewsNotConfiguredError extends Error {}

export interface RemoteReview {
  externalReviewId: string;
  authorName: string;
  rating: number;          // 1-5
  reviewText: string;
  reviewCreatedAt: Date | null;
  hasReply: boolean;
}

export interface RemoteLocation {
  name: string;            // accounts/{a}/locations/{l}  (used for review calls)
  title: string;
}

function oauthClient() {
  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new ReviewsNotConfiguredError("Google OAuth is not configured (GOOGLE_CLIENT_ID/SECRET).");
  }
  return new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);
}

export function getAuthUrl(accountId: number): string {
  return oauthClient().generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state: String(accountId),
  });
}

/** Exchange the OAuth code for tokens; returns the connection fields to store. */
export async function exchangeCode(code: string): Promise<Partial<CalendarConnection>> {
  const client = oauthClient();
  const { tokens } = await client.getToken(code);
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const profile = await oauth2.userinfo.get();
  return {
    provider: REVIEWS_PROVIDER,
    status: "connected",
    displayName: profile.data.email || "Google Business Profile",
    oauthTokensEncrypted: encryptSecret(tokens),
  };
}

/**
 * Return a fresh access token for a stored connection, refreshing + re-persisting
 * if needed. `persist` writes the rotated refresh/access tokens back to storage.
 */
async function accessTokenFor(
  conn: CalendarConnection,
  persist?: (encrypted: string) => Promise<void>,
): Promise<string> {
  if (!conn.oauthTokensEncrypted) throw new ReviewsNotConfiguredError("Google Business Profile not connected.");
  const tokens = decryptSecret(conn.oauthTokensEncrypted);
  const client = oauthClient();
  client.setCredentials(tokens);
  // googleapis refreshes automatically when the access token is stale.
  const { token } = await client.getAccessToken();
  const updated = client.credentials;
  if (persist && updated && JSON.stringify(updated) !== JSON.stringify(tokens)) {
    await persist(encryptSecret(updated));
  }
  if (!token) throw new ReviewsNotConfiguredError("Could not obtain a Google access token.");
  return token;
}

async function gfetch(url: string, accessToken: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  const body = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const msg = body?.error?.message || `Google API ${res.status}`;
    const err: any = new Error(msg);
    err.status = res.status;
    throw err;
  }
  return body;
}

/** List the connected Google account's locations so the user can pick one. */
export async function listLocations(
  conn: CalendarConnection,
  persist?: (encrypted: string) => Promise<void>,
): Promise<RemoteLocation[]> {
  if (MOCK) {
    return [{ name: "accounts/123/locations/456", title: "Demo Home Improvements (mock)" }];
  }
  const token = await accessTokenFor(conn, persist);
  const accounts = await gfetch(`${ACCOUNT_MGMT}/accounts`, token);
  const out: RemoteLocation[] = [];
  for (const acct of accounts.accounts || []) {
    const acctName: string = acct.name; // "accounts/{id}"
    const locRes = await gfetch(
      `${BUSINESS_INFO}/${acctName}/locations?readMask=name,title&pageSize=100`,
      token,
    );
    for (const loc of locRes.locations || []) {
      // loc.name is "locations/{id}"; the v4 reviews API needs "accounts/{a}/locations/{l}".
      const locId = String(loc.name || "").split("/").pop();
      out.push({ name: `${acctName}/locations/${locId}`, title: loc.title || locId || "Location" });
    }
  }
  return out;
}

/** Fetch reviews for the connection's selected location (externalId). */
export async function listReviews(
  conn: CalendarConnection,
  persist?: (encrypted: string) => Promise<void>,
): Promise<RemoteReview[]> {
  const locationName = conn.externalId;
  if (!locationName) throw new ReviewsNotConfiguredError("No Google Business Profile location selected.");
  if (MOCK) return mockReviews();

  const token = await accessTokenFor(conn, persist);
  const reviews: RemoteReview[] = [];
  let pageToken: string | undefined;
  do {
    const url = `${REVIEWS_API}/${locationName}/reviews?pageSize=50${pageToken ? `&pageToken=${pageToken}` : ""}`;
    const page = await gfetch(url, token);
    for (const r of page.reviews || []) {
      reviews.push({
        externalReviewId: r.reviewId || String(r.name || "").split("/").pop() || "",
        authorName: r.reviewer?.displayName || "",
        rating: STAR_MAP[r.starRating] ?? 0,
        reviewText: r.comment || "",
        reviewCreatedAt: r.createTime ? new Date(r.createTime) : null,
        hasReply: !!r.reviewReply,
      });
    }
    pageToken = page.nextPageToken;
  } while (pageToken);
  return reviews;
}

/** Post (or update) the owner reply to a single review. */
export async function postReply(
  conn: CalendarConnection,
  externalReviewId: string,
  comment: string,
  persist?: (encrypted: string) => Promise<void>,
): Promise<void> {
  const locationName = conn.externalId;
  if (!locationName) throw new ReviewsNotConfiguredError("No Google Business Profile location selected.");
  if (MOCK) return;

  const token = await accessTokenFor(conn, persist);
  await gfetch(`${REVIEWS_API}/${locationName}/reviews/${externalReviewId}/reply`, token, {
    method: "PUT",
    body: JSON.stringify({ comment }),
  });
}

// Google returns star ratings as enum strings.
const STAR_MAP: Record<string, number> = {
  ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5,
};

function mockReviews(): RemoteReview[] {
  return [
    {
      externalReviewId: "mock-neg-1",
      authorName: "Jan de Vries",
      rating: 1,
      reviewText: "Kitchen install was delayed three weeks and no one called me back. Very disappointed.",
      reviewCreatedAt: new Date(Date.now() - 2 * 864e5),
      hasReply: false,
    },
    {
      externalReviewId: "mock-pos-1",
      authorName: "Mariska B.",
      rating: 5,
      reviewText: "Super netjes werk en vriendelijke monteurs. Aanrader!",
      reviewCreatedAt: new Date(Date.now() - 3 * 864e5),
      hasReply: false,
    },
  ];
}
