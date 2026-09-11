// Managed messaging provisioning (Twilio) — spec: specs/messaging-provisioning.
// Phase 1: one-click SMS provisioning (subaccount + NL number + messaging service),
// status, and deprovision. Phase 2: WhatsApp sender registration via Meta Embedded
// Signup (Twilio ISV) + Twilio Senders API v2 (v1 was retired 2026-09-01).
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
    // A subaccount exists but setup stopped before a number was bought.
    partial: !!a.twilioAccountSid && !fromNumber,
  };
}

// Twilio requires an Address on the same (sub)account that buys a number; copy the master's.
async function ensureAddress(master: any, subClient: any): Promise<string | undefined> {
  const own = await subClient.addresses.list({ limit: 1 });
  if (own.length) return own[0].sid;
  const [src] = await master.addresses.list({ isoCountry: "NL", limit: 1 });
  if (!src) return undefined;
  const created = await subClient.addresses.create({
    customerName: src.customerName,
    street: src.street,
    city: src.city,
    region: src.region || src.city,
    postalCode: src.postalCode,
    isoCountry: src.isoCountry,
  });
  return created.sid;
}

function mapSenderStatus(s: string): "pending" | "approved" | "rejected" {
  if (s === "ONLINE" || s === "ONLINE:UPDATING") return "approved";
  if (s === "OFFLINE") return "rejected";
  return "pending";
}

export function registerMessagingRoutes(app: Express): void {
  // ── Status ────────────────────────────────────────────────────────────────
  // No Twilio webhook for sender review, so a pending sender is re-checked on read.
  app.get("/api/accounts/:id/messaging/status", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    let account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });

    if (account.whatsappSenderSid && account.whatsappSenderStatus === "pending" && account.twilioAccountSid) {
      try {
        const subClient = twilio(account.twilioAccountSid, account.twilioAuthToken || undefined);
        const sender = await subClient.messaging.v2.channelsSender(account.whatsappSenderSid).fetch();
        const mapped = mapSenderStatus(sender.status);
        if (mapped !== account.whatsappSenderStatus) {
          account = (await storage.updateAccount(account.id, { whatsappSenderStatus: mapped } as any)) || account;
        }
      } catch { /* best-effort: never fail the status read on a Twilio hiccup */ }
    }

    res.json(buildStatus(account));
  }));

  // ── Meta verification code ───────────────────────────────────────────────────
  // During Embedded Signup Meta texts a code to the number. On a Twilio number that SMS
  // lands in Twilio, not on anyone's phone, so we read it back for the signup screen.
  app.get("/api/accounts/:id/messaging/whatsapp/verification-code", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const account = await storage.getAccountById(Number(req.params.id));
    if (!account) return res.status(404).json({ message: "Account not found" });
    const to = account.twilioDefaultFromNumber;
    if (!account.twilioAccountSid || !to || to.startsWith("whatsapp:")) return res.json({ code: null });
    try {
      const subClient = twilio(account.twilioAccountSid, account.twilioAuthToken || undefined);
      const msgs = await subClient.messages.list({ to, dateSentAfter: new Date(Date.now() - 15 * 60 * 1000), limit: 10 });
      const latest = msgs.find((m) => m.direction === "inbound" && /\d{3}[-\s]?\d{3}/.test(m.body || ""));
      const code = latest?.body?.match(/\d{3}[-\s]?\d{3}/)?.[0]?.replace(/[-\s]/g, "") || null;
      res.json({ code, receivedAt: latest?.dateSent || latest?.dateCreated || null });
    } catch {
      res.json({ code: null });
    }
  }));

  // ── Register WhatsApp sender (after Meta Embedded Signup) ──────────────────────
  // The popup only returns waba_id; the E.164 number is collected in our own form first.
  app.post("/api/accounts/:id/messaging/whatsapp/register", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const id = Number(req.params.id);
    const account = await storage.getAccountById(id);
    if (!account) return res.status(404).json({ message: "Account not found" });
    if (!account.twilioAccountSid || !account.twilioAuthToken) {
      return res.status(400).json({ message: "Set up messaging before enabling WhatsApp" });
    }
    if (account.whatsappSenderSid) {
      return res.json({ ...buildStatus(account), alreadyRegistered: true });
    }

    const phoneNumber = String(req.body?.phoneNumber || "").replace(/[\s\-()]/g, "");
    const displayName = String(req.body?.displayName || "").trim();
    const wabaId = String(req.body?.wabaId || "").trim();
    if (!/^\+[1-9]\d{6,14}$/.test(phoneNumber)) {
      return res.status(400).json({ message: "Phone number must be in international format, e.g. +31612345678" });
    }
    if (!displayName || !wabaId) {
      return res.status(400).json({ message: "Display name and WhatsApp Business Account are required" });
    }

    const subClient = twilio(account.twilioAccountSid, account.twilioAuthToken);
    let sender;
    try {
      sender = await subClient.messaging.v2.channelsSender.create({
        senderId: `whatsapp:${phoneNumber}`,
        configuration: { wabaId },
        profile: { name: displayName },
      } as any);
    } catch (e: any) {
      return res.status(502).json({ message: `WhatsApp sender registration failed: ${e?.message || e}` });
    }

    const updated = await storage.updateAccount(id, {
      whatsappSenderSid: sender.sid,
      whatsappSenderStatus: mapSenderStatus(sender.status),
      whatsappDisplayName: displayName,
    } as any);
    res.json({ ...buildStatus(updated || account), registered: true });
  }));

  // ── Provision (SMS) ─────────────────────────────────────────────────────────
  app.post("/api/accounts/:id/messaging/provision", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    if (!MASTER_SID || !MASTER_TOKEN) {
      return res.status(500).json({ message: "Master Twilio credentials not configured on the server" });
    }
    const id = Number(req.params.id);
    const account = await storage.getAccountById(id);
    if (!account) return res.status(404).json({ message: "Account not found" });

    const master = twilio(MASTER_SID, MASTER_TOKEN);
    const existingNumber = account.twilioDefaultFromNumber && !account.twilioDefaultFromNumber.startsWith("whatsapp:")
      ? account.twilioDefaultFromNumber : null;

    // Idempotent: a finished setup is returned as-is, never re-bought.
    if (account.twilioAccountSid && existingNumber && account.twilioMessagingServiceSid) {
      return res.json({ ...buildStatus(account), alreadyProvisioned: true });
    }

    // 1) Resume the subaccount an earlier failed attempt left behind, or create one.
    let subSid: string;
    let subToken: string;
    if (account.twilioAccountSid) {
      const ours = account.twilioAccountSid !== MASTER_SID && await master.api.v2010.accounts(account.twilioAccountSid)
        .fetch().then((a) => a.ownerAccountSid === MASTER_SID).catch(() => false);
      if (!ours) {
        return res.status(409).json({ message: "This account uses its own Twilio credentials (Advanced). Clear them to use managed setup." });
      }
      subSid = account.twilioAccountSid;
      subToken = account.twilioAuthToken || "";
    } else {
      const sub = await master.api.v2010.accounts.create({
        friendlyName: `LeadAwaker — ${account.name || "account"} (#${id})`,
      });
      subSid = sub.sid;
      subToken = (sub as any).authToken as string;
      await storage.updateAccount(id, { twilioAccountSid: subSid, twilioAuthToken: subToken } as any);
    }
    const subClient = twilio(subSid, subToken);

    // 2) Buy an NL mobile number unless an earlier attempt already did. Mobile only:
    //    NL local numbers need a KvK + in-area address bundle, so an unattended buy fails.
    let fromNumber: string;
    if (existingNumber) {
      fromNumber = existingNumber;
    } else {
      try {
        const addressSid = await ensureAddress(master, subClient);
        const available: Array<{ phoneNumber: string }> = await subClient.availablePhoneNumbers("NL").mobile.list({ smsEnabled: true, limit: 1 });
        if (!available.length) {
          return res.status(502).json({ message: "No NL mobile numbers currently available to purchase" });
        }
        const bought = await subClient.incomingPhoneNumbers.create({
          phoneNumber: available[0].phoneNumber,
          addressSid,
          smsUrl: INBOUND_URL,
          smsMethod: "POST",
          statusCallback: STATUS_URL,
          statusCallbackMethod: "POST",
        });
        fromNumber = bought.phoneNumber;
        await storage.updateAccount(id, { twilioDefaultFromNumber: fromNumber } as any);
      } catch (e: any) {
        return res.status(502).json({ message: `Number purchase failed: ${e?.message || e}` });
      }
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
