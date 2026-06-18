import { apiFetch, API_BASE } from "@/lib/apiUtils";

export type CalendarProviderId = "google" | "outlook" | "calcom" | "calendly" | "ical";
export type CalendarAuthType = "oauth" | "apikey" | "url";

export interface CalendarProviderMeta {
  id: CalendarProviderId;
  authType: CalendarAuthType;
  canPush: boolean;
  canFreeBusy: boolean;
}

export interface CalendarConnection {
  id: number;
  accountId: number;
  provider: CalendarProviderId;
  status: string;
  displayName: string | null;
  calendarId: string | null;
  timezone: string | null;
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

/** Re-reveals previously provisioned Cal.diy credentials, or null if never provisioned. */
export const fetchCaldiyCredentials = async (accountId: number): Promise<CaldiyCredentials | null> => {
  const res = await apiFetch(`/api/calendar/caldiy-credentials?accountId=${accountId}`);
  if (!res.ok) throw new Error("Failed to load booking page credentials");
  return res.json();
};
