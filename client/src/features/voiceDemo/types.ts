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
/**
 * One distinct thing the caller raised. `update_call_summary` sends a whole
 * list at once, called once at the end of the call rather than live as she
 * goes: a function call always ends the response item it interrupts, so
 * calling it mid-conversation forced a pause she then narrated out loud
 * ("let me just organise the note"), audible and meaningless to the caller.
 * Calling it once, on a call that is already over, removes that pause. It
 * also means a caller who changes their mind mid-call (asks about a quote,
 * then decides to just leave a message) shows up as two items rather than
 * one overwriting the other.
 */
export interface SummaryItem {
  intent: CallIntent;
  interest?: string;
  notes?: string;
}

/** What the model reports it has understood, via the `update_call_summary` tool. */
export interface CallSummary {
  name?: string;
  items: SummaryItem[];
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

/**
 * Why a call is over. `null` is the caller pressing Hang up, which needs no
 * explaining; every other ending happened on its own and has to say so, or the
 * demo reads as having crashed.
 */
export type EndedReason =
  | null
  | "time_limit"
  | "dropped"
  /** She said goodbye and called `end_call`. */
  | "completed"
  /** Nobody answered for thirty seconds after she finished speaking. */
  | "silence";

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

// --- GPT-Live ---------------------------------------------------------------

/**
 * Language and accent in one value. Two locales can share a `VoiceLang` (the
 * prompt row, knowledge base and CRM copy they read) while sounding completely
 * different: pt-BR and pt-PT both read the Portuguese row, and only one of
 * them says "está a fazer".
 */
export type VoiceLocale = "en-GB" | "en-US" | "nl" | "pt-BR" | "pt-PT" | "es-ES";

export interface LocaleOption {
  id: VoiceLocale;
  label: string;
  language: VoiceLang;
  voice: string;
  /**
   * True where OpenAI documents no native voice for this language, so she
   * speaks it through a voice built for another one. Their guidance is
   * explicit that this is not guaranteed to hold the accent, so the setup
   * screen says so rather than implying parity.
   */
  needs_listening_test: boolean;
}

export interface LiveOptions {
  default_locale: VoiceLocale;
  locales: LocaleOption[];
  voices: { id: string; label: string }[];
}

export interface LiveSetup {
  locale: VoiceLocale;
  companyName: string;
  callerNumber: string;
  /** Overrides the locale's default voice. Empty means "use the default". */
  voice: string;
}
