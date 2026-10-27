/**
 * The Demos page's prospect bodies, as pure zod schemas (no Express, no
 * database) so the rules are tested on their own (demoProspectSchemas.test.ts).
 * Used by demoProspects.ts.
 */
import { z } from "zod";

/** A prospect group key: a uuid, or `token:<token>` for a legacy ungrouped link. */
export const PROSPECT_GROUP_RE = /^[A-Za-z0-9:_-]{4,80}$/;

const field = {
  firstName: z.string().trim().min(1).max(80),
  companyName: z.string().trim().max(120),
  clientNiche: z.string().trim().max(300),
  language: z.enum(["en", "nl", "pt"]),
  aiDisclosure: z.enum(["", "off", "opener", "second_message"]),
  market: z.enum(["", "uk", "us", "nl"]),
  notes: z.string().max(4000),
  websiteUrl: z.string().trim().max(500),
};

export const prospectCreateSchema = z.object({
  prospectGroup: z.string().regex(PROSPECT_GROUP_RE),
  firstName: field.firstName,
  companyName: field.companyName.default(""),
  clientNiche: field.clientNiche.default(""),
  language: field.language.default("en"),
  aiDisclosure: field.aiDisclosure.default(""),
  market: field.market.default(""),
  notes: field.notes.default(""),
  websiteUrl: field.websiteUrl.default(""),
});
export type ProspectCreateInput = z.infer<typeof prospectCreateSchema>;

/** Every field but the group key, all optional and with no defaults, so an
 *  omitted field is left as it is. */
export const prospectPatchSchema = z
  .object({
    ...field,
    // A prospect always has a Client: it can be changed, not cleared.
    clientNiche: field.clientNiche.min(1),
  })
  .partial()
  .refine((v) => Object.keys(v).length > 0, { message: "Nothing to change." });
export type ProspectPatchInput = z.infer<typeof prospectPatchSchema>;
