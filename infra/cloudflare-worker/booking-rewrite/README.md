# Booking-domain rewrite Worker

White-labels client booking pages: serves `https://book.clientwebsite.com/` from
the client's Cal.diy page with no `cal.leadawaker.com` in the address bar.

## How it fits (Cloudflare Tunnel — Option B)

1. **Client** adds one DNS record: `CNAME book → 75e02640-edf0-41dd-b681-6efc0469e8e2.cfargotunnel.com`
   (shown in the CRM card, copy-to-clipboard).
2. **Gabriel** adds a Public Hostname in Zero Trust → Tunnels → `pi-tunnel`:
   `book.clientwebsite.com` → `http://localhost:3001` (Cal.diy).
3. **This Worker** is bound to that hostname's route. It looks up the Cal.diy
   username for the host (Express `/api/internal/custom-domain-lookup`) and
   rewrites `/` → `/<username>`, `/<event>` → `/<username>/<event>`.
4. **Gabriel** marks the domain **active** in the CRM (the "Verify" button) once
   DNS has propagated; only then do the AI's outbound links use the custom host.

No Cloudflare for SaaS, no per-hostname certs to manage on the Pi.

## Deploy

```bash
cd infra/cloudflare-worker/booking-rewrite
wrangler secret put INTERNAL_KEY      # = INTERNAL_API_KEY from server .env
wrangler deploy
```

Add a route per client hostname (see `wrangler.toml`), then redeploy.

## Test

```bash
curl -s -H "Host: book.clientwebsite.com" https://book.clientwebsite.com/ | grep -o "<title>[^<]*"
```

Should return the client's booking page, not the cal.leadawaker.com landing.
