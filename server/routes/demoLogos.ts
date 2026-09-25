// Client logos for the Instagram and Reputation demos (server/clientLogo.ts).
// Set per Client on the Demos table, read live by the demo pages, so a change
// or the on/off switch reaches every demo of that Client, links already sent
// included.
import type { Express, Request, Response } from "express";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { nicheVocabulary } from "@shared/schema";
import { logoUrlFor, refreshSiteLogo, storeLogo } from "../clientLogo";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import { loadPersona } from "./demoSocial";

const cols = {
  niche: nicheVocabulary.niche,
  logoPath: nicheVocabulary.logoPath,
  logoSource: nicheVocabulary.logoSource,
  logoEnabled: nicheVocabulary.logoEnabled,
  websiteUrl: nicheVocabulary.websiteUrl,
  companyNameTemplate: nicheVocabulary.companyNameTemplate,
};
interface Row {
  niche: string | null;
  logoPath: string | null;
  logoSource: string | null;
  logoEnabled: boolean | null;
  websiteUrl: string | null;
  companyNameTemplate: unknown;
}

function view(r: Row) {
  const names = (r.companyNameTemplate || {}) as Record<string, string>;
  return {
    // The file, whether or not it is switched on, so the Demos page can preview it.
    logoUrl: r.logoPath ? `/api/site-shot/${r.logoPath}` : null,
    source: r.logoSource || null,
    enabled: r.logoEnabled !== false,
    websiteUrl: r.websiteUrl || null,
    company: names.en || names.nl || names.pt || "",
  };
}

async function one(niche: string) {
  const [r] = await db.select(cols).from(nicheVocabulary).where(eq(nicheVocabulary.niche, niche)).limit(1);
  return r as Row | undefined;
}

/** The logo a demo page should show for this persona, or null (initials). */
export async function logoForPersona(persona: Record<string, unknown>): Promise<string | null> {
  const key = String(persona.client_niche || persona.raw || "");
  if (!key) return null;
  const [r] = await db
    .select({ logoPath: nicheVocabulary.logoPath, logoEnabled: nicheVocabulary.logoEnabled })
    .from(nicheVocabulary)
    .where(eq(nicheVocabulary.niche, key))
    .limit(1);
  return logoUrlFor(r);
}

export function registerDemoLogoRoutes(app: Express) {
  // Every Client's logo state, keyed by niche, for the Demos table. One request.
  app.get("/api/demo/client-logos", requireAuth, requireAgency, wrapAsync(async (_req: Request, res: Response) => {
    const rows = (await db.select(cols).from(nicheVocabulary)) as Row[];
    const logos: Record<string, ReturnType<typeof view>> = {};
    for (const r of rows) if (r.niche) logos[r.niche] = view(r);
    res.json({ logos });
  }));

  app.post("/api/demo/clients/:niche/logo/fetch", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const niche = String(req.params.niche || "");
    const row = await one(niche);
    if (!row) return res.status(404).json({ message: "Unknown client." });
    if (!row.websiteUrl) return res.status(400).json({ message: "This Client has no website on file." });
    // An explicit click replaces an upload: that is what the button says.
    const got = await refreshSiteLogo(niche, row.websiteUrl, { overwriteUpload: true });
    if (!got.ok) return res.status(422).json({ message: got.error });
    res.json(view((await one(niche))!));
  }));

  // A data URL uploads a replacement; null removes the logo (back to initials).
  app.put("/api/demo/clients/:niche/logo", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const niche = String(req.params.niche || "");
    const parsed = z
      .object({ dataUrl: z.string().regex(/^data:image\/(webp|png|jpeg|gif|svg\+xml);base64,[A-Za-z0-9+/=]+$/).nullable() })
      .safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    if (!(await one(niche))) return res.status(404).json({ message: "Unknown client." });

    if (parsed.data.dataUrl === null) {
      await db.update(nicheVocabulary).set({ logoPath: null, logoSource: null }).where(eq(nicheVocabulary.niche, niche));
      return res.json(view((await one(niche))!));
    }
    const [, mime, b64] = /^data:image\/([a-z+]+);base64,(.+)$/.exec(parsed.data.dataUrl)!;
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length || bytes.length > 3_000_000) return res.status(413).json({ message: "That image is too large." });
    const file = await storeLogo(bytes, `image/${mime}`);
    if (!file) return res.status(422).json({ message: "That image could not be used (too small or unreadable)." });
    await db.update(nicheVocabulary).set({ logoPath: file, logoSource: "upload", logoEnabled: true }).where(eq(nicheVocabulary.niche, niche));
    res.json(view((await one(niche))!));
  }));

  app.put("/api/demo/clients/:niche/logo-enabled", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const niche = String(req.params.niche || "");
    const parsed = z.object({ enabled: z.boolean() }).safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const [r] = await db
      .update(nicheVocabulary)
      .set({ logoEnabled: parsed.data.enabled })
      .where(eq(nicheVocabulary.niche, niche))
      .returning({ niche: nicheVocabulary.niche });
    if (!r) return res.status(404).json({ message: "Unknown client." });
    res.json(view((await one(niche))!));
  }));

  // Public, token-gated: what the Reputation demo page shows. The Instagram
  // page gets the same value server-side in its boot blob.
  app.get("/api/demo/:token/logo", wrapAsync(async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).json({ logoUrl: null });
    const { persona, found, expired } = await loadPersona(token);
    res.set("cache-control", "no-store");
    if (!found || expired) return res.json({ logoUrl: null });
    res.json({ logoUrl: await logoForPersona(persona) });
  }));
}
