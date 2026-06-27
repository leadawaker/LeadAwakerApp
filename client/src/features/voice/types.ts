// Missed-Call Text-Back workspace — shared types (mock-data UI, first page).
// Mirrors specs/missed-call-textback: a forwarded missed call → AI WhatsApp
// text-back from the client's own number → AI conversation, with an optional
// transcribed voicemail injected into context.

export type CallStatus = "booked" | "recovered" | "texted" | "noreply";

export type ThreadMsg = {
  id: string;
  from: "ai" | "lead";
  text: string;
  time: string;
  /** the AI's first WhatsApp touch fired automatically from the missed call */
  auto?: boolean;
};

export type Voicemail = {
  /** human duration label, e.g. "0:18" */
  duration: string;
  /** Whisper transcript, stored as the inbound "[Voicemail]" interaction */
  transcript: string;
  /** decorative waveform heights (0–1), purely for the player UI */
  wave: number[];
};

export type MissedCall = {
  id: string;
  name: string | null;     // null → show the phone number as the title
  phone: string;
  ini: string;
  status: CallStatus;
  /** relative age for the list row, e.g. "2 min", "1h", "Yesterday" */
  ago: string;
  /** clock time of the missed call, e.g. "9:42 AM" */
  time: string;
  /** day bucket for the detail header, e.g. "Today" */
  day: string;
  /** approximate hours-ago, drives the list grouping */
  ageHours: number;
  voicemail?: Voicemail;
  thread: ThreadMsg[];
};

export type VoiceView = { key: string; label: string; count: number | null };
