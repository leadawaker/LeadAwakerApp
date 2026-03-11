# Requirements: Vercel Deployment

## What & Why

Deploy the React frontend to Vercel at `leadawaker.com` while keeping the Express API on the Pi at `app.leadawaker.com` (Cloudflare Tunnel). This gives a production-grade CDN-hosted frontend with zero changes to the backend infrastructure.

## Architecture

```
User browser
  → leadawaker.com          (Vercel — static React build)
  → app.leadawaker.com/api  (Cloudflare Tunnel → Pi → Express)
```

Local development workflow is unchanged: code-server on Pi, pm2 serves combined app at `app.leadawaker.com`.

## Acceptance Criteria

- [ ] Frontend deployed to `leadawaker.com` via Vercel
- [ ] All API calls from Vercel-hosted frontend reach `app.leadawaker.com/api`
- [ ] Login/session works cross-origin (cookie sent from `leadawaker.com` → `app.leadawaker.com`)
- [ ] SSE real-time messages work from Vercel-hosted frontend
- [ ] `git push` to `main` branch triggers automatic Vercel re-deployment
- [ ] Local development at `app.leadawaker.com` continues to work unchanged

## Dependencies

- GitHub repo (must be created and code pushed)
- Vercel account connected to GitHub repo
- `leadawaker.com` DNS pointed to Vercel
- `SESSION_SECRET` env var set in Pi `.env` (already required in production)
