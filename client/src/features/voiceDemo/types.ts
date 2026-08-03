export type VoiceLang = "en" | "nl" | "pt";

export type CallState = "idle" | "connecting" | "live" | "ended";

/** Who currently holds the floor, derived from realtime turn-detection events. */
export type Floor = "connecting" | "listening" | "speaking";

export interface Turn {
  id: string;
  side: "them" | "you";
  text: string;
  /** Still streaming in; rendered dimmed until the final transcript lands. */
  pending: boolean;
}

/**
 * A row the engine confirms it wrote to the CRM, returned by `/voice/relay`.
 * The CRM panel renders these rather than reading CRM data back, so the demo
 * needs no authenticated read path.
 */
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
