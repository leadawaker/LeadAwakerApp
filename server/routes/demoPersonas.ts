// Persona (Niche_Vocabulary) helpers for the Personas page that do not belong
// in demo.ts. Translate returns the other language's copy for the editor to
// fill in and review; nothing is written here, the editor's autosave persists it.
import type { Express } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { getDemoClient, demoClientToEditable, LIVE_CLIENT_MESSAGE } from "../demo-clients";
import { GenerationError, runJson } from "../demoGenerator/providers";
import {
  buildTranslatePrompt,
  coerceTranslation,
  isSourceEmpty,
  translateSource,
  validateTranslation,
} from "../demoTranslate";

const translateSchema = z.object({
  from: z.enum(["en", "nl"]),
  to: z.enum(["en", "nl", "pt"]),
  provider: z.enum(["claude", "openai"]).optional().default("openai"),
  claudeModel: z.enum(["opus", "sonnet"]).optional().default("sonnet"),
});

export function registerDemoPersonaRoutes(app: Express) {
  app.post(
    "/api/demo/clients/:niche/translate",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = translateSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const { from, to, provider, claudeModel } = parsed.data;
      if (from === to) return res.status(400).json({ message: "Pick two different languages." });

      const row = await getDemoClient(String(req.params.niche));
      if (!row) return res.status(404).json({ message: "No such Client." });
      if (row.isLive) return res.status(409).json({ message: LIVE_CLIENT_MESSAGE });

      const src = translateSource(demoClientToEditable(row), from);
      if (isSourceEmpty(src)) {
        return res.status(422).json({ message: "Nothing to translate: the source language is empty." });
      }

      const { system, user } = buildTranslatePrompt(src, from, to);
      try {
        const { data } = await runJson({
          system,
          user,
          provider,
          claudeModel,
          validate: validateTranslation(src),
          openai: { model: "gpt-5.6-terra", maxTokens: 6000, timeoutMs: 90_000 },
          stage: "translate",
        });
        res.json({ translation: coerceTranslation(data, src) });
      } catch (err) {
        if (!(err instanceof GenerationError)) throw err;
        res.status(502).json({ message: "Could not translate right now. Try again." });
      }
    }),
  );
}
