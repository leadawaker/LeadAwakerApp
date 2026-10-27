// Demo persona (Client) routes beyond the Clients tab's own CRUD in demo.ts.
import type { Express } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAgency } from "../auth";
import { generateNicheContextStrict } from "../demo-session";
import { GenerationError } from "../demoGenerator/providers";
import { saveDemoClient, isLiveClient, LIVE_CLIENT_MESSAGE } from "../demo-clients";

const fromNicheSchema = z.object({
  // The library key, and the trade the generator is asked to theme.
  niche: z.string().trim().min(3).max(300),
  language: z.enum(["en", "nl", "pt"]),
  market: z.enum(["uk", "us", "nl"]).optional(),
  provider: z.enum(["claude", "openai"]).optional().default("claude"),
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
}
