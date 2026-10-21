/**
 * Socials studio tags: the account's own tags (name + palette color) and the tags on an idea or a
 * script. Who: any user of the account reads; agency or a Manager makes a tag and tags ideas (Managers
 * add ideas too); renaming, recoloring, deleting and tagging scripts are agency's (scripts are agency's).
 */
import type { Express } from "express";
import { wrapAsync } from "../routes/_helpers";
import { canManageSocial, isAgency } from "./access";
import { forbidden, makeAccountGate, positiveIntParam } from "./gate";
import { toScriptView, toTopicView } from "./scripts";
import type { StudioDeps } from "./studioDeps";
import { isDuplicateName, parseNewTagBody, parseTagEditBody, parseTagIdsBody, toTagView } from "./tags";

export function registerTagRoutes(app: Express, deps: StudioDeps): void {
  const { store } = deps;
  const accountGate = makeAccountGate((id) => store.getAccount(id));
  const tagIdsOf = async (accountId: number) => new Set((await store.listSocialTags(accountId)).map((t) => t.id));
  const duplicate = (res: Parameters<typeof forbidden>[0]) => res.status(409).json({ message: "A tag with that name already exists", reason: "tag_exists" });

  app.get("/api/social/accounts/:id/tags", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    res.json((await store.listSocialTags(ctx.accountId)).map(toTagView));
  }));

  app.post("/api/social/accounts/:id/tags", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const parsed = parseNewTagBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    try {
      res.status(201).json(toTagView(await store.insertSocialTag({ accountsId: ctx.accountId, ...parsed.input })));
    } catch (err) {
      if (isDuplicateName(err)) return duplicate(res);
      throw err;
    }
  }));

  app.patch("/api/social/accounts/:id/tags/:tagId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const tagId = positiveIntParam(req, res, "tagId");
    if (tagId === null) return;
    const parsed = parseTagEditBody(req.body);
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    try {
      const updated = await store.updateSocialTag(ctx.accountId, tagId, parsed.input);
      if (!updated) return res.status(404).json({ message: "Tag not found" });
      res.json(toTagView(updated));
    } catch (err) {
      if (isDuplicateName(err)) return duplicate(res);
      throw err;
    }
  }));

  app.delete("/api/social/accounts/:id/tags/:tagId", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const tagId = positiveIntParam(req, res, "tagId");
    if (tagId === null) return;
    if (!(await store.deleteSocialTag(ctx.accountId, tagId))) return res.status(404).json({ message: "Tag not found" });
    res.status(204).end();
  }));

  // ─── An idea's tags: agency, or a Manager of the account ──────────────────
  app.put("/api/social/accounts/:id/topics/:topicId/tags", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!canManageSocial(req.user, ctx.accountId)) return forbidden(res);
    const topicId = positiveIntParam(req, res, "topicId");
    if (topicId === null) return;
    const parsed = parseTagIdsBody(req.body, await tagIdsOf(ctx.accountId));
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const updated = await store.setSocialTopicTags(ctx.accountId, topicId, parsed.input);
    if (!updated) return res.status(404).json({ message: "Topic not found" });
    res.json(toTopicView(updated));
  }));

  // ─── A script's tags: agency only ─────────────────────────────────────────
  app.put("/api/social/accounts/:id/scripts/:scriptId/tags", deps.requireAuth, wrapAsync(async (req, res) => {
    const ctx = await accountGate(req, res);
    if (!ctx) return;
    if (!isAgency(req.user)) return forbidden(res);
    const scriptId = positiveIntParam(req, res, "scriptId");
    if (scriptId === null) return;
    const parsed = parseTagIdsBody(req.body, await tagIdsOf(ctx.accountId));
    if (!parsed.ok) return res.status(400).json({ message: parsed.message });
    const updated = await store.setSocialScriptTags(ctx.accountId, scriptId, parsed.input);
    if (!updated) return res.status(404).json({ message: "Script not found" });
    const post = updated.postId ? await store.getSocialPost(ctx.accountId, updated.postId) : null;
    res.json(toScriptView(updated, post));
  }));
}
