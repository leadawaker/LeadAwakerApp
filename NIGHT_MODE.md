# Night Mode — Implementation Guide

> **Read this before touching anything dark-mode-related.**

---

## How It Works

Dark mode uses Tailwind CSS v4's `@custom-variant dark (&:is(.dark *))` directive. When the `.dark` class is on `<html>`, all `dark:` utility variants activate and CSS custom properties in the `.dark {}` block override the light-mode `:root` values.

### Toggle

- **Hook:** `client/src/hooks/useTheme.ts` — `useTheme()` returns `{ isDark, toggleTheme, setIsDark }`
- **Persistence:** `localStorage.setItem("theme", "dark" | "light")`
- **Default:** Follows system preference via `prefers-color-scheme`
- **Button:** Moon/Sun icon in Topbar (lines ~350-364 of `Topbar.tsx`)

---

## Surface Hierarchy

| Token | Light | Dark | Hex (Dark) |
|-------|-------|------|------------|
| `--background` | `0 0% 87%` | `217 43% 13%` | `#131E30` |
| `--muted` | `0 0% 93%` | `215 44% 17%` | `#18283E` |
| `--card` | `0 0% 97%` | `217 34% 21%` | `#243249` |
| `--card-hover` | `0 0% 100%` | `225 26% 32%` | `#3D4868` |
| `--popover` | `0 0% 100%` | `217 23% 18%` | `#232B38` |
| `--input-bg` | `0 0% 100%` | `224 38% 22%` | `#232E4D` |

**Light:** stone-gray stepping (bg → muted → card → popover = white)
**Dark:** navy-indigo stepping (bg → muted → card → popover = deep indigo)

### Text Colors

| Token | Light | Dark | Hex (Dark) |
|-------|-------|------|------------|
| `--foreground` | `0 0% 3.9%` | `0 0% 100%` | `#FFFFFF` |
| `--muted-foreground` | `0 0% 45.1%` | `225 23% 59%` | `#7E8AAE` |

---

## Per-Page Accent Colors

Each page has its own hue for `--highlight-active` (sidebar pill) and `--highlight-selected` (selected card). These are defined in `client/src/lib/pageAccents.ts` as two maps:

- **`PAGE_ACCENTS`** — Light mode: bright pastels (78-86% L active, 91-96% L selected)
- **`PAGE_ACCENTS_DARK`** — Dark mode: deep tints (22-24% L active)

**The 25% Rule:** In dark mode, `selected` lightness = `active` lightness × 1.25, with +5% saturation. This ensures selected cards are visibly lighter/paler than the sidebar pill without being too bright on dark surfaces.

`CrmShell.tsx` reads the current page slug, picks from the dark or light map based on `isDark`, and injects the values as inline CSS custom property overrides.

### Fallback Highlights (index.css `.dark {}`)

```css
--highlight-active: 40 50% 24%;   /* Deep warm amber — active pill/tab */
--highlight-selected: 40 55% 30%; /* 25% brighter amber — selected card/row */
--highlight-hover: 243 40% 36%;   /* Indigo-tinted — hover on highlighted */
```

These are the defaults when no page-specific accent is defined.

---

## Substitution Rules

When adding dark mode support to new components, follow these patterns:

| Pattern | Replacement |
|---------|-------------|
| `bg-white` (panel/card) | `bg-white dark:bg-card` |
| `bg-white` (popover) | `bg-white dark:bg-popover` |
| `bg-[#F8F8F8]` | `bg-card` (auto-adapts) |
| `bg-[#ffffff]` (gradient base) | `bg-popover dark:bg-background` |
| `bg-white/60` | `bg-white/60 dark:bg-white/[0.10]` |
| `bg-white/70` | `bg-white/70 dark:bg-white/[0.07]` |
| `bg-white/80` | `bg-white/80 dark:bg-white/[0.08]` |
| `bg-white/90` | `bg-white/90 dark:bg-card/90` |
| `hover:bg-white` | `hover:bg-white dark:hover:bg-card` |
| `hover:bg-white/30` | `hover:bg-white/30 dark:hover:bg-white/[0.04]` |
| `text-gray-900` (on colored bg) | `text-gray-900 dark:text-foreground` |

### What NOT to change

- `text-white` on `bg-brand-indigo` buttons — white-on-indigo works in both modes
- Toggle switch handles — always white
- Pre-login / landing pages — out of scope

---

## Avatar System (Dark Mode)

All avatar color palettes in `client/src/lib/avatarUtils.ts` have dark variants:

| Entity | Light Maps | Dark Maps |
|--------|------------|-----------|
| Lead (pipeline) | `LEAD_AVATAR_BG` / `LEAD_AVATAR_TEXT` | `LEAD_AVATAR_BG_DARK` / `LEAD_AVATAR_TEXT_DARK` |
| Account | `ACCOUNT_AVATAR_BG` / `ACCOUNT_AVATAR_TEXT` | `ACCOUNT_AVATAR_BG_DARK` / `ACCOUNT_AVATAR_TEXT_DARK` |
| Campaign | `CAMPAIGN_AVATAR_BG` / `CAMPAIGN_AVATAR_TEXT` | `CAMPAIGN_AVATAR_BG_DARK` / `CAMPAIGN_AVATAR_TEXT_DARK` |
| User Role | `ROLE_AVATAR` | `ROLE_AVATAR_DARK` |
| Prompt | `PROMPT_AVATAR_BG` / `PROMPT_AVATAR_TEXT` | `PROMPT_AVATAR_BG_DARK` / `PROMPT_AVATAR_TEXT_DARK` |

**Getter functions** (`getLeadStatusAvatarColor`, `getAccountAvatarColor`, etc.) check `document.documentElement.classList.contains('dark')` at render time and return the appropriate palette.

**Dark palette design:**
- Backgrounds: very low lightness (~15%), moderate saturation (~50% of source)
- Text: high lightness (~78%), moderate saturation (~60% of source)
- This ensures legibility on dark surfaces while preserving the hue identity of each status

---

## Gradient Overlays

Detail panels (leads, campaigns, accounts, billing, prompts) use decorative radial-gradient overlays. In dark mode these are dimmed to barely-visible hints:

```tsx
{/* Decorative gradient — light: visible pastel, dark: barely-there hint */}
<div className="absolute inset-0 pointer-events-none dark:opacity-[0.08]"
  style={{ background: "radial-gradient(...)" }} />
```

The `dark:opacity-[0.08]` reduces the gradient to ~8% opacity, enough for a subtle color tint without overwhelming dark surfaces.

### Section Cards on Gradients

Semi-transparent section cards on gradient backgrounds use:
```
bg-white/60 dark:bg-white/[0.10]
```
This creates elevation distinction on both light and dark surfaces.

---

## Chat Panel (Conversations)

Three background styles, all dark-aware:

| Style | Light | Dark |
|-------|-------|------|
| `crm` | `bg-card` | auto-adapts via CSS variable |
| `social1` | Linear gradient (rgba greens) | `dark:opacity-[0.08]` on gradient div |
| `social2` | Linear gradient (rgba blues) | `dark:opacity-[0.08]` on gradient div |

Message bubbles:
- **AI:** `bg-[#f2f5ff]` → `dark:bg-[#1e2340]`
- **Human agent:** `bg-[#f1fff5]` → `dark:bg-[#1a2e1f]`

---

## Key Files

| File | Role |
|------|------|
| `client/src/index.css` (`.dark {}` block) | All CSS custom property dark values |
| `client/src/hooks/useTheme.ts` | Theme toggle hook |
| `client/src/lib/pageAccents.ts` | Per-page accent colors (light + dark maps) |
| `client/src/lib/avatarUtils.ts` | Avatar color palettes (light + dark) |
| `client/src/components/crm/CrmShell.tsx` | Applies page accents as inline CSS overrides |
| `client/src/components/crm/Topbar.tsx` | Moon/Sun toggle button |

---

## Adding Dark Mode to New Components

1. **Never hardcode** `bg-white`, `bg-[#F8F8F8]`, or `bg-[#ffffff]` — use CSS variable utilities (`bg-card`, `bg-popover`, etc.) or add `dark:` variants per the substitution table above.
2. **Selected state** → always use `bg-highlight-selected` (never hardcode a hex). The accent system handles page-specific colors automatically.
3. **Avatar colors** → always use the getter functions from `avatarUtils.ts`. They auto-switch palettes.
4. **Gradients** → add `dark:opacity-[0.08]` to decorative gradient overlays.
5. **Test** both modes after any UI change — toggle via the Moon/Sun button in the Topbar.
