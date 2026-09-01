export type VoiceLang = "en" | "nl" | "pt";

export type CallState = "idle" | "connecting" | "live" | "ended";

/** Who currently holds the floor, derived from realtime turn-detection events. */
export type Floor = "connecting" | "listening" | "speaking";

export interface Turn {
  id: string;
  side: "them" | "you";
  text: string;
  /**
   * Still streaming in, or reserved and not yet transcribed. A pending turn
   * with no text is a placeholder holding this turn's position in the
   * transcript while its words are still being transcribed.
   */
  pending: boolean;
}

/**
 * A row the engine confirms it wrote to the CRM, returned by `/voice/relay`.
 * The CRM panel renders these rather than reading CRM data back, so the demo
 * needs no authenticated read path.
 */
/** What the model reports it has understood, via the `update_call_summary` tool. */
export interface CallSummary {
  intent?: CallIntent;
  name?: string;
  interest?: string;
  notes?: string;
}

export type CallIntent =
  | "book_appointment"
  | "request_quote"
  | "ask_advice"
  | "existing_customer"
  | "complaint_or_fault"
  | "not_relevant";

/** A confirmed appointment: `spoken` is what she said, `iso` drives the calendar. */
export interface Booking {
  spoken: string;
  iso: string | null;
}

/** Why a call is over — a hang-up says nothing, the other two need explaining. */
export type EndedReason = null | "time_limit" | "dropped";

export interface CrmReceipt {
  lead_id: number | null;
  interaction_id?: number;
  who?: string;
  direction?: "inbound" | "outbound";
  content?: string;
  type?: string;
  created_lead: boolean;
  booked_slot?: string;
  booking_failed?: boolean;
  booked_iso?: string | null;
  summary?: CallSummary;
}

export interface CallSetup {
  language: VoiceLang;
  companyName: string;
  callerNumber: string;
  /** Realtime model and voice, validated server-side against an allow-list. */
  model: string;
  voice: string;
  speed: number;
}

/** Model and voice ids this account can actually use, served by /voice/options. */
export interface VoiceOptions {
  models: string[];
  voices: string[];
}
