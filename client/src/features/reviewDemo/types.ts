export type Skin = "sms" | "wa";

export interface DemoMessage {
  id: number;
  role: "ai" | "visitor";
  text: string;
  at: string | null;
}

export interface ReputationState {
  rating: number | null;
  outcome: "link_sent" | "callback_requested" | "declined" | null;
  managerAlerted: boolean;
}

export interface ReviewDemoState {
  token: string;
  firstName: string;
  language: string;
  company: string;
  agent: string;
  messages: DemoMessage[];
  done: boolean;
  restartsUsed: number;
  restartsMax: number;
  reputation: ReputationState | null;
}

export type ManagerEvent =
  | { id: string; kind: "alert"; stars: number; quote: string }
  | { id: string; kind: "review"; stars: number; text: string }
  | { id: string; kind: "draft"; draft: string | null };

/** Must match DEMO_REVIEW_URL in the engine (reputation_conversation.py). */
export const DEMO_REVIEW_URL = "https://g.page/r/demo-business/review";
