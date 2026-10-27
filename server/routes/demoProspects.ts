// The Demos page's prospect rows: list them, add one from the create panel.
// Settings edits, notes and delete come in the routes that follow.
import type { Express } from "express";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { createProspect, listProspects } from "../demoProspects/store";
import { normalizeSettings } from "../demoProspects/rows";
import { prospectCreateSchema } from "./demoProspectSchemas";

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
}
