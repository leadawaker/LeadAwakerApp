/**
 * Route orchestrator — imports and registers all domain-specific route modules.
 * Replaces the old monolithic server/routes.ts.
 *
 * Signature matches the original: registerRoutes(httpServer, app): Promise<Server>
 */
import type { Express, Request, Response } from "express";
import { type Server } from "http";

import { registerAuthAndAdminRoutes } from "./auth";
import { registerAccountsRoutes } from "./accounts";
import { registerCampaignsRoutes } from "./campaigns";
import { registerLeadsRoutes, startBookingReminders } from "./leads";
import { registerConversationsRoutes } from "./conversations";
import { registerTasksRoutes, startTaskNotifiers } from "./tasks";
import { registerBillingRoutes } from "./billing";
import {
  registerAiAgentsRoutes,
  startSupportCleanup,
  seedSupportBotPrompt,
  seedAiAgents,
  startAutomationFailureNotifier,
  startCampaignFinishedNotifier,
} from "./ai-agents";
import { registerGmailRoutes } from "./gmail";
import { registerDemoRoutes } from "./demo";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Python engine proxy (/webhook/* → port 8100) ──────────────────────
  // Forward all /webhook/* requests to the Python engine (port 8100).
  // Uses fetch so the already-parsed body (req.body) is re-serialized cleanly.
  app.use("/webhook", async (req: Request, res: Response) => {
    const targetUrl = `http://localhost:8100${req.originalUrl}`;
    const body = req.method !== "GET" && req.method !== "HEAD"
      ? JSON.stringify(req.body)
      : undefined;
    const upstream = await fetch(targetUrl, {
      method: req.method,
      headers: { "content-type": "application/json" },
      body,
    });
    const data = await upstream.text();
    res.status(upstream.status).set("content-type", upstream.headers.get("content-type") || "application/json").send(data);
  });

  // ── Core routes ───────────────────────────────────────────────────────
  registerAuthAndAdminRoutes(app);
  registerAccountsRoutes(app);
  registerCampaignsRoutes(app);
  registerLeadsRoutes(app);
  registerConversationsRoutes(app);
  registerTasksRoutes(app);
  registerBillingRoutes(app);
  registerAiAgentsRoutes(app);
  registerGmailRoutes(app);
  registerDemoRoutes(app);

  // ── One-time startup tasks ────────────────────────────────────────────
  // Seed default AI agents (idempotent)
  await seedAiAgents();

  // Seed support bot prompt into Prompt Library (idempotent)
  await seedSupportBotPrompt();

  // ── Background notifiers ──────────────────────────────────────────────
  startSupportCleanup();            // daily support session cleanup
  startTaskNotifiers();             // task due-soon (30min) + task overdue (30min)
  startBookingReminders();          // booking reminder 1h before call (10min check)
  startAutomationFailureNotifier(); // automation failure check (5min)
  startCampaignFinishedNotifier();  // campaign finished check (10min)

  return httpServer;
}
