# Permissions Model

LeadAwaker has a 5-tier role system. Higher tiers are strict supersets of
lower tiers on the client; on the server, permission helpers in
`server/permissions.ts` make the rules explicit.

## Roles

| Role     | Notes |
|----------|-------|
| Owner    | Gabriel (+ any future co-owner). Top-tier. No guardrails. |
| Admin    | Trusted operator (Finn). Day-to-day power, no destructive or financial access. |
| Operator | Legacy alias of Admin. Same permissions; not surfaced in UI. |
| Manager  | Client-side manager. Read+write on own account. |
| Agent    | Legacy alias of Manager. Not surfaced in UI. |
| Viewer   | Read-only. |

## Permission matrix

| Action | Owner | Admin | Manager | Viewer |
| --- | :-: | :-: | :-: | :-: |
| Expenses page | ✓ | — | — | — |
| Billing page (invoices + contracts) | ✓ | ✓ | — | — |
| Invite / remove users | ✓ | ✓ (cannot touch Owner accounts) | — | — |
| Settings: own AI keys | ✓ | ✓ | — | — |
| Settings: system-default AI keys | ✓ | — | — | — |
| Delete campaigns / leads / prospects | ✓ (hard) | ✓ (soft-archive: `status='Archived'`) | — | — |
| Delete accounts | ✓ | — | — | — |
| Hard purge from Archived view | ✓ | — | — | — |
| Lead Awaker AI button | ✓ (DB read+write) | ✓ (DB read-only, own key) | — | — |
| Tom support | ✓ | ✓ | ✓ | ✓ |
| View-as impersonation | ✓ | — | — | — |
| Demo VIP slash commands | ✓ | ✓ | — | — |

## DELETE semantics

`DELETE /api/campaigns/:id`, `/api/leads/:id`, `/api/prospects/:id` behave
based on caller:

- **Internal API key (`x-internal-key`)** → hard delete. Python automations
  rely on this; do not change.
- **Owner** → hard delete (campaigns also cascade-delete their prompts).
- **Admin / Operator / anyone else** → soft archive (`status='Archived'`).
  No prompt cascade for campaigns.

To hard-purge an already-archived row, Owner calls
`POST /api/<entity>/:id/purge` (Owner-only, no internal-key bypass).

## Server-side helpers (`server/permissions.ts`)

- `isOwner(user)` / `isAdmin(user)` / `isAgencyUser(user)`
- `canDeleteHard(user)` — Owner only.
- `canManageUser(actor, target)` — Admin cannot manage Owner; Owner can manage anyone.
- `canSeeExpenses(user)` — Owner only. *(Page wiring is TODO — Expenses page does not exist yet.)*
- `canSeeBilling(user)` — Owner + Admin.
- `canEditSystemAiKeys(user)` — Owner only. *(UI wiring is TODO — settings UI does not yet split own vs system keys.)*
- `canImpersonate(user)` — Owner only. *(Route wiring is TODO — `POST /api/auth/impersonate` does not exist yet.)*
- `canUseLeadAwakerAi(user)` — Owner + Admin.
- `canUseDemoVipCommands(user)` — Owner + Admin.

## Middleware (`server/auth.ts`)

- `requireAuth` — any logged-in user or valid internal key.
- `requireAgency` — Owner, Admin, Operator, or anyone on `accountsId === 1`.
  Internal key bypass is honored.
- `requireAdminOrOwner` — Owner / Admin / Operator. Internal key bypass honored.
- `requireOwner` — Owner only. **No internal-key bypass.**

## Client-side helpers (`client/src/hooks/useWorkspace.ts`)

`useWorkspace()` returns:

- `isOwner` / `isAdmin` / `isAgencyUser`
- `canInviteUsers` / `canHardDelete` / `canSeeExpenses` / `canSeeSystemAiKeys`

Role is read from `localStorage["leadawaker_user_role"]`, populated on login
from `/api/auth/me`. (Reworking that to read role from a fresh `/api/me` on
every render is intentionally out-of-scope.)

## Delete button labels (`useDeleteAction`)

`client/src/hooks/useDeleteAction.ts` returns a `{ label, confirmCopy, isHardDelete }`
tuple. Owner sees "Delete" + permanent-deletion confirm copy; everyone else
sees "Archive" + restorable-archive confirm copy. The DELETE request hits
the same endpoint regardless — the **server** decides behavior. Wired into:

- `CampaignListView.tsx`
- `LeadsTable.tsx`, `LeadCard.tsx`, `LeadListCard.tsx`, `LeadsCardViewMain.tsx`, `ContactWidget.tsx`
- `ProspectsPage.tsx`, `ProspectDetailView.tsx`

## Migration

To promote Gabriel to Owner:

```bash
sudo -u postgres psql -d nocodb -f /home/gabriel/LeadAwakerApp/scripts/migrate-owner-role.sql
```

The migration is idempotent — rerunning it just bumps `updated_at`.

## Known TODOs

- Expenses page does not exist. `canSeeExpenses` helper is ready to consume when it lands.
- Settings UI does not separate own AI keys vs system-default AI keys. `canEditSystemAiKeys` helper is ready.
- View-as impersonation route does not exist. `canImpersonate` helper is ready.
- `ALL_PAGES` in `useWorkspace.ts` now includes `billing` but **not** `expenses` (since the page is not built yet). Add `expenses` to `ALL_PAGES` when the page lands, gated by `canSeeExpenses`.
- Frontend Settings > Team UI does not surface an "Owner" option in the role dropdown. Promotion to Owner is SQL-only for now. PATCH `/api/users/:id` rejects role='Owner' from non-Owner actors.
