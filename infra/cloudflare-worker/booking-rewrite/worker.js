/**
 * LeadAwaker white-label booking-domain rewrite Worker.
 *
 * Bound to client custom hostnames (e.g. book.clientwebsite.com). It maps the
 * custom host to the client's Cal.diy username and rewrites the path so the
 * booking page renders at the root of the custom domain:
 *
 *   GET https://book.client.com/            → origin /<username>
 *   GET https://book.client.com/<event>     → origin /<username>/<event>
 *   /_next/* /api/* /booking/* /favicon*     → passed through unchanged
 *
 * Origin is the Cloudflare Tunnel front (cal.leadawaker.com). The username is
 * resolved from the Express internal endpoint and cached at the edge.
 *
 * Env vars (wrangler.toml [vars] / secrets):
 *   ORIGIN       https://cal.leadawaker.com
 *   LOOKUP_URL   https://api.leadawaker.com/api/internal/custom-domain-lookup
 *   INTERNAL_KEY <INTERNAL_API_KEY>   (secret)
 */

const PASS_THROUGH = [/^\/_next\//, /^\/api\//, /^\/booking\//, /^\/favicon/, /^\/icons?\//];
const ASSET_EXT = /\.(?:js|css|map|png|jpg|jpeg|gif|svg|ico|woff2?|ttf|webp|avif|json|txt|xml)$/i;
const LOOKUP_TTL = 300; // seconds

async function resolveUsername(host, env) {
  const cacheKey = new Request(`https://lookup.internal/${host}`);
  const cache = caches.default;
  const hit = await cache.match(cacheKey);
  if (hit) return (await hit.json()).username;

  const resp = await fetch(`${env.LOOKUP_URL}?host=${encodeURIComponent(host)}`, {
    headers: { "x-internal-key": env.INTERNAL_KEY },
    cf: { cacheTtl: 0 },
  });
  const username = resp.ok ? (await resp.json()).username || null : null;

  await cache.put(
    cacheKey,
    new Response(JSON.stringify({ username }), {
      headers: { "content-type": "application/json", "cache-control": `max-age=${LOOKUP_TTL}` },
    }),
  );
  return username;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();
    const originBase = env.ORIGIN || "https://cal.leadawaker.com";

    const proxy = (target) => {
      const headers = new Headers(request.headers);
      headers.set("Host", new URL(originBase).hostname);
      return fetch(target, {
        method: request.method,
        headers,
        body: request.body,
        redirect: "manual",
      });
    };

    // Never rewrite the canonical host or passthrough paths.
    const isPassThrough =
      PASS_THROUGH.some((re) => re.test(url.pathname)) || ASSET_EXT.test(url.pathname);

    let username = null;
    try {
      username = await resolveUsername(host, env);
    } catch (_) {
      username = null;
    }

    // Unknown host or asset/API request → proxy origin untouched.
    if (!username || isPassThrough) {
      return proxy(`${originBase}${url.pathname}${url.search}`);
    }

    // Already namespaced under the username → leave as-is.
    let path = url.pathname;
    if (path === "/" || path === "") {
      path = `/${username}`;
    } else if (!path.startsWith(`/${username}/`) && path !== `/${username}`) {
      path = `/${username}${path}`;
    }

    return proxy(`${originBase}${path}${url.search}`);
  },
};
