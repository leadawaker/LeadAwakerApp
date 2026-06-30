// Managed messaging provisioning (Twilio) — spec: specs/messaging-provisioning.
// Phase 1: one-click SMS provisioning (subaccount + NL number + messaging service),
// status, and deprovision. Phase 2 (WhatsApp sender registration) is added later.
//
// SAFETY: provisioning makes real Twilio calls that COST MONEY (buys a number).
// It is idempotent (a second call returns existing status, never double-buys) and
// recovers from partial failures by persisting what succeeded.
import type { Express } from "express";
import twilio from "twilio";
import { storage } from "../storage";
import { requireAuth, requireAgency } from "../auth";
import { wrapAsync } from "./_helpers";

const MASTER_SID = process.env.TWILIO_ACCOUNT_SID || "";
const MASTER_TOKEN = process.env.TWILIO_AUTH_TOKEN || "";

// The engine's PUBLIC inbound webhook (Twilio posts inbound SMS/WhatsApp here).
// Overridable via env; default is the engine's known public endpoint.
const INBOUND_URL =
  process.env.ENGINE_INBOUND_WEBHOOK_URL || "https://webhooks.leadawaker.com/webhooks/sms/inbound";
// Delivery-status callback (consumed by the channel-fallback feature). Harmless
// 404s until that endpoint exists.
const STATUS_URL =
  process.env.ENGINE_STATUS_WEBHOOK_URL || "https://webhooks.leadawaker.com/webhooks/sms/status";

function buildStatus(a: any) {
  const fromNumber = a.twilioDefaultFromNumber || null;
  // A `whatsapp:`-prefixed value is the shared Twilio WhatsApp SANDBOX number — it
  // can't send SMS and isn't a real owned sender. Don't let it read as "SMS ready".
  const sandbox = !!fromNumber && fromNumber.startsWith("whatsapp:");
  return {
    sms: fromNumber && !sandbox ? "ready" : "none",
    whatsapp: a.whatsappSenderStatus || "none",
    fromNumber,
    sandbox,
    displayName: a.whatsappDisplayName || null,
    provisionedAt: a.messagingProvisionedAt || null,
    // managed = we provisioned a subaccount; false = manually-pasted (Tier-1) creds.
    managed: !!a.messagingProvisionedAt,
  };
}

export function registerMessagingRoutes(app: Express): void {
  // ── Status ────────────────────────────────────────────────────────────────
  app.get("/api/accounts/:id/messaging/status", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(buildStatus(account));
  }));

  // ── Provision (SMS) ─────────────────────────────────────────────────────────
  app.post("/api/accounts/:id/messaging/provision", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    if (!MASTER_SID || !MASTER_TOKEN) {
      return res.status(500).json({ message: "Master Twilio credentials not configured on the server" });
    }
    const id = Number(req.params.id);
    const account = await storage.getAccountById(id);
    if (!account) return res.status(404).json({ message: "Account not found" });

    // Idempotent: if a subaccount already exists, never create a second one.
    if (account.twilioAccountSid) {
      return res.json({ ...buildStatus(account), alreadyProvisioned: true });
    }

    const master = twilio(MASTER_SID, MASTER_TOKEN);

    // 1) Create a subaccount for this client (billing isolation).
    const sub = await master.api.v2010.accounts.create({
      friendlyName: `LeadAwaker — ${account.name || "account"} (#${id})`,
    });
    const subSid = sub.sid;
    const subToken = (sub as any).authToken as string;
    const subClient = twilio(subSid, subToken);

    // 2) Buy an NL two-way number (mobile preferred, local fallback). On failure,
    //    persist the subaccount creds so a retry doesn't orphan a second subaccount.
    let fromNumber: string;
    try {
      let available: Array<{ phoneNumber: string }> = await subClient.availablePhoneNumbers("NL").mobile.list({ smsEnabled: true, limit: 1 });
      if (!available.length) {
        available = await subClient.availablePhoneNumbers("NL").local.list({ smsEnabled: true, limit: 1 });
      }
      if (!available.length) {
        await storage.updateAccount(id, { twilioAccountSid: subSid, twilioAuthToken: subToken } as any);
        return res.status(502).json({ message: "No NL numbers currently available to purchase" });
      }
      const bought = await subClient.incomingPhoneNumbers.create({
        phoneNumber: available[0].phoneNumber,
        smsUrl: INBOUND_URL,
        smsMethod: "POST",
        statusCallback: STATUS_URL,
        statusCallbackMethod: "POST",
      });
      fromNumber = bought.phoneNumber;
    } catch (e: any) {
      await storage.updateAccount(id, { twilioAccountSid: subSid, twilioAuthToken: subToken } as any);
      return res.status(502).json({ message: `Number purchase failed: ${e?.message || e}` });
    }

    // 3) Create a Messaging Service and attach the number. On failure, persist the
    //    number so a retry is recoverable (won't re-buy).
    let serviceSid: string;
    try {
      const svc = await subClient.messaging.v1.services.create({
        friendlyName: `LeadAwaker — ${account.name || id}`,
        inboundRequestUrl: INBOUND_URL,
        statusCallback: STATUS_URL,
      });
      serviceSid = svc.sid;
      const nums = await subClient.incomingPhoneNumbers.list({ phoneNumber: fromNumber, limit: 1 });
      if (nums.length) {
        await subClient.messaging.v1.services(serviceSid).phoneNumbers.create({ phoneNumberSid: nums[0].sid });
      }
    } catch (e: any) {
      await storage.updateAccount(id, {
        twilioAccountSid: subSid, twilioAuthToken: subToken, twilioDefaultFromNumber: fromNumber,
      } as any);
      return res.status(502).json({ message: `Messaging service setup failed: ${e?.message || e}` });
    }

    // 4) Persist the full set (timestamp server-side).
    const updated = await storage.updateAccount(id, {
      twilioAccountSid: subSid,
      twilioAuthToken: subToken,
      twilioMessagingServiceSid: serviceSid,
      twilioDefaultFromNumber: fromNumber,
      messagingProvisionedAt: new Date(),
    } as any);

    res.json({ ...buildStatus(updated || account), provisioned: true, fromNumber });
  }));

  // ── Deprovision (offboarding) ────────────────────────────────────────────────
  app.delete("/api/accounts/:id/messaging", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const account = await storage.getAccountById(id);
    if (!account) return res.status(404).json({ message: "Account not found" });

    if (account.twilioAccountSid && MASTER_SID && MASTER_TOKEN) {
      try {
        const subClient = twilio(account.twilioAccountSid, account.twilioAuthToken || undefined);
        const nums = await subClient.incomingPhoneNumbers.list({ limit: 20 });
        for (const n of nums) {
          try { await subClient.incomingPhoneNumbers(n.sid).remove(); } catch { /* best-effort */ }
        }
        const master = twilio(MASTER_SID, MASTER_TOKEN);
        try { await master.api.v2010.accounts(account.twilioAccountSid).update({ status: "closed" }); } catch { /* best-effort */ }
      } catch { /* never block clearing creds on Twilio errors */ }
    }

    await storage.updateAccount(id, {
      twilioAccountSid: null,
      twilioAuthToken: null,
      twilioMessagingServiceSid: null,
      twilioDefaultFromNumber: null,
      messagingProvisionedAt: null,
      whatsappSenderStatus: null,
      whatsappSenderSid: null,
      whatsappDisplayName: null,
    } as any);
    res.status(204).end();
  }));
}
