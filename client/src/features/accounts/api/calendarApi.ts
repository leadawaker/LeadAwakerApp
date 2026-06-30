import { apiFetch, API_BASE } from "@/lib/apiUtils";

export type CalendarProviderId = "google" | "outlook" | "calcom" | "calendly" | "ical" | "apple";
export type CalendarAuthType = "oauth" | "apikey" | "url" | "caldav";

export interface CalendarProviderMeta {
  id: CalendarProviderId;
  authType: CalendarAuthType;
  canPush: boolean;
  canFreeBusy: boolean;
}

export interface CalendarConnection {
  id: number;
  accountId: number;
  provider: CalendarProviderId | "caldiy";
  status: string;
  displayName: string | null;
  calendarId: string | null;
  timezone: string | null;
  customDomain?: string | null;
  customDomainStatus?: string | null;
  lastError: string | null;
  lastSyncAt: string | null;
}

export const fetchCalendarProviders = async (): Promise<CalendarProviderMeta[]> => {
  const res = await apiFetch("/api/calendar/providers");
  if (!res.ok) throw new Error("Failed to load calendar providers");
  return res.json();
};

export const fetchCalendarConnections = async (accountId: number): Promise<CalendarConnection[]> => {
  const res = await apiFetch(`/api/calendar/connections?accountId=${accountId}`);
  if (!res.ok) throw new Error("Failed to load calendar connections");
  return res.json();
};

/** OAuth providers: full-page redirect to the provider consent screen. */
export const startCalendarOAuth = (provider: CalendarProviderId, accountId: number) => {
  window.location.href = `${API_BASE}/api/calendar/oauth/${provider}/authorize?accountId=${accountId}`;
};

/** API-key (calcom/calendly) or URL (ical) connect. */
export const connectCalendarKey = async (
  provider: CalendarProviderId,
  accountId: number,
  payload: { apiKey?: string; icalUrl?: string },
): Promise<CalendarConnection> => {
  const res = await apiFetch(`/api/calendar/connect/${provider}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, ...payload }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to connect calendar");
  }
  return res.json();
};

export const disconnectCalendar = async (accountId: number, provider: CalendarProviderId): Promise<void> => {
  const res = await apiFetch("/api/calendar/disconnect", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, provider }),
  });
  if (!res.ok) throw new Error("Failed to disconnect calendar");
};

export interface CaldiyCredentials {
  username: string;
  password: string;
  bookingUrl: string;
}

/** Creates (or re-provisions, resetting the password) a Cal.diy booking user for this account. */
export const provisionBookingPage = async (accountId: number): Promise<CaldiyCredentials> => {
  const res = await apiFetch("/api/calendar/provision-booking", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to provision booking page");
  }
  return res.json();
};

/** Apple / CalDAV connect: submits username + app-specific password to validate and inject. */
export const connectCalendarCaldav = async (
  accountId: number,
  payload: { kind: "apple" | "caldav"; username: string; password: string; url?: string },
): Promise<{ ok: boolean; integration: string; externalId: string }> => {
  const res = await apiFetch("/api/calendar/connect-caldav", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ accountId, ...payload }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to connect Apple / CalDAV calendar");
  }
  return res.json();
};

/** Re-reveals previously provisioned Cal.diy credentials, or null if never provisioned. */
export const fetchCaldiyCredentials = async (accountId: number): Promise<CaldiyCredentials | null> => {
  const res = await apiFetch(`/api/calendar/caldiy-credentials?accountId=${accountId}`);
  if (!res.ok) throw new Error("Failed to load booking page credentials");
  return res.json();
};

// ── White-label booking domain ───────────────────────────────────────────────

export interface CustomDomainState {
  customDomain: string | null;
  customDomainStatus: string | null;
  cnameName: string;
  cnameTarget: string;
}

export const saveCustomDomain = async (accountId: number, domain: string): Promise<CustomDomainState> => {
  const res = await apiFetch(`/api/accounts/${accountId}/custom-domain`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ domain }),
  });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to save domain");
  }
  return res.json();
};

export const verifyCustomDomain = async (accountId: number): Promise<CustomDomainState & { verified: boolean }> => {
  const res = await apiFetch(`/api/accounts/${accountId}/custom-domain/verify`, { method: "POST" });
  if (!res.ok) {
    const msg = await res.json().catch(() => ({}));
    throw new Error(msg.message || "Failed to verify domain");
  }
  return res.json();
};

export const removeCustomDomain = async (accountId: number): Promise<void> => {
  const res = await apiFetch(`/api/accounts/${accountId}/custom-domain`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to remove domain");
};
