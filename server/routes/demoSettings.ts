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
import { SHOT_DIR } from "../siteShot";
import { execFile } from "child_process";
import { promisify } from "util";
import os from "os";
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

  /**
   * The homepage image behind a Client's widget demo.
   *
   * Clients built from a URL get one automatically from the scrape. A Client
   * typed as a niche never had a site to photograph, so its widget demo had
   * nothing behind it: this is how one gets there by hand, a generated mockup
   * or a screenshot taken manually.
   *
   * Stored exactly like a scraped one (content-addressed .webp in
   * uploads/site-shots, name on the Client row), so everything downstream --
   * the widget demo, the thumbnail in the sessions table, the launcher colour
   * read off the image -- works without knowing where it came from.
   */
  const MAX_SHOT_BYTES = 8_000_000;
  const execFileAsync = promisify(execFile);

  app.put("/api/demo/clients/:niche/screenshot", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const niche = String(req.params.niche || "");
    const parsed = z
      .object({ dataUrl: z.string().regex(/^data:image\/(webp|png|jpeg);base64,[A-Za-z0-9+/=]+$/).nullable() })
      .safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);

    if (parsed.data.dataUrl === null) {
      // The file is left on disk: another Client may point at the same image,
      // and a stray 40KB webp is cheaper than a wrong delete.
      const [row] = await db
        .update(nicheVocabulary)
        .set({ screenshotPath: null, screenshotAt: null })
        .where(eq(nicheVocabulary.niche, niche))
        .returning({ niche: nicheVocabulary.niche });
      if (!row) return res.status(404).json({ message: "Unknown client." });
      return res.json({ screenshot: null });
    }

    const [, mime, b64] = /^data:image\/(webp|png|jpeg);base64,(.+)$/.exec(parsed.data.dataUrl)!;
    let bytes = Buffer.from(b64, "base64");
    if (!bytes.length || bytes.length > MAX_SHOT_BYTES) {
      return res.status(413).json({ message: "That image is too large." });
    }

    // The serve route (GET /api/site-shot/:file) only ever hands out .webp, so
    // anything else is converted here rather than being stored as-is and 404ing
    // for the rest of its life.
    if (mime !== "webp") {
      const tmp = path.join(os.tmpdir(), `shot-${Date.now()}.${mime === "jpeg" ? "jpg" : mime}`);
      const out = `${tmp}.webp`;
      try {
        await fs.writeFile(tmp, bytes);
        await execFileAsync("cwebp", ["-quiet", "-q", "82", "-resize", "1280", "0", tmp, "-o", out]);
        bytes = await fs.readFile(out);
      } catch (err) {
        console.error("[demo-shot] cwebp failed", err);
        return res.status(500).json({ message: "Could not convert that image." });
      } finally {
        await fs.rm(tmp, { force: true });
        await fs.rm(out, { force: true });
      }
    }

    const file = `${createHash("sha256").update(bytes).digest("hex").slice(0, 16)}.webp`;
    await fs.mkdir(SHOT_DIR, { recursive: true });
    await fs.writeFile(path.join(SHOT_DIR, file), bytes);
    const [row] = await db
      .update(nicheVocabulary)
      .set({ screenshotPath: file, screenshotAt: new Date() })
      .where(eq(nicheVocabulary.niche, niche))
      .returning({ niche: nicheVocabulary.niche });
    if (!row) return res.status(404).json({ message: "Unknown client." });
    res.json({ screenshot: file });
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

  /**
   * The voice demo's own settings: which voice answers in each language, the
   * door password and how long a demo call may run.
   *
   * The engine reads this row directly (src/automations/voice/demo_settings.py)
   * and keeps its own defaults for anything missing, so an empty row is the
   * same as no row. Voice ids are not checked against the engine's list here:
   * that list lives in Python, and the engine ignores an id it does not know
   * rather than passing it to OpenAI mid-call.
   */
  const voiceSchema = z.object({
    defaultVoices: z.record(z.string().max(40), z.string().trim().max(40)).optional(),
    // Stored as typed. The engine casefolds and strips accents on both sides,
    // so "Olá" and "ola" are the same word at the door.
    passwords: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
    maxCallMinutes: z.number().int().min(1).max(30).optional(),
  });

  app.put("/api/demo-settings/voice", requireAuth, requireAgency, wrapAsync(async (req: Request, res: Response) => {
    const parsed = voiceSchema.safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const current = await readSettings("voice");
    const next = { ...current, ...parsed.data };
    // An empty pick means "use the engine's built-in default for that
    // language", so it is removed rather than stored as "".
    if (next.defaultVoices && typeof next.defaultVoices === "object") {
      next.defaultVoices = Object.fromEntries(
        Object.entries(next.defaultVoices as Record<string, string>).filter(([, v]) => v),
      );
    }
    await writeSettings("voice", next);
    res.json({ settings: next });
  }));

  /**
   * The /voice-demo door, for the page's own password box. Public, because the
   * page is: it answers yes or no rather than handing the browser the list.
   * The engine checks the password again on every call, so this is a door, not
   * the lock.
   */
  app.post("/api/voice-demo/door", wrapAsync(async (req: Request, res: Response) => {
    const parsed = z.object({ password: z.string().max(60) }).safeParse(req.body);
    if (!parsed.success) return handleZodError(res, parsed.error);
    const extra = (await readSettings("voice")).passwords;
    const list = Array.isArray(extra) ? (extra as string[]) : [];
    const normalize = (v: string) =>
      v.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    const typed = normalize(parsed.data.password);
    res.json({ ok: list.some((p) => normalize(p) === typed) });
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
