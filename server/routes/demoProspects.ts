// The Demos page's prospect rows: list them, add one from the create panel, and
// edit one (a settings edit is rewritten into every link it owns).
// Notes-only and delete come in the routes that follow.
import type { Express } from "express";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { createProspect, listProspects } from "../demoProspects/store";
import { normalizeSettings } from "../demoProspects/rows";
import { applyProspectSettings } from "../demoProspects/applySettings";
import { PROSPECT_GROUP_RE, prospectCreateSchema, prospectPatchSchema } from "./demoProspectSchemas";

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
      if (!outcome.ok) return res.status(outcome.status).json({ message: outcome.message });
      res.json(outcome.result);
    }),
  );
}
