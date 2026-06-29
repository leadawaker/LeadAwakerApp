import type { Express } from "express";
import { storage } from "../storage";
import { requireAgency, requireOwner } from "../auth";
import { canDeleteHard } from "../permissions";
import {
  interactions,
  outreachTemplates,
  insertOutreachTemplatesSchema,
} from "@shared/schema";
import { toDbKeys, toDbKeysArray, fromDbKeys } from "../dbKeys";
import { handleZodError, wrapAsync } from "./_helpers";
import { broadcast } from "../sse";
import { sendWhatsAppCloudImage } from "../channel-sender";

/**
 * Normalize a phone number to E.164 digits-only format.
 * Strips all non-digits, validates minimum length (7) and maximum (15).
 * Returns null if the number is invalid.
 */
function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  return digits;
}

export function registerProspectsWhatsappRoutes(app: Express): void {
  app.post("/api/prospects/:id/whatsapp/send", (req, res, next) => {
    console.log(`[WA-Send-PRE] prospect=${req.params.id} auth=${req.isAuthenticated()} user=${(req.user as any)?.id} role=${(req.user as any)?.role} acctId=${(req.user as any)?.accountsId}`);
    next();
  }, requireAgency, wrapAsync(async (req, res) => {
    console.log(`[WA-Send] prospect=${req.params.id} body=`, JSON.stringify(req.body).slice(0, 200));
    const prospectId = Number(req.params.id);
    const { message } = req.body as { message?: string };

    if (!message?.trim()) {
      return res.status(400).json({ message: "message is required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    let sendStatus: string = "queued";

    if (token && phoneNumberId) {
      const waRes = await fetch(
        `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: phone,
            type: "text",
            text: { body: message.trim() },
          }),
        }
      );
      if (!waRes.ok) {
        const err = await waRes.json().catch(() => ({}));
        // Meta error 131047 = message outside 24-hour customer service window
        const errorCode = err?.error?.code;
        if (errorCode === 131047) {
          return res.status(422).json({ message: "WhatsApp 24-hour window expired", code: "window_expired", detail: err });
        }
        return res.status(502).json({ message: "WhatsApp API error", detail: err });
      }
      sendStatus = "sent";
    }

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content: message.trim(),
      type: "whatsapp",
      direction: "outbound",
      status: sendStatus,
      sentAt: new Date(),
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  // Typing indicator — best-effort, always returns 200
  app.post("/api/prospects/:id/whatsapp/typing", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) return res.status(400).json({ message: "Prospect has no phone number" });

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (token && phoneNumberId) {
      // Fire-and-forget — typing indicators are best-effort
      fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "typing",
          typing: { duration: 25000 },
        }),
      }).catch(() => {});
    }
    res.status(200).json({ ok: true });
  }));

  app.post("/api/prospects/:id/whatsapp/send-image", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { imageData, mimeType, caption } = req.body as { imageData?: string; mimeType?: string; caption?: string };

    if (!imageData || !mimeType) {
      return res.status(400).json({ message: "imageData and mimeType are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const result = await sendWhatsAppCloudImage(phone, imageData, mimeType, caption);
    if (!result.success) {
      const errMsg = result.error ?? "Failed to send image";
      if (errMsg.includes("131047")) {
        return res.status(422).json({ message: "WhatsApp 24-hour window expired", code: "window_expired" });
      }
      return res.status(502).json({ message: errMsg });
    }

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content: caption || "[Image]",
      type: "whatsapp",
      direction: "outbound",
      status: "sent",
      sentAt: new Date(),
      attachment: imageData,
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  // ─── WhatsApp Message Templates (Meta) ───────────────────────────

  app.get("/api/whatsapp/templates", requireAgency, wrapAsync(async (req, res) => {
    const token = process.env.WHATSAPP_TOKEN;
    const wabaId = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID;
    if (!token || !wabaId) {
      return res.status(500).json({ message: "WhatsApp Business Account not configured" });
    }
    const metaRes = await fetch(
      `https://graph.facebook.com/v22.0/${wabaId}/message_templates?limit=50&status=APPROVED`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!metaRes.ok) {
      const err = await metaRes.json().catch(() => ({}));
      return res.status(502).json({ message: "Failed to fetch templates", detail: err });
    }
    const { data } = await metaRes.json() as { data: any[] };
    const templates = data.map((t: any) => ({
      name: t.name,
      language: t.language,
      category: t.category,
      status: t.status,
      components: t.components,
    }));
    res.json(templates);
  }));

  app.post("/api/prospects/:id/whatsapp/send-template", requireAgency, wrapAsync(async (req, res) => {
    const prospectId = Number(req.params.id);
    const { templateName, languageCode, variables } = req.body as {
      templateName?: string;
      languageCode?: string;
      variables?: { body?: string[]; header?: string[]; button?: string[] };
    };

    if (!templateName || !languageCode) {
      return res.status(400).json({ message: "templateName and languageCode are required" });
    }

    const prospect = await storage.getProspectById(prospectId);
    if (!prospect) return res.status(404).json({ message: "Prospect not found" });

    const phone = normalizePhone((prospect as any).phone || (prospect as any).contactPhone);
    if (!phone) {
      return res.status(400).json({ message: "Prospect has no valid phone number", code: "invalid_phone" });
    }

    const token = process.env.WHATSAPP_TOKEN;
    const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
    if (!token || !phoneNumberId) {
      return res.status(500).json({ message: "WhatsApp not configured" });
    }

    // Build components array from variables
    const components: any[] = [];
    if (variables?.header?.length) {
      components.push({
        type: "header",
        parameters: variables.header.map((v) => ({ type: "text", text: v })),
      });
    }
    if (variables?.body?.length) {
      components.push({
        type: "body",
        parameters: variables.body.map((v) => ({ type: "text", text: v })),
      });
    }
    if (variables?.button?.length) {
      components.push({
        type: "button",
        sub_type: "url",
        index: 0,
        parameters: variables.button.map((v) => ({ type: "text", text: v })),
      });
    }

    const waRes = await fetch(
      `https://graph.facebook.com/v22.0/${phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: phone,
          type: "template",
          template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 ? { components } : {}),
          },
        }),
      }
    );

    if (!waRes.ok) {
      const err = await waRes.json().catch(() => ({}));
      return res.status(502).json({ message: "WhatsApp API error", detail: err });
    }

    // Build a human-readable content string for the interaction log
    const bodyVars = variables?.body?.join(", ") || "";
    const content = `[Template: ${templateName} (${languageCode})]${bodyVars ? ` Variables: ${bodyVars}` : ""}`;

    const interaction = await storage.createInteraction({
      prospectId,
      accountsId: 1,
      content,
      type: "whatsapp",
      direction: "outbound",
      status: "sent",
      sentAt: new Date(),
    });

    const responseBody = toDbKeys(interaction as any, interactions);
    broadcast(1, "new_interaction", responseBody);

    res.status(201).json({ interaction: responseBody });
  }));

  app.delete("/api/prospects/:id", requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);

    const internalKey = req.headers["x-internal-key"] as string | undefined;
    const wantsHardDelete = !!internalKey || canDeleteHard(req.user);

    if (!wantsHardDelete) {
      const updated = await storage.updateProspect(id, { status: "Archived" } as any);
      if (!updated) return res.status(404).json({ message: "Prospect not found" });
      return res.status(204).end();
    }

    const ok = await storage.deleteProspect(id);
    if (!ok) return res.status(404).json({ message: "Prospect not found" });
    res.status(204).end();
  }));

  app.post("/api/prospects/:id/purge", requireOwner, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const ok = await storage.deleteProspect(id);
    if (!ok) return res.status(404).json({ message: "Prospect not found" });
    res.status(204).end();
  }));

  // ─── Outreach Templates ──────────────────────────────────────────

  app.get("/api/outreach-templates", requireAgency, wrapAsync(async (req, res) => {
    const data = await storage.getOutreachTemplates();
    res.json(toDbKeysArray(data as any, outreachTemplates));
  }));

  app.get("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const tpl = await storage.getOutreachTemplateById(Number(req.params.id));
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.post("/api/outreach-templates", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertOutreachTemplatesSchema.safeParse(fromDbKeys(req.body, outreachTemplates));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tpl = await storage.createOutreachTemplate(parsed.data);
    res.status(201).json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.patch("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const parsed = insertOutreachTemplatesSchema.partial().safeParse(fromDbKeys(req.body, outreachTemplates));
    if (!parsed.success) return handleZodError(res, parsed.error);
    const tpl = await storage.updateOutreachTemplate(Number(req.params.id), parsed.data);
    if (!tpl) return res.status(404).json({ message: "Template not found" });
    res.json(toDbKeys(tpl as any, outreachTemplates));
  }));

  app.delete("/api/outreach-templates/:id", requireAgency, wrapAsync(async (req, res) => {
    const ok = await storage.deleteOutreachTemplate(Number(req.params.id));
    if (!ok) return res.status(404).json({ message: "Template not found" });
    res.status(204).end();
  }));
}
