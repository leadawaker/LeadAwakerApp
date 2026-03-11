# Implementation Plan: Real-Time Messages via SSE

## Overview

Replace the 15-second polling in the Conversations view with Server-Sent Events (SSE). The server maintains a registry of connected clients. When a new interaction is saved (via `POST /api/interactions` or any internal write), it pushes the new message to all relevant connected clients immediately. No new npm packages required.

---

## Phase 1: Server-Side SSE Endpoint

Add an SSE endpoint to Express and a lightweight in-memory client registry. Hook into `createInteraction` to broadcast new messages.

### Tasks

- [ ] Create `server/sse.ts` — client registry module
  - [ ] Export a `Map<accountId, Set<Response>>` to track connected clients
  - [ ] Export `addClient(accountId, res)` and `removeClient(accountId, res)` helpers
  - [ ] Export `broadcast(accountId, eventName, data)` — sends SSE to all clients for that account
- [ ] Add SSE route `GET /api/interactions/stream` in `server/routes.ts`
  - [ ] Set headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
  - [ ] Extract `accountId` from session (use `scopeToAccount` middleware)
  - [ ] Call `addClient(accountId, res)` on connect
  - [ ] Send a `ping` event every 30s to keep the connection alive
  - [ ] Call `removeClient(accountId, res)` on `req.on('close')`
- [ ] Hook `broadcast` into `POST /api/interactions` in `server/routes.ts`
  - [ ] After `storage.createInteraction(...)` succeeds, call `broadcast(accountId, 'new_interaction', interaction)`
  - [ ] `accountId` comes from `interaction.accountsId`

### Technical Details

```ts
// server/sse.ts
type SseClient = Response;
const clients = new Map<number, Set<SseClient>>();

export function addClient(accountId: number, res: SseClient) {
  if (!clients.has(accountId)) clients.set(accountId, new Set());
  clients.get(accountId)!.add(res);
}

export function removeClient(accountId: number, res: SseClient) {
  clients.get(accountId)?.delete(res);
}

export function broadcast(accountId: number, event: string, data: unknown) {
  const group = clients.get(accountId);
  if (!group) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of group) {
    res.write(payload);
  }
}
```

```ts
// In routes.ts — SSE endpoint (add before the POST /api/interactions route)
app.get("/api/interactions/stream", requireAuth, scopeToAccount, (req, res) => {
  const accountId = (req as any).forcedAccountId ?? Number(req.query.accountId);
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  addClient(accountId, res);

  const keepAlive = setInterval(() => {
    res.write("event: ping\ndata: {}\n\n");
  }, 30_000);

  req.on("close", () => {
    clearInterval(keepAlive);
    removeClient(accountId, res);
  });
});
```

```ts
// In routes.ts — after createInteraction succeeds
const interaction = await storage.createInteraction(parsed.data);
broadcast(interaction.accountsId, "new_interaction", toDbKeys(interaction as any, interactions));
res.status(201).json(toDbKeys(interaction as any, interactions));
```

---

## Phase 2: Client-Side SSE Hook

Create a React hook that opens the SSE connection and appends new messages to the local state.

### Tasks

- [ ] Create `client/src/features/conversations/hooks/useInteractionStream.ts`
  - [ ] Opens `EventSource('/api/interactions/stream')`
  - [ ] Listens for `new_interaction` events
  - [ ] Accepts a callback `onNewInteraction(interaction)` to update parent state
  - [ ] Closes `EventSource` on component unmount
- [ ] Update `useConversationsData.ts`
  - [ ] Remove the 15-second `setInterval` polling
  - [ ] Keep the initial `loadData()` on mount (for hydration)
  - [ ] Use `useInteractionStream` to append new interactions in real time
- [ ] Update `useApiData.ts`
  - [ ] Remove the 15-second polling from `useInteractions()` hook
  - [ ] Keep the initial fetch

### Technical Details

```ts
// client/src/features/conversations/hooks/useInteractionStream.ts
import { useEffect } from "react";

export function useInteractionStream(onNewInteraction: (interaction: any) => void) {
  useEffect(() => {
    const es = new EventSource("/api/interactions/stream");

    es.addEventListener("new_interaction", (e) => {
      const interaction = JSON.parse(e.data);
      onNewInteraction(interaction);
    });

    es.onerror = () => {
      // Browser auto-reconnects after error — no manual handling needed
    };

    return () => es.close();
  }, [onNewInteraction]);
}
```

The `onNewInteraction` callback in `useConversationsData.ts` should:
1. Check if the new interaction belongs to the currently selected lead
2. If yes, append it to the local `interactions` list (avoid duplicates by checking `id`)
3. Also update the conversation list's `lastMessage` if needed

---

## Phase 3: Filter by Lead & Deduplication

Ensure incoming SSE events only update the correct lead's chat and don't create duplicate messages.

### Tasks

- [ ] In the `onNewInteraction` handler, filter by `leads_id` matching the selected lead
- [ ] Deduplicate: before appending, check if `interactions.some(i => i.id === newInteraction.id)`
- [ ] Update the conversation list sidebar: if a new interaction arrives for a different lead, update that lead's preview text and badge count without switching the view
- [ ] Scroll chat to bottom when a new message arrives (if already at bottom)

### Technical Details

```ts
// Deduplication + filter pattern
function handleNewInteraction(newMsg: Interaction) {
  // Update full list for sidebar preview
  setAllInteractions(prev => {
    if (prev.some(i => i.id === newMsg.id)) return prev; // dedupe
    return [...prev, newMsg];
  });

  // Only update active chat if it's for the selected lead
  if (newMsg.leads_id === selectedLeadId) {
    setCurrentInteractions(prev => {
      if (prev.some(i => i.id === newMsg.id)) return prev;
      return [...prev, newMsg];
    });
  }
}
```

---

## Phase 4: Twilio Webhook — External Messages

Messages received from leads via Twilio are saved by the Twilio webhook handler, not by `POST /api/interactions`. Those must also trigger `broadcast`.

### Tasks

- [ ] Find the Twilio webhook route in `server/routes.ts` (search for `/webhook` or `/twilio`)
- [ ] After any `createInteraction` call in the webhook handler, add `broadcast(accountId, "new_interaction", interaction)`
- [ ] Verify the accountId is available at that point in the handler

### Technical Details

The Twilio webhook likely saves an inbound interaction and an AI-generated response. Both calls to `createInteraction` should broadcast. The `accountId` will come from the matched lead/campaign.
