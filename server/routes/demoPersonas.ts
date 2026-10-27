// Demo persona (Client) routes beyond the Clients tab's own CRUD in demo.ts.
//
// - from-niche: "Describe a niche instead", generates a persona from a typed
//   description and saves it as a Client.
// - translate: Persona (Niche_Vocabulary) helper for the Personas page. It
//   returns the other language's copy for the editor to fill in and review;
//   nothing is written here, the editor's autosave persists it.
import type { Express } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { generateNicheContextStrict } from "../demo-session";
import { GenerationError, runJson } from "../demoGenerator/providers";
import {
  saveDemoClient,
  isLiveClient,
  getDemoClient,
  demoClientToEditable,
  LIVE_CLIENT_MESSAGE,
} from "../demo-clients";
import {
  buildTranslatePrompt,
  coerceTranslation,
  isSourceEmpty,
  translateSource,
  validateTranslation,
} from "../demoTranslate";

const fromNicheSchema = z.object({
  // The library key, and the trade the generator is asked to theme.
  niche: z.string().trim().min(3).max(300),
  language: z.enum(["en", "nl", "pt"]),
  market: z.enum(["uk", "us", "nl"]).optional(),
  provider: z.enum(["claude", "openai"]).optional().default("claude"),
  claudeModel: z.enum(["opus", "sonnet"]).optional().default("sonnet"),
});

const translateSchema = z.object({
  from: z.enum(["en", "nl"]),
  to: z.enum(["en", "nl", "pt"]),
  provider: z.enum(["claude", "openai"]).optional().default("openai"),
  claudeModel: z.enum(["opus", "sonnet"]).optional().default("sonnet"),
});

export function registerDemoPersonaRoutes(app: Express) {
  // "Describe a niche instead": no website, just a typed description. Generates
  // the persona and saves it as a Client; the panel selects it afterwards and
  // never mints. Same failure shape as the website build: nothing is saved when
  // the generation fails, and the caller may retry.
  app.post(
    "/api/demo/clients/from-niche",
    requireAgency,
    wrapAsync(async (req, res) => {
      const parsed = fromNicheSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);
      const { niche, language, market, provider, claudeModel } = parsed.data;

      // A live voice client's persona is managed in Account > Voice; a typed
      // niche that happens to match it must not regenerate its slots.
      if (await isLiveClient(niche)) return res.status(409).json({ message: LIVE_CLIENT_MESSAGE });

      let generated;
      try {
        generated = await generateNicheContextStrict(niche, language, "inquired", market, { provider, claudeModel });
      } catch (err) {
        return res.status(502).json({
          message: (err as Error).message,
          stage: err instanceof GenerationError ? err.stage : "generate",
          retryable: true,
        });
      }

      const saved = await saveDemoClient(niche, language, generated.ctx);
      res.json({ client: niche, saved: saved.saved, provider_used: generated.providerUsed });
    }),
  );

  // Translate one persona's copy between languages for the editor to review.
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
