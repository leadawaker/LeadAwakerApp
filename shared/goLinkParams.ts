/**
 * The query a /go/<code> link may carry (pure, shared by GoLink, the login
 * return trip and the server). Anything else is dropped.
 *  - ?to=settings: the email footer's "choose which emails you get"
 *  - ?to=calls:    the recap's "See all N calls"
 *  - ?call=<id>:   one call row in the recap (the server checks the call is the code's account's)
 */
export type GoLinkParams = { to?: "settings" | "calls"; call?: string };

const CALL_ID = /^[A-Za-z0-9_-]{1,80}$/;

export function parseGoLinkParams(search: string): GoLinkParams {
  const q = new URLSearchParams(search);
  const to = q.get("to");
  if (to === "settings" || to === "calls") return { to };
  const call = q.get("call");
  return call && CALL_ID.test(call) ? { call } : {};
}

/** Back to a query string ("" when nothing is kept). */
export function goLinkQuery(p: GoLinkParams): string {
  if (p.to) return `?to=${p.to}`;
  return p.call ? `?call=${encodeURIComponent(p.call)}` : "";
}
