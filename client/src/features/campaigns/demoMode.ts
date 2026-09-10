// The conversation type a demo runs as, and the two places it has to be spelled
// differently.
//
// One vocabulary is used everywhere it can be: "scoping"/"decision" are the
// engine's own conversation_mode tokens, the Opener_Templates.type values, and
// the words the WhatsApp /scenario alias table already accepts, so the Launch
// button can put them straight into its payload.
//
// The demo link API is the exception. /api/demo/create-link takes a lead
// SCENARIO (what the lead did), not a mode, and its enum predates this control:
// "inquired" | "deciding" | "declined". Those collapse onto two modes, so the
// mapping is one-way and lossy in the harmless direction.

export const DEMO_MODES = ["scoping", "decision"] as const;
export type DemoMode = (typeof DEMO_MODES)[number];

/** Lead scenario to send to /api/demo/create-link for a given conversation type. */
export const DEMO_MODE_SCENARIO: Record<DemoMode, "inquired" | "deciding"> = {
  scoping: "inquired",
  decision: "deciding",
};

// The market an English demo is pointed at. Only English needs it: Dutch and
// Portuguese each have one market and the server resolves those itself. This
// mirrors DemoMarket in server/demo-session.ts, the same way DEMO_MODES above
// mirrors the server's scenario enum. Keep the two lists in step.
export const DEMO_MARKETS = ["uk", "us", "nl"] as const;
export type DemoMarket = (typeof DEMO_MARKETS)[number];

// The service demos: one campaign per AI service (database reactivation, speed
// to lead, and voice/reputation to come). These behave identically in the CRM:
// two settings tabs instead of three, and a niche generator, because their
// "business" identity comes from the prospect persona on each demo lead rather
// than from the campaign row.
//
// Mirrors SERVICE_DEMO_CAMPAIGN_IDS in server/demo-session.ts, which in turn
// mirrors PERSONA_DEMO_CAMPAIGN_IDS in the engine. Keep the three in step.
export const SERVICE_DEMO_CAMPAIGN_IDS = [60, 67, 68] as const;

/** Does this campaign demo a service, with the prospect supplied per link? */
export function isServiceDemoCampaign(id: number | undefined | null): boolean {
  return typeof id === "number" && (SERVICE_DEMO_CAMPAIGN_IDS as readonly number[]).includes(id);
}
