# Legacy Folder File Map

Quick navigation for the legacy marketing site and pages.

## Root Level
| File | Purpose |
|------|---------|
| `LegacyRoute.tsx` | Route wrapper for legacy pages |
| `i18n.ts` | i18n configuration for legacy locale files |

## Pages
| File | Purpose |
|------|---------|
| `pages/Home.tsx` | Main marketing/landing page |
| `pages/Login.tsx` | Login page |
| `pages/Faq.tsx` | FAQ page |

## Components
Organized by section number (used in Home.tsx):

| Component | Purpose |
|-----------|---------|
| `components/01-Chat3D.tsx` | 3D chat animation hero section |
| `components/02-StepsSection.tsx` | 4-step process walkthrough |
| `components/03-PipelineChartSection.tsx` | Pipeline visualization demo |
| `components/04-Counters.tsx` | Metrics/stats counter section |
| `components/05-Calculator.tsx` | ROI calculator (wrapper) |
| `components/05-calculator/CalculatorHero.tsx` | Calculator heading & inputs |
| `components/05-calculator/CalculatorSliders.tsx` | Slider controls |
| `components/05-calculator/CalculatorChart.tsx` | Results chart |
| `components/05-calculator/CalculatorAdvanced.tsx` | Advanced settings panel |
| `components/05-calculator/useCalculator.ts` | Calculator logic hook |
| `components/06-DemoSection.tsx` | Live demo section |
| `components/07-WorkflowSection.tsx` | Workflow features showcase |
| `components/08-AboutSection.tsx` | About / company info section |
| `components/09-LeadReactivationAnimation.tsx` | Animated explainer video/graphic |
| `components/StepCarousel.tsx` | Carousel component for steps |
| `components/Meteor.tsx` | Animated meteor effect |

## UI Components
Primitive reusable components:

| File | Purpose |
|------|---------|
| `components/ui/badge.tsx` | Badge/tag component |
| `components/ui/button.tsx` | Button component |
| `components/ui/card.tsx` | Card/box container |
| `components/ui/input.tsx` | Text input field |
| `components/ui/background-paths.tsx` | SVG background patterns |
| `components/ui/dotted-surface.tsx` | Dotted texture background |
| `components/ui/falling-pattern.tsx` | Falling particle animation |

## Hooks
| File | Purpose |
|------|---------|
| `hooks/useCarouselScrollLock.ts` | Prevent page scroll during carousel interaction |
| `hooks/useCountry.ts` | Detect/get user country |
| `hooks/useCurrency.ts` | Get currency based on country |
| `components/useCarouselScrollLock.ts` | **Duplicate** of hooks version (consider removing) |

## Utilities
| File | Purpose |
|------|---------|
| `lib/apiUtils.ts` | API request helpers |
| `lib/seo.tsx` | Meta tags / SEO component |
| `lib/utils.ts` | General utility functions |

## Styling
| File | Purpose |
|------|---------|
| `styles/theme.css` | Global theme, colors, typography |

## i18n Translations
Organized by locale (en / nl / pt):

**Translation files (same structure in en/, nl/, pt/):**
- `common.ts` | Shared strings across pages |
- `home.ts` | Home page strings |
- `services.ts` | Service descriptions |
- `01-chat3d.ts` | Chat3D section copy |
- `02-steps.ts` | Steps section copy |
- `03-pipeline.ts` | Pipeline section copy |
- `07-workflow.ts` | Workflow section copy |
- `08-about.ts` | About section copy |

## Notes
- Legacy pages are **read-only backups** — do not edit unless explicitly asked
- This folder uses its own design system (theme.css) — not the main CRM `UI_STANDARDS.md`
- i18n setup: See `i18n.ts` for namespace config; always add user-facing strings to locale files
- Duplicate hook: `components/useCarouselScrollLock.ts` mirrors `hooks/useCarouselScrollLock.ts` — consolidate if editing