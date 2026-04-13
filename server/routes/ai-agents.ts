import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, invalidateUserCache } from "../auth";
import {
  aiAgents,
  aiSessions,
  aiMessages,
  aiFiles,
  campaigns,
  leads,
  insertAiAgentSchema,
  insertAiMessageSchema,
} from "@shared/schema";
import { db } from "../db";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { broadcast } from "../sse";
import { handleZodError, wrapAsync } from "./_helpers";
import { eq, count, desc, and, sql } from "drizzle-orm";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { ZodError } from "zod";
import {
  seedDefaultAiAgents,
  streamClaudeResponse,
  getSessionCwd,
  generateConversationTitle,
  GOG_INSTRUCTIONS,
  parseGogCommands,
  executeGogCommands,
  formatConversationHistory,
} from "../aiAgents";
import {
  buildCrmToolsPrompt,
  parseCrmToolCalls,
  executeCrmTool,
  executeCrmToolCalls,
  isDestructiveToolCall,
  describeToolCall,
  type AgentPermissions,
  type CrmToolCall,
} from "../crmTools";

const VALID_THINKING_LEVELS = ["none", "low", "medium", "high"];
const VALID_MODELS = [
  "claude-sonnet-4-20250514",
  "claude-opus-4-20250514",
  "claude-haiku-235-20241022",
];

// ─── File upload constants ─────────────────────────────────────────────────
const ALLOWED_FILE_EXTENSIONS = new Set([
  ".pdf",
  ".jpg", ".jpeg", ".png", ".gif", ".webp",
  ".csv", ".xlsx", ".xls",
]);
const ALLOWED_IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".gif", ".webp"]);
const ALLOWED_SPREADSHEET_EXTENSIONS = new Set([".csv", ".xlsx", ".xls"]);
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

// ─── Helpers for building prompt context blocks ───────────────────────────
function buildPageContextBlock(pageContext: any): string {
  let ctxLines = `[Current Page Context]\n`;
  ctxLines += `The user is currently on the "${pageContext.pageName || "Unknown"}" page.\n`;
  ctxLines += `Route: ${pageContext.path || "/"}\n`;
  if (pageContext.pageType) ctxLines += `Page type: ${pageContext.pageType}\n`;
  if (pageContext.params && Object.keys(pageContext.params).length > 0) {
    ctxLines += `Route params: ${JSON.stringify(pageContext.params)}\n`;
  }
  if (pageContext.entityData) {
    const ed = pageContext.entityData;
    ctxLines += `\nOn-screen entity: ${ed.entityType}`;
    if (ed.entityId) ctxLines += ` (ID: ${ed.entityId})`;
    if (ed.entityName) ctxLines += ` — "${ed.entityName}"`;
    ctxLines += `\n`;
    if (ed.summary && Object.keys(ed.summary).length > 0) {
      ctxLines += `Entity details:\n`;
      for (const [key, val] of Object.entries(ed.summary)) {
        ctxLines += `  ${key}: ${typeof val === "object" ? JSON.stringify(val) : val}\n`;
      }
    }
    if (ed.filters && Object.keys(ed.filters).length > 0) {
      ctxLines += `Active filters: ${JSON.stringify(ed.filters)}\n`;
    }
  }
  ctxLines += `\nIMPORTANT — Pronoun Resolution:\n`;
  ctxLines += `When the user says "this lead", "this campaign", etc., they refer to the on-screen entity above.\n`;
  ctxLines += `Use entity details and page context for specific, data-aware answers.\n`;
  return ctxLines + `\n`;
}

function buildFileContextBlock(fr: any, isCurrent: boolean): string {
  const fileExt = path.extname(fr.filename).toLowerCase();
  const isImg = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(fileExt);
  const isSsheet = [".csv", ".xlsx", ".xls"].includes(fileExt);
  const prefix = isCurrent ? "[Attached" : "[Previously Uploaded";
  const suffix = isCurrent ? "Please analyze as requested." : "This file was shared earlier — reference it if relevant.";

  if (isImg) {
    if (fr.filePath && fs.existsSync(fr.filePath)) {
      const imgBuffer = fs.readFileSync(fr.filePath);
      const base64Data = imgBuffer.toString("base64");
      return `\n\n${prefix} Image: ${fr.filename}]\ndata:${fr.mimeType || "image/jpeg"};base64,${base64Data}\n\n${suffix}\n`;
    }
    return `\n\n${prefix} Image: ${fr.filename}]\n[Image file not found on disk]\n`;
  } else if (isSsheet) {
    return `\n\n${prefix} Spreadsheet: ${fr.filename}]\n${fr.transcription || "[Could not extract]"}\n\n${suffix}\n`;
  } else {
    return `\n\n${prefix} PDF Document: ${fr.filename}]\n${fr.transcription || "[Could not extract]"}\n\n${suffix}\n`;
  }
}

export function registerAiAgentsRoutes(app: Express): void {
  // ─── Support Chat ──────────────────────────────────────────────────

  // POST /api/support-chat/sessions — create or get active session
  app.post("/api/support-chat/sessions", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const channel = req.body.channel === "founder" ? "founder" : "bot";
    const existing = await storage.getActiveSupportSession(user.id!, channel);
    if (existing) return res.json(existing);
    const sessionId = `sc_${user.id}_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
    const session = await storage.createSupportSession({
      sessionId,
      userId: user.id!,
      accountId: user.accountsId ?? null,
      channel,
      status: "active",
    });
    res.status(201).json(session);
  }));

  // GET /api/support-chat/sessions/active — get current user's active session
  app.get("/api/support-chat/sessions/active", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const session = await storage.getActiveSupportSession(user.id!);
    res.json(session || null);
  }));

  // GET /api/support-chat/messages/:sessionId — fetch message history
  app.get("/api/support-chat/messages/:sessionId", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const { sessionId } = req.params;
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.userId !== user.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const messages = await storage.getSupportMessagesBySessionId(sessionId);
    res.json(messages);
  }));

  // POST /api/support-chat/messages — send message + forward to n8n webhook
  app.post("/api/support-chat/messages", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const { sessionId, content, language } = req.body;
    if (!sessionId || !content) {
      return res.status(400).json({ message: "sessionId and content are required" });
    }
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.userId !== user.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const userMsg = await storage.createSupportMessage({
      sessionId,
      userId: user.id!,
      accountId: user.accountsId ?? null,
      role: "user",
      content,
    });

    const webhookUrl = process.env.SUPPORT_CHAT_WEBHOOK_URL;
    if (!webhookUrl) {
      const fallbackMsg = await storage.createSupportMessage({
        sessionId,
        userId: user.id!,
        accountId: user.accountsId ?? null,
        role: "assistant",
        content: "Support is being configured. Please try again later.",
      });
      return res.json({ userMessage: userMsg, assistantMessage: fallbackMsg, escalated: false });
    }

    try {
      const history = await storage.getSupportMessagesBySessionId(sessionId);
      let systemPrompt = "";
      try {
        const prompts = await storage.getPrompts();
        const botPrompt = prompts.find((p: any) => (p.name || p.Name) === "Lead Awaker Support Bot");
        if (botPrompt) {
          systemPrompt = (botPrompt as any).systemMessage || (botPrompt as any).system_message || "";
        }
      } catch {}

      const webhookRes = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId,
          message: content,
          userId: user.id,
          accountId: user.accountsId,
          userName: user.fullName1 || user.email,
          language: language || "en",
          systemPrompt,
          history: history.map((m) => ({ role: m.role, content: m.content })),
        }),
      });
      const webhookData = await webhookRes.json() as { response?: string; escalate?: boolean };
      const aiContent = webhookData.response || "I'm sorry, I couldn't process that. Please try again.";
      const shouldEscalate = webhookData.escalate === true;
      const assistantMsg = await storage.createSupportMessage({
        sessionId,
        userId: user.id!,
        accountId: user.accountsId ?? null,
        role: "assistant",
        content: aiContent,
      });

      let escalationMessage = null;
      if (shouldEscalate) {
        await storage.updateSupportSession(session.id, {
          status: "escalated",
          escalatedAt: new Date(),
        } as any);

        escalationMessage = await storage.createSupportMessage({
          sessionId,
          userId: user.id!,
          accountId: user.accountsId ?? null,
          role: "assistant",
          content: "I've connected you with a human agent. They'll be with you shortly.",
        });

        try {
          const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
          for (const admin of agencyUsers) {
            await createAndDispatchNotification({
              type: "lead_manual_takeover",
              title: "Support escalation",
              body: `${user.fullName1 || user.email} needs human assistance`,
              userId: admin.id!,
              accountId: user.accountsId ?? null,
              read: false,
              link: null,
              leadId: null,
            });
          }
        } catch (notifErr) {
          console.error("[support-chat] Failed to create escalation notification:", notifErr);
        }

        const telegramUrl = process.env.SUPPORT_CHAT_TELEGRAM_WEBHOOK_URL;
        if (telegramUrl) {
          fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "support_escalation",
              userName: user.fullName1 || user.email,
              userEmail: user.email,
              accountId: user.accountsId,
              sessionId,
              timestamp: new Date().toISOString(),
            }),
          }).catch((err) => console.error("[support-chat] Telegram webhook error:", err));
        }
      }

      res.json({
        userMessage: userMsg,
        assistantMessage: assistantMsg,
        escalated: shouldEscalate,
        escalationMessage,
      });
    } catch (err) {
      console.error("[support-chat] Webhook error:", err);
      const errorMsg = await storage.createSupportMessage({
        sessionId,
        userId: user.id!,
        accountId: user.accountsId ?? null,
        role: "assistant",
        content: "I'm having trouble connecting right now. Please try again in a moment.",
      });
      res.json({ userMessage: userMsg, assistantMessage: errorMsg, escalated: false });
    }
  }));

  // POST /api/support-chat/escalate — escalate session to human agent
  app.post("/api/support-chat/escalate", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.userId !== user.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.updateSupportSession(session.id, {
      status: "escalated",
      escalatedAt: new Date(),
    } as any);

    await storage.createSupportMessage({
      sessionId,
      userId: user.id!,
      accountId: user.accountsId ?? null,
      role: "assistant",
      content: "I've notified an agent. They'll be with you shortly. You can continue describing your issue here.",
    });

    try {
      const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
      for (const admin of agencyUsers) {
        await createAndDispatchNotification({
          type: "lead_manual_takeover",
          title: "Support escalation",
          body: `${user.fullName1 || user.email} requested to speak with an agent`,
          userId: admin.id!,
          accountId: user.accountsId ?? null,
          read: false,
          link: null,
          leadId: null,
        });
      }
    } catch (err) {
      console.error("[support-chat] Failed to create notification:", err);
    }

    const telegramUrl = process.env.SUPPORT_CHAT_TELEGRAM_WEBHOOK_URL;
    if (telegramUrl) {
      fetch(telegramUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "support_escalation",
          userName: user.fullName1 || user.email,
          userEmail: user.email,
          accountId: user.accountsId,
          sessionId,
          timestamp: new Date().toISOString(),
        }),
      }).catch((err) => console.error("[support-chat] Telegram webhook error:", err));
    }

    res.json({ success: true, status: "escalated" });
  }));

  // GET /api/support-chat/config — get bot display config (name, photo)
  app.get("/api/support-chat/config", requireAuth, wrapAsync(async (_req, res) => {
    try {
      const account = await storage.getAccountById(1);
      const raw = (account as any)?.supportBotConfig;
      if (raw) {
        const config = typeof raw === "string" ? JSON.parse(raw) : raw;
        return res.json(config);
      }
    } catch {
      // Fallback to defaults
    }
    res.json({ name: "Tom", photoUrl: null, enabled: true });
  }));

  // PATCH /api/support-chat/config — update bot display config (admin only)
  app.patch("/api/support-chat/config", requireAgency, wrapAsync(async (req, res) => {
    const { name, photoUrl, enabled } = req.body;
    const config = { name: name || "Tom", photoUrl: photoUrl || null, enabled: enabled !== false };
    await storage.updateAccount(1, { supportBotConfig: JSON.stringify(config) } as any);
    res.json(config);
  }));

  // POST /api/support-chat/transcribe — Groq Whisper transcription (no lead required)
  app.post("/api/support-chat/transcribe", requireAuth, wrapAsync(async (req, res) => {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return res.status(503).json({ error: "Transcription not configured" });

    const { audio_data, mime_type } = req.body;
    if (!audio_data) return res.status(400).json({ error: "No audio data provided" });

    try {
      const base64Clean = (audio_data as string).replace(/^data:[^,]+,/, "");
      const audioBuffer = Buffer.from(base64Clean, "base64");
      const rawMime = (mime_type || "audio/webm") as string;
      const mimeBase = rawMime.split(";")[0].trim();
      const ext = mimeBase.includes("webm") ? "webm" : mimeBase.includes("ogg") ? "ogg" : mimeBase.includes("mp4") ? "mp4" : mimeBase.includes("wav") ? "wav" : "webm";
      const file = new File([audioBuffer], `recording.${ext}`, { type: mimeBase });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("model", "whisper-large-v3-turbo");
      formData.append("response_format", "json");
      formData.append("temperature", "0");
      const response = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      });
      if (!response.ok) {
        const errBody = await response.text();
        return res.status(500).json({ error: "Transcription failed", detail: errBody });
      }
      const json = await response.json() as { text?: string };
      return res.json({ transcription: json.text?.trim() ?? "" });
    } catch (err) {
      console.error("[support-chat/transcribe] Error:", err);
      return res.status(500).json({ error: "Internal error" });
    }
  }));

  // POST /api/support-chat/close — close a session
  app.post("/api/support-chat/close", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const { sessionId } = req.body;
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.userId !== user.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.updateSupportSession(session.id, {
      status: "closed",
      closedAt: new Date(),
    } as any);
    res.json({ success: true });
  }));

  // ─── Founder Direct Messages ────────────────────────────────────────

  // POST /api/support-chat/founder/message — user sends message to founder (no AI)
  app.post("/api/support-chat/founder/message", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const { sessionId, content } = req.body;
    if (!sessionId || !content) {
      return res.status(400).json({ message: "sessionId and content are required" });
    }
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.userId !== user.id! || session.channel !== "founder") {
      return res.status(403).json({ message: "Forbidden" });
    }

    const userMsg = await storage.createSupportMessage({
      sessionId,
      userId: user.id!,
      accountId: user.accountsId ?? null,
      role: "user",
      content,
    });

    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_FOUNDER_CHAT_ID;
    if (botToken && chatId) {
      const userName = user.fullName1 || user.email;
      const text = `New message from ${userName}:\n\n${content}\n\nSession: ${sessionId}`;
      fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ chat_id: chatId, text }),
      }).catch((err) => console.error("[founder-dm] Telegram error:", err));
    }

    broadcast(1, "founder_message", {
      sessionId,
      message: userMsg,
      userName: user.fullName1 || user.email,
    });

    res.json({ message: userMsg });
  }));

  // GET /api/support-chat/founder/sessions — admin lists all active founder sessions
  app.get("/api/support-chat/founder/sessions", requireAgency, wrapAsync(async (_req, res) => {
    const sessions = await storage.getFounderSessions();
    const enriched = await Promise.all(sessions.map(async (s) => {
      const user = await storage.getAppUserById(s.userId);
      const messages = await storage.getSupportMessagesBySessionId(s.sessionId);
      const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      const unread = messages.filter((m) => m.role === "user").length;
      return {
        ...s,
        userName: user?.fullName1 || user?.email || "Unknown",
        userEmail: user?.email,
        lastMessage: lastMsg?.content,
        lastMessageAt: lastMsg?.createdAt,
        messageCount: messages.length,
        unreadCount: unread,
      };
    }));
    res.json(enriched);
  }));

  // POST /api/support-chat/founder/reply — admin replies to a founder session
  app.post("/api/support-chat/founder/reply", requireAgency, wrapAsync(async (req, res) => {
    const admin = req.user!;
    const { sessionId, content } = req.body;
    if (!sessionId || !content) {
      return res.status(400).json({ message: "sessionId and content are required" });
    }
    const session = await storage.getSupportSessionBySessionId(sessionId);
    if (!session || session.channel !== "founder") {
      return res.status(404).json({ message: "Founder session not found" });
    }

    const replyMsg = await storage.createSupportMessage({
      sessionId,
      userId: admin.id!,
      accountId: session.accountId ?? null,
      role: "assistant",
      content,
    });

    if (session.accountId) {
      broadcast(session.accountId, "founder_reply", { sessionId, message: replyMsg });
    }
    broadcast(1, "founder_reply", { sessionId, message: replyMsg });

    res.json({ message: replyMsg });
  }));

  // ─── Onboarding Tutorial ────────────────────────────────────────────

  function parseOnboarding(user: { preferences?: string | Record<string, unknown> | null }) {
    const defaults = {
      completed: false,
      skipped: false,
      currentStage: 1,
      currentStep: 0,
      completedStages: [] as number[],
      startedAt: null as string | null,
      completedAt: null as string | null,
    };
    if (!user.preferences) return defaults;
    try {
      const prefs = typeof user.preferences === "string"
        ? JSON.parse(user.preferences)
        : user.preferences;
      return { ...defaults, ...prefs?.onboarding };
    } catch {
      return defaults;
    }
  }

  async function saveOnboarding(userId: number, currentPrefs: any, onboarding: Record<string, unknown>) {
    let prefs: Record<string, any> = {};
    if (currentPrefs) {
      try {
        prefs = typeof currentPrefs === "string" ? JSON.parse(currentPrefs) : { ...currentPrefs };
      } catch {}
    }
    prefs.onboarding = { ...(prefs.onboarding || {}), ...onboarding };
    const updated = await storage.updateAppUser(userId, { preferences: JSON.stringify(prefs) } as any);
    if (updated) invalidateUserCache(userId);
    return updated;
  }

  // GET /api/onboarding/status
  app.get("/api/onboarding/status", requireAuth, wrapAsync(async (req, res) => {
    res.json(parseOnboarding(req.user!));
  }));

  // PATCH /api/onboarding/progress
  app.patch("/api/onboarding/progress", requireAuth, wrapAsync(async (req, res) => {
    const { currentStage, currentStep, completedStages, startedAt } = req.body;
    const update: Record<string, unknown> = {};
    if (currentStage !== undefined) update.currentStage = currentStage;
    if (currentStep !== undefined) update.currentStep = currentStep;
    if (completedStages !== undefined) update.completedStages = completedStages;
    if (startedAt !== undefined) update.startedAt = startedAt;
    const updated = await saveOnboarding(req.user!.id!, req.user!.preferences, update);
    if (!updated) return res.status(500).json({ message: "Failed to update onboarding" });
    res.json(parseOnboarding(updated));
  }));

  // POST /api/onboarding/complete
  app.post("/api/onboarding/complete", requireAuth, wrapAsync(async (req, res) => {
    const updated = await saveOnboarding(req.user!.id!, req.user!.preferences, {
      completed: true,
      completedAt: new Date().toISOString(),
    });
    if (!updated) return res.status(500).json({ message: "Failed to complete onboarding" });
    res.json(parseOnboarding(updated));
  }));

  // POST /api/onboarding/skip
  app.post("/api/onboarding/skip", requireAuth, wrapAsync(async (req, res) => {
    const updated = await saveOnboarding(req.user!.id!, req.user!.preferences, { skipped: true });
    if (!updated) return res.status(500).json({ message: "Failed to skip onboarding" });
    res.json(parseOnboarding(updated));
  }));

  // POST /api/onboarding/restart
  app.post("/api/onboarding/restart", requireAuth, wrapAsync(async (req, res) => {
    const updated = await saveOnboarding(req.user!.id!, req.user!.preferences, {
      completed: false,
      skipped: false,
      currentStage: 1,
      currentStep: 0,
      completedStages: [],
      startedAt: null,
      completedAt: null,
    });
    if (!updated) return res.status(500).json({ message: "Failed to restart onboarding" });
    res.json(parseOnboarding(updated));
  }));

  // ─── AI Agents: /api/ai-agents ───────────────────────────────────────

  // GET /api/ai-agents — list all enabled agents
  app.get("/api/ai-agents", requireAgency, wrapAsync(async (_req, res) => {
    const agents = await storage.getAiAgents();
    res.json(agents);
  }));

  // POST /api/ai-agents — create custom agent
  app.post("/api/ai-agents", requireAgency, wrapAsync(async (req, res) => {
    const { DEFAULT_SYSTEM_PROMPTS } = await import("../aiAgents");
    const { name, systemPrompt, photoUrl, model, thinkingLevel } = req.body;
    if (!name?.trim()) return res.status(400).json({ message: "name required" });
    const resolvedModel = model || "claude-sonnet-4-20250514";
    if (!VALID_MODELS.includes(resolvedModel)) {
      return res.status(400).json({ message: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` });
    }
    const resolvedThinking = thinkingLevel || "medium";
    if (!VALID_THINKING_LEVELS.includes(resolvedThinking)) {
      return res.status(400).json({ message: `Invalid thinking_level. Must be one of: ${VALID_THINKING_LEVELS.join(", ")}` });
    }
    const agent = await storage.createAiAgent({
      name: name.trim(),
      type: "custom",
      systemPrompt: systemPrompt || DEFAULT_SYSTEM_PROMPTS.code_runner,
      photoUrl: photoUrl || null,
      enabled: true,
      displayOrder: 99,
      model: resolvedModel,
      thinkingLevel: resolvedThinking,
      permissions: { read: true, write: false, create: false, delete: false },
    });
    res.status(201).json(agent);
  }));

  // GET /api/ai-sessions — list user's sessions (legacy endpoint)
  app.get("/api/ai-sessions", requireAgency, wrapAsync(async (req, res) => {
    const sessions = await storage.getAiSessionsByUserId(req.user!.id!);
    res.json(sessions);
  }));

  // POST /api/ai-sessions — start or resume a session (legacy endpoint)
  app.post("/api/ai-sessions", requireAgency, wrapAsync(async (req, res) => {
    const { agentId } = req.body;
    if (!agentId) return res.status(400).json({ message: "agentId required" });

    const agent = await storage.getAiAgentById(agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    const existing = await storage.getActiveAiSessionByUserAndAgent(req.user!.id!, agentId);
    if (existing) return res.json(existing);

    const session = await storage.createAiSession({
      sessionId: crypto.randomUUID(),
      userId: req.user!.id!,
      agentId,
      title: `Chat with ${agent.name}`,
      status: "active",
    });
    res.status(201).json(session);
  }));

  // GET /api/ai-sessions/:sessionId/messages — get message history (legacy)
  app.get("/api/ai-sessions/:sessionId/messages", requireAgency, wrapAsync(async (req, res) => {
    const { sessionId } = req.params;
    const session = await storage.getAiSessionBySessionId(sessionId);
    if (!session || session.userId !== req.user!.id!) return res.status(404).json({ message: "Session not found" });
    const messages = await storage.getAiMessagesBySessionId(sessionId);
    res.json(messages);
  }));

  // POST /api/ai-sessions/:sessionId/close — close a session (legacy)
  app.post("/api/ai-sessions/:sessionId/close", requireAgency, wrapAsync(async (req, res) => {
    const { sessionId } = req.params;
    const session = await storage.getAiSessionBySessionId(sessionId);
    if (!session || session.userId !== req.user!.id!) return res.status(404).json({ message: "Session not found" });
    await storage.updateAiSession(session.id, { status: "closed" });
    res.json({ ok: true });
  }));

  // POST /api/ai-chat — SSE streaming endpoint (legacy)
  app.post("/api/ai-chat", requireAgency, async (req, res) => {
    const { sessionId, message, attachmentBase64 } = req.body;
    if (!sessionId || !message?.trim()) {
      return res.status(400).json({ message: "sessionId and message required" });
    }

    const session = await storage.getAiSessionBySessionId(sessionId);
    if (!session || session.userId !== req.user!.id!) {
      return res.status(404).json({ message: "Session not found" });
    }

    const agent = await storage.getAiAgentById(session.agentId);
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    await storage.createAiMessage({
      sessionId,
      role: "user",
      content: message.trim(),
      subAgentBlocks: null,
    });

    const allMessages = await storage.getAiMessagesBySessionId(sessionId);

    let fullPrompt = "";
    if (agent.systemPrompt) {
      fullPrompt += `[System Instructions]\n${agent.systemPrompt}\n\n`;
    }
    fullPrompt += formatConversationHistory(allMessages);
    if (attachmentBase64) {
      fullPrompt += `[User attached a file (base64): ${attachmentBase64.slice(0, 100)}...]\n\n`;
    }
    fullPrompt += message.trim();

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders();

    const cwd = getSessionCwd(sessionId, agent.type);

    streamClaudeResponse({
      prompt: fullPrompt,
      cwd,
      bypassPermissions: true,
      res,
      onDone: async (fullText, subAgentBlocks) => {
        try {
          await storage.createAiMessage({
            sessionId,
            role: "assistant",
            content: fullText,
            subAgentBlocks: subAgentBlocks.length > 0 ? JSON.stringify(subAgentBlocks) : null,
          });
        } catch (err) {
          console.error("[AI Chat] Failed to save assistant message:", err);
        }
      },
    });
  });

  // ─── AI Agents: /api/agents ──────────────────────────────────────────

  // List all agents
  app.get("/api/agents", requireAgency, async (_req, res) => {
    try {
      const rows = await db.select().from(aiAgents).orderBy(aiAgents.displayOrder);
      res.json(rows);
    } catch (err: any) {
      console.error("[AI Agents] list error:", err);
      res.status(500).json({ message: "Failed to list agents" });
    }
  });

  // Get single agent
  app.get("/api/agents/:id", requireAgency, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid agent ID" });
      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, id));
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (err: any) {
      console.error("[AI Agents] get error:", err);
      res.status(500).json({ message: "Failed to get agent" });
    }
  });

  // Create agent — clones Code Runner template defaults
  app.post("/api/agents", requireAgency, async (req, res) => {
    try {
      const { DEFAULT_SYSTEM_PROMPTS } = await import("../aiAgents");

      const thinkingLevel = req.body.thinkingLevel || "medium";
      if (!VALID_THINKING_LEVELS.includes(thinkingLevel)) {
        return res.status(400).json({ message: `Invalid thinking_level. Must be one of: ${VALID_THINKING_LEVELS.join(", ")}` });
      }

      const model = req.body.model || "claude-sonnet-4-20250514";
      if (!VALID_MODELS.includes(model)) {
        return res.status(400).json({ message: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` });
      }

      const body = {
        ...req.body,
        type: req.body.type || "custom",
        systemPrompt: req.body.systemPrompt || DEFAULT_SYSTEM_PROMPTS.code_runner,
        model,
        thinkingLevel,
        enabled: req.body.enabled !== undefined ? req.body.enabled : true,
        displayOrder: req.body.displayOrder || 99,
        permissions: req.body.permissions || { read: true, write: false, create: false, delete: false },
      };
      const parsed = insertAiAgentSchema.parse(body);
      const agent = await storage.createAiAgent(parsed);
      res.status(201).json(agent);
    } catch (err: any) {
      if (err instanceof ZodError) return handleZodError(res, err);
      console.error("[AI Agents] create error:", err);
      res.status(500).json({ message: "Failed to create agent" });
    }
  });

  // PUT /api/agents/:id — update agent name and icon
  app.put("/api/agents/:id", requireAgency, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid agent ID" });

      const { name, photoUrl } = req.body;
      if (!name?.trim()) {
        return res.status(400).json({ message: "name is required" });
      }

      const updateData: Record<string, any> = { name: name.trim() };
      if (photoUrl !== undefined) updateData.photoUrl = photoUrl;

      const agent = await storage.updateAiAgent(id, updateData);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (err: any) {
      console.error("[AI Agents] put error:", err);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  // PATCH /api/agents/:id — update agent (any fields)
  app.patch("/api/agents/:id", requireAgency, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid agent ID" });

      if (req.body.thinkingLevel !== undefined && !VALID_THINKING_LEVELS.includes(req.body.thinkingLevel)) {
        return res.status(400).json({ message: `Invalid thinking_level. Must be one of: ${VALID_THINKING_LEVELS.join(", ")}` });
      }

      if (req.body.model !== undefined && !VALID_MODELS.includes(req.body.model)) {
        return res.status(400).json({ message: `Invalid model. Must be one of: ${VALID_MODELS.join(", ")}` });
      }

      const agent = await storage.updateAiAgent(id, req.body);
      if (!agent) return res.status(404).json({ message: "Agent not found" });
      res.json(agent);
    } catch (err: any) {
      console.error("[AI Agents] update error:", err);
      res.status(500).json({ message: "Failed to update agent" });
    }
  });

  // DELETE /api/agents/:id — delete agent and cascade
  app.delete("/api/agents/:id", requireAgency, async (req, res) => {
    try {
      const id = parseInt(req.params.id, 10);
      if (isNaN(id)) return res.status(400).json({ message: "Invalid agent ID" });

      const agent = await storage.getAiAgentById(id);
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const sessions = await db.select().from(aiSessions).where(eq(aiSessions.agentId, id));
      const sessionIds = sessions.map((s) => s.sessionId);

      if (sessionIds.length > 0) {
        for (const sid of sessionIds) {
          await db.delete(aiFiles).where(eq(aiFiles.conversationId, sid));
          await db.delete(aiMessages).where(eq(aiMessages.sessionId, sid));
        }
        await db.delete(aiSessions).where(eq(aiSessions.agentId, id));
      }

      await db.delete(aiAgents).where(eq(aiAgents.id, id));

      console.log(`[AI Agents] Deleted agent ${id} (${agent.name}) with ${sessionIds.length} sessions`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AI Agents] delete error:", err);
      res.status(500).json({ message: "Failed to delete agent" });
    }
  });

  // ─── AI Conversations ──────────────────────────────────────────────

  // POST /api/agents/:id/conversations — create new conversation
  app.post("/api/agents/:id/conversations", requireAgency, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const agentId = parseInt(req.params.id, 10);
      if (isNaN(agentId)) return res.status(400).json({ message: "Invalid agent ID" });

      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const sessionId = crypto.randomUUID();
      const session = await storage.createAiSession({
        sessionId,
        userId,
        agentId,
        title: req.body.title || null,
        status: "active",
        isActive: true,
        model: agent.model,
        thinkingLevel: agent.thinkingLevel,
        cliSessionId: null,
      });
      res.status(201).json(session);
    } catch (err: any) {
      console.error("[AI Conversations] create error:", err);
      res.status(500).json({ message: "Failed to create conversation" });
    }
  });

  // GET /api/agents/:id/conversations — list all conversations for agent
  app.get("/api/agents/:id/conversations", requireAgency, async (req, res) => {
    try {
      const agentId = parseInt(req.params.id, 10);
      if (isNaN(agentId)) return res.status(400).json({ message: "Invalid agent ID" });

      const sessions = await db
        .select()
        .from(aiSessions)
        .where(eq(aiSessions.agentId, agentId))
        .orderBy(desc(aiSessions.updatedAt));

      const conversationsWithMeta = await Promise.all(
        sessions.map(async (session) => {
          const [msgCount] = await db
            .select({ total: count() })
            .from(aiMessages)
            .where(eq(aiMessages.sessionId, session.sessionId));

          const [lastMsg] = await db
            .select({ content: aiMessages.content, role: aiMessages.role, createdAt: aiMessages.createdAt })
            .from(aiMessages)
            .where(eq(aiMessages.sessionId, session.sessionId))
            .orderBy(desc(aiMessages.createdAt))
            .limit(1);

          return {
            id: session.id,
            sessionId: session.sessionId,
            agentId: session.agentId,
            userId: session.userId,
            title: session.title,
            model: session.model,
            thinkingLevel: session.thinkingLevel,
            isActive: session.isActive,
            status: session.status,
            totalInputTokens: session.totalInputTokens,
            totalOutputTokens: session.totalOutputTokens,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            messageCount: msgCount?.total ?? 0,
            lastMessage: lastMsg
              ? { content: lastMsg.content.substring(0, 200), role: lastMsg.role, createdAt: lastMsg.createdAt }
              : null,
          };
        }),
      );

      res.json(conversationsWithMeta);
    } catch (err: any) {
      console.error("[AI Conversations] list error:", err);
      res.status(500).json({ message: "Failed to list conversations" });
    }
  });

  // GET /api/agent-conversations/:id — get single conversation with messages
  app.get("/api/agent-conversations/:id", requireAgency, async (req, res) => {
    try {
      const sessionId = req.params.id;

      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      const messages = await storage.getAiMessagesBySessionId(sessionId);
      const files = await storage.getAiFilesByConversationId(sessionId);

      const filesByMessage = new Map<number, typeof files>();
      for (const f of files) {
        if (f.messageId) {
          const existing = filesByMessage.get(f.messageId) || [];
          existing.push(f);
          filesByMessage.set(f.messageId, existing);
        }
      }

      const messagesWithFiles = messages.map((m) => ({
        ...m,
        subAgentBlocks: typeof m.subAgentBlocks === "string"
          ? JSON.parse(m.subAgentBlocks)
          : (m.subAgentBlocks ?? []),
        files: m.id ? (filesByMessage.get(m.id) || []) : [],
      }));

      res.json({
        id: session.id,
        sessionId: session.sessionId,
        agentId: session.agentId,
        userId: session.userId,
        title: session.title,
        model: session.model,
        thinkingLevel: session.thinkingLevel,
        isActive: session.isActive,
        status: session.status,
        totalInputTokens: session.totalInputTokens,
        totalOutputTokens: session.totalOutputTokens,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        messages: messagesWithFiles,
      });
    } catch (err: any) {
      console.error("[AI Conversations] get error:", err);
      res.status(500).json({ message: "Failed to get conversation" });
    }
  });

  // DELETE /api/agent-conversations/:id — delete conversation and cascade
  app.delete("/api/agent-conversations/:id", requireAgency, async (req, res) => {
    try {
      const sessionId = req.params.id;

      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      await db.delete(aiFiles).where(eq(aiFiles.conversationId, sessionId));
      await db.delete(aiMessages).where(eq(aiMessages.sessionId, sessionId));
      await db.delete(aiSessions).where(eq(aiSessions.id, session.id));

      console.log(`[AI Conversations] Deleted conversation ${sessionId} (files, messages, session)`);
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AI Conversations] delete error:", err);
      res.status(500).json({ message: "Failed to delete conversation" });
    }
  });

  // ─── AI Sessions ────────────────────────────────────────────────────

  // GET /api/agents/sessions/list — list sessions for current user
  app.get("/api/agents/sessions/list", requireAgency, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const sessions = await storage.getAiSessionsByUserId(userId);
      res.json(sessions);
    } catch (err: any) {
      console.error("[AI Sessions] list error:", err);
      res.status(500).json({ message: "Failed to list sessions" });
    }
  });

  // POST /api/agents/:agentId/sessions — get or create active session
  app.post("/api/agents/:agentId/sessions", requireAgency, async (req, res) => {
    try {
      const userId = (req.user as any)?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const agentId = parseInt(req.params.agentId, 10);
      if (isNaN(agentId)) return res.status(400).json({ message: "Invalid agent ID" });

      let session = await storage.getActiveAiSessionByUserAndAgent(userId, agentId);
      if (!session) {
        const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
        const sessionId = crypto.randomUUID();
        session = await storage.createAiSession({
          sessionId,
          userId,
          agentId,
          title: req.body.title || null,
          status: "active",
          cliSessionId: null,
          model: agent?.model || "claude-sonnet-4-20250514",
          thinkingLevel: agent?.thinkingLevel || "medium",
        });
      }
      res.json(session);
    } catch (err: any) {
      console.error("[AI Sessions] create error:", err);
      res.status(500).json({ message: "Failed to create session" });
    }
  });

  // GET /api/agents/sessions/:sessionId — get session by sessionId
  app.get("/api/agents/sessions/:sessionId", requireAgency, async (req, res) => {
    try {
      const session = await storage.getAiSessionBySessionId(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      res.json(session);
    } catch (err: any) {
      console.error("[AI Sessions] get error:", err);
      res.status(500).json({ message: "Failed to get session" });
    }
  });

  // PATCH /api/agents/sessions/:sessionId — update session
  app.patch("/api/agents/sessions/:sessionId", requireAgency, async (req, res) => {
    try {
      const session = await storage.getAiSessionBySessionId(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      const updated = await storage.updateAiSession(session.id, req.body);
      res.json(updated);
    } catch (err: any) {
      console.error("[AI Sessions] update error:", err);
      res.status(500).json({ message: "Failed to update session" });
    }
  });

  // DELETE /api/agents/sessions/:sessionId — close/delete session
  app.delete("/api/agents/sessions/:sessionId", requireAgency, async (req, res) => {
    try {
      const session = await storage.getAiSessionBySessionId(req.params.sessionId);
      if (!session) return res.status(404).json({ message: "Session not found" });
      await storage.updateAiSession(session.id, { status: "closed" });
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AI Sessions] close error:", err);
      res.status(500).json({ message: "Failed to close session" });
    }
  });

  // ─── AI Messages ────────────────────────────────────────────────────

  // GET /api/agents/sessions/:sessionId/messages — get messages for a session
  app.get("/api/agents/sessions/:sessionId/messages", requireAgency, async (req, res) => {
    try {
      const messages = await storage.getAiMessagesBySessionId(req.params.sessionId);
      res.json(messages);
    } catch (err: any) {
      console.error("[AI Messages] list error:", err);
      res.status(500).json({ message: "Failed to list messages" });
    }
  });

  // POST /api/agents/sessions/:sessionId/messages — create a message
  app.post("/api/agents/sessions/:sessionId/messages", requireAgency, async (req, res) => {
    try {
      const parsed = insertAiMessageSchema.parse({
        ...req.body,
        sessionId: req.params.sessionId,
      });
      const message = await storage.createAiMessage(parsed);
      res.status(201).json(message);
    } catch (err: any) {
      if (err instanceof ZodError) return handleZodError(res, err);
      console.error("[AI Messages] create error:", err);
      res.status(500).json({ message: "Failed to create message" });
    }
  });

  // DELETE /api/agents/sessions/:sessionId/messages — clear message history
  app.delete("/api/agents/sessions/:sessionId/messages", requireAgency, async (req, res) => {
    try {
      await db.delete(aiMessages).where(eq(aiMessages.sessionId, req.params.sessionId));
      res.json({ success: true });
    } catch (err: any) {
      console.error("[AI Messages] clear error:", err);
      res.status(500).json({ message: "Failed to clear messages" });
    }
  });

  // ─── Voice Transcription ───────────────────────────────────────────

  app.post("/api/agent-voice/transcribe", requireAgency, async (req, res) => {
    const { audio_data, mime_type, session_id } = req.body as {
      audio_data?: string;
      mime_type?: string;
      session_id?: string;
    };

    if (!audio_data) {
      return res.status(400).json({ message: "audio_data is required" });
    }

    try {
      const base64Match = audio_data.match(/;base64,(.+)$/);
      const base64Data = base64Match ? base64Match[1] : audio_data;
      const buffer = Buffer.from(base64Data, "base64");

      if (buffer.length === 0) {
        return res.status(400).json({ message: "Empty audio data" });
      }

      const mimeRaw = mime_type || "audio/webm";
      const mimeStr = mimeRaw.split(";")[0].trim();
      const extMap: Record<string, string> = {
        "audio/webm": ".webm",
        "audio/mp4": ".mp4",
        "audio/mpeg": ".mp3",
        "audio/mp3": ".mp3",
        "audio/wav": ".wav",
        "audio/ogg": ".ogg",
      };
      const ext = extMap[mimeStr] || ".webm";
      console.log("[Voice Transcribe] MIME:", mimeRaw, "->", mimeStr, "| ext:", ext);
      const filename = `voice-memo-${Date.now()}${ext}`;

      let fileRecord: any = null;
      if (session_id) {
        const uploadsDir = path.join("/home/gabriel/LeadAwakerApp", "uploads", "agent-files", session_id);
        fs.mkdirSync(uploadsDir, { recursive: true });
        const filePath = path.join(uploadsDir, filename);
        fs.writeFileSync(filePath, buffer);

        fileRecord = await storage.createAiFile({
          conversationId: session_id,
          filename,
          mimeType: mimeRaw,
          filePath,
          fileSize: buffer.length,
        });
      }

      const openaiKey = process.env.OPEN_AI_API_KEY;
      if (!openaiKey) {
        return res.status(500).json({ message: "OpenAI API key not configured" });
      }

      const boundary = `----FormBoundary${crypto.randomBytes(16).toString("hex")}`;
      const formParts: Buffer[] = [];

      formParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${filename}"\r\nContent-Type: ${mimeStr}\r\n\r\n`
      ));
      formParts.push(buffer);
      formParts.push(Buffer.from("\r\n"));
      formParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1\r\n`
      ));
      formParts.push(Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="response_format"\r\n\r\ntext\r\n`
      ));
      formParts.push(Buffer.from(`--${boundary}--\r\n`));

      const formBody = Buffer.concat(formParts);

      const whisperRes = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${openaiKey}`,
          "Content-Type": `multipart/form-data; boundary=${boundary}`,
        },
        body: formBody,
      });

      if (!whisperRes.ok) {
        const errBody = await whisperRes.text();
        console.error("[Voice Transcribe] Whisper API error:", whisperRes.status, errBody);
        return res.status(502).json({ message: "Transcription service error" });
      }

      const transcription = (await whisperRes.text()).trim();

      if (fileRecord?.filePath) {
        try { fs.unlinkSync(fileRecord.filePath); } catch {}
        await db.delete(aiFiles).where(eq(aiFiles.id, fileRecord.id));
      }

      res.json({ transcription });
    } catch (err: any) {
      console.error("[Voice Transcribe] error:", err);
      res.status(500).json({ message: "Transcription failed" });
    }
  });

  // ─── AI File Upload ──────────────────────────────────────────────────

  app.post("/api/agent-conversations/:id/files", requireAgency, async (req, res) => {
    const sessionId = req.params.id;
    const { filename, mimeType, data } = req.body as { filename?: string; mimeType?: string; data?: string };

    if (!filename || !data) {
      return res.status(400).json({ message: "filename and data (base64) are required" });
    }

    const ext = path.extname(filename).toLowerCase();
    if (!ALLOWED_FILE_EXTENSIONS.has(ext)) {
      return res.status(400).json({ message: "Unsupported file type. Allowed: PDF, images (JPEG, PNG, GIF, WebP), spreadsheets (CSV, XLSX, XLS)" });
    }

    try {
      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      const buffer = Buffer.from(data, "base64");

      if (buffer.length > MAX_FILE_SIZE) {
        return res.status(400).json({ message: `File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB` });
      }

      const uploadsDir = path.join("/home/gabriel/LeadAwakerApp", "uploads", "agent-files", sessionId);
      fs.mkdirSync(uploadsDir, { recursive: true });
      const safeFilename = `${Date.now()}-${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      const filePath = path.join(uploadsDir, safeFilename);
      fs.writeFileSync(filePath, buffer);

      const isImage = ALLOWED_IMAGE_EXTENSIONS.has(ext);
      const isSpreadsheet = ALLOWED_SPREADSHEET_EXTENSIONS.has(ext);

      let transcription: string | null = null;
      if (ext === ".pdf") {
        try {
          const { PDFParse } = await import("pdf-parse") as any;
          const parser = new PDFParse({ data: buffer });
          await parser.load();
          const pdfResult = await parser.getText();
          parser.destroy();
          let pdfText: string = pdfResult.text || "";
          if (pdfText.length > 80000) {
            pdfText = pdfText.slice(0, 80000) + "\n\n[... truncated at 80000 characters]";
          }
          if (!pdfText.trim()) {
            pdfText = "[PDF contains no extractable text — may be scanned/image-based]";
          }
          transcription = pdfText;
        } catch (parseErr) {
          console.error("[AI Files] PDF parse error:", parseErr);
          transcription = `[Error parsing PDF: ${(parseErr as Error).message}]`;
        }
      } else if (isSpreadsheet) {
        try {
          if (ext === ".csv") {
            transcription = buffer.toString("utf-8");
            if (transcription.length > 50000) {
              const lines = transcription.split("\n");
              const header = lines[0] || "";
              transcription = lines.slice(0, 500).join("\n") + `\n\n[... truncated: showing 500 of ${lines.length} rows. Header: ${header}]`;
            }
          } else {
            const XLSX = await import("xlsx");
            const workbook = XLSX.read(buffer, { type: "buffer" });
            const sheets: string[] = [];
            for (const sheetName of workbook.SheetNames.slice(0, 5)) {
              const sheet = workbook.Sheets[sheetName];
              const csvContent = XLSX.utils.sheet_to_csv(sheet);
              sheets.push(`[Sheet: ${sheetName}]\n${csvContent}`);
            }
            transcription = sheets.join("\n\n");
            if (transcription.length > 50000) {
              transcription = transcription.slice(0, 50000) + "\n\n[... truncated at 50000 characters]";
            }
          }
        } catch (parseErr) {
          console.error("[AI Files] Spreadsheet parse error:", parseErr);
          transcription = `[Error parsing spreadsheet: ${(parseErr as Error).message}]`;
        }
      }

      const resolvedMimeType = mimeType
        || (ext === ".pdf" ? "application/pdf"
          : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg"
          : ext === ".png" ? "image/png"
          : ext === ".gif" ? "image/gif"
          : ext === ".webp" ? "image/webp"
          : ext === ".csv" ? "text/csv"
          : ext === ".xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          : ext === ".xls" ? "application/vnd.ms-excel"
          : "application/octet-stream");

      const fileRecord = await storage.createAiFile({
        conversationId: sessionId,
        filename,
        mimeType: resolvedMimeType,
        filePath,
        fileSize: buffer.length,
        ...(transcription ? { transcription } : {}),
      });

      res.status(201).json({
        ...fileRecord,
        fileType: isImage ? "image" : isSpreadsheet ? "spreadsheet" : "pdf",
        ...(isImage ? { thumbnailUrl: `/api/agent-files/${fileRecord.id}/thumbnail` } : {}),
      });
    } catch (err: any) {
      console.error("[AI Files] upload error:", err);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  // GET /api/agent-files/:id/thumbnail — serve image for thumbnail preview
  app.get("/api/agent-files/:id/thumbnail", requireAgency, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id, 10);
      if (isNaN(fileId)) return res.status(400).json({ message: "Invalid file ID" });
      const [fileRecord] = await db.select().from(aiFiles).where(eq(aiFiles.id, fileId));
      if (!fileRecord || !fileRecord.filePath) return res.status(404).json({ message: "File not found" });
      const ext = path.extname(fileRecord.filename).toLowerCase();
      if (!ALLOWED_IMAGE_EXTENSIONS.has(ext)) return res.status(400).json({ message: "Not an image file" });
      if (!fs.existsSync(fileRecord.filePath)) return res.status(404).json({ message: "File not found on disk" });
      res.setHeader("Content-Type", fileRecord.mimeType || "image/jpeg");
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(fileRecord.filePath).pipe(res);
    } catch (err: any) {
      console.error("[AI Files] thumbnail error:", err);
      res.status(500).json({ message: "Failed to serve thumbnail" });
    }
  });

  // GET /api/agent-files/:id/download — serve full file for download
  app.get("/api/agent-files/:id/download", requireAgency, async (req, res) => {
    try {
      const fileId = parseInt(req.params.id, 10);
      if (isNaN(fileId)) return res.status(400).json({ message: "Invalid file ID" });
      const [fileRecord] = await db.select().from(aiFiles).where(eq(aiFiles.id, fileId));
      if (!fileRecord || !fileRecord.filePath) return res.status(404).json({ message: "File not found" });
      if (!fs.existsSync(fileRecord.filePath)) return res.status(404).json({ message: "File not found on disk" });
      const contentType = fileRecord.mimeType || "application/octet-stream";
      res.setHeader("Content-Type", contentType);
      res.setHeader("Content-Disposition", `inline; filename="${fileRecord.filename}"`);
      res.setHeader("Cache-Control", "public, max-age=86400");
      fs.createReadStream(fileRecord.filePath).pipe(res);
    } catch (err: any) {
      console.error("[AI Files] download error:", err);
      res.status(500).json({ message: "Failed to serve file" });
    }
  });

  // ─── CRM Tool Execution ───────────────────────────────────────────

  app.post("/api/agents/:agentId/execute-crm-tool", requireAgency, async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId, 10);
      if (isNaN(agentId)) return res.status(400).json({ message: "Invalid agent ID" });

      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const { toolName, args } = req.body;
      if (!toolName) return res.status(400).json({ message: "toolName is required" });

      const permissions = (agent.permissions || {}) as AgentPermissions;
      const result = await executeCrmTool(
        { name: toolName, args: args || {} },
        permissions,
      );

      res.json(result);
    } catch (err: any) {
      console.error("[CRM Tools] execute error:", err);
      res.status(500).json({ message: "Failed to execute CRM tool" });
    }
  });

  app.post("/api/agents/:agentId/execute-crm-tools", requireAgency, async (req, res) => {
    try {
      const agentId = parseInt(req.params.agentId, 10);
      if (isNaN(agentId)) return res.status(400).json({ message: "Invalid agent ID" });

      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, agentId));
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const { toolCalls } = req.body;
      if (!Array.isArray(toolCalls) || toolCalls.length === 0) {
        return res.status(400).json({ message: "toolCalls array is required" });
      }

      const permissions = (agent.permissions || {}) as AgentPermissions;
      const results = await executeCrmToolCalls(toolCalls, permissions);
      res.json({ results });
    } catch (err: any) {
      console.error("[CRM Tools] batch execute error:", err);
      res.status(500).json({ message: "Failed to execute CRM tools" });
    }
  });

  // POST /api/agent-conversations/:id/confirm-tools — execute confirmed destructive actions
  app.post("/api/agent-conversations/:id/confirm-tools", requireAgency, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { actions, agentId } = req.body;

      if (!Array.isArray(actions) || actions.length === 0) {
        return res.status(400).json({ message: "actions array is required" });
      }
      if (!agentId) {
        return res.status(400).json({ message: "agentId is required" });
      }

      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, Number(agentId)));
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const permissions = (agent.permissions || {}) as AgentPermissions;

      const toolCalls: CrmToolCall[] = actions.map((a: { toolName: string; args: Record<string, unknown> }) => ({
        name: a.toolName,
        args: a.args || {},
      }));

      const results = await executeCrmToolCalls(toolCalls, permissions);

      console.log(`[CRM Tools] User confirmed ${results.length} destructive action(s) for session ${sessionId}`);

      const toolResultsText = results.map((r) => {
        if (r.success) {
          return `[Tool: ${r.tool}] Confirmed & executed:\n${JSON.stringify(r.data, null, 2)}`;
        }
        return `[Tool: ${r.tool}] Error: ${r.error}`;
      }).join("\n\n");

      await storage.createAiMessage({
        sessionId,
        role: "tool",
        content: toolResultsText,
      });

      res.json({ results });
    } catch (err: any) {
      console.error("[CRM Tools] confirm-tools error:", err);
      res.status(500).json({ message: "Failed to execute confirmed actions" });
    }
  });

  // POST /api/agent-conversations/:id/cancel-tools — log that user cancelled destructive actions
  app.post("/api/agent-conversations/:id/cancel-tools", requireAgency, async (req, res) => {
    try {
      const sessionId = req.params.id;
      const { actions } = req.body;

      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      const descriptions = (actions || []).map((a: { description?: string; toolName?: string }) =>
        a.description || a.toolName || "unknown action"
      );

      console.log(`[CRM Tools] User cancelled destructive action(s) for session ${sessionId}: ${descriptions.join(", ")}`);

      await storage.createAiMessage({
        sessionId,
        role: "tool",
        content: `[User Action] The user cancelled the following destructive action(s):\n${descriptions.map((d: string) => `- ${d}`).join("\n")}\n\nThe actions were NOT executed.`,
      });

      res.json({ cancelled: true });
    } catch (err: any) {
      console.error("[CRM Tools] cancel-tools error:", err);
      res.status(500).json({ message: "Failed to log cancellation" });
    }
  });

  // ─── Send message to agent (main streaming endpoint) ──────────────

  app.post("/api/agent-conversations/:id/messages", requireAgency, async (req, res) => {
    const sessionId = req.params.id;
    const { content, pageContext, fileId } = req.body;

    if (!content?.trim()) {
      return res.status(400).json({ message: "content is required" });
    }

    try {
      const session = await storage.getAiSessionBySessionId(sessionId);
      if (!session) return res.status(404).json({ message: "Conversation not found" });

      const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, session.agentId));
      if (!agent) return res.status(404).json({ message: "Agent not found" });

      const userMessage = await storage.createAiMessage({
        sessionId,
        role: "user",
        content: content.trim(),
        pageContext: pageContext || null,
        metadata: {
          model: session.model || agent.model || "claude-sonnet-4-20250514",
          thinkingLevel: session.thinkingLevel || agent.thinkingLevel || "medium",
          ...(fileId ? { fileId: Number(fileId) } : {}),
        },
        attachments: fileId ? [{ fileId: Number(fileId) }] : null,
      });

      const history = await storage.getAiMessagesBySessionId(sessionId);
      const isFirstMessage = history.filter((m) => m.role === "user").length <= 1;

      let systemPrompt = agent.systemPrompt || "";
      if (agent.systemPromptId) {
        const linkedPrompt = await storage.getPromptById(agent.systemPromptId);
        if (linkedPrompt?.promptText) {
          systemPrompt = linkedPrompt.promptText;
        }
      }

      const agentPermissions = (agent.permissions || {}) as AgentPermissions;
      const crmToolsPrompt = buildCrmToolsPrompt(agentPermissions);
      if (crmToolsPrompt) {
        systemPrompt += crmToolsPrompt;
      }

      systemPrompt += GOG_INSTRUCTIONS;

      const hasCliSession = !!session.cliSessionId;

      let fullPrompt = "";
      let appendSystemPrompt = "";

      if (!hasCliSession) {
        if (systemPrompt) {
          fullPrompt += `[System Instructions]\n${systemPrompt}\n\n`;
        }

        if (pageContext) {
          fullPrompt += buildPageContextBlock(pageContext);
        }

        const allConversationFiles = await storage.getAiFilesByConversationId(sessionId);
        const currentFileId = fileId ? Number(fileId) : null;
        if (currentFileId) {
          await db.update(aiFiles).set({ messageId: userMessage.id }).where(eq(aiFiles.id, currentFileId));
        }
        for (const fr of allConversationFiles) {
          const isCurrent = currentFileId !== null && fr.id === currentFileId;
          fullPrompt += buildFileContextBlock(fr, isCurrent);
        }

        fullPrompt += content.trim();
      } else {
        const currentFileId = fileId ? Number(fileId) : null;
        if (currentFileId) {
          await db.update(aiFiles).set({ messageId: userMessage.id }).where(eq(aiFiles.id, currentFileId));
          const allConversationFiles = await storage.getAiFilesByConversationId(sessionId);
          const currentFile = allConversationFiles.find(f => f.id === currentFileId);
          if (currentFile) {
            fullPrompt += buildFileContextBlock(currentFile, true);
          }
        }

        if (pageContext) {
          appendSystemPrompt = buildPageContextBlock(pageContext);
        }

        fullPrompt += content.trim();
      }

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ type: "message_id", id: userMessage.id })}\n\n`);

      const cwd = getSessionCwd(sessionId, agent.type);
      const sessionModel = session.model || agent.model || "claude-sonnet-4-20250514";

      streamClaudeResponse({
        prompt: fullPrompt,
        cwd,
        bypassPermissions: true,
        model: sessionModel,
        cliSessionId: session.cliSessionId || undefined,
        agentType: agent.type,
        appendSystemPrompt: appendSystemPrompt || undefined,
        res,
        beforeDone: async (fullText, sseRes) => {
          const toolCalls = parseCrmToolCalls(fullText);
          if (toolCalls.length > 0) {
            const safeCalls = toolCalls.filter((tc) => !isDestructiveToolCall(tc));
            const destructiveCalls = toolCalls.filter((tc) => isDestructiveToolCall(tc));

            if (safeCalls.length > 0) {
              const results = await executeCrmToolCalls(safeCalls, agentPermissions);
              for (const result of results) {
                sseRes.write(`data: ${JSON.stringify({ type: "tool_result", ...result })}\n\n`);
              }
              await storage.createAiMessage({
                sessionId, role: "tool",
                content: results.map((r) => r.success ? `[Tool: ${r.tool}] Result:\n${JSON.stringify(r.data, null, 2)}` : `[Tool: ${r.tool}] Error: ${r.error}`).join("\n\n"),
              });
            }

            if (destructiveCalls.length > 0) {
              sseRes.write(`data: ${JSON.stringify({
                type: "pending_confirmation", sessionId, agentId: agent.id,
                actions: destructiveCalls.map((tc) => ({ toolName: tc.name, args: tc.args, description: describeToolCall(tc) })),
              })}\n\n`);
            }
          }

          const gogCommands = parseGogCommands(fullText);
          if (gogCommands.length > 0) {
            const gogResults = await executeGogCommands(gogCommands);
            for (const result of gogResults) {
              sseRes.write(`data: ${JSON.stringify({ type: "tool_result", tool: result.command, success: result.success, data: result.output, error: result.error })}\n\n`);
            }
            await storage.createAiMessage({
              sessionId, role: "tool",
              content: gogResults.map((r) => r.success ? `[GOG: ${r.command}] Result:\n${r.output}` : `[GOG: ${r.command}] Error: ${r.error}`).join("\n\n"),
            });
          }
        },
        onDone: async (fullText, _subAgentBlocks, cliSessionId, usage) => {
          try {
            if (fullText.trim()) {
              await storage.createAiMessage({
                sessionId,
                role: "assistant",
                content: fullText.trim(),
                metadata: {
                  model: sessionModel,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  costUsd: usage.costUsd,
                },
              });
            }

            const sessionUpdate: Record<string, unknown> = {
              totalInputTokens: (session.totalInputTokens || 0) + usage.inputTokens,
              totalOutputTokens: (session.totalOutputTokens || 0) + usage.outputTokens,
            };
            if (cliSessionId && cliSessionId !== session.cliSessionId) {
              sessionUpdate.cliSessionId = cliSessionId;
            }
            await storage.updateAiSession(session.id, sessionUpdate as any);

            if (!session.title && isFirstMessage && content.trim().length > 0 && fullText.trim().length > 0) {
              generateConversationTitle(content.trim(), fullText.trim())
                .then((aiTitle) => {
                  storage.updateAiSession(session.id, { title: aiTitle });
                  console.log(`[Agent Conversations] Title: "${aiTitle}" for session ${session.id}`);
                })
                .catch(() => {
                  const fallback = content.trim().slice(0, 60) + (content.trim().length > 60 ? "..." : "");
                  storage.updateAiSession(session.id, { title: fallback });
                });
            }
          } catch (err) {
            console.error("[Agent Conversations] onDone error:", err);
          }
        },
      });
    } catch (err: any) {
      console.error("[Agent Conversations] send error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to send message" });
      }
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Internal error" })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", cliSessionId: null, subAgentBlocks: [], usage: { inputTokens: 0, outputTokens: 0, costUsd: 0 } })}\n\n`);
      res.end();
    }
  });

  // ─── Agent Skills (canonical) ──────────────────────────────────────

  // GET /api/agent-skills — list global skills from ~/.claude/skills/
  app.get("/api/agent-skills", requireAgency, async (_req, res) => {
    try {
      const skillsDir = path.join(process.env.HOME || "/home/gabriel", ".claude", "skills");
      if (!fs.existsSync(skillsDir)) {
        return res.json([]);
      }
      const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
      const skills: { id: string; name: string; description: string; path: string }[] = [];

      for (const entry of entries) {
        if (!entry.isDirectory() || entry.name === "learned") continue;
        const skillMdPath = path.join(skillsDir, entry.name, "SKILL.md");
        if (!fs.existsSync(skillMdPath)) continue;
        try {
          const raw = fs.readFileSync(skillMdPath, "utf-8");
          const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
          let name = entry.name;
          let description = "";
          if (fmMatch) {
            const fm = fmMatch[1];
            const nameMatch = fm.match(/^name:\s*(.+)$/m);
            const descMatch = fm.match(/^description:\s*(.+)$/m);
            if (nameMatch) name = nameMatch[1].trim();
            if (descMatch) description = descMatch[1].trim();
          }
          skills.push({ id: entry.name, name, description, path: skillMdPath });
        } catch {
          // Skip unreadable skill files
        }
      }
      skills.sort((a, b) => a.name.localeCompare(b.name));
      res.json(skills);
    } catch (err) {
      console.error("[Agent Skills] Error listing skills:", err);
      res.json([]);
    }
  });

  // POST /api/agent-skills/execute — execute a skill in agent conversation context
  app.post("/api/agent-skills/execute", requireAgency, async (req, res) => {
    const { skillId, sessionId, content } = req.body;

    if (!skillId) return res.status(400).json({ message: "skillId is required" });
    if (!sessionId) return res.status(400).json({ message: "sessionId is required" });

    const skillsDir = path.join(process.env.HOME || "/home/gabriel", ".claude", "skills");
    const skillMdPath = path.join(skillsDir, skillId, "SKILL.md");
    if (!fs.existsSync(skillMdPath)) {
      return res.status(404).json({ message: `Skill '${skillId}' not found` });
    }

    const session = await storage.getAiSessionBySessionId(sessionId);
    if (!session) return res.status(404).json({ message: "Session not found" });

    const [agent] = await db.select().from(aiAgents).where(eq(aiAgents.id, session.agentId));
    if (!agent) return res.status(404).json({ message: "Agent not found" });

    try {
      const raw = fs.readFileSync(skillMdPath, "utf-8");
      const fmMatch = raw.match(/^---\n([\s\S]*?)\n---/);
      let skillName = skillId;
      let skillInstructions = raw;
      if (fmMatch) {
        const nameMatch = fmMatch[1].match(/^name:\s*(.+)$/m);
        if (nameMatch) skillName = nameMatch[1].trim();
        skillInstructions = raw.slice(fmMatch[0].length).trim();
      }

      const userContent = content?.trim() || `Execute skill: ${skillName}`;
      const userMessage = await storage.createAiMessage({
        sessionId,
        role: "user",
        content: userContent,
        metadata: {
          skillId,
          skillName,
          model: session.model || agent.model || "claude-sonnet-4-20250514",
        },
      });

      const history = await storage.getAiMessagesBySessionId(sessionId);
      const isFirstMessage = history.filter((m) => m.role === "user").length <= 1;

      let systemPrompt = agent.systemPrompt || "";
      if (agent.systemPromptId) {
        const linkedPrompt = await storage.getPromptById(agent.systemPromptId);
        if (linkedPrompt?.promptText) systemPrompt = linkedPrompt.promptText;
      }

      let fullPrompt = "";
      if (systemPrompt) {
        fullPrompt += systemPrompt + "\n\n";
      }

      fullPrompt += formatConversationHistory(history);
      fullPrompt += `[Skill Instructions: ${skillName}]\n${skillInstructions}\n\n`;
      fullPrompt += userContent;

      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");
      res.flushHeaders();

      res.write(`data: ${JSON.stringify({ type: "message_id", id: userMessage.id })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "skill_metadata", skillId, skillName })}\n\n`);

      const cwd = getSessionCwd(sessionId, agent.type);
      const sessionModel = session.model || agent.model || "claude-sonnet-4-20250514";
      const sessionThinking = session.thinkingLevel || agent.thinkingLevel || "medium";

      streamClaudeResponse({
        prompt: fullPrompt,
        cwd,
        bypassPermissions: true,
        model: sessionModel,
        thinkingLevel: sessionThinking,
        res,
        onDone: async (fullText, _subAgentBlocks, _cliSessionId, usage) => {
          try {
            if (fullText.trim()) {
              await storage.createAiMessage({
                sessionId,
                role: "assistant",
                content: fullText.trim(),
                metadata: {
                  skillId,
                  skillName,
                  model: sessionModel,
                  inputTokens: usage.inputTokens,
                  outputTokens: usage.outputTokens,
                  costUsd: usage.costUsd,
                },
              });
            }
            await storage.updateAiSession(session.id, {
              totalInputTokens: (session.totalInputTokens || 0) + usage.inputTokens,
              totalOutputTokens: (session.totalOutputTokens || 0) + usage.outputTokens,
            });

            if (!session.title && isFirstMessage && userContent.length > 0 && fullText.trim().length > 0) {
              generateConversationTitle(userContent, fullText.trim())
                .then((aiTitle) => {
                  storage.updateAiSession(session.id, { title: aiTitle });
                })
                .catch(() => {
                  storage.updateAiSession(session.id, { title: `Skill: ${skillName}` });
                });
            }
          } catch (err) {
            console.error("[Agent Skills] onDone error:", err);
          }
        },
      });
    } catch (err: any) {
      console.error("[Agent Skills] Execute error:", err);
      if (!res.headersSent) {
        return res.status(500).json({ message: "Failed to execute skill" });
      }
      res.write(`data: ${JSON.stringify({ type: "error", message: err.message || "Skill execution failed" })}\n\n`);
      res.write(`data: ${JSON.stringify({ type: "done", subAgentBlocks: [] })}\n\n`);
      res.end();
    }
  });
}

// ─── Background notifiers ──────────────────────────────────────────────────

export function startSupportCleanup(): void {
  const runSupportCleanup = async () => {
    try {
      const result = await storage.cleanupOldSupportData(1);
      if (result.sessions > 0 || result.messages > 0) {
        console.log(`[support-chat] Cleanup: removed ${result.messages} messages, ${result.sessions} sessions older than 1 day`);
      }
    } catch (err) {
      console.error("[support-chat] Cleanup error:", err);
    }
  };
  runSupportCleanup();
  setInterval(runSupportCleanup, 24 * 60 * 60 * 1000);
}

export async function seedSupportBotPrompt(): Promise<void> {
  try {
    const existing = await storage.getPrompts();
    const hasBot = existing.some((p: any) => (p.name || p.Name) === "Lead Awaker Support Bot");
    if (!hasBot) {
      await storage.createPrompt({
        name: "Lead Awaker Support Bot",
        promptText: "",
        systemMessage: `You are Tom, the Lead Awaker support assistant. You help clients understand and get the most out of Lead Awaker — an AI-powered WhatsApp lead reactivation platform that converts inactive leads into booked calls.

PERSONALITY
- Friendly, concise, and professional
- Use simple language — no technical jargon unless the user is technical
- Keep responses under 300 tokens

PLATFORM KNOWLEDGE
1. Campaigns — Create WhatsApp outreach campaigns targeting inactive leads with AI-powered messaging sequences
2. Lead Pipeline — Visual Kanban board tracking leads: New → Contacted → Responded → Multiple Responses → Qualified → Booked → Closed → Lost → DND
3. AI Conversations — Automated WhatsApp messages that engage leads naturally, with smart follow-up bumps
4. Lead Scoring — Automatic 0-100 scoring based on engagement signals, response quality, and conversion likelihood
5. Manual Takeover — Human agents can take over any AI conversation at any time and hand back to AI when done
6. Calendar — View and manage scheduled calls and follow-ups with leads
7. Analytics — Campaign performance, conversion rates, cost-per-lead, ROI tracking
8. Tags — Organize and segment leads with custom color-coded tags
9. Billing — Track expenses, invoices, and campaign costs with BTW/VAT support

WHAT YOU CAN HELP WITH
- Explaining how any feature works
- Guiding through common workflows (creating campaigns, managing leads, reading analytics)
- Suggesting best practices for lead reactivation
- Clarifying what pipeline stages mean and when leads move between them
- Explaining how AI conversations and bump sequences work

WHAT YOU CANNOT DO
- Access or modify account data, leads, or campaigns directly
- Process payments or change billing information
- Make promises about specific conversion rates or results
- Discuss other clients' accounts or data

ESCALATION RULES — When you determine a human agent is needed:
- User explicitly asks for a human
- You cannot resolve the issue after 2-3 exchanges on the same topic
- The question involves billing disputes, account deletion, or sensitive changes
- User reports a bug or technical issue you cannot diagnose
- User is visibly frustrated
When escalating, write a natural farewell/handoff message to the user, then append [ESCALATE] at the very end of your response. Do NOT mention this marker to the user — it is processed automatically by the system.

GUARDRAILS
- Stay strictly on Lead Awaker topics. Politely redirect off-topic questions.
- Never fabricate features that don't exist
- If unsure, say "I'm not sure about that — let me connect you with an agent who can help." and append [ESCALATE]
- Maximum response length: 300 tokens`,
        model: "gpt-5-nano",
        temperature: "0.6",
        maxTokens: "400",
        status: "active",
        useCase: "customer-support",
        notes: "System prompt for the in-app support chatbot widget. Edit here to update bot behavior.",
      } as any);
      console.log("[support-chat] Seeded 'Lead Awaker Support Bot' prompt");
    }
  } catch (err) {
    console.error("[support-chat] Failed to seed prompt:", err);
  }
}

export async function seedAiAgents(): Promise<void> {
  try {
    const { db: dbInstance } = await import("../db");
    const { aiAgents: aiAgentsTable } = await import("@shared/schema");
    await seedDefaultAiAgents(dbInstance, aiAgentsTable);
  } catch (err) {
    console.error("[AI Agents] Seed error:", err);
  }
}

export function startAutomationFailureNotifier(): void {
  const notify = createAndDispatchNotification;
  let lastAutomationFailureCheck = new Date();

  async function checkAutomationFailures() {
    const since = lastAutomationFailureCheck;
    lastAutomationFailureCheck = new Date();
    try {
      const failures = await storage.getRecentFailedAutomationLogs(since);
      if (failures.length === 0) return;
      const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
      if (agencyUsers.length === 0) return;
      for (const failure of failures) {
        for (const user of agencyUsers) {
          await notify({
            type: "critical_automation_failure",
            title: `${failure.workflowName || "Automation"} failed`,
            body: failure.stepName || failure.errorCode || null,
            userId: user.id!,
            accountId: user.accountsId ?? null,
            read: false,
            link: "/agency/automation-logs",
          });
        }
      }
    } catch (err) {
      console.error("[AutomationNotifier]", err);
    }
  }

  setInterval(checkAutomationFailures, 5 * 60 * 1000);
}

export function startCampaignFinishedNotifier(): void {
  const campaignFinishedNotified = new Set<number>();

  async function checkCampaignsFinished() {
    try {
      const activeCampaigns = await db
        .select()
        .from(campaigns)
        .where(eq(campaigns.status, "active"));

      for (const campaign of activeCampaigns) {
        if (!campaign.id || campaignFinishedNotified.has(campaign.id)) continue;
        if ((campaign as any).isDemo) continue;

        const [pending] = await db
          .select({ cnt: count() })
          .from(leads)
          .where(
            and(
              eq(leads.campaignsId, campaign.id),
              sql`${leads.conversionStatus} IN ('New', 'Queued')`,
            ),
          );

        const [total] = await db
          .select({ cnt: count() })
          .from(leads)
          .where(eq(leads.campaignsId, campaign.id));

        if (total.cnt > 0 && pending.cnt === 0) {
          campaignFinishedNotified.add(campaign.id);

          const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
          for (const user of agencyUsers) {
            await createAndDispatchNotification({
              type: "campaign_finished",
              title: `Campaign finished: ${(campaign as any).title || campaign.name || "Untitled"}`,
              body: `All ${total.cnt} leads have been contacted`,
              userId: user.id!,
              accountId: campaign.accountsId ?? null,
              read: false,
              link: "/campaigns",
              leadId: null,
            });
          }
        }
      }
    } catch (err) {
      console.error("[CampaignFinishedNotifier]", err);
    }
  }

  setInterval(checkCampaignsFinished, 10 * 60 * 1000);
}
