import express, { type Express, type Request, type Response } from "express";
import path from "path";
import { z } from "zod";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { nicheVocabulary } from "@shared/schema";
import { wrapAsync } from "./_helpers";
import { requireAuth, requireAgency } from "../auth";
import { isTokenExpired, pickPostImage, renderSocialDemoHtml } from "../socialDemoPage";
import { getDemoClient, demoClientToEditable, demoClientToContext, clientLanguages } from "../demo-clients";
import { clientSupportsLanguage } from "./demo";
import { getClientSocialPost, saveClientSocialPost, startClientSocialImage, socialPostInput } from "../demoSocial/clientStore";
import { generateSocialPost } from "../demoSocial/generatePost";
import { validateSocialPost, coerceSocialPost } from "../demoSocial/validate";

const LEADS_TABLE = '"p2mxx34fvbf3ll6"."Leads"';
const INTERACTIONS_TABLE = '"p2mxx34fvbf3ll6"."Interactions"';
const LANGS = new Set(["en", "nl", "pt"]);

async function loadPersona(token: string) {
  // Newest first: the browser lead is cloned from the wa-demo one after it,
  // so the newest row is the one the engine would still match, or neither is.
  const { rows } = await pool.query(
    `SELECT demo_niche, language, created_at FROM ${LEADS_TABLE}
      WHERE channel_identifier IN ($1, $2) AND demo_niche IS NOT NULL
      ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [`web-demo:${token}`, `wa-demo:${token}`],
  );
  let persona: Record<string, any> = {};
  try { persona = JSON.parse(String(rows[0]?.demo_niche || "{}")) || {}; } catch { /* none */ }
  const lang = String(rows[0]?.language || "en");
  return {
    persona,
    language: (LANGS.has(lang) ? lang : "en") as "en" | "nl" | "pt",
    found: rows.length > 0,
    expired: rows.length > 0 && isTokenExpired(rows[0].created_at),
  };
}

/** Test files sit next to the modules; they are not part of the page. */
const TEST_FILE = /\.test\.[cm]?[jt]s$/;

/** The thread has started once the prospect has sent a DM. The opener alone
 *  does not count: after a restart the engine re-sends it, and the page must
 *  show the feed again. */
async function threadStarted(token: string): Promise<boolean> {
  const { rows } = await pool.query(
    `SELECT 1 FROM ${INTERACTIONS_TABLE} i
       JOIN ${LEADS_TABLE} l ON l.id = i."Leads_id"
      WHERE l.channel_identifier = $1 AND i.direction = 'inbound' LIMIT 1`,
    [`web-demo:${token}`],
  );
  return rows.length > 0;
}

export function registerDemoSocialRoutes(app: Express) {
  app.use("/social-demo-assets", (req, res, next) => {
    if (TEST_FILE.test(req.path)) return res.status(404).end();
    next();
  });
  app.use("/social-demo-assets", express.static(path.resolve("client/public/social-demo"), {
    setHeaders: (res) => res.set("cache-control", "no-cache"),
  }));

  app.get("/social-demo/:token", wrapAsync(async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    res.set("x-robots-tag", "noindex, nofollow");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).send("Invalid demo link.");
    const { persona, language, found, expired } = await loadPersona(token);
    if (!found) return res.status(404).send("This demo link does not exist.");

    res.set("content-type", "text/html; charset=utf-8");
    res.set("cache-control", "no-store");
    if (expired) {
      // Nothing of the persona goes out: the page only needs the language.
      return res.status(410).send(renderSocialDemoHtml({
        token, language, started: false, expired: true, company: "", agentName: "", post: null, imageUrl: "",
      }));
    }

    // demoClientToContext writes both `raw` and `client_niche` to the same
    // Client key; the create-link handler only ever sets `client_niche`.
    // Read whichever one the persona actually carries.
    const clientKey = String(persona.client_niche || persona.raw || "");

    // The image snapshotted at mint wins, so a later image regeneration on the
    // Client cannot change a link already sent. The live Client image is only
    // the fallback for a link minted while the first image was still being made.
    let socialImage: string | null = String(persona.social_image_path || "") || null;
    let screenshot: string | null = String(persona.screenshot || "") || null;
    if (clientKey && (!socialImage || !screenshot)) {
      const [client] = await db
        .select({ socialImagePath: nicheVocabulary.socialImagePath, screenshotPath: nicheVocabulary.screenshotPath })
        .from(nicheVocabulary)
        .where(eq(nicheVocabulary.niche, clientKey))
        .limit(1);
      socialImage = socialImage || client?.socialImagePath || null;
      screenshot = screenshot || client?.screenshotPath || null;
    }

    res.send(renderSocialDemoHtml({
      token,
      language,
      started: await threadStarted(token),
      company: String(persona.company_name || ""),
      agentName: String(persona.agent_name || ""),
      post: persona.social_post ?? null,
      imageUrl: pickPostImage({ socialImage, screenshot }),
    }));
  }));

  const langSchema = z.enum(["en", "nl", "pt"]);
  const editSchema = z.object({
    language: langSchema,
    post: z.object({
      caption: z.string().max(400),
      keyword: z.string().max(20),
      cta_line: z.string().max(300),
      dm_opener: z.string().max(400),
    }),
  });

  app.put("/api/demo/clients/:niche/social-post", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const parsed = editSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const row = await getDemoClient(String(req.params.niche));
    if (!row) return res.status(404).json({ message: "Client not found" });
    const current = getClientSocialPost(row, parsed.data.language);
    if (!current) return res.status(404).json({ message: "No post in this language yet" });
    const merged = { ...current, ...parsed.data.post };
    const problem = validateSocialPost(merged);
    if (problem) return res.status(400).json({ message: problem });
    await saveClientSocialPost(row.niche, parsed.data.language, coerceSocialPost(merged));
    res.json({ client: demoClientToEditable((await getDemoClient(row.niche))!) });
  }));

  app.post("/api/demo/clients/:niche/social-post/regenerate", requireAuth, requireAgency, wrapAsync(async (req, res) => {
    const parsed = z.object({ language: langSchema, part: z.enum(["text", "image"]) }).safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid body" });
    const row = await getDemoClient(String(req.params.niche));
    if (!row) return res.status(404).json({ message: "Client not found" });
    const { language, part } = parsed.data;
    if (part === "image") {
      const post = getClientSocialPost(row, language);
      if (!post) return res.status(404).json({ message: "No post in this language yet" });
      startClientSocialImage(row.niche, post.image_prompt);
      return res.status(202).json({ client: demoClientToEditable(row) });
    }
    if (!clientSupportsLanguage(row, language)) {
      const have = clientLanguages(row).map((l) => l.toUpperCase()).join(", ");
      return res.status(409).json({
        message: `"${row.niche}" has no ${language.toUpperCase()} version. It only exists in ${have}.`,
      });
    }
    const ctx = demoClientToContext(row, language, "inquired", undefined);
    if (!ctx) {
      return res.status(409).json({
        message: `"${row.niche}" has no saved persona yet. Generate one for this niche instead.`,
      });
    }
    const fresh = await generateSocialPost(socialPostInput(row, language, ctx));
    await saveClientSocialPost(row.niche, language, fresh);
    // Same rule as ensureClientSocialPost: an image starts only when the
    // Client has none yet, so rewriting the text on a Client that already
    // has an image never triggers a second, unwanted paid regeneration.
    if (!row.socialImagePath) startClientSocialImage(row.niche, fresh.image_prompt);
    res.json({ client: demoClientToEditable((await getDemoClient(row.niche))!) });
  }));
}
