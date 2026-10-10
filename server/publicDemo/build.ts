// Builds Sara for one verified public demo request: read the visitor's site,
// generate the persona, put it on their demo lead, then ask the engine to
// tell them on WhatsApp that she is ready (call number, browser link, how to
// chat). Runs only after the phone is verified.
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { leads } from "@shared/schema";
import { buildClientFromSite } from "../demoWebsiteClient";
import { buildVoiceDemoLink, type DemoMarket } from "../demo-session";
import type { DemoLang } from "../demo-clients";
import { addSpend, domainCachedPersona } from "./limits";
import { getPublicDemoSettings } from "./settings";

const REQ = `"p2mxx34fvbf3ll6"."Public_Demo_Requests"`;
const ENGINE = process.env.ENGINE_URL || "http://localhost:8100";
const BUILD_TIMEOUT_MS = 150_000;

export async function engineCall(path: string, body: Record<string, unknown>): Promise<boolean> {
  try {
    const res = await fetch(`${ENGINE}/api/public-demo/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Internal-Key": process.env.INTERNAL_API_KEY || "" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) console.error(`[public-demo] engine ${path} returned`, res.status, await res.text().catch(() => ""));
    return res.ok;
  } catch (err) {
    console.error(`[public-demo] engine ${path} failed`, (err as Error).message);
    return false;
  }
}

/** Which market an English demo prices in: the site's country, else the phone's. */
function marketFor(domain: string, phone: string | null): DemoMarket | undefined {
  if (domain.endsWith(".uk")) return "uk";
  if (domain.endsWith(".nl")) return "nl";
  if ((phone || "").startsWith("+44")) return "uk";
  return undefined;
}

// The site's icon, as the engine found it (tools/site_logo.py): a small raster
// image inlined as a data: URL. Checked again here because the landing page
// puts whatever is stored straight into an <img>.
const LOGO_RE = /^data:image\/(png|jpeg|webp|gif|x-icon);base64,[A-Za-z0-9+/]+=*$/;
const LOGO_MAX_CHARS = 210_000;

export function safeLogo(value: unknown): string | null {
  return typeof value === "string" && value.length <= LOGO_MAX_CHARS && LOGO_RE.test(value) ? value : null;
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`timed out after ${ms / 1000}s`)), ms)),
  ]);
}

export async function buildPublicDemo(token: string): Promise<void> {
  const { rows } = await pool.query(`SELECT * FROM ${REQ} WHERE token = $1`, [token]);
  const req = rows[0];
  if (!req || req.status !== "building" || !req.lead_id) return;
  const language = req.language as DemoLang;

  try {
    let persona: Record<string, unknown>;
    let logo: string | null = null;
    const cached = await domainCachedPersona(req.domain, language);
    if (cached) {
      persona = cached.persona;
      logo = safeLogo(cached.logo);
    } else {
      const settings = await getPublicDemoSettings();
      // Counted before the work, so a failing site still uses up budget and a
      // daily build slot: retrying a broken URL is not free.
      await addSpend(settings.costEstimates.buildEur, { built: true, token });
      const result = await withTimeout(
        buildClientFromSite({
          url: req.website_url,
          text: "",
          language,
          scenario: "inquired",
          market: language === "en" ? marketFor(req.domain, req.phone) : undefined,
          provider: "openai",
          claudeModel: "sonnet",
          public: true,
        }),
        BUILD_TIMEOUT_MS,
      );
      if (!result.ok) throw new Error(result.body.message);
      persona = result.ctx as unknown as Record<string, unknown>;
      logo = safeLogo(result.scraped?.logo);
    }

    const companyName = String(persona.company_name || "").slice(0, 120) || null;
    await db
      .update(leads)
      .set({ demoNiche: JSON.stringify(persona), updatedAt: new Date() } as any)
      .where(eq(leads.id, req.lead_id));
    await pool.query(
      `UPDATE ${REQ} SET persona = $1, company_name = $2, logo = $3, status = 'ready', ready_at = now() WHERE token = $4`,
      [JSON.stringify(persona), companyName, logo, token],
    );
    console.log(`[public-demo] ready: ${req.domain}${cached ? " (cached persona)" : ""}`);
    await engineCall("opening", { lead_id: req.lead_id, voice_url: buildVoiceDemoLink({ token }) });
  } catch (err) {
    const reason = (err as Error).message.slice(0, 500);
    console.error(`[public-demo] build failed for ${req.domain}:`, reason);
    await pool.query(`UPDATE ${REQ} SET status = 'failed', reason = $1 WHERE token = $2`, [reason, token]);
    await engineCall("notice", { lead_id: req.lead_id, kind: "unreadable", domain: req.domain });
  }
}
