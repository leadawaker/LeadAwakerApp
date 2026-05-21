# Legacy Landing Pages Backup

This folder contains backups of the original landing pages before the home page redesign (May 15, 2026).

## Files

- **home.tsx** — Original home page with all buttons, CTA functionality, AI demo
- **login.tsx** — Original login page
- **faq.tsx** — Original FAQ page
- **landing-pages-legacy-backup.zip** — Compressed backup of all three files

## How to Restore

If you need to revert to the old design:

```bash
# Option 1: Copy back to active pages (overwrites current)
cp legacy/home.tsx ../home.tsx
cp legacy/login.tsx ../login.tsx
cp legacy/faq.tsx ../faq.tsx

# Option 2: Reference specific functionality
# Open legacy/home.tsx and copy specific components/hooks you need
```

## What's New

The current `home.tsx`, `login.tsx`, and `faq.tsx` in the parent directory contain the redesigned versions targeting premium home improvement companies.

## Git History

All versions are also preserved in git history:
```bash
git log --oneline client/src/pages/home.tsx  # See all changes
git show <commit>:client/src/pages/home.tsx  # View specific version
```
