# Implementation Plan: Prospect to Account Conversion

## Overview

Add a "Convert to Account" button to the prospect detail sidebar that creates an Account + User from prospect data in one action. Three phases: backend endpoint, frontend modal, and i18n.

## Phase 1: Backend - Conversion Endpoint

Create a single transactional endpoint that creates Account + User + updates Prospect atomically.

### Tasks
- [ ] Add POST `/api/prospects/:id/convert` endpoint in `server/routes.ts`
- [ ] Add `convertProspectToAccount` method in `server/storage.ts` that:
  - Creates Account from prospect fields
  - Creates User (role=Manager) from prospect contact fields, linked to new Account
  - Updates prospect: status="Converted", Accounts_id=new account ID
  - Returns { account, user, prospect } on success
- [ ] Wrap all three operations in a database transaction (rollback on failure)

### Technical Details

**Endpoint location:** `server/routes.ts` after the existing prospect PATCH endpoint

**Storage method:** `server/storage.ts` - add after `updateProspect`

**Field mapping (server-side):**
```typescript
// Account
const accountData = {
  name: prospect.company,
  businessNiche: prospect.niche,
  website: prospect.website,
  phone: prospect.phone,
  ownerEmail: prospect.email,
  businessDescription: [prospect.ai_summary, prospect.notes].filter(Boolean).join('\n\n'),
  logoUrl: prospect.photo_url,
  status: "Trial",
  type: "Client",
  timezone: "Europe/Amsterdam",
};

// User
const userData = {
  fullName1: prospect.contact_name,
  email: prospect.contact_email,
  phone: prospect.contact_phone,
  role: "Manager",
  status: "Active",
  accountsId: newAccount.id,
};
```

**Transaction:** Use Drizzle's `db.transaction()`:
```typescript
const result = await db.transaction(async (tx) => {
  const [account] = await tx.insert(accounts).values(accountData).returning();
  const [user] = await tx.insert(users).values({ ...userData, accountsId: account.id }).returning();
  const [updated] = await tx.update(prospects)
    .set({ status: "Converted", accountsId: account.id })
    .where(eq(prospects.id, prospectId))
    .returning();
  return { account, user, prospect: updated };
});
```

**Validation:** Check prospect exists and is not already converted (Accounts_id is null) before proceeding. Return 409 Conflict if already converted.

## Phase 2: Frontend - Convert Button + Confirmation Modal

### Tasks
- [ ] Add "Convert to Account" button to `ProspectDetailView.tsx` action bar
- [ ] Build `ConvertToAccountModal.tsx` in `client/src/features/prospects/components/`
  - Pre-filled editable form with Account fields and User fields
  - Two sections: "Account" and "Primary User"
  - Submit calls POST `/api/prospects/:id/convert`
  - On success: invalidate queries, show toast, close modal
- [ ] Add disabled state + tooltip when prospect already has Accounts_id
- [ ] Add link to account in sidebar when prospect is converted (shows account name, clickable)

### Technical Details

**Button placement:** In ProspectDetailView.tsx, in the action bar area near the edit/delete buttons. Use the Building2 icon.

**Button states:**
- Normal: `Building2` icon + "Convert to Account" label
- Disabled: when `prospect.Accounts_id` is set, tooltip "Already converted"
- Loading: spinner during API call

**Modal structure:**
```tsx
<Dialog>
  <DialogHeader>Convert to Account</DialogHeader>
  <DialogContent>
    {/* Section 1: Account */}
    <SectionHeader label="Account" />
    <EditText label="Company Name" value={company} />
    <EditText label="Website" value={website} />
    <EditText label="Niche" value={niche} />
    <EditText label="Phone" value={phone} />
    <EditText label="Email" value={email} />
    <EditTextarea label="Description" value={description} />

    {/* Section 2: Primary User */}
    <SectionHeader label="Primary User" />
    <EditText label="Full Name" value={contactName} />
    <EditText label="Email" value={contactEmail} />
    <EditText label="Phone" value={contactPhone} />
    <span>Role: Manager</span>

    <DialogFooter>
      <Button variant="outline" onClick={onCancel}>Cancel</Button>
      <Button onClick={onConfirm}>Create Account</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

**API call:**
```typescript
const res = await apiFetch(`/api/prospects/${prospect.id}/convert`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ account: accountFields, user: userFields }),
});
```

**Query invalidation:** Invalidate both `prospects` and `accounts` queries on success.

## Phase 3: i18n

### Tasks
- [ ] Add conversion-related keys to `client/src/locales/en/prospects.json`
- [ ] Add matching keys to `client/src/locales/nl/prospects.json`
- [ ] Add matching keys to `client/src/locales/pt/prospects.json`

### Technical Details

**Keys to add (in prospects namespace):**
```json
{
  "convert": {
    "button": "Convert to Account",
    "alreadyConverted": "Already converted",
    "modalTitle": "Convert Prospect to Account",
    "accountSection": "Account Details",
    "userSection": "Primary User",
    "companyName": "Company Name",
    "description": "Description",
    "fullName": "Full Name",
    "roleNote": "Role: Manager (account owner)",
    "confirm": "Create Account",
    "cancel": "Cancel",
    "success": "Account created successfully",
    "error": "Failed to create account",
    "conflict": "This prospect has already been converted",
    "viewAccount": "View Account"
  }
}
```
