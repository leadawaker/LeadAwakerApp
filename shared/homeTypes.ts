export const HOME_PERIODS = ["month", "7d", "30d", "last_month"] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];
export type HomeChannel = "phone" | "whatsapp" | "sms" | "website";
export type HomeTab = "overview" | "phone" | "whatsapp" | "website" | "reactivation" | "reputation" | "social";
export interface Compared { value: number; previous: number }
export interface DayPoint { day: string; value: number }

export interface HomeServices { phone: boolean; whatsapp: boolean; website: boolean; reactivation: boolean; reputation: boolean; social: boolean; sms: boolean }

export interface AttentionRow {
  kind: "callback" | "transfer_failed" | "handoff";
  channel: HomeChannel;
  leadId: number | null;
  callId: string | null;
  name: string | null;
  at: string;
}
export interface ActivityRow {
  kind: "booked" | "call" | "transferred" | "chat_started" | "followup_sent";
  channel: HomeChannel | "booking_page" | "unknown";
  leadId: number | null;
  callId: string | null;
  name: string | null;
  at: string;
}
export interface HomeOverview {
  conversations: Compared; bookings: Compared; callbacks: Compared; newContacts: Compared;
  waiting: number;
  byChannel: { channel: HomeChannel; conversations: number; bookings: number }[];
  perDay: DayPoint[];
  attention: AttentionRow[];
  activity: ActivityRow[];
}
export type CallOutcome = "booked" | "callback" | "transferred" | "hung_up" | "other";
export interface HomePhone {
  calls: Compared; booked: Compared; transferred: Compared; avgSeconds: Compared;
  transfersFailed: number;
  perDay: DayPoint[];
  outcomes: { outcome: CallOutcome; count: number }[];
  outOfHoursPct: number | null;
  screened: number;
  recent: { callId: string; name: string | null; callerNumber: string | null; outcome: CallOutcome; seconds: number | null; at: string }[];
}
export interface RecentLead { leadId: number; name: string | null; at: string; snippet: string }
export interface HomeWhatsapp {
  conversations: Compared; messagesIn: Compared; messagesOut: Compared; bookings: Compared; handedOff: Compared;
  perDay: DayPoint[];
  followUps: number;
  /** followUpShare: % of after-call follow-ups sent by SMS instead of WhatsApp; null when none were sent. */
  sms: { sent: number; delivered: number; failed: number; followUpShare: number | null } | null;
  sender: { connected: boolean; quality: string | null } | null;
  recent: RecentLead[];
}
export interface HomeWebsite {
  chats: Compared; contacts: Compared; bookings: Compared;
  perDay: DayPoint[];
  recent: RecentLead[];
}
export interface HomeReactivation {
  contacted: Compared; replied: Compared; bookings: Compared;
  costPerBooking: number | null;
  perDay: { day: string; replies: number; bookings: number }[];
  pipeline: { status: string; count: number }[];
  campaigns: { id: number; name: string }[];
}
export interface HomeReputation {
  /** Google Business Profile is connected for the account (always false in the all-accounts view). */
  connected: boolean;
  reviews: Compared;
  avgRating: { value: number | null; previous: number | null };
  replied: Compared;
  /** Reviews with no posted reply right now. Not tied to the period. */
  awaitingReply: number;
  requestsSent: Compared;
  ratings: { rating: number; count: number }[];
  perDay: DayPoint[];
  recent: { id: number; author: string | null; rating: number | null; text: string; replied: boolean; at: string }[];
}
export interface HomeSocial {
  /** An Instagram account is connected (always false in the all-accounts view). */
  connected: boolean;
  conversations: Compared; messagesIn: Compared; messagesOut: Compared; bookings: Compared;
  perDay: DayPoint[];
  recent: RecentLead[];
}
