// Request schemas of the ElevenLabs prompt draft and change card routes. Kept free of
// storage imports so they test without a database (voicePromptDrafts.ts re-exports them).
import { z } from "zod";

export const langQuery = z.enum(["nl", "en"]);
export const draftBodySchema = z.object({ lang: z.enum(["nl", "en"]), text: z.string().max(60_000) });
