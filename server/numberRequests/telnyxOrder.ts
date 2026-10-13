/**
 * Ordering a client's phone number at Telnyx from a submitted number request
 * (specs: the /number-docs upload page). Three calls, all with what the client
 * handed in: an address, a requirement group that points at their three
 * documents, then the number order itself. Telnyx reviews the documents; the
 * order stays "pending" until they approve it (two days for our own 073).
 *
 * Only Dutch local (geographic) numbers for now: their requirement ids are
 * below. The address must lie in the area code's region, so the area code is
 * chosen to match the client's city.
 */
import type { NumberRequest, NumberRequestOrder } from "@shared/schema";

const API = "https://api.telnyx.com/v2";

// GET /v2/requirements?filter[country_code]=NL&filter[phone_number_type]=local
const REQ = {
  contact: "2708e569-696a-4fc7-9305-5fdb3eb9c7dd",
  address: "a7d9a3a3-70ed-4cb4-821b-b94e8ea6dc9b",
  proofOfAddress: "b0197fa1-c2fd-4500-9875-2c658b2396eb",
  id: "ec029bc6-357f-404d-bdfd-f61d4e578896",
  kvk: "f39fbfaa-336d-40d9-bbc4-21082446ed07",
} as const;

export class TelnyxOrderError extends Error {}

/** One authenticated request to Telnyx, as it comes back. The one place the key and the base URL are set. */
export function telnyxFetch(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<Response> {
  return fetch(`${API}/${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${process.env.TELNYX_API_KEY || ""}`, ...(init.headers ?? {}) },
    signal: AbortSignal.timeout(timeoutMs),
  });
}

async function telnyx(path: string, init?: { method?: string; body?: unknown }): Promise<any> {
  let res: Response;
  try {
    res = await telnyxFetch(path, {
      method: init?.method ?? "GET",
      headers: init?.body ? { "Content-Type": "application/json" } : {},
      body: init?.body ? JSON.stringify(init.body) : undefined,
    });
  } catch {
    throw new TelnyxOrderError("Telnyx could not be reached");
  }
  const data = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) {
    const e = data?.errors?.[0];
    throw new TelnyxOrderError(e?.detail || e?.title || `Telnyx answered ${res.status}`);
  }
  return data?.data;
}

export interface AvailableNumber { phoneNumber: string; locality: string | null; upfront: string | null; monthly: string | null }

/** Up to `limit` Dutch local numbers in stock for an area code without the 0 ("73"). */
export async function searchNumbers(areaCode: string, limit = 6): Promise<AvailableNumber[]> {
  const q = new URLSearchParams({
    "filter[country_code]": "NL",
    "filter[phone_number_type]": "local",
    "filter[national_destination_code]": areaCode,
    "filter[features]": "voice",
    "filter[limit]": String(limit),
  });
  const rows = (await telnyx(`available_phone_numbers?${q}`)) ?? [];
  return rows.map((r: any) => ({
    phoneNumber: r.phone_number,
    locality: r.region_information?.find((x: any) => x.region_type === "location")?.region_name ?? null,
    upfront: r.cost_information?.upfront_cost ?? null,
    monthly: r.cost_information?.monthly_cost ?? null,
  }));
}

/** "Thijs van der Robben" -> ["Thijs", "van der Robben"]. */
function splitName(full: string): [string, string] {
  const parts = full.trim().split(/\s+/);
  return parts.length > 1 ? [parts[0], parts.slice(1).join(" ")] : [full.trim(), full.trim()];
}

const now = () => new Date().toISOString();

/**
 * Place the order. Never throws: the outcome (or the reason it failed) comes
 * back as the order record to store on the request.
 */
export async function placeOrder(row: NumberRequest, companyName: string): Promise<NumberRequestOrder> {
  const base = { orderId: null, requirementGroupId: null, phoneNumber: null, checkedAt: now() };
  try {
    const d = row.details;
    const doc = (kind: string) => row.documents.find((x) => x.kind === kind)?.telnyxDocumentId;
    if (!row.areaCode) throw new TelnyxOrderError("No area code chosen");
    if (!doc("kvk") || !doc("id") || !doc("address")) throw new TelnyxOrderError("A document is missing");

    // The number: the one picked when the link was made, if still free, else the first free one.
    const free = await searchNumbers(row.areaCode, 20);
    const phoneNumber = free.find((n) => n.phoneNumber === row.preferredNumber)?.phoneNumber ?? free[0]?.phoneNumber;
    if (!phoneNumber) throw new TelnyxOrderError(`No numbers in stock for area code 0${row.areaCode}`);

    const [first, last] = splitName(d.representative || companyName);
    const business = d.legalName || companyName;
    const address = await telnyx("addresses", {
      method: "POST",
      body: {
        first_name: first, last_name: last, business_name: business,
        street_address: d.street, locality: d.city, postal_code: d.postalCode, country_code: "NL",
        phone_number: d.contactPhone, customer_reference: `KvK ${d.kvkNumber}`,
      },
    });
    const group = await telnyx("requirement_groups", {
      method: "POST",
      body: {
        country_code: "NL", phone_number_type: "local", action: "ordering",
        customer_reference: `${business} (account ${row.accountsId})`,
        regulatory_requirements: [
          { requirement_id: REQ.contact, field_value: `Contact: ${d.representative} | Business: ${business} (KvK ${d.kvkNumber}) | Phone: ${d.contactPhone}` },
          { requirement_id: REQ.address, field_value: String(address.id) },
          { requirement_id: REQ.kvk, field_value: doc("kvk")! },
          { requirement_id: REQ.id, field_value: doc("id")! },
          { requirement_id: REQ.proofOfAddress, field_value: doc("address")! },
        ],
      },
    });
    const order = await telnyx("number_orders", {
      method: "POST",
      body: {
        phone_numbers: [{ phone_number: phoneNumber, requirement_group_id: group.id }],
        // The route of a number nobody owns yet; attaching it in the CRM moves it.
        ...(process.env.TELNYX_DIRECT_CONNECTION_ID ? { connection_id: process.env.TELNYX_DIRECT_CONNECTION_ID } : {}),
        customer_reference: `${business} (account ${row.accountsId})`,
      },
    });
    return {
      ...base, phoneNumber, orderId: String(order.id), requirementGroupId: String(group.id),
      status: order.status === "success" ? "success" : order.status === "failure" ? "failure" : "pending",
      error: null,
    };
  } catch (err) {
    return { ...base, status: "failure", error: err instanceof Error ? err.message : String(err) };
  }
}

/** Re-read a pending order's status from Telnyx. */
export async function refreshOrder(order: NumberRequestOrder): Promise<NumberRequestOrder> {
  if (!order.orderId || order.status !== "pending") return order;
  try {
    const o = await telnyx(`number_orders/${order.orderId}`);
    const status = o.status === "success" ? "success" : o.status === "failure" ? "failure" : "pending";
    return { ...order, status, checkedAt: now(), error: status === "failure" ? "Telnyx turned the order down. Check the documents in the Telnyx portal." : null };
  } catch {
    return order;
  }
}
