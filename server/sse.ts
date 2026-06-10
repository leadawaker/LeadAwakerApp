import type { Response } from "express";

type SseClient = Response;

// Map from accountId → set of connected SSE clients
const clients = new Map<number, Set<SseClient>>();

// Agency clients watching ALL accounts (no specific account filter)
const globalClients = new Set<SseClient>();

// Map from userId → set of connected SSE clients (for user-targeted events
// like notifications, which must NOT fan out to everyone on the account).
const userClients = new Map<number, Set<SseClient>>();

export function addClient(accountId: number, res: SseClient, global = false, userId?: number) {
  if (global) {
    globalClients.add(res);
  } else {
    if (!clients.has(accountId)) clients.set(accountId, new Set());
    clients.get(accountId)!.add(res);
  }
  if (userId != null) {
    if (!userClients.has(userId)) userClients.set(userId, new Set());
    userClients.get(userId)!.add(res);
  }
}

export function removeClient(accountId: number, res: SseClient, global = false, userId?: number) {
  if (global) {
    globalClients.delete(res);
  } else {
    clients.get(accountId)?.delete(res);
    if (clients.get(accountId)?.size === 0) clients.delete(accountId);
  }
  if (userId != null) {
    userClients.get(userId)?.delete(res);
    if (userClients.get(userId)?.size === 0) userClients.delete(userId);
  }
}

function sendToClient(res: SseClient, payload: string, cleanup: Set<SseClient>) {
  try {
    res.write(payload);
    (res as any).flush?.();
    (res as any).socket?.flush?.();
  } catch {
    cleanup.add(res);
  }
}

export function broadcast(accountId: number, event: string, data: unknown) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;

  // Send to account-specific clients
  const group = clients.get(accountId);
  if (group && group.size > 0) {
    const dead = new Set<SseClient>();
    group.forEach((res) => sendToClient(res, payload, dead));
    dead.forEach((res) => group.delete(res));
  }

  // Send to global (agency "all accounts") clients
  if (globalClients.size > 0) {
    const dead = new Set<SseClient>();
    globalClients.forEach((res) => sendToClient(res, payload, dead));
    dead.forEach((res) => globalClients.delete(res));
  }
}

/**
 * Send an event to a single user's connected clients only.
 * Used for user-private events (notifications) so they don't leak to other
 * users on the same account or to agency "all accounts" watchers.
 */
export function broadcastToUser(userId: number, event: string, data: unknown) {
  const group = userClients.get(userId);
  if (!group || group.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  const dead = new Set<SseClient>();
  group.forEach((res) => sendToClient(res, payload, dead));
  dead.forEach((res) => group.delete(res));
}
