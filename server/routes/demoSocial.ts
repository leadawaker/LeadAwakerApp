import express, { type Express, type Request, type Response } from "express";
import path from "path";
import { eq } from "drizzle-orm";
import { db, pool } from "../db";
import { nicheVocabulary } from "@shared/schema";
import { wrapAsync } from "./_helpers";
import { pickPostImage, renderSocialDemoHtml } from "../socialDemoPage";

const LEADS_TABLE = '"p2mxx34fvbf3ll6"."Leads"';
const INTERACTIONS_TABLE = '"p2mxx34fvbf3ll6"."Interactions"';
const LANGS = new Set(["en", "nl", "pt"]);

async function loadPersona(token: string) {
  const { rows } = await pool.query(
    `SELECT demo_niche, language FROM ${LEADS_TABLE}
      WHERE channel_identifier IN ($1, $2) AND demo_niche IS NOT NULL
      ORDER BY created_at DESC NULLS LAST LIMIT 1`,
    [`web-demo:${token}`, `wa-demo:${token}`],
  );
  let persona: Record<string, any> = {};
  try { persona = JSON.parse(String(rows[0]?.demo_niche || "{}")) || {}; } catch { /* none */ }
  const lang = String(rows[0]?.language || "en");
  return { persona, language: (LANGS.has(lang) ? lang : "en") as "en" | "nl" | "pt", found: rows.length > 0 };
}

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
  app.use("/social-demo-assets", express.static(path.resolve("client/public/social-demo"), {
    setHeaders: (res) => res.set("cache-control", "no-cache"),
  }));

  app.get("/social-demo/:token", wrapAsync(async (req: Request, res: Response) => {
    const token = String(req.params.token || "");
    if (!/^[A-Za-z0-9]{4,64}$/.test(token)) return res.status(400).send("Invalid demo link.");
    const { persona, language, found } = await loadPersona(token);
    if (!found) return res.status(404).send("This demo link does not exist.");

    // demoClientToContext writes both `raw` and `client_niche` to the same
    // Client key; the create-link handler only ever sets `client_niche`.
    // Read whichever one the persona actually carries.
    const clientKey = String(persona.client_niche || persona.raw || "");

    let socialImage: string | null = null;
    let screenshot: string | null = String(persona.screenshot || "") || null;
    if (clientKey) {
      const [client] = await db
        .select({ socialImagePath: nicheVocabulary.socialImagePath, screenshotPath: nicheVocabulary.screenshotPath })
        .from(nicheVocabulary)
        .where(eq(nicheVocabulary.niche, clientKey))
        .limit(1);
      socialImage = client?.socialImagePath ?? null;
      screenshot = screenshot || client?.screenshotPath || null;
    }

    res.set("content-type", "text/html; charset=utf-8");
    res.set("cache-control", "no-store");
    res.set("x-robots-tag", "noindex, nofollow");
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
}
