// Demos page → Settings tab. One row per service in Demo_Settings.
//
// Most services have no knobs yet; the tab lists them anyway so the place to
// add one already exists. The widget is the first real setting: the photo the
// widget demo shows for its agent, uploaded once instead of asked for per demo.
import type { Express, Request, Response } from "express";
import { createHash } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { eq, isNotNull, or } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { demoSettings, nicheVocabulary } from "@shared/schema";
import { brandColorForShot } from "../brandColor";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";

export const DEMO_AVATAR_DIR = path.resolve("uploads/demo-avatars");
/** The bundled photo every widget demo uses until one is uploaded. */
export const DEFAULT_WIDGET_AVATAR = "/avatars/receptionist.webp";

// Content-addressed names, so the serve route can refuse anything that is not
// exactly one of ours before it touches the filesystem.
const AVATAR_FILE_RE = /^[a-f0-9]{16}\.(webp|png|jpg)$/;
// The client resizes to 192px before uploading, so a real one is ~10-30KB.
// This ceiling only stops an oversized paste, it is not the expected size.
const MAX_AVATAR_BYTES = 400_000;

async function readSettings(service: string): Promise<Record<string, unknown>> {
  const [row] = await db.select().from(demoSettings).where(eq(demoSettings.service, service)).limit(1);
  return (row?.settings as Record<string, unknown>) || {};
}

async function writeSettings(service: string, settings: Record<string, unknown>) {
  await db
    .insert(demoSettings)
    .values({ service, settings, updatedAt: new Date() })
    .onConflictDoUpdate({ target: demoSettings.service, set: { settings, updatedAt: new Date() } });
}

/** The agent photo for widget demos: the uploaded one, else the bundled default. */
export async function widgetDemoAvatarUrl(): Promise<string> {
  try {
    const file = String((await readSettings("widget")).avatarFile || "");
    return AVATAR_FILE_RE.test(file) ? `/api/demo-avatar/${file}` : DEFAULT_WIDGET_AVATAR;
  } catch {
    return DEFAULT_WIDGET_AVATAR;
  }
}

const HEX_RE = /^#[0-9a-fA-F]{6}$/;

/**
 * The widget demo launcher colour for one Client: the one picked by hand, else
 * the brand colour read off its screenshot, else null (the page draws black).
 * Read live at page render, so a change reaches links already sent.
 */
export async function widgetColorFor(row: { widgetColor?: string | null; screenshotPath?: string | null }) {
  const manual = row.widgetColor && HEX_RE.test(row.widgetColor) ? row.widgetColor.toLowerCase() : null;
  const auto = row.screenshotPath ? await brandColorForShot(row.screenshotPath) : null;
  return { manual, auto, color: manual || auto };
}

export function registerDemoSettingsRoutes(app: Express) {
  // Every Client's launcher colour, keyed by niche, for the swatches in the
  // Demos table's widget column. One request for the whole table.
  app.get("/api/demo/widget-colors", requireAuth, requireAgency, wrapAsync(async (_req: Request, res: Response) => {
    const rows = await db
      .select({ niche: nicheVocabulary.niche, widgetColor: nicheVocabulary.widgetColor, screenshotPath: nicheVocabulary.screenshotPath })
      .from(nicheVocabulary)
      .where(or(isNotNull(nicheVocabulary.screenshotPath), isNotNull(nicheVocabulary.widgetColor)));
    const colors: Record<string, Awaited<ReturnType<typeof widgetColorFor>>> = {};
    for (const r of rows) colors[r.niche] = await widgetColorFor(r);
    res.json({ colors });
  }));

  // null clears the pick, which falls back to the detected colour (or black).
  app.put("/api/demo/clients/:niche/widget-color", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const niche = String(req.params.niche || "");
    const parsed = z.object({ color: z.string().regex(HEX_RE).nullable() }).safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const [row] = await db
      .update(nicheVocabulary)
      .set({ widgetColor: parsed.data.color ? parsed.data.color.toLowerCase() : null })
      .where(eq(nicheVocabulary.niche, niche))
      .returning({ widgetColor: nicheVocabulary.widgetColor, screenshotPath: nicheVocabulary.screenshotPath });
    if (!row) return res.status(404).json({ message: "Unknown client." });
    res.json(await widgetColorFor(row));
  }));

  app.get("/api/demo-settings", requireAuth, requireAgency, wrapAsync(async (_req: Request, res: Response) => {
    const rows = await db.select().from(demoSettings);
    const out: Record<string, Record<string, unknown>> = {};
    for (const r of rows) out[r.service] = (r.settings as Record<string, unknown>) || {};
    res.json({ settings: out, widgetAvatarUrl: await widgetDemoAvatarUrl(), defaultWidgetAvatarUrl: DEFAULT_WIDGET_AVATAR });
  }));

  // The photo travels as a data URL: the page already has it as one after the
  // canvas resize, and it keeps this route free of a multipart parser.
  const avatarSchema = z.object({
    dataUrl: z.string().regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/).nullable(),
  });

  app.put("/api/demo-settings/widget/avatar", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = avatarSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const current = await readSettings("widget");

    // null resets to the bundled default.
    if (parsed.data.dataUrl === null) {
      const { avatarFile: _drop, ...rest } = current;
      await writeSettings("widget", rest);
      return res.json({ widgetAvatarUrl: DEFAULT_WIDGET_AVATAR });
    }

    const [, mime, b64] = /^data:image\/(webp|png|jpeg);base64,(.+)$/.exec(parsed.data.dataUrl)!;
    const bytes = Buffer.from(b64, "base64");
    if (!bytes.length || bytes.length > MAX_AVATAR_BYTES) {
      return res.status(413).json({ message: "That image is too large." });
    }
    const ext = mime === "jpeg" ? "jpg" : mime;
    const file = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.${ext}`;
    await fs.mkdir(DEMO_AVATAR_DIR, { recursive: true });
    await fs.writeFile(path.join(DEMO_AVATAR_DIR, file), bytes);
    await writeSettings("widget", { ...current, avatarFile: file });
    res.json({ widgetAvatarUrl: `/api/demo-avatar/${file}` });
  }));

  // Public: a prospect's demo page loads it.
  app.get("/api/demo-avatar/:file", wrapAsync(async (req: Request, res: Response) => {
    const file = String(req.params.file || "");
    if (!AVATAR_FILE_RE.test(file)) return res.status(404).end();
    const type = file.endsWith(".webp") ? "image/webp" : file.endsWith(".png") ? "image/png" : "image/jpeg";
    res.sendFile(path.join(DEMO_AVATAR_DIR, file), {
      headers: { "content-type": type, "cache-control": "public, max-age=86400, immutable" },
    }, (err) => { if (err && !res.headersSent) res.status(404).end(); });
  }));
}
