# Action Required: Vercel Deployment

## Before Implementation

- [x] **Create GitHub account / repo** — already exists at leadawaker/LeadAwakerApp
- [x] **Create Vercel account** — connected to leadawaker GitHub org

## After Code Changes

- [ ] **Add `.env` line on Pi** — add `CORS_ORIGIN=https://leadawaker.com` to `/home/gabriel/LeadAwakerApp/.env`, then `pm2 restart leadawaker`
- [ ] **Push to GitHub** — `git push origin main` (or the branch you want to deploy)
- [ ] **Import project in Vercel** — vercel.com → "Add New Project" → select the GitHub repo
- [ ] **Set Vercel env var** — in Vercel project Settings → Environment Variables: `VITE_API_URL = https://app.leadawaker.com`
- [ ] **Add custom domain in Vercel** — project Settings → Domains → add `leadawaker.com`
- [ ] **Update Cloudflare DNS for `leadawaker.com`** — Vercel will show the DNS records to add. Set Cloudflare proxy to **grey cloud (DNS only)** on this record — orange cloud breaks Vercel's HTTPS
