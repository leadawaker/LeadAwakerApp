# Demos page redesign: Sessions, create panel, scan quality, personas

Date: 2026-10-27. Owner: Gabriel. Status: design, awaiting approval.

## Why

The Demos page (`client/src/features/demos/`) is where Gabriel mints demo links for prospects. Today it is three loosely related tabs:

- **Sessions** is a bland 1,550px table.
- **New demo** is one mega form that mixes two different jobs: minting a link for an existing client, and building a new client.
- **Demo personas** is cluttered.

Typed input is lost when you leave the tab. 274 of 293 links are dead. Dealer demos did not know a single car model, which Gabriel calls unacceptable.

Success: Gabriel can add a prospect, get their links and send them in under a minute from one page. Any scanned client knows the real products or services of that business. The table only shows live, useful rows he can search, filter, annotate and clean up.

Anti-goals:
- Losing typed input on tab switch.
- Demos that bluff about products.
- More clicks for the everyday quick mint.
- Desktop layout regressions (see the mobile rules in the `leadawaker-dev` skill).

## Decisions made by Gabriel

1. **No separate New demo tab.** A "+ New demo" button in the Sessions topbar opens a right side panel (layout A, mockup in `.superpowers/brainstorm/.../create-demo-layout-v2.html`). On mobile the panel is full screen.
2. **The panel only adds a prospect row. No link is minted from the panel.** All links are minted from the table cells.
3. **Two paths in the panel**, as a switch at the top:
   - **Existing client** (quick mint).
   - **New from website** (scan). Describing a niche by hand is a folded secondary option inside this path.
4. **Draft persists** across tab switches and navigation until Gabriel presses **Clear**.
5. **Voice picker removed** from the flow. The voices are already configured.
6. **Unused home improvement personas are deleted**, for example floor experts and stone and surface studios. Going forward, clients come mostly from scans.
7. **Row settings are editable after minting.** Edits apply to already-sent links.
8. **DBR and Quote share one column.** Its "+" opens a popover to pick DBR or Quote. Quote stays a distinct demo.
9. **Voice links expire after 14 days.** Other links keep 7 days.
10. **Dead links with no replies are deleted completely**, including their child rows. Links where the prospect replied are kept, hidden behind the Expired filter, because their conversations feed the voice review and prompt coach. A manual delete of one link or prospect is still a hard delete, after a confirmation. The bulk backlog delete is run only after Gabriel confirms it at build time.
10a. **Re-mint revokes the old link but keeps its conversation.** The old token stops working, its row stays, and the new token gets the same settings.
10b. **Public website demo visitors** (`Source = 'Public Website Demo'`) are excluded from the bulk cleanup and the expiry changes. They show in the table with a "Website" pill, and Gabriel can delete one by hand.
10c. **Existing website-built clients are re-scanned once.** The re-scan fills only the new fields (products, `stock_url`, city, phone) and never overwrites existing or hand-edited fields.
10d. **The scan upgrade applies to the internal scan only.** The public landing page scan (`public: true`) keeps its current caps and gets no Firecrawl re-fetch. Upgrading it is a later, separate change.
11. **Scan stores a sample of about 20 real products or services**, with price when shown, plus the URL of the stock or products page. There is no live browsing during conversations and no full-stock tool for prospect demos.
12. **Everything ships in one round:** create panel, Sessions upgrades, scan fix, personas page.

## Current state (facts from investigation)

- **Tokens are rows in `Leads`, not a separate table.** Each token is a `wa-demo:<token>` row created at mint (`server/demo-session.ts:969`). A `web-demo:<token>` copy is made on first browser open (automations `src/webhooks/web_demo_routes.py:217`). All settings live in the JSON text column `demo_niche`, which is a mint-time copy of the client persona plus overrides.
- **Settings are read live on every AI turn** (automations `prompt_builder.py:289`). So editing a token's rows changes already-sent links.
  - Voice, widget and Instagram read the newest row, which is `web-demo` once it exists. Every edit must write both rows. `updateDemoIdentity` (`server/demo-admin.ts:181`) does this already. `PATCH /config` writes `web-demo` only and returns 404 when there is none: fix that.
  - Changing language must rebuild the persona text from the client (as `/config` does at `server/routes/demo.ts:973`).
- **Expiry:** `created_at` older than 7 days. The checks are in automations `whatsapp_cloud_routes.py:139,176`, `web_demo_routes.py:74` (`TOKEN_TTL_DAYS`) and `server/socialDemoPage.ts:25`. Voice has no check today. There is a restart cap of 5 and a 12 month purge (`demo_data_purge.py`).
- **No delete, revoke or re-mint endpoint exists.** Only name and company can be edited. `listDemoSessions` (`demo-admin.ts:273`) does not return disclosure, market or scenario, so table-cell mints drop them (`ServiceCell.tsx:89`).
- **Two bugs:**
  - `prospectGroup` is created once on mount (`NewDemoForm.tsx:53`), so a second prospect joins the first prospect's row.
  - The "describe a new niche" text is never sent (`NewDemoForm.tsx:41`, missing from the props at `:315`).
- **The scan pipeline** runs `server/routes/demo.ts:246`, then `server/demoWebsiteClient.ts`, then engine `/api/site-kb`, then `tools/site_kb.py`. It does a plain HTTP fetch of the homepage plus 6 pages.
  - Link priority (`tools/prospect_enricher.py:46`) ignores stock and product paths.
  - Pages are cut at 6k characters each and 24k in total.
  - Firecrawl runs only when the homepage fetch errors.
  - The summarizer prompt (`site_kb.py:101-118`) asks for about 300 words including "brands or products carried", so it drops models. Johan Meure's 75 models with prices were fetched and then lost.
  - The niche generator (`demoWebsiteClient.ts:93`) sees only the label, so the enquiry context, opener, scoping ladder and objections are generic.
  - City and phone are scraped but never saved.
- **Which persona fields reach which prompt** (WhatsApp prompts 93 and 108, voice prompts 109-111):
  - `kb`, business description and company name: every channel.
  - Enquiry context, quote context, scoping ladder, question and objection banks, opener and first message, terms: WhatsApp only.
  - The niche question appears only in an appended block.
  - City is in the voice template but never stored.

## What to build

### 1. Sessions page shell
- Tabs become: Sessions, Demo personas, Settings. Remove the New demo tab.
- Topbar matches the other list pages (see `UI_STANDARDS.md`, `UI_PATTERNS.md`, and the `LeadsDesktopToolbar` pattern):
  - Search: prospect, company, client.
  - Filters: Opened, Replied, Never opened, Expired, by client, by demo type.
  - Sort: newest, prospect, company, last activity.
  - View toggle: Table or Folders.
  - "+ New demo".
- Use `buildEntityRows` / `groupItemsToMap` for the filter, sort and group logic.
- Empty state with a "+ New demo" button. Error state with Retry. Toasts for copy, create, delete and re-mint.

### 2. Create panel (right side panel, never a Dialog)
- **Common fields:** first name (required, marked), company.
- **Existing client:**
  - Searchable client list showing label and language flags, with no emoji clutter.
  - Language (EN, NL, PT).
  - "More options" collapsed: AI disclosure, and market (EN only).
- **New from website:**
  - URL plus Scan, with visible progress steps (reading site, building client).
  - A folded "Describe a niche instead" textarea that is actually wired to the server's `niche` field.
  - "Build from notes" stays in this fold.
  - After a scan, a **review step** shows: business summary, the product and service list (editable lines, add and remove), city, and the stock page URL. "Save client" saves it, then switches to Existing client with it selected.
- **"Add to table"** creates the prospect row and highlights it in the table, then closes the panel. The draft stays until Clear.
- The draft persists in a per-viewer store that survives tab switches and reloads. The prospect group id is regenerated on Clear and after "Add to table".

### 3. Prospect rows that remember settings
- A prospect row stores: first name, company, client, language, AI disclosure, market, notes, website and screenshot.
- Every cell mint uses the row settings, which fixes the dropped disclosure and market.
- Editing settings on a row rewrites every live token in the row, on both `wa-demo` and `web-demo` rows. Changing the client or language rebuilds the persona copy from the client.
- An empty row (prospect added, no links yet) must be possible.

### 4. Table and folder views
- **Table:** one row per prospect.
  - Columns: Site, Prospect, Company, Client (clickable, opens that client on the personas page), DBR/Quote, Speed, Widget, Voice, Reviews, Socials, Last activity, Sent (with year when not the current year).
  - Status as coloured pills: grey never opened, accent opened, green replied, muted expired. Show the channel icon (WhatsApp or browser).
- **Folders:** one card per prospect, showing site thumbnail, name, company, client, and status chips per demo. Opening a card shows a detail panel with all links and their actions, settings (editable), notes, and the conversation and reply counts.
- **Site screenshot click** opens a large preview of the homepage screenshot plus a link to the live site.
- **Per-link actions:** copy, open, WhatsApp share, voice call controls (existing `DemoCallControls`), widget and social swatches (existing), re-mint, delete.
- **Re-mint** creates a new token with the same settings and revokes the old one, keeping its conversation (decision 10a). It needs a revoked marker that every expiry check honours.
- **Delete** works per link or per prospect (all its links). It removes both lead rows and their child rows (Interactions, Leads_Tags, Automation_Logs, Send_Queue, Booking_Links, Notifications, Lead_Score_History, Tasks), as `demo_data_purge.py` does. Confirm with a destructive Dialog.
- **Mobile:** the folder view is the default under 768px. 44px touch targets. Replace right-click copy with a ⋯ menu.

### 5. Expiry and cleanup
- Voice token age check: 14 days, in realtime and ElevenLabs voice. Other channels stay at 7.
- Expired links show as Expired (filterable), with re-mint and delete available.
- **One-off cleanup script:** delete tokens that have no replies and are either expired by their channel's rule or point at a deleted campaign, plus the orphan `web-demo` row. Public website demos are excluded (decision 10b). Do a dry run first that prints the counts, then run only after Gabriel confirms.
- **One-off backfill:** re-scan existing website-built clients to fill only the new fields (decision 10c). Do a dry run listing the clients first.

### 6. Scan fix (automation engine plus CRM)
- **New persona field: products list.** About 20 items, each with name, short detail and price when shown, plus `stock_url`. Store it per language next to `kb_template`, and include it in `demoClientToContext`. Render it into every channel's prompt: WhatsApp 93 and 108, and voice 109-111 / ElevenLabs facts. Prompt rule: only quote listed items. When asked about something not listed, offer to check with the team or share `stock_url`.
- **Fetching:**
  - Prioritise stock, product, price and menu paths in multiple languages (occasions, voorraad, aanbod, used, stock, products, diensten, prijzen, tarieven, menu, behandelingen, etc.).
  - Raise the page budget.
  - Re-fetch with Firecrawl any page whose text is near empty or looks like a JS shell, not only on homepage errors.
  - Raise the per-page cap for stock pages.
- **Summarizer:** a separate extraction step that returns the products list as structured JSON, so the 300 word summary no longer swallows it.
- **Generator:** pass the scraped summary and products into `generateNicheContextStrict`, so the enquiry context, opener, scoping ladder and objections reference real items.
- **Save city and phone.**
- Build from notes uses the same extraction.
- Works for any niche, not only cars.

### 7. Demo personas page
- Remove the per-client emoji or icons.
- Search, filters (niche, language, source: website or manual) and delete. Delete is blocked or warned when live tokens use the client.
- **Translate button** on an empty language slot. It translates from EN or NL (Gabriel picks when both exist) and fills that slot for review.
- Every field shown must reach a prompt. Wire the niche question into the WhatsApp and voice prompts or remove it from the UI (builder's call, documented). Show the products list and city.
- Delete the unused home improvement personas. List them for Gabriel's confirmation first.

## Constraints
- Follow `UI_STANDARDS.md`: wine tokens only, dark mode safe, Manrope, `IconBtn` 36px, neu utilities, no `transition-all`, primitives from `components/crm/primitives/`. Use shared components instead of the inline styles in `NewDemoForm.tsx`.
- All strings in i18n (`locales/{en,nl,pt}/demos.json`). PT is Brazilian.
- Mobile changes are additive. Desktop layout outside the Demos page is untouched.
- Never run tsc automatically. Run on the Pi via pm2. Do not push `main` without Gabriel's go-ahead. Timestamps are set server-side.
- Keep files under about 500 lines and split components.
- The automation engine lives in `/home/gabriel/automations` (read its `CLAUDE.md`).

## Left to the builder
- The storage for prospect row settings and notes: a new `Demo_Prospects` table keyed by prospect group, or columns on the `wa-demo` lead. A new table is recommended so empty rows and notes have a home.
- The exact draft storage mechanism.
- Folder card visual details, within `UI_PATTERNS.md`.
- Page budget numbers and the Firecrawl shell heuristic.
- Whether the niche question is wired in or removed.
- Order of work, and splitting it into phases with checkpoints.
