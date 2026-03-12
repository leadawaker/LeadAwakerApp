/**
 * Chat Sync Bus — lightweight singleton for syncing useAgentChat state
 * between the widget and full-page Conversations view.
 *
 * When two useAgentChat instances share the same sessionId, one instance's
 * state changes (messages, streaming, streamingText) are broadcast to the other.
 * Each listener has an identity ref so broadcasts skip the sender.
 */

import type { AgentMessage } from "./useAgentChat";

export interface ChatSyncPayload {
  messages: AgentMessage[];
  streaming: boolean;
  streamingText: string;
}

type SyncListener = (data: ChatSyncPayload) => void;

/** Map of sessionId → Set of { listener, id } */
const registry = new Map<
  string,
  Set<{ listener: SyncListener; id: symbol }>
>();

/**
 * Subscribe to sync updates for a specific session.
 * Returns an unsubscribe function.
 */
export function subscribeSyncBus(
  sessionId: string,
  listener: SyncListener,
  id: symbol,
): () => void {
  if (!registry.has(sessionId)) {
    registry.set(sessionId, new Set());
  }
  const entry = { listener, id };
  registry.get(sessionId)!.add(entry);

  return () => {
    const set = registry.get(sessionId);
    if (set) {
      set.delete(entry);
      if (set.size === 0) registry.delete(sessionId);
    }
  };
}

/**
 * Broadcast state to all listeners on the same sessionId,
 * except the sender (identified by symbol id).
 */
export function broadcastSync(
  sessionId: string,
  data: ChatSyncPayload,
  senderId: symbol,
): void {
  const set = registry.get(sessionId);
  if (!set) return;
  Array.from(set).forEach((entry) => {
    if (entry.id !== senderId) {
      entry.listener(data);
    }
  });
}

/**
 * Check how many listeners exist for a session.
 * Useful for deciding whether to broadcast (skip if only 1 listener = no peer).
 */
export function listenerCount(sessionId: string): number {
  return registry.get(sessionId)?.size ?? 0;
}
