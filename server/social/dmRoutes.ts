/**
 * Comment-to-DM settings in the Socials page, agency only: the rules (keyword, first message, which
 * post, AI follow-up), the switch state and the DM log (what was sent, or would have been in dry run).
 * The mode and the hourly cap are saved through PUT /settings (studioRoutes.ts).
 * Spec: docs/superpowers/specs/2026-10-20-comment-to-dm-design.md
 */
import type { Express, RequestHandler } from "express";
import type { InsertSocialDmRule, SocialDmLogRow, SocialDmRule, SocialPost, SocialSettings } from "@shared/schema";
import { isDmMode, type DmMode } from "@shared/socialStudio";
import { wrapAsync } from "../routes/_helpers";
import { isAgency } from "./access";
import { DM_TEXT_MAX, KEYWORD_MAX, keywordNorm, words } from "./dmMatch";
import { dmLiveSwitchOn, effectiveDmMode } from "./dmSafety";
import { actorIdOf, forbidden, makeAccountGate, positiveIntParam, refused, type GetAccount } from "./gate";
import { DEFAULT_DM_HOURLY_CAP } from "./studioSettings";

export interface DmRouteDeps {
  requireAuth: RequestHandler;
  now(): Date;
  env(): NodeJS.ProcessEnv;
  /** INSTAGRAM_WEBHOOK_VERIFY_TOKEN and INSTAGRAM_APP_SECRET are both set. */
  webhookReady(): boolean;
  store: {
    getAccount: GetAccount;
    getSocialSettings(accountId: number): Promise<SocialSettings | null>;
    listDmRules(accountId: number): Promise<SocialDmRule[]>;
    insertDmRule(row: InsertSocialDmRule): Promise<SocialDmRule>;
    updateDmRule(accountId: number, ruleId: number, fields: Partial<InsertSocialDmRule>): Promise<SocialDmRule | null>;
    deleteDmRule(accountId: number, ruleId: number): Promise<boolean>;
    listDmLog(accountId: number, limit: number): Promise<SocialDmLogRow[]>;
    countDmSentSince(accountId: number, since: Date): Promise<number>;
    listSocialPosts(accountId: number): Promise<SocialPost[]>;
    getSocialPost(accountId: number, postId: number): Promise<SocialPost | null>;
  };
}

export interface DmRuleView { id: number; keyword: string; firstMessage: string; postId: number | null; aiFollowUp: boolean; active: boolean; updatedAt: string }

const ruleView = (r: SocialDmRule): DmRuleView => ({
  id: r.id, keyword: r.keyword, firstMessage: r.firstMessage, postId: r.postId, aiFollowUp: r.aiFollowUp, active: r.active, updatedAt: r.updatedAt.toISOString(),
});

const logView = (l: SocialDmLogRow) => ({
  id: l.id, kind: l.kind, mode: l.mode, status: l.status, reason: l.reason, text: l.text, username: l.username, ruleId: l.ruleId, leadId: l.leadId, createdAt: l.createdAt.toISOString(),
});

type RuleInput = { keyword?: string; firstMessage?: string; postId?: number | null; aiFollowUp?: boolean; active?: boolean };

export function parseRuleBody(body: unknown, partial: boolean): { ok: true; input: RuleInput } | { ok: false; message: string } {
  if (typeof body !== "object" || body === null || Array.isArray(body)) return { ok: false, message: "Body must be an object" };
  const b = body as Record<string, unknown>;
  const input: RuleInput = {};
  if (b.keyword !== undefined || !partial) {
    // One word: "E-BOOK" or "free guide" would be stored as one run but a comment splits it in two and it never matches.
    if (typeof b.keyword !== "string" || b.keyword.trim().length > KEYWORD_MAX || words(b.keyword).length !== 1) {
      return { ok: false, message: `keyword must be one word of letters or digits (at most ${KEYWORD_MAX})` };
    }
    input.keyword = b.keyword.trim();
  }
  if (b.firstMessage !== undefined || !partial) {
    if (typeof b.firstMessage !== "string" || !b.firstMessage.trim() || b.firstMessage.length > DM_TEXT_MAX) return { ok: false, message: `firstMessage must be 1 to ${DM_TEXT_MAX} characters` };
    input.firstMessage = b.firstMessage.replace(/\r\n/g, "\n").trim();
  }
  if (b.postId !== undefined) {
    if (b.postId !== null && (!Number.isInteger(b.postId) || (b.postId as number) <= 0)) return { ok: false, message: "postId must be a post id or null" };
    input.postId = b.postId as number | null;
  }
  for (const k of ["aiFollowUp", "active"] as const) {
    if (b[k] === undefined) continue;
    if (typeof b[k] !== "boolean") return { ok: false, message: `${k} must be a boolean` };
    input[k] = b[k] as boolean;
  }
  if (partial && Object.keys(input).length === 0) return { ok: false, message: "Nothing to change" };
  return { ok: true, input };
}

export function registerDmRoutes(app: Express, deps: DmRouteDeps): void {
  const { store } = deps;
  const accountGate = makeAccountGate((id) => store.getAccount(id));
  const agencyGate = async (req: Parameters<RequestHandler>[0], res: Parameters<RequestHandler>[1]) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return null;
    if (!isAgency(req.user)) { forbidden(res); return null; }
    return ctx;
  };

  /** A rule's post must be this account's and already live on Instagram (its media id is what comments carry). */
  async function mediaFor(accountId: number, postId: number | null | undefined): Promise<{ igMediaId: string | null } | "not_published"> {
    if (postId == null) return { igMediaId: null };
    const post = await store.getSocialPost(accountId, postId);
    if (!post || post.status !== "published" || !post.igMediaId) return "not_published";
    return { igMediaId: post.igMediaId };
  }

  app.get("/api/social/accounts/:id/dm", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await agencyGate(req, res);
    if (!ctx) return;
    const [settings, rules, posts, sent] = await Promise.all([
      store.getSocialSettings(ctx.accountId),
      store.listDmRules(ctx.accountId),
      store.listSocialPosts(ctx.accountId),
      store.countDmSentSince(ctx.accountId, new Date(deps.now().getTime() - 3_600_000)),
    ]);
    const mode: DmMode = isDmMode(settings?.dmMode) ? (settings!.dmMode as DmMode) : "off";
    res.json({
      mode,
      effectiveMode: effectiveDmMode(mode, deps.env()),
      liveSwitch: dmLiveSwitchOn(deps.env()),
      webhookReady: deps.webhookReady(),
      hourlyCap: settings?.dmHourlyCap ?? DEFAULT_DM_HOURLY_CAP,
      sentLastHour: sent,
      rules: rules.map(ruleView),
      posts: posts.filter((p) => p.status === "published" && p.igMediaId).map((p) => ({
        id: p.id, caption: p.caption.split("\n").find((l) => l.trim())?.slice(0, 120) ?? "", publishedAt: (p.publishedAt ?? p.scheduledAt).toISOString(), permalink: p.permalink,
      })),
    });
  }));

  app.post("/api/social/accounts/:id/dm/rules", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await agencyGate(req, res);
    if (!ctx) return;
    const userId = actorIdOf(req, res);
    if (userId === null) return;
    const parsed = parseRuleBody(req.body, false);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const media = await mediaFor(ctx.accountId, parsed.input.postId);
    if (media === "not_published") return refused(res, 422, "post_not_published");
    const created = await store.insertDmRule({
      accountsId: ctx.accountId,
      keyword: parsed.input.keyword!,
      keywordNorm: keywordNorm(parsed.input.keyword!),
      firstMessage: parsed.input.firstMessage!,
      postId: parsed.input.postId ?? null,
      igMediaId: media.igMediaId,
      aiFollowUp: parsed.input.aiFollowUp ?? false,
      active: parsed.input.active ?? true,
      createdByUserId: userId,
    });
    res.status(201).json(ruleView(created));
  }));

  app.patch("/api/social/accounts/:id/dm/rules/:ruleId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await agencyGate(req, res);
    if (!ctx) return;
    const ruleId = positiveIntParam(req, res, "ruleId");
    if (ruleId === null) return;
    const parsed = parseRuleBody(req.body, true);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const current = (await store.listDmRules(ctx.accountId)).find((r) => r.id === ruleId);
    if (!current) return res.status(404).json({ message: "Rule not found" });
    const fields: Partial<InsertSocialDmRule> = { ...parsed.input };
    if (parsed.input.keyword !== undefined) fields.keywordNorm = keywordNorm(parsed.input.keyword);
    // The post is only checked again when it changes: a rule whose post went away can still get a new message.
    if (parsed.input.postId === current.postId) delete fields.postId;
    else if (parsed.input.postId !== undefined) {
      const media = await mediaFor(ctx.accountId, parsed.input.postId);
      if (media === "not_published") return refused(res, 422, "post_not_published");
      fields.igMediaId = media.igMediaId;
    }
    const updated = await store.updateDmRule(ctx.accountId, ruleId, fields);
    if (!updated) return res.status(404).json({ message: "Rule not found" });
    res.json(ruleView(updated));
  }));

  app.delete("/api/social/accounts/:id/dm/rules/:ruleId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await agencyGate(req, res);
    if (!ctx) return;
    const ruleId = positiveIntParam(req, res, "ruleId");
    if (ruleId === null) return;
    if (!(await store.deleteDmRule(ctx.accountId, ruleId))) return res.status(404).json({ message: "Rule not found" });
    res.json({ ok: true });
  }));

  app.get("/api/social/accounts/:id/dm/log", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await agencyGate(req, res);
    if (!ctx) return;
    const limit = Math.min(200, Math.max(1, Number(req.query.limit) || 50));
    res.json((await store.listDmLog(ctx.accountId, limit)).map(logView));
  }));
}
