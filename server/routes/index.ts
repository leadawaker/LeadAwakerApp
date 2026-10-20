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
} from "./ai-agents";
import { registerGmailRoutes } from "./gmail";
import { registerCalendarRoutes } from "./calendar";
import { registerReviewsRoutes } from "./reviews";
import { startReviewPoller } from "../reviews/poller";
import { startDemoReplyNotifier } from "../demo-reply-notifier";
import { registerMessagingRoutes } from "./messaging";
import { registerEmailSenderRoutes } from "./emailSender";
import { registerMissedCallRoutes } from "./missedCall";
import { registerDemoRoutes } from "./demo";
import { registerVoiceCallsRoutes } from "./voice-calls";
import { registerVoiceLineRoutes } from "./voice-line";
import { registerVoiceFollowUpPreviewRoutes } from "./voiceFollowUpPreview";
import { registerTwilioVoiceRoutes } from "./twilio-voice";
import { registerUserSettingsRoutes } from "./user-settings";
import { registerAutomationRoutes } from "./automation";
import { registerWidgetRoutes } from "./widget";
import { registerDemoSettingsRoutes } from "./demoSettings";
import { registerVoicePromptRoutes } from "./voicePrompts";
import { registerVoiceAccountPromptRoutes } from "./voiceAccountPrompts";
import { registerDemoSocialRoutes } from "./demoSocial";
import { registerDemoLogoRoutes } from "./demoLogos";
import { registerPublicDemoRoutes } from "./publicDemo";
import { registerReportOptinRoutes } from "./reportOptin";
import { registerTopaWebhookRoutes } from "./topaWebhook";
import { registerProposalRoutes } from "./proposals";
import { registerTrafficRoutes } from "./traffic";
import { registerWhatsappCloudRoutes } from "./whatsappCloud";
import { registerNumberRequestRoutes } from "./numberRequests";
import { registerClientAlertsRoutes } from "./clientAlerts";
import { registerHomeRoutes } from "./home";
import { registerSocialRoutes } from "./social";
import { registerSocialPostRoutes } from "./socialPosts";
import { registerSocialStudioRoutes } from "./socialStudio";
import { registerSocialDmRoutes } from "./socialDm";
import { registerSocialInsightRoutes } from "./socialInsights";
import { startPublicDemoPoller } from "../publicDemo/poller";
import { startSocialPublisher } from "../social/publisher";
import { startSocialTokenRefresher } from "../social/tokenRefresher";
import { startSocialInsights } from "../social/insightsCollector";

export async function registerRoutes(httpServer: Server, app: Express): Promise<Server> {
  // ── Python engine proxy (/webhook/* → port 8100) ──────────────────────
  // Forward all /webhook/* requests to the Python engine (port 8100).
  // Uses fetch so the already-parsed body (req.body) is re-serialized cleanly.
  //
  // SECURITY: this proxy performs NO authentication or signature verification —
  // it forwards every /webhook/* request straight to the engine. This is only
  // safe because the engine is bound to localhost and these routes are not meant
  // to be reachable from the public internet. If /webhook/* is ever exposed
  // through Cloudflare / a public host, add auth or per-provider signature
  // validation here (and to the engine) BEFORE doing so.
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
  registerCalendarRoutes(app);
  registerReviewsRoutes(app);
  registerMessagingRoutes(app);
  registerEmailSenderRoutes(app);
  registerMissedCallRoutes(app);
  registerDemoRoutes(app);
  registerVoiceCallsRoutes(app);
  registerVoiceLineRoutes(app);
  registerVoiceFollowUpPreviewRoutes(app);
  registerTwilioVoiceRoutes(app);
  registerUserSettingsRoutes(app);
  registerAutomationRoutes(app);
  registerWidgetRoutes(app);
  registerDemoSettingsRoutes(app);
  registerVoicePromptRoutes(app);
  registerVoiceAccountPromptRoutes(app);
  registerDemoSocialRoutes(app);
  registerDemoLogoRoutes(app);
  registerPublicDemoRoutes(app);
  registerReportOptinRoutes(app);
  registerTopaWebhookRoutes(app);
  registerProposalRoutes(app);
  registerTrafficRoutes(app);
  registerWhatsappCloudRoutes(app);
  registerNumberRequestRoutes(app);
  registerClientAlertsRoutes(app);
  registerHomeRoutes(app);
  registerSocialRoutes(app);
  registerSocialPostRoutes(app);
  registerSocialStudioRoutes(app);
  registerSocialDmRoutes(app);
  registerSocialInsightRoutes(app);

  // ── One-time startup tasks ────────────────────────────────────────────
  // Seed default AI agents (idempotent)
  await seedAiAgents();

  // Seed support bot prompt into Prompt Library (idempotent)
  await seedSupportBotPrompt();

  // ── Background notifiers ──────────────────────────────────────────────
  // DISABLE_BACKGROUND_JOBS=1 skips every timer below: for a second server (a test copy on other
  // ports) that must never publish, notify or poll on its own.
  if (process.env.DISABLE_BACKGROUND_JOBS === "1") {
    console.log("[jobs] DISABLE_BACKGROUND_JOBS=1: background jobs not started");
    return httpServer;
  }
  startSupportCleanup();            // daily support session cleanup
  startTaskNotifiers();             // task due-soon (30min) + task overdue (30min)
  startBookingReminders();          // booking reminder 1h before call (10min check)
  startAutomationFailureNotifier(); // automation failure check (5min)
  startReviewPoller();              // Reputation v2: Google review ingest + auto-post (20min)
  startDemoReplyNotifier();         // a prospect replied to a demo for the first time (60s)
  startPublicDemoPoller();          // landing-page website demos: call task, budget, retention (60s)
  startSocialPublisher();           // Instagram: publish due Reels (60s)
  startSocialTokenRefresher();      // Instagram: token refresh + upload cleanup (6h)
  startSocialInsights();            // Instagram: insights snapshots (1h tick; fresh posts hourly, the rest 6h)

  return httpServer;
}
