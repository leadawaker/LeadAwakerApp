import type { Response } from "express";

type SseClient = Response;

// Map from accountId → set of connected SSE clients
const clients = new Map<number, Set<SseClient>>();

export function addClient(accountId: number, res: SseClient) {
  if (!clients.has(accountId)) clients.set(accountId, new Set());
  clients.get(accountId)!.add(res);
}

export function removeClient(accountId: number, res: SseClient) {
  clients.get(accountId)?.delete(res);
  if (clients.get(accountId)?.size === 0) clients.delete(accountId);
}

export function broadcast(accountId: number, event: string, data: unknown) {
  const group = clients.get(accountId);
  if (!group || group.size === 0) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  group.forEach((res) => {
    try {
      res.write(payload);
      // Force-flush to bypass any TCP Nagle buffering
      (res as any).flush?.();
      (res as any).socket?.flush?.();
    } catch {
      group.delete(res);
    }
  });
}
