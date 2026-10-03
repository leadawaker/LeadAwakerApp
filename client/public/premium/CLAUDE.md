# Landing Page (leadawaker.com)

The public-facing landing page is a **static HTML/JSX site**, separate from the CRM app.

- All files live in `client/public/premium/`. See `client/public/premium/FILE_MAP.md` for a full index.
- Legacy pages (`client/src/legacy/`, served only at `/legacy`) are retired backups: do not edit unless explicitly asked.
- The page uses its own design system (CSS variables, neumorphic tokens, Google Fonts). `UI_STANDARDS.md` does not apply here.
- Design tweaks (typography, light, depth, textures) are controlled via `config.jsx` + `app-main.jsx`.
