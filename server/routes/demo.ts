import type { Express, Request } from "express";
import { z } from "zod";
import { wrapAsync, handleZodError } from "./_helpers";
import { requireAuth } from "../auth";
import {
  DEMO_CAMPAIGNS,
  isValidDemoCampaignId,
  isDemoCampaign,
  checkRateLimit,
  generateToken,
  createPendingDemoLead,
  buildWhatsAppLink,
} from "../demo-session";

const createSessionSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  // Language picked on the form IS the lead's language. Lets one campaign
  // (e.g. English "Solar") serve prospects in NL/PT without duplicating the
  // campaign. The AI + First_Message render in this language at runtime.
  language: z.enum(["en", "nl", "pt"]),
  campaignId: z.number().int(),
});

function clientIp(req: Request): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.length > 0) return fwd.split(",")[0]!.trim();
  return req.ip ?? req.socket.remoteAddress ?? "unknown";
}

export function registerDemoRoutes(app: Express): void {
  app.get("/api/demo/campaigns", (_req, res) => {
    res.json({ campaigns: DEMO_CAMPAIGNS });
  });

  app.post(
    "/api/demo/create-session",
    wrapAsync(async (req, res) => {
      const parsed = createSessionSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const { firstName, language, campaignId } = parsed.data;

      if (!isValidDemoCampaignId(campaignId)) {
        return res.status(400).json({ message: "Invalid campaign." });
      }

      const ip = clientIp(req);
      const gate = checkRateLimit(ip);
      if (!gate.ok) {
        const msg =
          gate.reason === "global"
            ? "Demo is at capacity right now. Try again in an hour."
            : "Too many demo sessions from this IP. Try again later.";
        return res.status(429).json({ message: msg });
      }

      const { token } = generateToken();

      await createPendingDemoLead({
        token,
        firstName,
        language,
        campaignId,
      });

      const whatsappUrl = buildWhatsAppLink({ token });

      // Intentionally do NOT return the token or leadId separately —
      // the client only needs the wa.me link.
      res.json({ whatsappUrl });
    }),
  );

  // ── Admin: generate a WhatsApp demo link for ANY is_demo campaign ──
  // Used by the "Copy WhatsApp Demo Link" button on the campaigns page.
  // Bypasses the public rate limiter (auth-gated) and accepts campaigns
  // that aren't in the public /try list (e.g. custom per-prospect demos).
  const adminSchema = z.object({
    firstName: z.string().trim().min(1).max(80),
    // Email kept optional on the admin endpoint so it stays backward-compatible
    // with any existing CRM button that still sends it. Ignored server-side.
    email: z.string().trim().email().max(200).optional(),
    language: z.enum(["en", "nl", "pt"]),
    campaignId: z.number().int(),
  });

  app.post(
    "/api/demo/create-link",
    requireAuth,
    wrapAsync(async (req, res) => {
      const parsed = adminSchema.safeParse(req.body);
      if (!parsed.success) return handleZodError(res, parsed.error);

      const { firstName, language, campaignId } = parsed.data;

      if (!(await isDemoCampaign(campaignId))) {
        return res.status(400).json({
          message: "That campaign is not marked as a demo. Flag is_demo=true first.",
        });
      }

      const { token } = generateToken();
      await createPendingDemoLead({ token, firstName, language, campaignId });
      const whatsappUrl = buildWhatsAppLink({ token });
      res.json({ whatsappUrl });
    }),
  );
}
