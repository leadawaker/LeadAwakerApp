import type { Response } from "express";

type SseClient = Response;

// Map from accountId → set of connected SSE clients
const clients = new Map<number, Set<SseClient>>();

// Agency clients watching ALL accounts (no specific account filter)
const globalClients = new Set<SseClient>();

export function addClient(accountId: number, res: SseClient, global = false) {
  if (global) {
    globalClients.add(res);
  } else {
    if (!clients.has(accountId)) clients.set(accountId, new Set());
    clients.get(accountId)!.add(res);
  }
}

export function removeClient(accountId: number, res: SseClient, global = false) {
  if (global) {
    globalClients.delete(res);
  } else {
    clients.get(accountId)?.delete(res);
    if (clients.get(accountId)?.size === 0) clients.delete(accountId);
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
