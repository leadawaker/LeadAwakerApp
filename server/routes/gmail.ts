import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync } from "./_helpers";
import { broadcast } from "../sse";
import { getAuthUrl, exchangeCode, encryptTokens, getGmailClient, BRANDED_SIGNATURE } from "../gmail";

export function registerGmailRoutes(app: Express): void {
  // ─── Gmail OAuth ─────────────────────────────────────────────────────

  app.get("/api/gmail/oauth/authorize", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    const url = getAuthUrl();
    res.redirect(url);
  }));

  app.get("/api/gmail/oauth/callback", wrapAsync(async (req, res) => {
    console.log("[Gmail OAuth] Callback query params:", JSON.stringify(req.query));
    const error = req.query.error as string;
    if (error) {
      console.error("[Gmail OAuth] Google returned error:", error);
      const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
      return res.redirect(`${base}/agency/settings?gmail=error&reason=${encodeURIComponent(error)}`);
    }
    const code = req.query.code as string;
    if (!code) return res.status(400).json({ message: "Missing authorization code" });

    try {
      const { tokens, email } = await exchangeCode(code);
      const encrypted = encryptTokens(tokens);

      await storage.upsertGmailSyncState({
        accountEmail: email,
        oauthTokensEncrypted: encrypted,
        lastHistoryId: null,
        lastFullSyncAt: null,
      });

      const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
      res.redirect(`${base}/agency/settings?gmail=connected`);
    } catch (err: any) {
      console.error("[Gmail OAuth] Callback error:", err);
      const base = process.env.FRONTEND_URL || `${req.protocol}://${req.get("host")}`;
      res.redirect(`${base}/agency/settings?gmail=error`);
    }
  }));

  app.get("/api/gmail/oauth/status", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (state?.oauthTokensEncrypted) {
      res.json({ connected: true, email: state.accountEmail });
    } else {
      res.json({ connected: false });
    }
  }));

  app.post("/api/gmail/oauth/disconnect", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    await storage.deleteGmailSyncState("leadawaker@gmail.com");
    res.json({ ok: true });
  }));

  // Manual sync trigger
  app.post("/api/gmail/sync", requireAuth, requireAgency, wrapAsync(async (_req, res) => {
    const { syncEmails } = await import("../gmail-sync");
    await syncEmails();
    res.json({ ok: true });
  }));

  // ─── Gmail Send ────────────────────────────────────────────────────────

  app.post("/api/gmail/send", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { to, subject, htmlBody, prospectId, replyToMessageId, threadId } = req.body;

    if (!to || !subject || !htmlBody || !prospectId) {
      return res.status(400).json({ message: "Missing required fields: to, subject, htmlBody, prospectId" });
    }

    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (!state?.oauthTokensEncrypted) {
      return res.status(400).json({ message: "Gmail not connected. Please connect your Gmail account first." });
    }

    const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted);

    const fullHtml = `${htmlBody}\n${BRANDED_SIGNATURE}`;

    const fromHeader = "Gabriel Barbosa Fronza <gabriel@leadawaker.com>";
    const messageParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
    ];

    if (replyToMessageId) {
      messageParts.push(`In-Reply-To: ${replyToMessageId}`);
      messageParts.push(`References: ${replyToMessageId}`);
    }

    messageParts.push("", fullHtml);
    const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

    const sendParams: { userId: string; requestBody: { raw: string; threadId?: string } } = {
      userId: "me",
      requestBody: { raw: rawMessage },
    };
    if (threadId) {
      sendParams.requestBody.threadId = threadId;
    }

    const sent = await gmailClient.users.messages.send(sendParams);
    const gmailMessageId = sent.data.id || "";
    const gmailThreadId = sent.data.threadId || threadId || "";

    const interaction = await storage.createInteraction({
      type: "email",
      direction: "outbound",
      status: "delivered",
      content: htmlBody,
      metadata: {
        gmailMessageId,
        gmailThreadId,
        subject,
        from: fromHeader,
        to,
        fromEmail: "gabriel@leadawaker.com",
        toEmail: to,
      },
      prospectId,
      sentAt: new Date(),
      conversationThreadId: gmailThreadId || null,
      accountId: 1,
    } as any);

    const prospect = await storage.getProspectById(prospectId);
    if (prospect) {
      const updates: Record<string, unknown> = {
        lastContactedAt: new Date(),
        contactMethod: "email",
        outreachStatus: "email_sent",
        followUpCount: (prospect.followUpCount ?? 0) + 1,
      };
      if (prospect.status === "New") {
        updates.status = "Contacted";
      }
      if (!prospect.firstContactedAt) {
        updates.firstContactedAt = new Date();
      }
      await storage.updateProspect(prospectId, updates as any);
    }

    broadcast(1, "new_interaction", interaction);

    res.status(201).json(interaction);
  }));

  // ─── Gmail: Create Draft ─────────────────────────────────────────────────

  app.post("/api/gmail/draft", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { to, subject, htmlBody, prospectId, replyToMessageId, threadId } = req.body;

    if (!to || !subject || !htmlBody) {
      return res.status(400).json({ message: "Missing required fields: to, subject, htmlBody" });
    }

    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (!state?.oauthTokensEncrypted) {
      return res.status(400).json({ message: "Gmail not connected." });
    }

    const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted);

    const fullHtml = `${htmlBody}\n${BRANDED_SIGNATURE}`;
    const fromHeader = "Gabriel Barbosa Fronza <gabriel@leadawaker.com>";
    const messageParts = [
      `From: ${fromHeader}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `MIME-Version: 1.0`,
      `Content-Type: text/html; charset="UTF-8"`,
    ];

    if (replyToMessageId) {
      messageParts.push(`In-Reply-To: ${replyToMessageId}`);
      messageParts.push(`References: ${replyToMessageId}`);
    }

    messageParts.push("", fullHtml);
    const rawMessage = Buffer.from(messageParts.join("\r\n")).toString("base64url");

    const draftParams: { userId: string; requestBody: { message: { raw: string; threadId?: string } } } = {
      userId: "me",
      requestBody: { message: { raw: rawMessage } },
    };
    if (threadId) {
      draftParams.requestBody.message.threadId = threadId;
    }

    const draft = await gmailClient.users.drafts.create(draftParams);

    res.json({
      draftId: draft.data.id,
      messageId: draft.data.message?.id,
      threadId: draft.data.message?.threadId,
    });
  }));

  // ─── Gmail: Delete/Trash Email ────────────────────────────────────────────

  app.delete("/api/gmail/messages/:messageId", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { messageId } = req.params;
    const { permanent } = req.query;

    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (!state?.oauthTokensEncrypted) {
      return res.status(400).json({ message: "Gmail not connected." });
    }

    const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted);

    if (permanent === "true") {
      await gmailClient.users.messages.delete({ userId: "me", id: messageId });
    } else {
      await gmailClient.users.messages.trash({ userId: "me", id: messageId });
    }

    res.json({ ok: true, action: permanent === "true" ? "deleted" : "trashed" });
  }));

  // ─── Gmail: Get Email by ID ──────────────────────────────────────────────

  app.get("/api/gmail/messages/:messageId", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { messageId } = req.params;

    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (!state?.oauthTokensEncrypted) {
      return res.status(400).json({ message: "Gmail not connected." });
    }

    const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted);

    const msg = await gmailClient.users.messages.get({
      userId: "me",
      id: messageId,
      format: "full",
    });

    const headers = msg.data.payload?.headers || [];
    const getHeader = (name: string) =>
      headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";

    res.json({
      id: msg.data.id,
      threadId: msg.data.threadId,
      snippet: msg.data.snippet,
      from: getHeader("From"),
      to: getHeader("To"),
      cc: getHeader("Cc"),
      subject: getHeader("Subject"),
      date: getHeader("Date"),
      labels: msg.data.labelIds,
    });
  }));

  // ─── Gmail: Search Emails ──────────────────────────────────────────────

  app.get("/api/gmail/search", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { q, maxResults } = req.query;

    if (!q) {
      return res.status(400).json({ message: "Missing required query parameter: q" });
    }

    const state = await storage.getGmailSyncState("leadawaker@gmail.com");
    if (!state?.oauthTokensEncrypted) {
      return res.status(400).json({ message: "Gmail not connected." });
    }

    const { gmail: gmailClient } = await getGmailClient(state.oauthTokensEncrypted);

    const result = await gmailClient.users.messages.list({
      userId: "me",
      q: q as string,
      maxResults: Math.min(parseInt(maxResults as string) || 20, 100),
    });

    const messages = result.data.messages || [];

    const summaries = await Promise.all(
      messages.map(async (m) => {
        try {
          const full = await gmailClient.users.messages.get({
            userId: "me",
            id: m.id!,
            format: "metadata",
            metadataHeaders: ["From", "To", "Subject", "Date"],
          });
          const headers = full.data.payload?.headers || [];
          const getH = (name: string) =>
            headers.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
          return {
            id: full.data.id,
            threadId: full.data.threadId,
            snippet: full.data.snippet,
            from: getH("From"),
            to: getH("To"),
            subject: getH("Subject"),
            date: getH("Date"),
          };
        } catch {
          return { id: m.id, error: "Could not fetch" };
        }
      })
    );

    res.json({
      total: result.data.resultSizeEstimate,
      messages: summaries,
    });
  }));

  // ─── interactions/mark-read (Gmail-adjacent) ─────────────────────────────

  app.patch("/api/interactions/mark-read", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { prospectId } = req.body;
    if (!prospectId) return res.status(400).json({ message: "prospectId required" });
    await storage.markProspectInteractionsRead(Number(prospectId));
    res.json({ ok: true });
  }));
}
