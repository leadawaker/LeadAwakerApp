# Requirements: Language Toggle (i18n for CRM)

## Summary

Add a language toggle to the CRM application that allows users to switch between English, Dutch, and Portuguese. The marketing/landing pages already have full i18n support via i18next — this feature extends translation coverage to all post-login CRM pages and adds a visible language switcher in the UI.

## Why

- Dutch and Portuguese-speaking clients need to use the CRM in their native language
- The i18n infrastructure (i18next, react-i18next, language detector) is already installed and configured
- Marketing pages already support all 3 languages — the CRM pages are the gap

## Supported Languages

| Code | Language   | Flag |
|------|------------|------|
| en   | English    | GB   |
| pt   | Portuguese | BR   |
| nl   | Dutch      | NL   |

## Acceptance Criteria

1. A language toggle is accessible from the CRM Settings panel
2. Users can switch between English, Dutch, and Portuguese
3. Language preference persists across sessions (localStorage, key: `leadawaker_lang`)
4. All CRM page UI text is translatable (sidebar labels, page headers, buttons, form labels, table headers, empty states, tooltips, status badges)
5. Dynamic/database content (lead names, campaign names, message bodies) is NOT translated
6. The app does not reload when switching languages — React re-renders with new translations
7. Works in both agency and subaccount view modes
8. Dark mode compatibility maintained

## Scope

### In Scope
- Language toggle UI component in SettingsPanel
- CRM translation namespace files for all 3 languages (en, pt, nl)
- Wrapping all hardcoded CRM strings with `t()` calls
- Updating `i18n.ts` config to load CRM namespaces

### Out of Scope
- Backend/API changes (no server-side i18n)
- Translating user-generated content or database records
- Adding new languages beyond en/pt/nl
- Marketing page translations (already done)
- RTL language support

## Dependencies

- Existing: `i18next` v25.7.4, `react-i18next` v16.5.1, `i18next-browser-languagedetector` v8.2.0
- Existing: `client/src/i18n.ts` configuration
- Existing: `client/src/locales/{en,pt,nl}/` translation directories

## Related Features

- Dark mode toggle (Topbar) — similar UI pattern for settings-based toggle
- Settings panel (`SettingsPanel.tsx`) — where the language selector will live
