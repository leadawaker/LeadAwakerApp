# Lead Awaker — Premium Design System

## Overview

Warm-bone neumorphic design system. The aesthetic is tactile and material: surfaces appear extruded from or pressed into a warm parchment ground. A directional light source (top-right by default) drives all shadows. A single deep wine accent punctuates the neutral palette. Typography mixes a serif display face with a humanist sans.

---

## Color Palette

### Backgrounds & Surfaces
| Token | Value | Role |
|-------|-------|------|
| `--bg` | `#ECE6DA` | Page background |
| `--bg-2` | `#E5DECF` | Secondary background, subtle zones |
| `--paper` | `#F4EFE3` | Elevated paper / modal backgrounds |
| `--surface` | `#EDE7DB` | Card surface (midpoint between bg and paper) |

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

### Accent — Wine
| Token | Value | Role |
|-------|-------|------|
| `--wine` | `#5E2230` | Primary accent — CTA buttons, highlights, selection |
| `--wine-soft` | `#7A2E3E` | Hover state for wine elements |
| `--wine-tint` | `rgba(94, 34, 48, 0.08)` | Subtle wine-tinted backgrounds |
| `--wine-glow` | `rgba(94, 34, 48, 0.18)` | Wine shadow / ambient glow |

---

## Directional Light System

All shadows are computed from a single light source. The direction is expressed as a unit vector `(--lx, --ly)` derived from a light angle in degrees.

| Token | Default | Role |
|-------|---------|------|
| `--lx` | `0.94` | Light X direction (cos of angle) |
| `--ly` | `-0.34` | Light Y direction (-sin of angle) |
| `--light-x` | `92%` | Radial gradient X center |
| `--light-y` | `6%` | Radial gradient Y center |
| `--light-intensity` | `0.7` | Warm glow overlay strength |
| `--light-warm` | `255, 224, 168` | Warm light color (RGB triplet) |
| `--light-strength` | `1` | Shadow offset multiplier (0.35–1.85 based on distance) |

Default angle: 65°. All shadow tokens reference `--lx`, `--ly`, `--light-strength` via `calc()` so they respond live when the Tweaks panel adjusts the light.

---

## Shadow System

Three shadow styles × three depth tiers. All offsets are computed from the light vector and `--depth-scale`.

### Depth Scale
| Token | Default | Role |
|-------|---------|------|
| `--depth-scale` | `1` | Global multiplier — Tweaks slider scales all tiers |
| `--depth-polished` | `4` | Polished cards render 4× deeper than global scale |

### Offset/Blur Tiers
| Tier | Offset var | Blur var | Default offset | Default blur |
|------|-----------|----------|----------------|--------------|
| crisp | `--d-crisp-o` | `--d-crisp-b` | 5px | 13px |
| medium | `--d-medium-o` | `--d-medium-b` | 10px | 28px |
| large | `--d-large-o` | `--d-large-b` | 18px | 48px |

### Shadow Style Rules

**RAISED** — bilateral neumorphic, extruded from surface. Dark shadow away from light, light shadow toward light.
- Classes: `.neu-raised-crisp`, `.neu-raised`, `.neu-raised-large`
- Tokens: `--sh-raised-crisp`, `--sh-raised-medium`, `--sh-raised-large`
- Background: `var(--surface)`

**INSET** — pressed into surface. Raised inverted (dark on near-light edge, light on far-light edge).
- Classes: `.neu-inset-crisp`, `.neu-inset`, `.neu-inset-large`
- Tokens: `--sh-inset-crisp`, `--sh-inset-medium`, `--sh-inset-large`
- Background: `var(--surface)`
- Used for: inputs, pressed button state, recessed zones

**POLISHED** — drop shadows away from light + sharp rim highlight on the lit edge. Reads deeper than RAISED. Multiplied by `--depth-polished`.
- Classes: `.neu-polished-crisp`, `.neu-polished`, `.neu-polished-large`
- Tokens: `--sh-polished-crisp`, `--sh-polished-medium`, `--sh-polished-large`
- Backgrounds include layered radial gradients for surface sheen + bottom warmth
- `neu-polished-large` also uses `backdrop-filter: blur(28px) saturate(1.2)` for glass-like depth

---

## Glass System

Frosted glass elements that sit above the neumorphic surface.

| Token | Value | Role |
|-------|-------|------|
| `--glass-bg` | `rgba(255, 250, 240, 0.55)` | Standard glass fill |
| `--glass-bg-strong` | `rgba(255, 250, 240, 0.75)` | Denser glass (nav, overlays) |
| `--glass-border` | `rgba(255, 255, 255, 0.6)` | Glass edge border |
| `--glass-edge` | `rgba(255, 255, 255, 0.85)` | Bright rim highlight (inset 1px, light-side) |

**`.glass`**: `backdrop-filter: saturate(160%) blur(22px)` + border + directional rim highlight + drop shadow away from light.

**`.glass-strong`**: Same but `blur(28px)`, stronger fill, dual shadows (directional dark + light warm glow).

---

## Typography

| Token | Stack | Role |
|-------|-------|------|
| `--serif` | `"Instrument Serif", "Newsreader", Georgia, serif` | Display headings, pull quotes |
| `--sans` | `"Manrope", ui-sans-serif, system-ui, sans-serif` | Body, UI, labels |
| `--mono` | `"Geist Mono", ui-monospace, monospace` | Eyebrows, code, data |

Display font is runtime-swappable via `applyFonts()`. Available options: Instrument Serif, Newsreader, EB Garamond, Playfair Display, Bodoni Moda, Lora, Cormorant Garamond.

### Type Primitives (CSS classes)
| Class | Style |
|-------|-------|
| `.eyebrow` | Mono, 11px, weight 500, letter-spacing 0.2em, uppercase, `--mute` |
| `.serif` | Serif font, weight 400, letter-spacing -0.012em |
| `.italic` | `font-style: italic` |
| `.wine` | `color: var(--wine)` |

---

## Buttons

**`.btn-neu`** — base neumorphic button
- Surface background, raised-medium shadow
- Hover: raised-crisp + translateY(-1px)
- Active: inset-crisp + translateY(0)
- 16px/28px padding, border-radius 8px, uppercase sans 13px weight 600, letter-spacing 0.04em

**`.btn-wine`** — filled wine CTA
- `linear-gradient(145deg, #6E2638, #4B1A26)`, paper text
- Same hover/active shadow transitions as btn-neu

**`.btn-ghost`** — transparent with line border
- No shadow, `var(--line)` border, glass-bg on hover

---

## Inputs

**`.neu-input`**
- Background: `var(--bg)` (inset relative to surface)
- Shadow: `var(--sh-inset-crisp)` — visually recessed
- No border, 14px/18px padding, border-radius 6px
- Placeholder: `var(--mute-2)`

---

## Textures

Optional overlay textures. Applied as `::before` pseudo-elements. All require `isolation: isolate` on the host.

| Class | Asset | Opacity | Blend |
|-------|-------|---------|-------|
| `.tex-wood` | `/premium/assets/texture-wood.jpg` | 0.55 | overlay |
| `.tex-stone` | `/premium/assets/texture-stone.jpg` | 0.22 | multiply |
| `.tex-rock` | `/premium/assets/texture-rock.jpg` | 0.35 | multiply |

Child elements need `position: relative; z-index: 1` to sit above the texture.

---

## Utility Classes

| Class | Effect |
|-------|--------|
| `.neu-pill` | `border-radius: 999px` |
| `.row` | `display: flex; align-items: center` |
| `.rule` | 1px horizontal divider using `var(--line)` |
| `.floaty` | Gentle float animation (7s, ±6px Y) |
| `.invisible-plate` | Replicates the page background gradient as a solid element (for screenshot/export use) |

---

## Background Lighting

The page background uses two layered effects on `body::before` and `body::after`:

- **`body::before`**: Static warm radial gradients — bottom-left ambient warmth + center glow
- **`body::after`**: Dynamic directional light ellipse centered at `(--light-x, --light-y)`, `mix-blend-mode: screen`, warm color `rgba(255, 224, 168, …)` scaled by `--light-intensity`

Result: a surface that appears lit from a specific direction, with warm pooling and soft ambient fill.

---

## Logo Component

Two variants: `horizontal` (wordmark) and `mark` (monogram square).

**Horizontal**: "LEAD" in Yeseva One serif + "Awaker" in Manrope weight 400, with a small wine dot accent after the wordmark.

**Mark**: Square container (border-radius 6), dark background, "A" in Yeseva One at 60% of container size.

`invert` prop swaps ink to `--paper` and wine dot to a lightened rose (`#D9A3B0`) for use on dark backgrounds.

---

## Design Principles

1. **Single light source.** Every shadow, every highlight derives from the same `(--lx, --ly)` vector. Never mix shadow directions.
2. **Surface hierarchy through depth.** Raised = extruded. Inset = pressed. Polished = floating above. Never use arbitrary drop shadows.
3. **Warm neutrals only.** No cool grays. The neutral scale is desaturated warm — bone, parchment, bark.
4. **Wine is sparse.** One accent color. Use it for primary CTAs, selection states, and milestone indicators. Never for decorative purposes.
5. **Texture is optional.** Textures add tactility but must not compete with the typography. Kept at low opacity, multiply/overlay blend.
6. **Eyebrows orient, serifs express.** Mono eyebrows label sections. Serif headings carry emotional weight. Sans does the functional work.
