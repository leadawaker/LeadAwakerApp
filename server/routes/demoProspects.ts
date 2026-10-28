// The Demos page's prospect rows: list them, add one from the create panel, edit
// one (a settings edit is rewritten into every link it owns), delete one, and
// delete or re-mint a single link. There is no standalone revoke route: a link
// is revoked only as part of re-minting it (or removed by a delete).
import type { Express } from "express";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { createProspect, listProspects } from "../demoProspects/store";
import { normalizeSettings } from "../demoProspects/rows";
import { applyProspectSettings } from "../demoProspects/applySettings";
import { deleteLink, deleteProspect, remintToken } from "../demoProspects/linkOps";
import { PUBLIC_DEMO_MESSAGES } from "../demoProspects/linkGuards";
import { DEMO_TOKEN_RE, PROSPECT_GROUP_RE, prospectCreateSchema, prospectPatchSchema } from "./demoProspectSchemas";

export function registerDemoProspectRoutes(app: Express) {
  app.get(
    "/api/demo/prospects",
    requireAgency,
    wrapAsync(async (_req, res) => {
      res.json({ prospects: await listProspects() });
    }),
  );

  // The create panel's save. The panel never mints: this only records who the
  // demo is for, so the links minted afterwards join its group.
  app.post(
    "/api/demo/prospects",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = prospectCreateSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const { prospectGroup, notes, websiteUrl, ...settings } = parsed.data;

      const result = await createProspect({
        ...normalizeSettings(settings),
        prospectGroup,
        notes,
        websiteUrl,
      });
      if (!result.ok) {
        return res.status(409).json({ code: "exists", message: "This prospect already exists." });
      }
      res.status(201).json({ prospect: result.prospect });
    }),
  );

  // Edit a prospect. Settings changes are rewritten into both lead rows of
  // every token in the group, so links already sent pick them up. The body is
  // partial: an omitted field is left as it is.
  app.patch(
    "/api/demo/prospects/:group",
    requireAgency,
    wrapAsync(async (req, res) => {
      const group = String(req.params.group || "");
      if (!PROSPECT_GROUP_RE.test(group)) return res.status(400).json({ message: "Bad prospect key." });

      const parsed = prospectPatchSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const outcome = await applyProspectSettings(group, parsed.data);
      if (!outcome.ok) {
        return res.status(outcome.status).json({ ...(outcome.code ? { code: outcome.code } : {}), message: outcome.message });
      }
      res.json(outcome.result);
    }),
  );

  // Delete a prospect: every link it owns (both lead rows and their messages,
  // the same hard delete as the nightly purge), then its own row.
  app.delete(
    "/api/demo/prospects/:group",
    requireAgency,
    wrapAsync(async (req, res) => {
      const group = String(req.params.group || "");
      if (!PROSPECT_GROUP_RE.test(group)) return res.status(400).json({ message: "Bad prospect key." });
      res.json(await deleteProspect(group));
    }),
  );

  // Delete one link. Allowed for a public website demo too.
  app.delete(
    "/api/demo/links/:token",
    requireAgency,
    wrapAsync(async (req, res) => {
      const token = String(req.params.token || "");
      if (!DEMO_TOKEN_RE.test(token)) return res.status(400).json({ message: "Bad link token." });
      const result = await deleteLink(token);
      if (!result) return res.status(404).json({ message: "No link with that token." });
      res.json(result);
    }),
  );

  // Replace a link: a fresh token with the same persona, the old one revoked
  // (its conversation stays). A public website demo is the visitor's own, so it
  // refuses with 409 `public_demo`; a link that was already replaced refuses
  // with 409 `revoked`.
  app.post(
    "/api/demo/links/:token/remint",
    requireAgency,
    wrapAsync(async (req, res) => {
      const token = String(req.params.token || "");
      if (!DEMO_TOKEN_RE.test(token)) return res.status(400).json({ message: "Bad link token." });
      const outcome = await remintToken(token);
      if (!outcome.ok) {
        if (outcome.reason === "public_demo") {
          return res.status(409).json({ code: "public_demo", message: PUBLIC_DEMO_MESSAGES.remint });
        }
        if (outcome.reason === "revoked") {
          return res.status(409).json({ code: "revoked", message: "This link was already replaced. Use its newer link." });
        }
        return res.status(404).json({ message: "No link with that token." });
      }
      res.json(outcome.result);
    }),
  );
}
