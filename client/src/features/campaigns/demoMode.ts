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
