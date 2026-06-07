# Lead Awaker CRM — Design System

## Overview

Warm-bone neumorphic design system for the CRM application. The aesthetic is tactile and material: surfaces appear extruded from or pressed into a warm parchment ground. A directional light source (top-right, 65deg) drives all shadows. A single deep wine accent punctuates the neutral palette. Typography mixes a serif display face with a humanist sans and a monospace for UI chrome.

The CRM shares the core design tokens (light system, shadow engine, glass, neumorphic primitives) with the premium landing page. It extends the system with CRM-specific components: pipeline stages, campaign cards, sidebar navigation, segmented controls, compact action buttons, status pills, and responsive layout shells.

---

## Shared Foundation

These tokens match the landing page design system (`client/public/premium/design-tokens.css`). Any change to these values must be made in both files.

---

## Color Palette

### Backgrounds & Surfaces
| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#ECE6DA` | Page ground |
| `--bg-2` | `#E5DECF` | Sidebar / nav rail |
| `--chrome` | `#E5DECF` | Explicit alias for nav chrome (same as `--bg-2`) |
| `--paper` | `#F4EFE3` | Elevated paper / hero bands |
| `--surface` | `#EDE7DB` | Card surface (midpoint between bg and paper) |
| `--card` | `#FFFFFF` | White cards — brightness lift for data-dense views |
| `--card-bright` | `#FFFFFF` | Polished hero — pure white, warmth from gradient overlay |

### Ink & Text
| Token | Value | Role |
|-------|-------|------|
| `--ink` | `#1F1A14` | Primary text |
| `--ink-soft` | `#322B22` | Slightly softened headings |
| `--mute` | `#6C6354` | Secondary / label text |
| `--mute-2` | `#948A77` | Placeholder, tertiary text |

### Borders
| Token | Value | Role |
|-------|-------|------|
| `--line` | `rgba(110, 95, 65, 0.14)` | Dividers, ghost borders |
| `--line-strong` | `rgba(110, 95, 65, 0.24)` | Stronger borders |

### Accent — Wine
| Token | Value | Role |
|-------|-------|------|
| `--wine` | `#5E2230` | Primary accent |
| `--wine-soft` | `#7A2E3E` | Hover state |
| `--wine-tint` | `rgba(94, 34, 48, 0.08)` | Subtle wine-tinted backgrounds |
| `--wine-glow` | `rgba(94, 34, 48, 0.18)` | Wine shadow / ambient glow |
| `--wine-grad` | `linear-gradient(145deg, #6E2638, #4B1A26)` | Primary-action gradient |

### Status Accents
| Token | Value | Role |
|-------|-------|------|
| `--good` | `#2F9461` | Emerald — booked / positive |
| `--good-tint` | `rgba(47, 148, 97, 0.12)` | Good background tint |
| `--warn` | `#DA9426` | Amber — warm / about-to-send |
| `--warn-tint` | `rgba(218, 148, 38, 0.13)` | Warn background tint |

### Pipeline Stage Colors
| Token | Value | Stage |
|-------|-------|-------|
| `--stage-new` | `#6C5A8C` | New |
| `--stage-contacted` | `#547BB0` | Contacted |
| `--stage-responded` | `#3F8E8E` | Responded |
| `--stage-multi` | `#5E8E5E` | Multi-touch |
| `--stage-qualified` | `#B58F3E` | Qualified |
| `--stage-booked` | `#C48A2F` | Booked |
| `--stage-closed` | `#6E7A5E` | Closed |
| `--stage-lost` | `#A24B3F` | Lost |
| `--stage-dnd` | `#9D8E76` | Do Not Disturb |

---

## Directional Light System

All shadows are computed from a single light source. The direction is expressed as a unit vector `(--lx, --ly)`.

| Token | Value | Role |
|-------|-------|------|
| `--lx` | `0.94` | Light X direction |
| `--ly` | `-0.34` | Light Y direction |
| `--light-x` | `92%` | Radial gradient X center |
| `--light-y` | `6%` | Radial gradient Y center |
| `--light-intensity` | `0.7` | Warm glow overlay strength |
| `--light-warm` | `255, 224, 168` | Warm light color (RGB triplet) |
| `--light-strength` | `1` | Shadow offset multiplier |

---

## Shadow System

Three shadow styles x three depth tiers. All offsets are computed from the light vector and `--depth-scale`.

### Neumorphic Shadow Color Tokens
| Token | Value | Role |
|-------|-------|------|
| `--neu-dark` | `rgba(105, 75, 40, 0.55)` | Dark shadow (away from light) |
| `--neu-light` | `rgba(255, 253, 245, 1.0)` | Light shadow (toward light) |
| `--neu-dark-soft` | `rgba(105, 75, 40, 0.32)` | Softer dark for larger offsets |
| `--neu-light-soft` | `rgba(255, 253, 245, 0.9)` | Softer light for larger offsets |

### Depth Scale
| Token | Value | Role |
|-------|-------|------|
| `--depth-scale` | `1` | Global multiplier |
| `--depth-polished` | `4` | Polished cards render deeper than global scale |

### Offset/Blur Tiers
| Tier | Offset var | Blur var | Default offset | Default blur |
|------|-----------|----------|----------------|--------------|
| crisp | `--d-crisp-o` | `--d-crisp-b` | `calc(5px * var(--depth-scale))` | `calc(13px * var(--depth-scale))` |
| medium | `--d-medium-o` | `--d-medium-b` | `calc(10px * var(--depth-scale))` | `calc(28px * var(--depth-scale))` |
| large | `--d-large-o` | `--d-large-b` | `calc(18px * var(--depth-scale))` | `calc(48px * var(--depth-scale))` |

### Shadow Style Rules

**RAISED** — bilateral neumorphic, extruded from surface. Dark shadow away from light, light shadow toward light.
- Tokens: `--sh-raised-crisp`, `--sh-raised-medium`, `--sh-raised-large`
- Background: `var(--surface)` for landing page consistency; CRM cards use `var(--card)` (white) for data readability

**INSET** — pressed into surface. Raised inverted (dark on near-light edge, light on far-light edge).
- Tokens: `--sh-inset-crisp`, `--sh-inset-medium`
- Background: `var(--bg)`
- Used for: inputs, pressed button states, recessed zones, nav tracks, inactive tiles

**POLISHED** — drop shadows away from light + sharp rim highlight on the lit edge. Reads deeper than RAISED. Multiplied by `--depth-polished`.
- Tokens: `--sh-polished-medium`, `--sh-polished-large`
- Backgrounds include layered radial gradients for surface sheen + bottom warmth
- Used for: hero panels, modals, premium cards

---

## Glass System

Frosted glass elements that sit above the neumorphic surface.

| Token | Value | Role |
|-------|-------|------|
| `--glass-bg` | `rgba(255, 250, 240, 0.55)` | Standard glass fill |
| `--glass-bg-strong` | `rgba(255, 250, 240, 0.75)` | Denser glass (nav, overlays) |
| `--glass-border` | `rgba(255, 255, 255, 0.6)` | Glass edge border |
| `--glass-edge` | `rgba(255, 255, 255, 0.85)` | Bright rim highlight |

**`.glass`**: `backdrop-filter: saturate(160%) blur(32px)` + border + directional rim highlight + drop shadow away from light.

**`.glass-strong`**: `backdrop-filter: saturate(170%) blur(28px)` + stronger fill + dual shadows (directional dark + warm glow).

---

## Typography

| Token | Stack | Role |
|-------|-------|------|
| `--serif` | `"Instrument Serif", "Newsreader", Georgia, serif` | Display headings, pull quotes |
| `--sans` | `"Manrope", ui-sans-serif, system-ui, sans-serif` | Body, UI, labels |
| `--mono` | `"Geist Mono", ui-monospace, monospace` | Eyebrows, code, data, UI chrome |

### Type Primitives
| Class | Style |
|-------|-------|
| `.eyebrow` | Mono, 11px, weight 500, letter-spacing 0.2em, uppercase, `--mute` |
| `.eyebrow-sm` | Mono, 10px, letter-spacing 0.18em |
| `.serif` | Serif font, weight 400, letter-spacing -0.012em, `zoom: 0.8` |
| `.italic` | `font-style: italic` |
| `.wine` | `color: var(--wine)` |
| `.mute` | `color: var(--mute)` |
| `.mute-2` | `color: var(--mute-2)` |

---

## Radius Scale

Six semantic tiers. Never use ad-hoc px radii — snap to the nearest tier.

| Token | Value | Use |
|-------|-------|-----|
| `--r-flush` | `6px` | Wells, tracks, inset-crisp surfaces, tiny glyph tiles |
| `--r-button` | `8px` | Buttons, segmented controls, small action chips |
| `--r-surface` | `11px` | List rows, message balloons, mono tiles, raised chips |
| `--r-card` | `16px` | Cards and panels that carry a header |
| `--r-panel` | `22px` | Hero bands, modals, largest floating surfaces |
| `--r-pill` | `999px` | Pills, toggles, circular icon buttons |

---

## Spacing Scale

8px base unit.

| Token | Value |
|-------|-------|
| `--space-xxs` | `4px` |
| `--space-xs` | `8px` |
| `--space-sm` | `12px` |
| `--space-md` | `16px` |
| `--space-lg` | `20px` |
| `--space-xl` | `24px` |
| `--space-xxl` | `32px` |
| `--space-section` | `80px` |

### Density Tokens
| Token | Value | Role |
|-------|-------|------|
| `--pad` | `28px` | Standard internal padding |
| `--pad-tight` | `18px` | Compact padding |
| `--gap` | `18px` | Standard flex/grid gap |

---

## Neumorphic Surface Classes

### Raised
| Class | Shadow | Border radius |
|-------|--------|---------------|
| `.neu-raised-crisp` | `--sh-raised-crisp` | `10px` |
| `.neu-raised`, `.neu-raised-medium` | `--sh-raised-medium` | `14px` |
| `.neu-raised-large` | `--sh-raised-large` | `18px` |

Background: `var(--card)` (white in CRM, `var(--surface)` on landing page).

### Inset
| Class | Shadow | Border radius |
|-------|--------|---------------|
| `.neu-inset-crisp` | `--sh-inset-crisp` | `8px` |
| `.neu-inset`, `.neu-inset-medium` | `--sh-inset-medium` | `12px` |

Background: `var(--bg)`.

### Polished
| Class | Shadow | Border radius |
|-------|--------|---------------|
| `.neu-polished` | `--sh-polished-medium` | `16px` |
| `.neu-polished-large` | `--sh-polished-large` | `20px` |

Background: layered radial gradients (light-side sheen + bottom warmth) over `var(--card-bright)`.

---

## Buttons

### `.btn-neu` — Base neumorphic button
- Surface background, raised-medium shadow
- Hover: raised-crisp + translateY(-1px)
- Active: inset-crisp + translateY(0)
- 14px/24px padding, border-radius 8px, uppercase sans 13px weight 600, letter-spacing 0.04em

### `.btn-wine` — Filled wine CTA
- `var(--wine-grad)`, paper text
- Same hover/active shadow transitions as btn-neu
- inset 0 1px 0 rgba(255,255,255,0.15) for inner highlight

### `.btn-ghost` — Transparent with line border
- No shadow, `var(--line)` border, glass-bg on hover
- 10px/16px padding, weight 500

---

## Compact Action Buttons — `.la-btn`

Small mono-uppercase actions used in toolbars, detail headers, send/handoff, FABs, and toggles.

**Base:** inline-flex, mono 9px weight 700, letter-spacing 0.12em, uppercase, 8px/14px padding, `--r-button` radius, `--ink-soft` color.

### Modifiers
| Class | Effect |
|-------|--------|
| `.la-btn--wine` | Wine gradient background, paper text, raised-crisp shadow |
| `.la-btn--soft` | Surface background, mute color, raised-crisp shadow; hover → wine |
| `.la-btn--inset` | bg background, mute color, inset-crisp shadow; hover → wine |
| `.la-btn--icon` | 32x32 square, no padding |
| `.la-btn--lg` | 11px font, 13px/22px padding |
| `.la-btn--pill` | `--r-pill` radius |

---

## Segmented Controls — `.la-seg`

Universal tab / view switcher: an inset track holding 2-4 toggle items.

**Track (`.la-seg`):** inline-flex, 3px gap, 3px padding, `--bg` background, `--sh-inset-crisp`, `--r-surface` radius.

**Button (`.la-seg-btn`):** mono 9px weight 400, letter-spacing 0.12em, uppercase, mute color, 7px/13px padding, `--r-button` radius. Hover → wine.

**Active (`.la-seg-btn.on`):** `--card` background, `--sh-raised-crisp`, wine color, weight 700.

### Modifiers
| Class | Effect |
|-------|--------|
| `.la-seg--pill` | Fully round track + items (`--r-pill`) |
| `.la-seg--fill` | Items stretch to equal width |

---

## Inputs

### `.neu-input`
- Background: `var(--bg)` (inset relative to surface)
- Shadow: `var(--sh-inset-crisp)` — visually recessed
- No border, 12px/16px padding, border-radius 6px (`--r-flush`)
- Placeholder: `var(--mute-2)`

---

## Background Lighting

The app shell (`.la-app`) uses two layered pseudo-elements:

- **`::before`**: Static warm radial gradients — bottom-left ambient warmth + center glow
- **`::after`**: Dynamic directional light ellipse centered at `(--light-x, --light-y)`, `mix-blend-mode: screen`, warm color scaled by `--light-intensity`

All content sits in `position: relative; z-index: 1` to render above the lighting.

---

## CRM-Specific Components

### Sidebar Navigation

**`.la-nav-item`**: flex row, 12px gap, 10px/14px padding, border-radius 10px, sans 14px weight 500, `--ink-soft`. Hover → `--wine-tint` background. Active → `--surface` background, `--sh-inset-crisp`, wine color weight 600.

**`.la-nav-section`**: mono 10px, letter-spacing 0.22em, uppercase, `--mute-2`, 18px/14px/8px padding.

### Account Switcher — `.la-switcher`
Top of nav rail. Flex row, space-between, 9px/12px padding, border-radius 10px, `--bg` background, `--sh-inset-crisp`. Mono 10px, letter-spacing 0.14em, uppercase, `--ink-soft`. Hover → wine.

### Utility Row — `.la-util-row`
Bottom of nav rail. Flex row, 5px gap, space-between.

**`.la-util-btn`**: flex 1, 32px height, border-radius 8px, `--bg` background, `--sh-inset-crisp`, mute color. Hover → wine.
**`.la-util-dot`**: 5px wine dot positioned top-right (notification indicator).

### Profile Card — `.la-profile`
Bottom of nav rail. Flex row, 10px gap, 9px/11px padding, border-radius 11px, `--surface` background, `--sh-raised-crisp`. Hover → translateY(-1px). Open → `--sh-inset-crisp`.

**`.la-profile-av`**: 32x32, border-radius 9px, warm brown gradient, paper serif 13px.

**`.la-profile-menu`**: Absolute above profile, `--card` background, `--r-surface` radius, `--sh-raised-large`, `--line` border, 6px padding, 1px gap, z-index 30.

**`.la-profile-menu-item`**: flex row, 10px gap, 9px/11px padding, border-radius 8px, sans 13px weight 500, `--ink-soft`. Hover → `--wine-tint`, wine color.

### Campaign List Card — `.la-camp-card`
16px/18px padding, border-radius 14px, transparent background, flex row, 14px gap, align center. Hover → `--wine-tint`. Active → `--card` background, `--sh-raised-crisp`, with 3px wine left bar indicator.

### Mono Tile — `.la-mono-tile`
44x44, border-radius 10px, `--card-bright` background, `--sh-raised-crisp`, flex center, serif 20px, letter-spacing -0.02em. Inactive variant: `--bg-2` background, `--sh-inset-crisp`, mute color. Wine variant: `--wine-grad` background, paper color.

### Status Pills — `.la-status`
Inline-flex, 6px gap, mono 10px, letter-spacing 0.16em, uppercase, 3px/9px padding, `--r-pill` radius, `--bg` background, `--sh-inset-crisp`, mute color.

| Modifier | Color |
|----------|-------|
| `.active-s` | `--good` |
| `.paused` | `--warn` |
| `.inactive` | `--mute-2` |

---

## Responsive Layout Shell

### Mobile Shell Tokens
| Token | Value | Role |
|-------|-------|------|
| `--bottombar-h` | `64px` | Bottom tab bar height |
| `--safe-top` | `env(safe-area-inset-top, 0px)` | Top safe area |
| `--safe-bottom` | `env(safe-area-inset-bottom, 0px)` | Bottom safe area |

### Breakpoints (reference only — CSS custom properties can't drive media queries)
| Token | Value | Behavior |
|-------|-------|----------|
| `--bp-phone` | `768px` | < 768 → mobile app (bottom tabs, sheets) |
| `--bp-tablet` | `1024px` | 768-1023 → sidebar + stacked detail |
| `--bp-desktop` | `1240px` | < 1240 → leads list collapses to icon rail |
| `--bp-wide` | `1680px` | >= 1680 → detail splits chat + summary columns |

---

## Dashboard "Now & Next" Layout (Version B)

### Hero Panel — `.bold-hero`
26px margin, border-radius 28px, `--line` border, overflow hidden. Background: directional warm radial gradients over `--paper`. `--sh-raised-large`.

### Metrics Row — `.bold-metrics-row`
Flex row, 24px gap, align stretch, wrap.

### Grid — `.bold-grid`
Flex row, 22px gap, 0 26px 30px padding, align start, wrap.
- `.bold-main`: flex 2 1 600px, column, 22px gap
- `.col-next`: flex 1 1 340px

### State Now — `.bold-state-now`
Flex row, 22px gap, align start, wrap.
- `.col-state`: flex 1 1 300px
- `.col-now`: flex 1 1 320px

### Wide (>= 2560px)
Grid gap 28px, max-width 3280px centered, 0 48px 40px padding.

---

## Animations

| Keyframe | Duration | Effect |
|----------|----------|--------|
| `la-pulse` | 2.4s ease-in-out infinite | Opacity 1 → 0.4 → 1 |

Class: `.la-pulse` applies this animation.

---

## Design Principles

1. **Single light source.** Every shadow, every highlight derives from the same `(--lx, --ly)` vector. Never mix shadow directions.
2. **Surface hierarchy through depth.** Raised = extruded. Inset = pressed. Polished = floating above. Never use arbitrary drop shadows.
3. **Warm neutrals only.** No cool grays. The neutral scale is desaturated warm — bone, parchment, bark.
4. **Wine is sparse.** One accent color. Use it for primary CTAs, selection states, and milestone indicators. Never for decorative purposes.
5. **White cards on warm ground.** CRM data density benefits from white (`#FFFFFF`) card surfaces. The warmth comes from the page ground and lighting, not from tinted cards.
6. **Eyebrows orient, serifs express, sans does the work.** Mono eyebrows label sections. Serif headings carry emotional weight. Sans handles all functional UI.
7. **Radius discipline.** Every corner snaps to one of the six `--r-*` tiers. No ad-hoc px values.
8. **Match the landing page.** Shared tokens (light, shadows, glass, colors) stay in sync with `client/public/premium/design-tokens.css`. CRM-only tokens extend, never override.
