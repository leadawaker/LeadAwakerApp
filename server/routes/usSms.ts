// Accounts > Integrations > WhatsApp & texting > US texting (agency only): the
// client's A2P 10DLC registration at Telnyx and its US texting number, in four
// steps: brand, campaign, number, assignment. State lives in Sms_Registrations
// (one row per account); the number on Accounts.telnyx_sms_number, which the
// engine sends from and routes inbound texts by. Every step that creates
// something at Telnyx costs money there (brand ~$4, campaign review $15 plus 3
// months up front, number ~$1/month), so each is its own explicit request.
import type { Express } from "express";
import { requireAgency } from "../auth";
import { pool } from "../db";
import { wrapAsync } from "./_helpers";
import {
  TelnyxError, assignNumber, brandFeedback, createBrand, createCampaign, createMessagingProfile, getAssignment,
  getBrand, getCampaign, getNumberOrder, orderNumber, searchUsNumbers, sendBrandOtp, verifyBrandOtp,
  type BrandInput,
} from "../usSms/telnyx10dlc";

const S = "p2mxx34fvbf3ll6";
/**
 * Off until Gabriel switches it on (US_SMS_REGISTRATION_ENABLED=true in .env): every step that
 * creates something at Telnyx (and costs money) is refused. Reading the state and searching
 * numbers stay available, so the panel can be explored.
 */
const enabled = () => process.env.US_SMS_REGISTRATION_ENABLED === "true";
const ENTITY_TYPES = ["PRIVATE_PROFIT", "PUBLIC_PROFIT", "NON_PROFIT", "SOLE_PROPRIETOR"];
const USECASES: Record<string, string[] | undefined> = {
  MIXED: ["CUSTOMER_CARE", "MARKETING"],
  LOW_VOLUME: ["CUSTOMER_CARE", "MARKETING"],
  CUSTOMER_CARE: undefined,
  MARKETING: undefined,
  SOLE_PROPRIETOR: ["CUSTOMER_CARE"],
};

type Row = Record<string, any>;

async function load(accountId: number): Promise<{ reg: Row | null; account: Row | null }> {
  const [reg, acc] = await Promise.all([
    pool.query(`SELECT * FROM ${S}."Sms_Registrations" WHERE "Accounts_id" = $1`, [accountId]),
    pool.query(`SELECT id, name, telnyx_sms_number, telnyx_messaging_profile_id FROM ${S}."Accounts" WHERE id = $1`, [accountId]),
  ]);
  return { reg: reg.rows[0] ?? null, account: acc.rows[0] ?? null };
}

/** Insert or update the account's row with the given columns (details merged, not replaced). */
async function save(accountId: number, cols: Record<string, unknown>, details: Record<string, unknown> = {}): Promise<void> {
  const keys = Object.keys(cols);
  const vals = keys.map((k) => cols[k]);
  const sets = keys.map((k, i) => `${k} = $${i + 3}`);
  await pool.query(
    `INSERT INTO ${S}."Sms_Registrations" ("Accounts_id", details${keys.map((k) => `, ${k}`).join("")})
     VALUES ($1, $2::jsonb${keys.map((_, i) => `, $${i + 3}`).join("")})
     ON CONFLICT ("Accounts_id") DO UPDATE SET details = ${S}."Sms_Registrations".details || $2::jsonb,
       updated_at = now()${sets.length ? `, ${sets.join(", ")}` : ""}`,
    [accountId, JSON.stringify(details), ...vals],
  );
}

const str = (v: unknown, max = 500) => (typeof v === "string" ? v.trim().slice(0, max) : "");

function view(reg: Row | null, account: Row | null) {
  return {
    registration: reg ? {
      entityType: reg.entity_type, brandId: reg.brand_id, brandStatus: reg.brand_status, brandIdentityStatus: reg.brand_identity_status,
      campaignId: reg.campaign_id, tcrCampaignId: reg.tcr_campaign_id, campaignStatus: reg.campaign_status, usecase: reg.usecase,
      numberStatus: reg.number_status, details: reg.details ?? {}, lastError: reg.last_error, updatedAt: reg.updated_at,
    } : null,
    number: account?.telnyx_sms_number ?? null,
    messagingProfileId: account?.telnyx_messaging_profile_id ?? null,
    enabled: enabled(),
  };
}

/** Pull the latest brand, campaign, number order and assignment states from Telnyx. */
async function refresh(accountId: number): Promise<void> {
  const { reg, account } = await load(accountId);
  if (!reg) return;
  const cols: Record<string, unknown> = {};
  const details: Record<string, unknown> = {};
  const errors: string[] = [];
  if (reg.brand_id) {
    try {
      const b = await getBrand(reg.brand_id);
      cols.brand_status = b?.status ?? null;
      cols.brand_identity_status = b?.identityStatus ?? null;
      if (String(b?.status || "").includes("FAIL")) {
        const fb = await brandFeedback(reg.brand_id);
        details.brandFeedback = fb?.category ?? fb ?? null;
      }
    } catch (e) { errors.push(`brand: ${(e as Error).message}`); }
  }
  if (reg.campaign_id) {
    try {
      const c = await getCampaign(reg.campaign_id);
      cols.campaign_status = c?.campaignStatus ?? c?.status ?? null;
      cols.tcr_campaign_id = c?.tcrCampaignId ?? reg.tcr_campaign_id ?? null;
      if (c?.failureReasons) details.campaignFailure = c.failureReasons;
    } catch (e) { errors.push(`campaign: ${(e as Error).message}`); }
  }
  const orderId = reg.details?.numberOrderId as string | undefined;
  const ordered = reg.details?.orderedNumber as string | undefined;
  if (orderId && !account?.telnyx_sms_number) {
    try {
      const o = await getNumberOrder(orderId);
      const status = String(o?.data?.status ?? "");
      cols.number_status = `order_${status}`;
      if (status === "success" && ordered) {
        await pool.query(`UPDATE ${S}."Accounts" SET telnyx_sms_number = $1 WHERE id = $2`, [ordered, accountId]);
      }
    } catch (e) { errors.push(`number: ${(e as Error).message}`); }
  }
  const number = account?.telnyx_sms_number || (cols.number_status === "order_success" ? ordered : null);
  if (number && reg.details?.assignRequested) {
    try {
      const a = await getAssignment(number);
      cols.number_status = a?.assignmentStatus ? `assignment_${String(a.assignmentStatus).toLowerCase()}` : cols.number_status ?? reg.number_status;
    } catch (e) { errors.push(`assignment: ${(e as Error).message}`); }
  }
  cols.last_error = errors.length ? errors.join(" · ").slice(0, 1000) : null;
  await save(accountId, cols, details);
}

export function registerUsSmsRoutes(app: Express): void {
  const id = (raw: string) => {
    const n = Number(raw);
    return Number.isSafeInteger(n) && n > 0 ? n : 0;
  };
  // A Telnyx refusal is the client's input or Telnyx's state, not our crash: 422 with Telnyx's words.
  const telnyx = (fn: (accountId: number, body: any) => Promise<unknown>) => wrapAsync(async (req, res) => {
    const accountId = id(req.params.id);
    if (!accountId) return res.status(400).json({ message: "Bad account id" });
    try {
      await fn(accountId, req.body ?? {});
    } catch (e) {
      if (e instanceof TelnyxError) {
        await save(accountId, { last_error: e.message.slice(0, 1000) }).catch(() => {});
        return res.status(422).json({ message: e.message });
      }
      if (e instanceof Error && e.name === "Input") return res.status(400).json({ message: e.message });
      throw e;
    }
    const { reg, account } = await load(accountId);
    res.json(view(reg, account));
  });
  const bad = (message: string) => Object.assign(new Error(message), { name: "Input" });
  const gate = (_req: any, res: any, next: () => void) =>
    enabled() ? next() : res.status(403).json({ message: "US texting registration is not switched on yet" });

  app.get("/api/accounts/:id/us-sms", requireAgency, wrapAsync(async (req, res) => {
    const accountId = id(req.params.id);
    if (!accountId) return res.status(400).json({ message: "Bad account id" });
    const { reg, account } = await load(accountId);
    if (!account) return res.status(404).json({ message: "Account not found" });
    res.json(view(reg, account));
  }));

  app.post("/api/accounts/:id/us-sms/refresh", requireAgency, telnyx(async (accountId) => { await refresh(accountId); }));

  // Step 1: the brand (the client's business at The Campaign Registry).
  app.post("/api/accounts/:id/us-sms/brand", requireAgency, gate, telnyx(async (accountId, body) => {
    const { reg } = await load(accountId);
    if (reg?.brand_id) throw bad("This account already has a brand");
    const entityType = str(body.entityType);
    if (!ENTITY_TYPES.includes(entityType)) throw bad("Pick the kind of business");
    const b: BrandInput = {
      entityType: entityType as BrandInput["entityType"],
      displayName: str(body.displayName, 255), companyName: str(body.companyName, 255), ein: str(body.ein, 21),
      firstName: str(body.firstName, 100), lastName: str(body.lastName, 100), phone: str(body.phone, 20), mobilePhone: str(body.mobilePhone, 20),
      email: str(body.email, 100), street: str(body.street, 100), city: str(body.city, 100), state: str(body.state, 20).toUpperCase(),
      postalCode: str(body.postalCode, 10), website: str(body.website, 100), vertical: str(body.vertical, 50) || "PROFESSIONAL",
    };
    const soleProp = b.entityType === "SOLE_PROPRIETOR";
    const missing = [
      ["displayName", b.displayName], ["email", b.email], ["street", b.street], ["city", b.city], ["state", b.state], ["postalCode", b.postalCode],
      ...(soleProp ? [["firstName", b.firstName], ["lastName", b.lastName], ["mobilePhone", b.mobilePhone]] : [["companyName", b.companyName], ["ein", b.ein]]),
    ].filter(([, v]) => !v).map(([k]) => k);
    if (missing.length) throw bad(`Missing: ${missing.join(", ")}`);
    const created = await createBrand(b);
    await save(accountId, {
      entity_type: b.entityType, brand_id: created?.brandId ?? null, brand_status: created?.status ?? "REGISTRATION_PENDING",
      brand_identity_status: created?.identityStatus ?? null, last_error: null,
    }, { brand: b });
  }));

  app.post("/api/accounts/:id/us-sms/brand/otp", requireAgency, gate, telnyx(async (accountId) => {
    const { reg } = await load(accountId);
    if (!reg?.brand_id) throw bad("Register the brand first");
    await sendBrandOtp(reg.brand_id);
    await save(accountId, { last_error: null }, { otpSentAt: new Date().toISOString() });
  }));

  app.post("/api/accounts/:id/us-sms/brand/otp/verify", requireAgency, gate, telnyx(async (accountId, body) => {
    const { reg } = await load(accountId);
    if (!reg?.brand_id) throw bad("Register the brand first");
    const pin = str(body.otpPin, 12);
    if (!pin) throw bad("Type the code");
    await verifyBrandOtp(reg.brand_id, pin);
    await save(accountId, { last_error: null }, { otpVerifiedAt: new Date().toISOString() });
    await refresh(accountId);
  }));

  // Step 2: the campaign (what the texts are for, with sample messages).
  app.post("/api/accounts/:id/us-sms/campaign", requireAgency, gate, telnyx(async (accountId, body) => {
    const { reg } = await load(accountId);
    if (!reg?.brand_id) throw bad("Register the brand first");
    if (reg.campaign_id) throw bad("This account already has a campaign");
    const usecase = reg.entity_type === "SOLE_PROPRIETOR" ? "SOLE_PROPRIETOR" : str(body.usecase);
    if (!(usecase in USECASES)) throw bad("Pick what the texts are for");
    const samples = (Array.isArray(body.samples) ? body.samples : []).map((s: unknown) => str(s, 1024)).filter(Boolean);
    const input = {
      brandId: reg.brand_id, usecase, subUsecases: USECASES[usecase],
      description: str(body.description, 4096), messageFlow: str(body.messageFlow, 4096), samples,
      helpMessage: str(body.helpMessage, 255), optoutMessage: str(body.optoutMessage, 255), optinMessage: str(body.optinMessage, 255),
      privacyPolicyLink: str(body.privacyPolicyLink, 255), termsAndConditionsLink: str(body.termsAndConditionsLink, 255),
      embeddedLink: body.embeddedLink !== false,
    };
    const missing = [["description", input.description], ["messageFlow", input.messageFlow], ["helpMessage", input.helpMessage], ["optoutMessage", input.optoutMessage]]
      .filter(([, v]) => !v).map(([k]) => k);
    if (samples.length < 2) missing.push("2 sample messages");
    if (missing.length) throw bad(`Missing: ${missing.join(", ")}`);
    const created = await createCampaign(input);
    await save(accountId, {
      campaign_id: created?.campaignId ?? null, tcr_campaign_id: created?.tcrCampaignId ?? null,
      campaign_status: created?.campaignStatus ?? created?.status ?? "PENDING", usecase, last_error: null,
    }, { campaign: { ...input, brandId: undefined } });
  }));

  // Step 3: a US number on the account's own messaging profile.
  app.get("/api/accounts/:id/us-sms/numbers", requireAgency, wrapAsync(async (req, res) => {
    const areaCode = String(req.query.areaCode ?? "").replace(/\D/g, "");
    if (areaCode.length !== 3) return res.status(400).json({ message: "Type a 3-digit area code" });
    try {
      res.json({ numbers: await searchUsNumbers(areaCode) });
    } catch (e) {
      if (e instanceof TelnyxError) return res.status(422).json({ message: e.message });
      throw e;
    }
  }));

  app.post("/api/accounts/:id/us-sms/number", requireAgency, gate, telnyx(async (accountId, body) => {
    const phoneNumber = str(body.phoneNumber, 20);
    if (!/^\+1\d{10}$/.test(phoneNumber)) throw bad("Pick a US number");
    const { reg, account } = await load(accountId);
    if (!account) throw bad("Account not found");
    if (account.telnyx_sms_number || reg?.details?.numberOrderId) throw bad("This account already has a texting number");
    let profileId = account.telnyx_messaging_profile_id as string | null;
    if (!profileId) {
      profileId = await createMessagingProfile(`Lead Awaker · ${account.name || `account ${accountId}`}`);
      await pool.query(`UPDATE ${S}."Accounts" SET telnyx_messaging_profile_id = $1 WHERE id = $2`, [profileId, accountId]);
    }
    const order = await orderNumber(phoneNumber, profileId, `leadawaker-account-${accountId}`);
    await save(accountId, { number_status: `order_${order.status}`, last_error: null }, { numberOrderId: order.id, orderedNumber: phoneNumber });
    if (order.status === "success") {
      await pool.query(`UPDATE ${S}."Accounts" SET telnyx_sms_number = $1 WHERE id = $2`, [phoneNumber, accountId]);
    }
  }));

  // Step 4: the number joins the campaign (only after the campaign is approved).
  app.post("/api/accounts/:id/us-sms/assign", requireAgency, gate, telnyx(async (accountId) => {
    const { reg, account } = await load(accountId);
    if (!reg?.campaign_id) throw bad("Create the campaign first");
    if (!account?.telnyx_sms_number) throw bad("Buy the number first");
    const a = await assignNumber(account.telnyx_sms_number, reg.campaign_id);
    await save(accountId, {
      number_status: a?.assignmentStatus ? `assignment_${String(a.assignmentStatus).toLowerCase()}` : "assignment_pending", last_error: null,
    }, { assignRequested: true });
  }));
}
