// The create panel's calls: scan a website, build a Client from a niche, save the reviewed scan.
import type { DemoLang, DemoClientPatch } from "@/features/campaigns/api/demoClientsApi";
import type { DemoProduct } from "@shared/demoProducts";
import { apiFetch } from "@/lib/apiUtils";

export interface ScanResult {
  client: string;
  languages: DemoLang[];
  pages_scraped: string[];
  provider_used: string;
  business_description: string;
  products: DemoProduct[];
  stock_url: string;
  city: string;
  phone: string;
  screenshot: string | null;
}

/** A failed call: the server's message, and whether trying again could help. */
export class ScanError extends Error {
  retryable: boolean;
  constructor(message: string, retryable: boolean) {
    super(message);
    this.retryable = retryable;
  }
}

interface GenerateOptions {
  language: DemoLang;
  market?: "uk" | "us" | "nl";
  provider: "claude" | "openai";
  claudeModel?: "opus" | "sonnet";
}

async function call(method: string, url: string, body: unknown): Promise<Record<string, unknown>> {
  const res = await apiFetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    const message = typeof data.message === "string" && data.message ? data.message : `Request failed (${res.status})`;
    throw new ScanError(message, data.retryable === true);
  }
  return data;
}

const text = (v: unknown): string => (typeof v === "string" ? v : "");
const list = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

/** Build a Client from the prospect's site (`url`) or from pasted details (`text`). The Client is saved before this returns. */
export async function scanWebsite(body: GenerateOptions & { url?: string; text?: string }): Promise<ScanResult> {
  const d = await call("POST", "/api/demo/clients/from-website", body);
  return {
    client: text(d.client),
    languages: list<DemoLang>(d.languages),
    pages_scraped: list<string>(d.pages_scraped),
    provider_used: text(d.provider_used),
    business_description: text(d.business_description),
    products: list<DemoProduct>(d.products),
    stock_url: text(d.stock_url),
    city: text(d.city),
    phone: text(d.phone),
    screenshot: typeof d.screenshot === "string" && d.screenshot ? d.screenshot : null,
  };
}

/** Generate and save a Client from a typed niche. */
export async function buildFromNiche(body: GenerateOptions & { niche: string }): Promise<{ client: string }> {
  const d = await call("POST", "/api/demo/clients/from-niche", body);
  return { client: text(d.client) };
}

/** The review step's "Save client": the edited summary, products, city and stock URL onto the saved Client. */
export async function saveScanReview(
  niche: string,
  lang: DemoLang,
  review: { summary: string; products: DemoProduct[]; city: string; stockUrl: string },
): Promise<void> {
  const patch: DemoClientPatch = {
    text: { descriptionTemplate: { [lang]: review.summary } },
    products: { [lang]: review.products },
    city: review.city,
    stockUrl: review.stockUrl,
  };
  await call("PATCH", `/api/demo/clients/${encodeURIComponent(niche)}`, patch);
}
