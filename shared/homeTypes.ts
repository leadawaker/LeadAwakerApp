/** "all" (the default) has no earlier period to compare with. Weeks start on Monday. */
export const HOME_PERIODS = ["all", "year", "month", "week", "today"] as const;
export type HomePeriod = (typeof HOME_PERIODS)[number];
export type HomeChannel = "phone" | "whatsapp" | "sms" | "website";
export const HOME_CHANNELS: readonly HomeChannel[] = ["phone", "whatsapp", "sms", "website"];
/** The Home page's channel switcher: null on the server = all channels. */
export type HomeChannelFilter = "all" | HomeChannel;
/** Chart granularity: month for all/year, day for month/week, hour for today. */
export type HomeBucket = "month" | "day" | "hour";
export interface Compared { value: number; previous: number }
/** `day` is the bucket key: YYYY-MM (month), YYYY-MM-DD (day) or YYYY-MM-DD HH (hour). */
export interface DayPoint { day: string; value: number }

export interface HomeServices { phone: boolean; whatsapp: boolean; website: boolean; reactivation: boolean; reputation: boolean; social: boolean; sms: boolean }

export interface AttentionRow {
  kind: "callback" | "transfer_failed" | "handoff";
  channel: HomeChannel;
  leadId: number | null;
  callId: string | null;
  name: string | null;
  at: string;
  /** Stable id for "Mark as handled": the call id, or "<lead id>:<handoff epoch ms>". */
  ref: string | null;
}
/** One Recent activity row: a call, or a lead's latest message on a text channel. Newest first. */
export interface RecentItem {
  channel: HomeChannel;
  callId: string | null;
  leadId: number | null;
  name: string | null;
  callerNumber: string | null;
  at: string;
  /** Call headline (as on the Voice calls inbox) or the message snippet. */
  text: string | null;
  /** Calls only. */
  outcome: CallOutcome | null;
}
export interface HomeOverview {
  conversations: Compared; bookings: Compared; callbacks: Compared; newContacts: Compared;
  waiting: number;
  byChannel: { channel: HomeChannel; conversations: number; bookings: number }[];
  perDay: DayPoint[];
  /** Open to-dos, not tied to the period. Filtered by the channel param, like perDay and recent. */
  attention: AttentionRow[];
  recent: RecentItem[];
}
export type CallOutcome = "booked" | "callback" | "transferred" | "hung_up" | "answered";
export interface HomePhone {
  calls: Compared; booked: Compared; transferred: Compared; avgSeconds: Compared;
  transfersFailed: number;
  perDay: DayPoint[];
  outcomes: { outcome: CallOutcome; count: number }[];
  outOfHoursPct: number | null;
  screened: number;
  /** Typical gap from the caller's last word to hers, in ms. Null before a measured call. */
  latencyMs: number | null;
  /** Owner only (the route strips it for everyone else). Null before a priced call. */
  cost?: { total: number; perMinute: number | null } | null;
  recent: { callId: string; name: string | null; callerNumber: string | null; outcome: CallOutcome; seconds: number | null; at: string; headline: string | null }[];
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
/** Live panels of the Reactivation tab. Not tied to the period: "now", "today" and "next". */
export interface HomeReactivationLive {
  /** Timezone the times should be shown in (the account's, or the agency's for all accounts). */
  tz: string;
  /** Booked calls from now on, soonest first. */
  upcoming: { leadId: number; name: string | null; campaign: string | null; at: string; handoff: boolean }[];
  /** Latest messages either way, newest first. */
  activity: { id: number; leadId: number; name: string | null; campaign: string | null; direction: "in" | "out"; preview: string; at: string }[];
  bumps: {
    /** First messages and bumps sent since midnight. stage 0 = first message. */
    sentToday: number;
    sentByStage: { stage: number; count: number }[];
    /** Bumps still due before midnight (overdue ones included). */
    dueToday: number;
    /** The next scheduled bumps, soonest first. */
    next: { leadId: number; name: string | null; campaign: string | null; stage: number; at: string }[];
  };
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
