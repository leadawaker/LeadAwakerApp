import { createContext, useContext } from "react";
import type { Thread, Interaction } from "../../hooks/useConversationsData";

// ─── Bubble width context ─────────────────────────────────────────────────────
const DEFAULT_BUBBLE_WIDTH = 60;
export const BubbleWidthContext = createContext<number>(DEFAULT_BUBBLE_WIDTH);
export function useBubbleWidth() { return useContext(BubbleWidthContext); }

export const HideAvatarsContext = createContext<boolean>(false);
export function useHideAvatars() { return useContext(HideAvatarsContext); }

/** Account timezone for displaying message timestamps (e.g. "Europe/Amsterdam") */
export const TimezoneContext = createContext<string | undefined>(undefined);
export function useTimezone() { return useContext(TimezoneContext); }

export interface ChatPanelProps {
  selected: Thread | null;
  loading?: boolean;
  sending: boolean;
  onSend: (leadId: number, content: string, type?: string) => Promise<void>;
  onToggleTakeover?: (leadId: number, manualTakeover: boolean) => Promise<void>;
  onRetry?: (failedMsg: Interaction) => Promise<void>;
  showContactPanel?: boolean;
  onShowContactPanel?: () => void;
  onNavigateToLead?: (leadId: number) => void;
  className?: string;
  /** Extra toolbar actions rendered in the header (e.g. +, Search, Settings) */
  headerActions?: React.ReactNode;
}

// ─── Sender run tracking ──────────────────────────────────────────────────────
export type SenderKey = "inbound" | "ai" | "human";

export interface MsgMeta {
  senderKey: SenderKey;
  isFirstInRun: boolean;
  isLastInRun: boolean;
}

// ─── Thread grouping ──────────────────────────────────────────────────────────
export interface ThreadGroup {
  threadId: string;
  threadIndex: number;
  msgs: Interaction[];
}
