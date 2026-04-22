// Vercel Edge Middleware: injects calculator-specific OG meta tags when
// a visitor lands on a shared calculator URL with query params.
// Static scrapers (LinkedIn, WhatsApp, Twitter, iMessage) will see a
// preview tailored to the prospect's own numbers.

export const config = {
  matcher: "/",
};

// Mirror of the 3 scenarios baked into RevenueCalculator.tsx. We use the
// middle ("Cold leads") scenario for the preview number since it is the
// default the prospect sees.
const RESPONSE_RATE = 0.50;
const QUALIFIED_RATE = 0.15;
const DEFAULT_CLOSE_RATE = 0.40;

function formatCurrency(val: number, symbol: string): string {
  if (!Number.isFinite(val) || val <= 0) return `${symbol}0`;
  if (val >= 1_000_000) return `${symbol}${(val / 1_000_000).toFixed(1)}M`;
  if (val >= 1_000) return `${symbol}${Math.round(val / 1_000)}K`;
  return `${symbol}${Math.round(val)}`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export default async function middleware(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const params = url.searchParams;

  // Only rewrite when the visitor is landing on a shared calculator state.
  // Presence of any one of these means someone shared a prospect-specific link.
  const hasCalcParams =
    params.has("leads") || params.has("deal") || params.has("cost");

  if (!hasCalcParams) {
    return fetch(new URL("/index.html", url.origin), request);
  }

  const leads = Number(params.get("leads")) || 5000;
  const deal = Number(params.get("deal")) || 3000;
  const cost = Number(params.get("cost")) || 5;
  const decay = Number(params.get("dc"));
  const gm = Number(params.get("gm"));
  const mr = Number(params.get("mr"));
  const profitMode = params.get("mode") === "profit";
  const recurring = params.get("rec") === "1";
  // Prefer scenario-specific close-rate override if present.
  const crOverride = Number(params.get("cr1"));
  const closeRate =
    Number.isFinite(crOverride) && crOverride >= 5 && crOverride <= 70
      ? crOverride / 100
      : DEFAULT_CLOSE_RATE;

  const decayPct = Number.isFinite(decay) && decay >= 0 && decay <= 30 ? decay : 10;
  const effectiveLeads = Math.round(leads * (1 - decayPct / 100));
  const closedDeals = Math.round(
    effectiveLeads * RESPONSE_RATE * QUALIFIED_RATE * closeRate
  );

  let perDealValue = deal;
  if (profitMode && Number.isFinite(gm) && gm >= 10 && gm <= 100) {
    perDealValue = perDealValue * (gm / 100);
  }
  if (recurring && Number.isFinite(mr) && mr >= 1 && mr <= 60) {
    perDealValue = perDealValue * mr;
  }

  const revenue = closedDeals * perDealValue;
  const totalSpend = leads * cost;
  const roi = totalSpend > 0 ? Math.round(((revenue - totalSpend) / totalSpend) * 100) : 0;

  // Currency: rough heuristic. If the "deal" value is very high we assume BRL,
  // otherwise EUR. The app uses language to pick currency; we can't read that
  // here, but deal size is a decent proxy for the Brazilian market.
  const symbol = deal >= 100_000 ? "R$" : "€";

  const noun = profitMode
    ? recurring ? "lifetime profit" : "profit"
    : recurring ? "lifetime revenue" : "revenue";

  const title = `Lead Awaker · ${formatCurrency(revenue, symbol)} in ${noun} from ${leads.toLocaleString()} dead leads`;
  const description = `At a ${Math.round(closeRate * 100)}% close rate on responders, ${leads.toLocaleString()} dead leads become ${closedDeals} closed deals. ROI: ${roi > 0 ? "+" : ""}${roi}%. Run your own numbers.`;

  const res = await fetch(new URL("/index.html", url.origin), request);
  const html = await res.text();

  const escTitle = escapeHtml(title);
  const escDesc = escapeHtml(description);

  const updated = html
    .replace(
      /<meta property="og:title"[^>]*>/,
      `<meta property="og:title" content="${escTitle}" />`
    )
    .replace(
      /<meta property="og:description"[^>]*>/,
      `<meta property="og:description" content="${escDesc}" />`
    )
    .replace(
      /<meta name="twitter:title"[^>]*>/,
      `<meta name="twitter:title" content="${escTitle}" />`
    )
    .replace(
      /<meta name="twitter:description"[^>]*>/,
      `<meta name="twitter:description" content="${escDesc}" />`
    );

  return new Response(updated, {
    status: res.status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      // Short TTL so changes propagate fast without each request hitting origin.
      "cache-control": "public, max-age=60, s-maxage=300",
    },
  });
}
