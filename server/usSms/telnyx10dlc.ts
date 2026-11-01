/**
 * US business texting (A2P 10DLC) at Telnyx, registered by Lead Awaker for a
 * client (specs/us-sms-a2p/plan.md). Telnyx is the registration provider: one
 * Brand per client, one Campaign per brand, numbers on a per-client messaging
 * profile whose webhook is the engine's /webhooks/telnyx/messaging (inbound
 * texts and delivery status). Paths and fields follow Telnyx's OpenAPI spec.
 *
 * The 10DLC endpoints answer with the object itself, the rest wrap it in
 * `data`; `call()` returns the body as it comes.
 */
import { telnyxFetch } from "../numberRequests/telnyxOrder";

export class TelnyxError extends Error {}

async function call(path: string, method = "GET", body?: unknown): Promise<any> {
  let res: Response;
  try {
    res = await telnyxFetch(path, {
      method,
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new TelnyxError("Telnyx could not be reached");
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const errs: any[] = Array.isArray(data?.errors) ? data.errors : Array.isArray(data) ? data : [];
    const msg = errs.map((e) => [e?.title, e?.detail, e?.description, e?.field].filter(Boolean).join(": ")).filter(Boolean).join(" · ");
    throw new TelnyxError(msg || data?.message || `Telnyx answered ${res.status}`);
  }
  return data;
}

/** The engine's public address; the messaging profile posts inbound texts and statuses there. */
const ENGINE_WEBHOOK = `${(process.env.ENGINE_PUBLIC_WEBHOOK_URL || "https://webhooks.leadawaker.com").replace(/\/+$/, "")}/webhooks/telnyx/messaging`;

export interface BrandInput {
  entityType: "PRIVATE_PROFIT" | "PUBLIC_PROFIT" | "NON_PROFIT" | "SOLE_PROPRIETOR";
  displayName: string;
  companyName?: string;
  ein?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  mobilePhone?: string;
  email: string;
  street: string;
  city: string;
  state: string;
  postalCode: string;
  website?: string;
  vertical: string;
}

export async function createBrand(b: BrandInput): Promise<any> {
  const soleProp = b.entityType === "SOLE_PROPRIETOR";
  const body: Record<string, unknown> = {
    entityType: b.entityType,
    displayName: b.displayName,
    country: "US",
    email: b.email,
    vertical: b.vertical,
    street: b.street, city: b.city, state: b.state, postalCode: b.postalCode,
    phone: b.phone || undefined,
    website: b.website || undefined,
    firstName: b.firstName || undefined,
    lastName: b.lastName || undefined,
  };
  if (soleProp) body.mobilePhone = b.mobilePhone;
  else { body.companyName = b.companyName; body.ein = b.ein; }
  return call("10dlc/brand", "POST", body);
}

export const getBrand = (brandId: string) => call(`10dlc/brand/${encodeURIComponent(brandId)}`);
export const brandFeedback = (brandId: string) => call(`10dlc/brand/feedback/${encodeURIComponent(brandId)}`).catch(() => null);

/** Sole proprietor: Telnyx texts the owner's mobile a code; they type it into the panel. */
export const sendBrandOtp = (brandId: string) => call(`10dlc/brand/${encodeURIComponent(brandId)}/smsOtp`, "POST", {
  pinSms: "Your Lead Awaker texting verification code is @OTP_PIN@. Reply STOP to opt out.",
  successSms: "Thanks, your business texting registration is verified.",
});
export const verifyBrandOtp = (brandId: string, otpPin: string) => call(`10dlc/brand/${encodeURIComponent(brandId)}/smsOtp`, "PUT", { otpPin });

export interface CampaignInput {
  brandId: string;
  usecase: string;
  subUsecases?: string[];
  description: string;
  messageFlow: string;
  samples: string[];
  helpMessage: string;
  optoutMessage: string;
  optinMessage?: string;
  privacyPolicyLink?: string;
  termsAndConditionsLink?: string;
  embeddedLink: boolean;
}

export async function createCampaign(c: CampaignInput): Promise<any> {
  const body: Record<string, unknown> = {
    brandId: c.brandId,
    usecase: c.usecase,
    description: c.description,
    messageFlow: c.messageFlow,
    helpMessage: c.helpMessage,
    optoutMessage: c.optoutMessage,
    optinMessage: c.optinMessage || undefined,
    helpKeywords: "HELP,INFO",
    optoutKeywords: "STOP,UNSUBSCRIBE,CANCEL,END,QUIT",
    optinKeywords: "START,YES",
    subscriberHelp: true,
    subscriberOptout: true,
    subscriberOptin: true,
    embeddedLink: c.embeddedLink,
    embeddedPhone: false,
    numberPool: false,
    ageGated: false,
    directLending: false,
    termsAndConditions: true,
    autoRenewal: true,
    privacyPolicyLink: c.privacyPolicyLink || undefined,
    termsAndConditionsLink: c.termsAndConditionsLink || undefined,
  };
  if (c.subUsecases?.length) body.subUsecases = c.subUsecases;
  c.samples.filter((s) => s.trim()).slice(0, 5).forEach((s, i) => { body[`sample${i + 1}`] = s.trim(); });
  return call("10dlc/campaignBuilder", "POST", body);
}

export const getCampaign = (campaignId: string) => call(`10dlc/campaign/${encodeURIComponent(campaignId)}`);

export interface AvailableUsNumber { phoneNumber: string; locality: string | null; region: string | null; monthly: string | null; upfront: string | null }

/** Up to `limit` US local numbers that can text, in an area code ("212"). */
export async function searchUsNumbers(areaCode: string, limit = 8): Promise<AvailableUsNumber[]> {
  const q = new URLSearchParams({
    "filter[country_code]": "US",
    "filter[phone_number_type]": "local",
    "filter[national_destination_code]": areaCode,
    "filter[features][]": "sms",
    "filter[limit]": String(limit),
  });
  const data = await call(`available_phone_numbers?${q}`);
  return (data?.data ?? []).map((n: any) => {
    const region = (n.region_information ?? []) as Array<{ region_type: string; region_name: string }>;
    return {
      phoneNumber: n.phone_number,
      locality: region.find((r) => r.region_type === "rate_center")?.region_name ?? null,
      region: region.find((r) => r.region_type === "state")?.region_name ?? null,
      monthly: n.cost_information?.monthly_cost ?? null,
      upfront: n.cost_information?.upfront_cost ?? null,
    };
  });
}

/** The account's own messaging profile (US only), pointed at the engine. Returns its id. */
export async function createMessagingProfile(name: string): Promise<string> {
  const data = await call("messaging_profiles", "POST", {
    name,
    whitelisted_destinations: ["US"],
    webhook_url: ENGINE_WEBHOOK,
    webhook_api_version: "2",
    enabled: true,
  });
  const id = data?.data?.id;
  if (!id) throw new TelnyxError("Telnyx did not return a messaging profile id");
  return String(id);
}

export async function orderNumber(phoneNumber: string, messagingProfileId: string, reference: string): Promise<{ id: string; status: string }> {
  const data = await call("number_orders", "POST", {
    phone_numbers: [{ phone_number: phoneNumber }],
    messaging_profile_id: messagingProfileId,
    customer_reference: reference,
  });
  return { id: String(data?.data?.id ?? ""), status: String(data?.data?.status ?? "pending") };
}

export const getNumberOrder = (orderId: string) => call(`number_orders/${encodeURIComponent(orderId)}`);

export const assignNumber = (phoneNumber: string, campaignId: string) =>
  call("10dlc/phone_number_campaigns", "POST", { phoneNumber, campaignId });
export const getAssignment = (phoneNumber: string) =>
  call(`10dlc/phone_number_campaigns/${encodeURIComponent(phoneNumber)}`);
