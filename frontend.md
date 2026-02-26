# Frontend Code Rules

> **For the complete design system (colors, tokens, sizing, components), see `UI_STANDARDS.md` in the project root.**
> This file covers coding workflow rules only.

## Always Do First
- **Invoke the `frontend-design` skill** before writing any frontend code, every session, no exceptions.
- **Read `UI_STANDARDS.md`** before making any color, spacing, or component decisions.

## Reference Images
- If a reference image is provided: match layout, spacing, typography, and color exactly. Swap in placeholder content (images via `https://placehold.co/`, generic copy). Do not improve or add to the design.
- If no reference image: design from scratch with high craft, following `UI_STANDARDS.md` rules.
- Screenshot your output, compare against reference, fix mismatches, re-screenshot. Do at least 2 comparison rounds.

## Local Server
- **Always serve on localhost** — never screenshot a `file:///` URL.
- Start the dev server: `node serve.mjs` (serves the project root at `http://localhost:3000`)

## Brand Assets
- Always check the `brand_assets/` folder before designing.
- If assets exist there, use them. Do not use placeholders where real assets are available.
- Do not invent brand colors — use the palette defined in `UI_STANDARDS.md` §2.

## Anti-Generic Guardrails
- **Colors:** Never use default Tailwind palette. Use CSS variable-based brand classes only.
- **Shadows:** Layered, low-opacity shadows. Never flat `shadow-md`.
- **Typography:** Outfit for headings, Inter for body. Never the same font for both.
- **Animations:** Only animate `transform` and `opacity`. Never `transition-all`.
- **Interactive states:** Every clickable element needs hover, focus-visible, and active states.
- **Depth:** Use the stone-gray surface hierarchy from `UI_STANDARDS.md` §2.3.

## Hard Rules
- Do not add sections, features, or content not in the reference
- Do not "improve" a reference design — match it
- Do not stop after one screenshot pass
- Do not use `transition-all`
- Do not use default Tailwind blue/indigo as primary color
- Do not use `#FFF375`, `#FFF6C8`, or `#5170FF` — these are banned (see `UI_STANDARDS.md` §9.2)
