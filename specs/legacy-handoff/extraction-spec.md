# Legacy Site Extraction Spec — Handoff to Buyer (Mike)

**Goal:** Extract the legacy landing site into a clean, self-contained `client/src/legacy/` folder (organized by category), decoupled from CRM/backend, and renamed generically. End state = a buyer with Claude Code can drop it into a fresh Vite project and customize it. Color-centralization (Phase 4) and translation-merge (Phase 5) are DEFERRED — only do them if Mike asks.

**Execute next session with full credits. Ideal as parallel agents (one per phase below).**

---

## Source inventory (what makes up the legacy site)

**Pages** (`client/src/pages/legacy/`): `home.tsx`, `faq.tsx`, `login.tsx`

**Components** (`client/src/components/`):
Chat3D, PipelineChart, AnimatedCounter, AnimatedRangeCounter, SalesRepSteps, RevenueCalculator, TryInSixtySeconds, WorkflowVisualization, FounderSection
+ internal leaves: Meteor, StepCarousel, `hooks/useCarouselScrollLock.ts`, LeadReactivationAnimation, and the whole `components/calculator/` folder (5 files)

**UI primitives** (`components/ui/`): button, input, card, badge, background-paths, dotted-surface (needs `three`), falling-pattern
+ `@/Seo` (used by faq.tsx)

**Hooks/libs**: `lib/utils.ts` (cn), `hooks/useCurrency.ts`, `hooks/useCountry.ts` (calls ipapi.co), `lib/apiUtils.ts` (login only), `i18n.ts`

**Locale JSONs** (per language, en/nl/pt): home, about, services, chat3d, salesRepSteps, pipelineChart, workflowVisualization, common, login, faq

**Assets**: `src/assets/*.webp/.png` used by SalesRepSteps, StepCarousel, FounderSection, profile.webp; plus `public/` files (favicon, login heroes, `/logos/credibility/`)

**npm deps**: react, wouter, framer-motion, react-i18next + detector, lucide-react, class-variance-authority, clsx, tailwind-merge, @radix-ui/react-slot, three

---

## Target structure: `client/src/legacy/`

```
legacy/
  pages/
    Home.tsx
    Faq.tsx
    Login.tsx            (keep — let buyer delete; stub its API call)
  components/
    sections/            (page sections, renamed generic — see renames)
    widgets/             (calculator, counters, animations)
    ui/                  (button, input, card, badge, effects)
  hooks/                 (useCurrency, useCountry, useCarouselScrollLock)
  lib/                   (utils.ts, seo)
  styles/                (existing css moved as-is; color-centralize deferred)
  locales/
    en/                  (per-namespace JSONs, unmerged — merge deferred)
    nl/
    pt/
  assets/                (only the images the landing actually uses)
  i18n.ts                (trimmed: only landing namespaces)
```

---

## Phase 1 — File moves + renames (cascade imports on every move)

Rename generic so buyer isn't stuck with LeadAwaker-specific names:
- `SalesRepSteps` → `StepsSection`
- `TryInSixtySeconds` → `DemoSection`
- `WorkflowVisualization` → `WorkflowSection`
- `RevenueCalculator` → `Calculator` (keep `calculator/` subfolder under widgets/)
- `PipelineChart` → `PipelineChartSection`
- `FounderSection` → `AboutSection`
- `Chat3D` → keep (generic enough) or → `ChatAnimation`

After EACH move/rename, update all import paths in referencing files. Verify no `@/components/...` or `@/pages/legacy/...` paths remain pointing outside `legacy/`.

## Phase 2 — Decouple from backend/CRM

- **login.tsx**: keep the file. Replace the `${API_BASE}/api/auth/login` POST with a clearly-marked placeholder (`const API_BASE = "REPLACE_WITH_YOUR_API"` + comment). Remove `leadawaker_*` localStorage keys + `/agency/campaigns` redirect, leave a TODO comment.
- **TryInSixtySeconds/DemoSection**: the `UniversalDemoForm` POST to `/api/demo/create-session` → point to a placeholder `YOUR_API_ENDPOINT` constant with a comment, NOT Gabriel's Pi.
- **i18n.ts**: remove the ~16 CRM namespaces (leads, campaigns, billing, accounts, settings, tasks, prospects, conversations, automation, prompts, calendar, tags, users, crm, docs, onboarding...). Keep only landing namespaces.
- Confirm no `shared/schema`, react-query, or auth-context imports survive (none currently in the tree — verify after moves).

## Phase 3 — Remove Gabriel-specific content

- Strip hardcoded WhatsApp number `wa.me/554774002162` from home.tsx CTAs + RevenueCalculator CTA → replace with `YOUR_WHATSAPP_NUMBER` placeholder constant.
- Swap profile image / FounderSection (AboutSection) personal info for generic placeholders with comments.

## Phase 4 — Centralize colors into ONE css (`styles/theme.css`) — DEFERRED

**SKIP for initial handoff.** Buyer may never need a full rebrand, and Claude Code can do a find-and-replace on the inline hex on demand. Only do this if Mike explicitly asks for one-file color control. Details kept below for when/if needed.


Current state: 31+ hardcoded hex inline across home.tsx + children (`#FEB800` brand yellow, `#273887`, `#3c50d6`, `#1c2973`, `#F9FAFC`, etc.), zero tokens.

- Define every brand color as a CSS variable in `theme.css` `:root` (e.g. `--brand-accent: #FEB800; --brand-primary: #273887;`).
- Replace each inline `bg-[#FEB800]` / `text-[#FEB800]` / `style={{backgroundColor:"#273887"}}` with the variable (Tailwind arbitrary `bg-[var(--brand-accent)]` or a mapped utility class).
- Goal: buyer changes ~6-8 variables in one file to fully rebrand. Document the variable list at top of theme.css with comments.

## Phase 5 — Merge translations (≤700 lines each) — DEFERRED

**SKIP for initial handoff.** The per-namespace JSON files are already clean and all under `locales/`. Merging is cosmetic and only worth doing if Mike asks. Details kept below for when/if needed.


- Merge the ~10 landing namespaces into `en.json` (single nested object). If >700 lines, split into `en.json` + `en-extra.json` (max two).
- Remap every `t('oldNamespace.key')` call in the TSX to the merged structure.
- Repeat for nl.json, pt.json (mirror keys exactly).

## Phase 6 — Optional TSX merges

Merge only where it genuinely reduces clutter without making files >500 lines (per CLAUDE.md):
- AnimatedCounter + AnimatedRangeCounter → `Counters.tsx`
- Small effect components (Meteor, falling-pattern) could co-locate under `ui/effects.tsx` if each is small.
- Do NOT merge large components (home.tsx, RevenueCalculator) — keep focused.

## Phase 7 — Verify

- All imports resolve within `legacy/` (no leaks to CRM).
- `home.tsx` and `faq.tsx` have zero live backend calls; `login` + demo point to placeholders only.
- Copy lives under `locales/` (per-namespace JSONs, unmerged — fine).
- List final npm deps for the buyer's `package.json`.

---

## Deliverable to Mike
Zip of `legacy/` as a standalone folder + a short README: install steps (Node.js, `npm install`, `npm run dev`), where to change colors (theme.css), where to change text (locales/*.json), where to set his API endpoint + WhatsApp number, how to deploy (Vercel).
