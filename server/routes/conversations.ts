import type { Express } from "express";
import { storage } from "../storage";
import { requireAuth, requireAgency, scopeToAccount } from "../auth";
import {
  interactions,
  notifications,
  insertInteractionsSchema,
  insertNotificationsSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { pool } from "../db";
import { createAndDispatchNotification } from "../notification-dispatcher";
import { broadcast, addClient, removeClient } from "../sse";
import { handleZodError, wrapAsync, getPagination } from "./_helpers";
import { eq, type SQL } from "drizzle-orm";
import type { Request, Response } from "express";
import { sendToChannel, sendVoiceToChannel, sendPhotoToChannel } from "../channel-sender";

export function registerConversationsRoutes(app: Express): void {
  // ─── Interactions ─────────────────────────────────────────────────

  // SSE stream — clients connect here to receive real-time interaction pushes
  app.get("/api/interactions/stream", requireAuth, (req: Request, res: Response) => {
    const user = (req as any).user;
    const isAgency = user.accountsId === 1;
    const hasAccountFilter = !!req.query.accountId;
    const accountId: number = !isAgency
      ? user.accountsId
      : (hasAccountFilter ? Number(req.query.accountId) : user.accountsId);
    const isGlobal = isAgency && !hasAccountFilter;

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    (res as any).socket?.setNoDelay?.(true);
    res.flushHeaders();

    console.log(`[sse] Client connected: accountId=${accountId}, userId=${user.id}, global=${isGlobal}`);
    res.write("event: connected\ndata: {}\n\n");
    addClient(accountId, res, isGlobal);

    const keepAlive = setInterval(() => {
      res.write("event: ping\ndata: {}\n\n");
    }, 15_000);

    req.on("close", () => {
      clearInterval(keepAlive);
      removeClient(accountId, res);
      console.log(`[sse] Client disconnected: accountId=${accountId}, userId=${user.id}`);
    });
  });

  app.get("/api/interactions", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const leadId = req.query.leadId ? Number(req.query.leadId) : undefined;
    const prospectId = req.query.prospect_id ? Number(req.query.prospect_id) : undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);

    if (prospectId) {
      const limit = Math.min(Number(req.query.limit) || 20, 200);
      const offset = Number(req.query.offset) || 0;
      const result = await storage.getInteractionsByProspectId(prospectId, limit, offset);
      return res.json(result);
    }

    const pagination = getPagination(req);
    if (pagination) {
      let where: SQL | undefined;
      if (leadId) {
        where = eq(interactions.leadsId, leadId);
      } else if (accountId) {
        where = eq(interactions.accountsId, accountId);
      }
      const { paginatedQuery } = await import("../storage");
      const result = await paginatedQuery(interactions, pagination, where);
      return res.json({ ...result, data: toDbKeysArray(result.data as any, interactions) });
    }

    let data;
    if (leadId) {
      data = await storage.getInteractionsByLeadId(leadId);
    } else if (accountId) {
      data = await storage.getInteractionsByAccountId(accountId);
    } else {
      data = await storage.getInteractions();
    }
    res.json(toDbKeysArray(data as any, interactions));
  }));

  app.get("/api/interactions/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const row = await storage.getInteractionById(id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json(toDbKeys(row as any, interactions));
  }));

  app.post("/api/interactions", requireAuth, wrapAsync(async (req, res) => {
    const parsed = insertInteractionsSchema.safeParse(fromDbKeys(req.body, interactions));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const interaction = await storage.createInteraction(parsed.data);
    const responseBody = toDbKeys(interaction as any, interactions);
    // Broadcast to SSE clients (covers manual messages sent from UI)
    if (interaction.accountsId) {
      broadcast(interaction.accountsId, "new_interaction", responseBody);
    }

    // ── Deliver outbound manual messages to the actual channel ──────────
    if ((parsed.data as any).direction?.toLowerCase() === "outbound") {
      // Fire-and-forget so the API response isn't blocked by delivery
      (async () => {
        try {
          const leadId = (interaction as any).leadsId ?? (interaction as any).leadId;
          if (!leadId) return;
          const lead = await storage.getLeadById(leadId);
          if (!lead) return;
          const channelId = (lead as any).channelIdentifier;
          if (!channelId) {
            console.log(`[channel-sender] No channel_identifier for lead ${leadId}, skipping delivery`);
            return;
          }
          // Resolve campaign channel (telegram, whatsapp_cloud, etc.) and bot token
          const campaignId = (lead as any).campaignsId ?? (lead as any).campaignId;
          let campaignChannel = "telegram"; // default for tg: identifiers
          let campaignBotToken: string | undefined;
          if (campaignId) {
            const campaign = await storage.getCampaignById(campaignId);
            if (campaign) {
              campaignChannel = (campaign as any).channel || campaignChannel;
              campaignBotToken = (campaign as any).botToken ?? undefined;
            }
          }

          const content = (interaction as any).content ?? "";
          const isAudio = (parsed.data as any).type === "audio" || content.startsWith("data:audio/");
          const attachment = (req.body as any).attachment;
          const isPhoto = !!attachment?.imageUrl;

          let result;
          if (isAudio) {
            // Voice memo: send as Telegram voice message
            const mimeType = content.match(/^data:(audio\/[^;]+)/)?.[1] || "audio/ogg";
            result = await sendVoiceToChannel(channelId, campaignChannel, content, mimeType, campaignBotToken);
          } else if (isPhoto) {
            // Photo: send as Telegram photo with optional caption
            result = await sendPhotoToChannel(channelId, campaignChannel, attachment.imageUrl, content || attachment.caption, campaignBotToken);
          } else {
            result = await sendToChannel(channelId, campaignChannel, content, campaignBotToken);
          }

          if (result.success) {
            console.log(`[channel-sender] Delivered to ${result.channel} (msg ${result.messageId}) for lead ${leadId}`);
            await storage.updateInteraction(interaction.id!, {
              status: "delivered",
              deliveredAt: new Date(),
            } as any);
            if (interaction.accountsId) {
              broadcast(interaction.accountsId, "interaction_updated", {
                id: interaction.id,
                status: "delivered",
                delivered_at: new Date().toISOString(),
              });
            }
          } else {
            console.error(`[channel-sender] Failed for lead ${leadId}: ${result.error}`);
            await storage.updateInteraction(interaction.id!, {
              status: "failed",
              failedAt: new Date(),
            } as any);
            if (interaction.accountsId) {
              broadcast(interaction.accountsId, "interaction_updated", {
                id: interaction.id,
                status: "failed",
                failed_at: new Date().toISOString(),
              });
            }
            // Notify all agency users of delivery failure
            const leadName = (lead as any).name ?? (lead as any).Name ?? `Lead ${leadId}`;
            const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
            for (const admin of agencyUsers) {
              await createAndDispatchNotification({
                type: "system",
                title: "Message delivery failed",
                body: `Failed to deliver message to ${leadName}: ${result.error ?? "unknown error"}`,
                userId: admin.id!,
                accountId: interaction.accountsId ?? null,
                read: false,
                link: "/leads",
                leadId: leadId,
              });
            }
          }
        } catch (err) {
          console.error("[channel-sender] Unexpected error:", err);
        }
      })();
    }

    // Notification: lead_responded — when an inbound message arrives
    if ((parsed.data as any).direction === "inbound") {
      try {
        const leadName = (parsed.data as any).leadName || "Lead";
        const agencyUsers = (await storage.getAppUsers()).filter((u: any) => u.accountsId === 1);
        for (const admin of agencyUsers) {
          await createAndDispatchNotification({
            type: "lead_responded",
            title: `${leadName} sent a message`,
            body: ((parsed.data as any).content || "").substring(0, 120) || null,
            userId: admin.id!,
            accountId: interaction.accountsId ?? null,
            read: false,
            link: "/leads",
            leadId: (interaction as any).leadsId ?? (interaction as any).leadId ?? null,
          });
        }
      } catch (notifErr) {
        console.error("[notifications] Failed to dispatch lead_responded:", notifErr);
      }
    }

    res.status(201).json(responseBody);
  }));

  app.delete("/api/interactions/:id", requireAuth, wrapAsync(async (req, res) => {
    const ok = await storage.deleteInteraction(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Interaction not found" });
    res.status(204).end();
  }));

  app.post("/api/interactions/bulk-delete", requireAuth, wrapAsync(async (req, res) => {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ message: "ids must be a non-empty array" });
    }
    const deleted = await storage.bulkDeleteInteractions(ids.map(Number));
    res.json({ deleted });
  }));

  app.patch("/api/interactions/mark-read", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const { prospectId } = req.body;
    if (!prospectId) return res.status(400).json({ message: "prospectId required" });
    await storage.markProspectInteractionsRead(Number(prospectId));
    res.json({ ok: true });
  }));

  // ─── Activity Feed ───────────────────────────────────────────────

  app.get("/api/activity-feed", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const accountId = forcedId ?? (req.query.accountId ? Number(req.query.accountId) : undefined);
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const offset = Number(req.query.offset) || 0;

    const schema = "p2mxx34fvbf3ll6";

    const acctFilter = accountId ? `AND t."Accounts_id" = $1` : "";
    const acctFilterLeads = accountId ? `AND l."Accounts_id" = $1` : "";
    const params: unknown[] = accountId ? [accountId] : [];

    const interactionsQ = `
      SELECT
        CASE
          WHEN i."direction" = 'inbound' THEN 'message_received'
          WHEN i."direction" = 'outbound' AND i."ai_generated" = true THEN 'message_sent'
          ELSE 'message_sent'
        END AS type,
        CASE
          WHEN i."direction" = 'inbound' THEN COALESCE(i."lead_name", 'Lead') || ' responded'
          WHEN i."ai_generated" = true THEN 'AI sent message to ' || COALESCE(i."lead_name", 'lead')
          ELSE 'Message sent to ' || COALESCE(i."lead_name", 'lead')
        END AS title,
        LEFT(i."Content", 120) AS description,
        COALESCE(i."Leads_id", i."lead_id"::int) AS lead_id,
        COALESCE(i."lead_name", '') AS lead_name,
        i."created_at" AS timestamp,
        CASE
          WHEN i."direction" = 'inbound' THEN 'message'
          WHEN i."ai_generated" = true THEN 'bot'
          ELSE 'user'
        END AS icon
      FROM "${schema}"."Interactions" i
      WHERE i."created_at" > NOW() - INTERVAL '7 days'
        ${acctFilter.replace('t.', 'i.')}
    `;

    const statusQ = `
      SELECT
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'call_booked'
          ELSE 'status_change'
        END AS type,
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'Call booked: ' || COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead')
          ELSE COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead') || ' moved to ' || l."Conversion_Status"
        END AS title,
        CASE
          WHEN l."Conversion_Status" = 'Booked' AND l."booked_call_date" IS NOT NULL
            THEN TO_CHAR(l."booked_call_date", 'Mon DD at HH12:MI AM')
          ELSE 'Status: ' || l."Conversion_Status"
        END AS description,
        l."id" AS lead_id,
        COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), '') AS lead_name,
        l."updated_at" AS timestamp,
        CASE
          WHEN l."Conversion_Status" = 'Booked' THEN 'phone'
          ELSE 'arrow'
        END AS icon
      FROM "${schema}"."Leads" l
      WHERE l."updated_at" > NOW() - INTERVAL '7 days'
        AND l."Conversion_Status" IN ('Booked', 'Qualified', 'Lost')
        ${acctFilterLeads}
    `;

    const automationQ = `
      SELECT
        'automation' AS type,
        COALESCE(a."workflow_name", 'Workflow') || ' — ' || COALESCE(a."status", 'ran') AS title,
        CASE
          WHEN a."lead_name" IS NOT NULL THEN 'Lead: ' || a."lead_name"
          ELSE COALESCE(a."step_name", '')
        END AS description,
        COALESCE(a."Leads_id", a."lead_id"::int) AS lead_id,
        COALESCE(a."lead_name", '') AS lead_name,
        a."created_at" AS timestamp,
        'bot' AS icon
      FROM "${schema}"."Automation_Logs" a
      WHERE a."created_at" > NOW() - INTERVAL '7 days'
        ${acctFilter.replace('t.', 'a.')}
    `;

    const takeoverQ = `
      SELECT
        'takeover' AS type,
        'Manual takeover: ' || COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), 'Lead') AS title,
        'Agent took over the conversation' AS description,
        l."id" AS lead_id,
        COALESCE(CONCAT_WS(' ', l."first_name", l."last_name"), '') AS lead_name,
        l."updated_at" AS timestamp,
        'user' AS icon
      FROM "${schema}"."Leads" l
      WHERE l."manual_takeover" = true
        AND l."updated_at" > NOW() - INTERVAL '7 days'
        ${acctFilterLeads}
    `;

    const countQuery = `
      SELECT COUNT(*) AS total FROM (
        ${interactionsQ}
        UNION ALL
        ${statusQ}
        UNION ALL
        ${automationQ}
        UNION ALL
        ${takeoverQ}
      ) sub
    `;

    const dataQuery = `
      SELECT * FROM (
        ${interactionsQ}
        UNION ALL
        ${statusQ}
        UNION ALL
        ${automationQ}
        UNION ALL
        ${takeoverQ}
      ) combined
      ORDER BY timestamp DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `;

    try {
      const [countResult, dataResult] = await Promise.all([
        pool.query(countQuery, params),
        pool.query(dataQuery, params),
      ]);

      const total = Number(countResult.rows[0]?.total ?? 0);
      const items = dataResult.rows.map((row: any) => ({
        type: row.type,
        title: row.title,
        description: row.description || "",
        leadId: row.lead_id ?? null,
        leadName: row.lead_name || "",
        timestamp: row.timestamp ? new Date(row.timestamp).toISOString() : null,
        icon: row.icon,
      }));

      res.json({
        items,
        total,
        hasMore: offset + items.length < total,
      });
    } catch (err: any) {
      console.error("[activity-feed] query error:", err);
      res.status(500).json({ message: "Failed to fetch activity feed", error: err.message });
    }
  }));

  // ─── Notifications ─────────────────────────────────────────

  // Legacy endpoint kept for backwards compat
  app.get("/api/notifications/legacy", requireAuth, scopeToAccount, wrapAsync(async (req, res) => {
    const forcedId = (req as any).forcedAccountId as number | undefined;
    const data = await storage.getRecentNotifications(forcedId);
    res.json(data);
  }));

  app.get("/api/notifications", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;
    const unreadOnly = req.query.unread === "true";
    const items = await storage.getNotificationsByUserId(user.id!, { limit, offset, unreadOnly });
    const unreadCount = await storage.getUnreadNotificationCount(user.id!);
    const totalCount = await storage.getTotalNotificationCount(user.id!);
    res.json({ items, unreadCount, totalCount });
  }));

  app.get("/api/notifications/count", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const unreadCount = await storage.getUnreadNotificationCount(user.id!);
    res.json({ unreadCount });
  }));

  // PATCH /api/notifications/preferences — must be before /:id
  app.patch("/api/notifications/preferences", requireAuth, wrapAsync(async (req, res) => {
    const userId = parseInt(req.query.user_id as string);
    const accountId = parseInt(req.query.account_id as string);
    if (isNaN(userId) || isNaN(accountId)) return res.status(400).json({ message: "Missing user_id or account_id" });
    if (req.user!.accountsId !== 1 && userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const { telegram_enabled, telegram_chat_id, push_enabled, type_overrides } = req.body;
    const row = await storage.upsertNotificationPreferences(userId, accountId, {
      telegramEnabled: telegram_enabled,
      telegramChatId: telegram_chat_id,
      webPushEnabled: push_enabled,
      typeOverrides: type_overrides,
    });
    res.json(row);
  }));

  app.patch("/api/notifications/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid notification ID" });
    const notif = await storage.getNotificationById(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (notif.userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.updateNotification(id, { read: true });
    res.json({ success: true });
  }));

  app.delete("/api/notifications/all", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const count = await storage.deleteAllNotifications(user.id!);
    res.json({ success: true, deleted: count });
  }));

  app.delete("/api/notifications/:id", requireAuth, wrapAsync(async (req, res) => {
    const id = parseInt(req.params.id);
    if (isNaN(id)) return res.status(400).json({ message: "Invalid notification ID" });
    const notif = await storage.getNotificationById(id);
    if (!notif) return res.status(404).json({ message: "Notification not found" });
    if (notif.userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    await storage.deleteNotification(id);
    res.json({ success: true });
  }));

  app.post("/api/notifications/mark-all-read", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const count = await storage.markAllNotificationsRead(user.id!);
    res.json({ success: true, updated: count });
  }));

  app.post("/api/notifications", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    if (user.accountsId !== 1 && user.role !== "Admin") {
      return res.status(403).json({ message: "Agency access required" });
    }
    const result = insertNotificationsSchema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({ message: "Invalid notification data", errors: result.error.flatten() });
    }
    const created = await createAndDispatchNotification(result.data);
    res.status(201).json(created);
  }));

  app.post("/api/notifications/test", requireAuth, wrapAsync(async (req, res) => {
    const user = req.user!;
    const notif = await createAndDispatchNotification({
      type: "system",
      title: "Test Notification",
      body: "If you see this, notifications are working!",
      userId: user.id!,
      accountId: user.accountsId ?? null,
      read: false,
      link: null,
      leadId: null,
    });
    res.json({ success: true, notification: notif });
  }));

  app.get("/api/notifications/vapid-public-key", requireAuth, (_req, res) => {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    if (!publicKey) return res.status(500).json({ message: "VAPID keys not configured" });
    res.json({ publicKey });
  });

  app.get("/api/notifications/preferences", requireAuth, wrapAsync(async (req, res) => {
    const userId = parseInt(req.query.user_id as string);
    const accountId = parseInt(req.query.account_id as string);
    if (isNaN(userId) || isNaN(accountId)) return res.status(400).json({ message: "Missing user_id or account_id" });
    if (req.user!.accountsId !== 1 && userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const prefs = await storage.getNotificationPreferences(userId, accountId);
    if (!prefs) return res.json({ telegram_enabled: true, telegram_chat_id: null, push_enabled: true, type_overrides: {} });
    res.json({
      telegram_enabled: prefs.telegramEnabled,
      telegram_chat_id: prefs.telegramChatId,
      push_enabled: prefs.webPushEnabled,
      type_overrides: prefs.typeOverrides ?? {},
    });
  }));

  app.get("/api/notifications/push-subscriptions", requireAuth, wrapAsync(async (req, res) => {
    const userId = parseInt(req.query.user_id as string);
    const accountId = parseInt(req.query.account_id as string);
    if (isNaN(userId) || isNaN(accountId)) return res.status(400).json({ message: "Missing user_id or account_id" });
    if (req.user!.accountsId !== 1 && userId !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const subs = await storage.getPushSubscriptionsByUser(userId, accountId);
    res.json(subs);
  }));

  app.post("/api/notifications/push-subscription", requireAuth, wrapAsync(async (req, res) => {
    const { userId, accountId, subscription, deviceLabel } = req.body;
    if (!userId || !accountId || !subscription) {
      return res.status(400).json({ message: "userId, accountId, and subscription are required" });
    }
    if (req.user!.accountsId !== 1 && Number(userId) !== req.user!.id!) {
      return res.status(403).json({ message: "Forbidden" });
    }
    const sub = await storage.createPushSubscription({ userId: Number(userId), accountId: Number(accountId), subscription: JSON.stringify(subscription), deviceLabel: deviceLabel ?? null } as any);
    res.json(sub);
  }));

  app.delete("/api/notifications/push-subscription", requireAuth, wrapAsync(async (req, res) => {
    const { endpoint } = req.body;
    if (!endpoint) return res.status(400).json({ message: "endpoint is required" });
    await storage.deletePushSubscriptionByEndpoint(endpoint);
    res.json({ ok: true });
  }));
}
