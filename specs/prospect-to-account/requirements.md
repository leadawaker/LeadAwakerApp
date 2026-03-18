# Requirements: Prospect to Account Conversion

## What It Does

One-click conversion of a qualified prospect into a full Account + Manager User, pre-filled with data already captured during prospecting. Eliminates the manual step of re-entering company info, contact details, and deal context when a prospect signs on.

## Why

Every prospect that converts requires manually creating an Account, then a User, then copying over company name, website, niche, contact info, notes, and AI summary. This is error-prone and slow. The prospect record already holds all the data needed to bootstrap both records.

## User Flow

1. User opens a prospect detail sidebar (status = "qualified" or any non-converted status)
2. Clicks a "Convert to Account" button in the action bar
3. A confirmation modal appears, showing:
   - Pre-filled Account fields (mapped from prospect)
   - Pre-filled User fields (mapped from prospect contact)
   - Role defaulting to "Manager"
   - Option to adjust any field before confirming
4. On confirm:
   - Account is created via POST /api/accounts
   - User is created via POST /api/users (linked to new Account)
   - Prospect status is updated to "Converted"
   - Prospect's `Accounts_id` is set to the new account ID
   - Toast confirmation shown
   - Sidebar refreshes to show "Converted" status with link to account
5. If prospect already has `Accounts_id` set (already converted), the button is disabled with "Already converted" tooltip

## Field Mapping

### Prospect -> Account

| Prospect Field | Account Field |
|---|---|
| company | name |
| niche | business_niche |
| website | website |
| phone | phone |
| email | owner_email |
| notes + ai_summary | business_description |
| photo_url | logo_url |
| country | (store in notes or address if available) |

### Prospect -> User (Manager)

| Prospect Field | User Field |
|---|---|
| contact_name | full_name_1 |
| contact_email | email |
| contact_phone | phone |
| contact_role | (display only, role = "Manager") |
| photo_url | avatar_url |

## Acceptance Criteria

- [ ] "Convert to Account" button visible on prospect detail sidebar for non-converted prospects
- [ ] Button disabled with tooltip when prospect is already converted (has Accounts_id)
- [ ] Confirmation modal shows all pre-filled fields, all editable before confirm
- [ ] Account created with correct field mapping
- [ ] User created with role "Manager" and linked to new account (Accounts_id)
- [ ] Prospect status updated to "Converted" and Accounts_id set
- [ ] Toast notification on success
- [ ] Error handling: show toast on failure, don't leave partial state
- [ ] All user-facing strings go through i18n (en, nl, pt)

## Dependencies

- Existing: POST /api/accounts endpoint (server/routes.ts:287)
- Existing: POST /api/users endpoint (needs verification)
- Existing: PATCH /api/prospects/:id endpoint
- Existing: ProspectDetailView.tsx sidebar component
