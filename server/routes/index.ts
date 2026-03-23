/**
 * Route orchestrator — imports and registers all domain-specific route modules.
 * Replaces the old monolithic server/routes.ts.
 *
 * Signature matches the original: registerRoutes(httpServer, app): Promise<Server>
 */
import type { Express } from "express";
import { type Server } from "http";

import { registerAuthAndAdminRoutes } from "./auth";
import { registerAccountsRoutes } from "./accounts";
import { registerCampaignsRoutes } from "./campaigns";
import { registerLeadsRoutes } from "./leads";
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

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
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

  // ── One-time startup tasks ────────────────────────────────────────────
  // Seed default AI agents (idempotent)
  await seedAiAgents();

  // Seed support bot prompt into Prompt Library (idempotent)
  await seedSupportBotPrompt();

  // ── Background notifiers ──────────────────────────────────────────────
  startSupportCleanup();            // daily support session cleanup
  startTaskNotifiers();             // task due-soon (30min) + task overdue (30min)
  startAutomationFailureNotifier(); // automation failure check (5min)
  startCampaignFinishedNotifier();  // campaign finished check (10min)

  return httpServer;
}
