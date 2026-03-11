# Implementation Plan: Language Toggle (i18n for CRM)

## Overview

Extend the existing i18next setup to cover all CRM pages. Create translation namespace files for each CRM feature, wrap hardcoded strings with `t()`, add a language selector to the Settings panel, and update the i18n config to load CRM namespaces.

---

## Phase 1: i18n Config & Translation Files

Set up the CRM translation namespaces and update the i18n configuration.

### Tasks
- [ ] Update `client/src/i18n.ts` to register CRM namespaces and set `crm` as default namespace for post-login pages
- [ ] Create English CRM translation files (canonical/source of truth) [complex]
  - [ ] `locales/en/crm.json` — shared CRM strings (sidebar labels, common actions, status badges, empty states, confirmations)
  - [ ] `locales/en/leads.json` — leads page strings
  - [ ] `locales/en/campaigns.json` — campaigns page strings
  - [ ] `locales/en/conversations.json` — conversations/chat strings
  - [ ] `locales/en/billing.json` — billing/expenses/invoices strings
  - [ ] `locales/en/settings.json` — settings panel strings
  - [ ] `locales/en/accounts.json` — accounts page strings
  - [ ] `locales/en/tasks.json` — task manager strings
  - [ ] `locales/en/automations.json` — automation logs/pipeline strings
  - [ ] `locales/en/prompts.json` — prompt library strings
  - [ ] `locales/en/users.json` — user management strings
  - [ ] `locales/en/calendar.json` — calendar page strings
- [ ] Create Dutch (nl) CRM translation files — translate all keys from en [complex]
- [ ] Create Portuguese (pt) CRM translation files — translate all keys from en [complex]

### Technical Details

**i18n.ts changes:**
```typescript
// Add CRM namespaces to the resource loader
// Namespaces: crm, leads, campaigns, conversations, billing, settings, accounts, tasks, automations, prompts, users, calendar
// Set fallbackLng: 'en' (already set)
// Ensure interpolation.escapeValue: false (React handles XSS)
```

**Translation file structure example (`locales/en/crm.json`):**
```json
{
  "sidebar": {
    "campaigns": "Campaigns",
    "leads": "Leads",
    "chats": "Chats",
    "calendar": "Calendar",
    "billing": "Billing",
    "tasks": "Tasks",
    "automations": "Automations",
    "settings": "Settings",
    "docs": "Docs"
  },
  "actions": {
    "save": "Save",
    "cancel": "Cancel",
    "delete": "Delete",
    "edit": "Edit",
    "create": "Create",
    "search": "Search",
    "filter": "Filter",
    "export": "Export"
  },
  "status": {
    "active": "Active",
    "inactive": "Inactive",
    "pending": "Pending",
    "completed": "Completed"
  }
}
```

**Key files:**
- `client/src/i18n.ts` — config
- `client/src/locales/{en,pt,nl}/` — translation files

---

## Phase 2: Language Toggle UI

Add the language selector component to the Settings panel.

### Tasks
- [ ] Create `LanguageSelector` component with dropdown showing flag + language name
- [ ] Add "Language" section to `SettingsPanel.tsx` (above Notifications section)
- [ ] Wire language change to `i18next.changeLanguage()` and localStorage persistence
- [ ] Verify language switch works without page reload

### Technical Details

**Component location:** `client/src/components/crm/LanguageSelector.tsx`

**UI pattern:** Use `Select` from shadcn/ui (already available). Show flag emoji + language name:
- English
- Nederlands
- Portugues

**Settings panel integration** (`SettingsPanel.tsx`):
```tsx
// Add after the settings header, before Notifications
<div className="space-y-2">
  <Label>Language</Label>
  <LanguageSelector />
</div>
```

**Language switching logic:**
```tsx
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();

const changeLanguage = (lang: string) => {
  i18n.changeLanguage(lang);
  localStorage.setItem('leadawaker_lang', lang);
};
```

---

## Phase 3: Wrap CRM Strings with `t()` — Core Layout

Replace hardcoded strings in shared layout components.

### Tasks
- [ ] Wrap sidebar navigation labels in `RightSidebar.tsx` with `t('crm:sidebar.*')`
- [ ] Wrap topbar strings in `Topbar.tsx` with `t()`
- [ ] Wrap settings panel strings in `SettingsPanel.tsx` with `t('settings:*')`
- [ ] Wrap onboarding tutorial strings if present

### Technical Details

**Pattern for wrapping strings:**
```tsx
// Before:
<span>Campaigns</span>

// After:
import { useTranslation } from 'react-i18next';
const { t } = useTranslation('crm');
<span>{t('sidebar.campaigns')}</span>
```

**Key files:**
- `client/src/components/crm/RightSidebar.tsx` (~750 lines)
- `client/src/components/crm/Topbar.tsx`
- `client/src/components/crm/SettingsPanel.tsx` (~400 lines)
- `client/src/components/crm/CrmShell.tsx`

---

## Phase 4: Wrap CRM Strings — Feature Pages [complex]

Replace hardcoded strings across all CRM feature pages. Each sub-task can be done independently/in parallel.

### Tasks
- [ ] Wrap leads feature strings (`client/src/features/leads/`)
- [ ] Wrap campaigns feature strings (`client/src/features/campaigns/`)
- [ ] Wrap conversations feature strings (`client/src/features/conversations/`)
- [ ] Wrap billing feature strings (`client/src/features/billing/`)
- [ ] Wrap accounts feature strings (`client/src/features/accounts/`)
- [ ] Wrap tasks feature strings (`client/src/features/tasks/`)
- [ ] Wrap automations feature strings (`client/src/features/automations/`)
- [ ] Wrap prompts feature strings (`client/src/features/prompts/`)
- [ ] Wrap users feature strings (`client/src/features/users/`)
- [ ] Wrap calendar feature strings (`client/src/features/calendar/`)

### Technical Details

**Approach per feature:**
1. Read all `.tsx` files in the feature directory
2. Extract all user-visible strings (labels, headers, buttons, placeholders, tooltips, empty states)
3. Add keys to the feature's English translation file
4. Replace strings with `t('namespace:key')` calls
5. Add `useTranslation('namespace')` hook to each component

**What to translate:**
- Static UI text: headers, labels, buttons, placeholders, tooltips
- Status/badge labels (e.g., "Active", "Paused", "Delivered")
- Empty state messages
- Confirmation dialogs
- Error messages shown to users
- Table column headers

**What NOT to translate:**
- Database field values (lead names, campaign names, message content)
- API error messages from the server
- Technical identifiers, URLs
- Console logs

**Estimated string counts per feature:**
- Leads: ~390 strings
- Campaigns: ~210 strings
- Conversations: ~150 strings
- Billing: ~120 strings
- Settings: ~50 strings
- Others: ~30-80 strings each

---

## Phase 5: Verification & Polish

Final checks and cleanup.

### Tasks
- [ ] Run `npx tsc --noEmit` and fix any type errors
- [ ] Verify all 3 languages render correctly in the UI (spot-check key pages)
- [ ] Verify language persists across page refresh
- [ ] Verify language toggle works in both agency and subaccount modes
- [ ] Check that dark mode still works correctly with translated strings
- [ ] Verify no layout breakage from longer Dutch/Portuguese strings
