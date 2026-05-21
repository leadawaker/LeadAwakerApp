# Premium Landing Page — File Map

Quick reference for where things live in `/client/public/premium/`.

## Core Files

| File | Purpose | Key Lines |
|------|---------|-----------|
| **index.html** | Root HTML, styles, font imports | 9: Google Fonts import; 10-370: CSS variables & design tokens |
| **translations.jsx** | All UI strings for EN and NL (i18n) | `window.TRANSLATIONS = { en: {...}, nl: {} }` |
| **config.jsx** | Design tweaks, palettes, utilities, i18n system | 20-30: TWEAK_DEFAULTS; 64-71: applyFonts(); end: I18nProvider + useI18n |
| **app-main.jsx** | App orchestration, tweaks panel UI | 93-148: TweaksPanel with all controls |

## Section Components

| File | Section | Lines |
|------|---------|-------|
| **hero.jsx** | Hero + conversation demo + testimonial | Full file |
| **sections1.jsx** | Trust Strip, Approach, Process (3 cards) | Full file |
| **sections2.jsx** | About (team), FAQ, Work section | Full file |
| **demo.jsx** | Demo form + WhatsApp preview chat | Full file |
| **audit.jsx** | Audit/results section | Check for inclusion |
| **cta-footer.jsx** | Call-to-action footer | Check for inclusion |

## Styling & Design System

| Item | Location | Details |
|------|----------|---------|
| **Color variables** | index.html:11-28 | --bg, --ink, --wine, --line, --paper, etc. |
| **Typography** | index.html:41-43 | --serif, --sans, --mono CSS variables |
| **Neumorphic shadows** | index.html:71-94 | --sh-raised-*, --sh-inset-*, --sh-floating-* |
| **Depth system** | index.html:59-69 | --depth-scale multiplier + tiers |
| **Light direction** | index.html:45-57 | --lx, --ly, --light-x, --light-y |

## Tweakable Settings (in TweaksPanel)

| Setting | Default | Control | Config Location |
|---------|---------|---------|-----------------|
| **Typography (Display)** | Instrument Serif | TweakRadio (7 options) | app-main.jsx:132-136 |
| **Light Angle** | 20° | Slider 0-360° | app-main.jsx:95-100 |
| **Light Distance** | 100 | Slider 0-100 | app-main.jsx:102-106 |
| **Light Intensity** | 100 | Slider 0-100 | app-main.jsx:108-112 |
| **Depth Scale** | 1 | Slider 0.4-1.8× | app-main.jsx:117-122 |
| **Textures** | true | Toggle | app-main.jsx:124-127 |
| **Logo Variant** | horizontal | TweakRadio | app-main.jsx:141-145 |

## Design Patterns

| Pattern | Example File | Lines |
|---------|--------------|-------|
| **Neumorphic cards** | sections1.jsx | 153-207 (Process cards) |
| **Gradient backgrounds** | hero.jsx | Search for "linear-gradient" |
| **Responsive grid layouts** | sections2.jsx | Search for "gridTemplateColumns" |
| **Chat bubble mockup** | demo.jsx | Full file |
| **Expandable FAQ rows** | sections2.jsx | 143-174 (FAQRow component) |

## Common Edits

**Change hero spacing/alignment?** → [hero.jsx:54-99](hero.jsx#L54-L99)
**Modify process card colors?** → [sections1.jsx:153-207](sections1.jsx#L153-L207)
**Update typography options?** → [config.jsx:64-71](config.jsx#L64-L71), [app-main.jsx:132-136](app-main.jsx#L132-L136)
**Add new color/shadow tokens?** → [index.html:11-94](index.html#L11-L94)
**Edit chat case data?** → [config.jsx:92-289](config.jsx#L92-L289)

## Auto-reload Watch Files

The page watches these files for changes and auto-reloads (index.html:392):
- app-main.jsx, config.jsx, hero.jsx, sections1.jsx, sections2.jsx, audit.jsx, demo.jsx, cta-footer.jsx
