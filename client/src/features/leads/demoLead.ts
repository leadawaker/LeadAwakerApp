/**
 * Demo-lead predicates, shared by the card views and the detail panel.
 *
 * One minted demo token produces two independent leads: `wa-demo:<token>` for
 * WhatsApp and `web-demo:<token>` for the browser page, created when that
 * surface is first opened. They deliberately carry the same name and persona,
 * so the CRM tells them apart by channel, never by name.
 * See specs/demo-surface-split.
 */

type LeadLike = Record<string, any>;

function channelId(lead: LeadLike): string {
  return String(lead?.channel_identifier || lead?.channelIdentifier || "");
}

function sourceOf(lead: LeadLike): string {
  return String(lead?.source || lead?.Source || "");
}

/** A demo session on either surface. */
export function isDemoLead(lead: LeadLike): boolean {
  const ci = channelId(lead);
  const src = sourceOf(lead);
  return (
    ci.startsWith("wa-demo:") ||
    ci.startsWith("web-demo:") ||
    src === "WhatsApp Demo" ||
    src === "Web Demo"
  );
}

/**
 * A demo run in the browser rather than WhatsApp. These never have a phone
 * number — the visitor is never asked for one — which is why the contact panel
 * labels the empty phone field instead of leaving it blank.
 */
export function isBrowserDemoLead(lead: LeadLike): boolean {
  return channelId(lead).startsWith("web-demo:") || sourceOf(lead) === "Web Demo";
}
