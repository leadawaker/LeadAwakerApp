# Booking Availability Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let Gabriel set, per client account, when the AI is allowed to offer a booking slot (minimum notice hours), how long calls default to, and which days/hours the client is open — surfaced as a new "Availability" step in the client onboarding wizard (`ProfileWizard.tsx`), replacing today's hardcoded "always starts tomorrow, Mon–Fri only" behavior.

**Architecture:** Four account-level fields (`minBookingNoticeHours`, `defaultCallDurationMinutes`, `openDays`, plus reuse of existing `businessHoursStart`/`businessHoursEnd`) are added to `accounts` and edited via a new `AvailabilityCard` component in the wizard, autosaving through the existing `PATCH /api/accounts/:id` route (already accepts any `accounts` column via drizzle-zod). `businessHoursStart`/`End`/`openDays` changes trigger the existing `resyncCaldiySchedule` pipeline, which now also pushes weekday selection into the separate `~/caldiy` repo. The Python automation engine reads `minBookingNoticeHours` to compute the initial booking-offer window instead of a hardcoded `+1 day`. `accounts.timezone` gets a `Europe/Amsterdam` default to close a silent-fallback gap (all clients are NL-based).

**Tech Stack:** Express + Drizzle ORM + PostgreSQL (LeadAwakerApp), React + TypeScript wizard component, Python automation engine (`~/automations`), separate cal.diy/cal.com fork (`~/caldiy`, Prisma + ts-node scripts).

## Global Constraints

- No hardcoded user-facing strings — every new label goes through i18n (`en`/`nl` only, no `pt` — dropped project-wide 2026-06-30).
- Never send ISO date strings from client for timestamp columns — not applicable here (no new timestamp columns), but the account PATCH flow must stay consistent with existing behavior.
- Never run `npm run dev` — app runs via pm2 with tsx watch; server files auto-reload in ~5-8s, no restart needed unless `ecosystem.config.cjs` changes.
- Never run `npx tsc --noEmit` unless Gabriel explicitly asks.
- `npm run db:push` fails (no TTY on the Pi) — schema changes must be applied via a direct `pg` script run with `node --env-file=.env`.
- Follow `UI_STANDARDS.md` / existing component patterns exactly — this wizard already has a fixed visual language (`IntegSection`, `SectionHead`, `IconTile`, `.neu-input`, `var(--wine)` etc.) — match it, don't invent new patterns.
- This repo has no automated test runner (no `test` script, no vitest/jest/pytest config) — all verification in this plan is manual (pm2 logs, direct DB queries, hitting the running app).
- The `~/caldiy` changes are in a **separate repository** from `LeadAwakerApp` — do not conflate the two in commits.

---

## Task 1: Add new `accounts` schema columns

**Files:**
- Modify: `shared/schema.ts` (accounts table, ~line 41 for `timezone`, ~line 49-50 for `businessHoursStart/End`)

**Interfaces:**
- Produces: `accounts.minBookingNoticeHours` (`integer`, default `16`), `accounts.defaultCallDurationMinutes` (`integer`, default `30`), `accounts.openDays` (`jsonb` typed `number[]`, default `[1,2,3,4,5]`), `accounts.timezone` gets `.default("Europe/Amsterdam")` added to its existing definition. These become available on the `Accounts` TS type and `insertAccountsSchema` (drizzle-zod) automatically.

- [ ] **Step 1: Add the timezone default**

In `shared/schema.ts`, find the existing line:

```ts
  timezone: text("timezone"),
```

(inside the `accounts` table definition, right after `website`/`type`). Change it to:

```ts
  timezone: text("timezone").default("Europe/Amsterdam"),
```

- [ ] **Step 2: Add the three new columns**

In the same `accounts` table definition, find:

```ts
  businessHoursStart: time("business_hours_start"),
  businessHoursEnd: time("business_hours_end"),
```

Change to:

```ts
  businessHoursStart: time("business_hours_start"),
  businessHoursEnd: time("business_hours_end"),
  // Days the client is open, 0=Sun...6=Sat (JS Date.getDay() convention). Default Mon-Fri.
  // Feeds resyncCaldiySchedule -> ~/caldiy's per-day Cal.com availability rows.
  openDays: jsonb("open_days").$type<number[]>().default([1, 2, 3, 4, 5]),
  // Hours between "now" and the earliest slot the AI will offer a lead. 0 = no minimum.
  minBookingNoticeHours: integer("min_booking_notice_hours").default(16),
  // Default call length in minutes when neither the lead nor campaign specifies one.
  defaultCallDurationMinutes: integer("default_call_duration_minutes").default(30),
```

Check that `jsonb` and `integer` are already imported at the top of `shared/schema.ts` from `drizzle-orm/pg-core` (they are used extensively elsewhere in the file — no new import needed).

- [ ] **Step 3: Verify the file parses**

Run: `node -e "require('esbuild-register'); require('./shared/schema.ts')" 2>&1 | head -30`

If `esbuild-register` isn't available, instead just visually confirm the edit via:

Run: `grep -n "openDays\|minBookingNoticeHours\|defaultCallDurationMinutes\|timezone: text" shared/schema.ts | head -10`

Expected: all four lines present, no syntax errors reported by your editor/LSP diagnostics.

- [ ] **Step 4: Commit**

```bash
git add shared/schema.ts
git commit -m "$(cat <<'EOF'
feat(booking): add account-level availability schema columns

minBookingNoticeHours, defaultCallDurationMinutes, openDays, and a
Europe/Amsterdam default on timezone — support fields for the new
Availability onboarding wizard step.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Push schema changes to the live Postgres DB

**Files:**
- Create: `/tmp/claude-1000/-home-gabriel-LeadAwakerApp/fd1808c3-a804-4f5d-b0d1-b18b5f56c3ca/scratchpad/push-availability-columns.js` (throwaway migration script, scratchpad — not committed)

**Interfaces:**
- Consumes: Postgres connection via `DATABASE_URL` env var (same as the rest of the app — check `.env` at repo root).
- Produces: live `accounts` table with the 3 new columns + `timezone` default applied; existing rows get the column defaults backfilled by Postgres automatically (`ADD COLUMN ... DEFAULT ...` backfills in one pass).

- [ ] **Step 1: Write the direct `pg` migration script**

This project's `db:push` has no TTY on the Pi, so schema changes are applied via a raw script (per `drizzle-push-needs-tty.md` memory / CLAUDE.md convention). Write:

```js
// scratchpad/push-availability-columns.js
const { Client } = require("pg");

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  await client.query(`
    ALTER TABLE accounts
      ALTER COLUMN timezone SET DEFAULT 'Europe/Amsterdam',
      ADD COLUMN IF NOT EXISTS open_days jsonb DEFAULT '[1,2,3,4,5]'::jsonb,
      ADD COLUMN IF NOT EXISTS min_booking_notice_hours integer DEFAULT 16,
      ADD COLUMN IF NOT EXISTS default_call_duration_minutes integer DEFAULT 30
  `);

  // Backfill existing rows that predate the column (NULL -> default), since
  // ALTER COLUMN ... DEFAULT only affects future inserts, not existing rows
  // for columns added without ADD COLUMN's own DEFAULT backfill quirk.
  await client.query(`
    UPDATE accounts SET timezone = 'Europe/Amsterdam' WHERE timezone IS NULL;
    UPDATE accounts SET open_days = '[1,2,3,4,5]'::jsonb WHERE open_days IS NULL;
    UPDATE accounts SET min_booking_notice_hours = 16 WHERE min_booking_notice_hours IS NULL;
    UPDATE accounts SET default_call_duration_minutes = 30 WHERE default_call_duration_minutes IS NULL;
  `);

  console.log("Migration applied.");
  await client.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Run it against the live DB**

Run: `node --env-file=.env /tmp/claude-1000/-home-gabriel-LeadAwakerApp/fd1808c3-a804-4f5d-b0d1-b18b5f56c3ca/scratchpad/push-availability-columns.js`

Expected output: `Migration applied.` with no errors.

- [ ] **Step 3: Verify the columns exist and are backfilled**

Run:
```bash
psql "$DATABASE_URL" -c "SELECT id, timezone, open_days, min_booking_notice_hours, default_call_duration_minutes FROM accounts LIMIT 5;"
```

Expected: all 5 rows show `timezone = Europe/Amsterdam` (or an existing non-null value if already set), `open_days = [1, 2, 3, 4, 5]`, `min_booking_notice_hours = 16`, `default_call_duration_minutes = 30`.

No commit for this step — it's a one-time live DB mutation, not a file to check in. The scratchpad script stays in the scratchpad directory, not the repo.

---

## Task 3: Wire `minBookingNoticeHours` into the Python booking engine

**Files:**
- Modify: `/home/gabriel/automations/src/automations/conversation/slot_booking.py:176-178`

**Interfaces:**
- Consumes: `campaign_account` dict already loaded earlier in the enclosing function (same dict that provides `account_timezone`/`timezone` — confirm the exact key name by reading the surrounding code before editing, since it must match how the DB row is fetched into this dict elsewhere in the file).
- Produces: no new public interface — this changes internal slot-offering behavior only.

- [ ] **Step 1: Read the exact surrounding function to confirm the `campaign_account` key naming**

Run: `sed -n '140,180p' /home/gabriel/automations/src/automations/conversation/slot_booking.py`

Confirm whether the DB column `min_booking_notice_hours` arrives in `campaign_account` as `min_booking_notice_hours` (snake_case, if it's a raw asyncpg row) or `minBookingNoticeHours` (camelCase, if pre-mapped). Match whichever convention `account_timezone`/`timezone` already use in that same dict — do not guess independently of what you see.

- [ ] **Step 2: Replace the hardcoded window_start**

Find:

```python
    # Fetch slots over a 7-day window starting tomorrow
    now = datetime.now(timezone.utc)
    window_start = (now + timedelta(days=1)).strftime("%Y-%m-%dT00:00:00Z")
    window_end = (now + timedelta(days=8)).strftime("%Y-%m-%dT23:59:59Z")
```

Replace with (using whichever key name Step 1 confirmed — this example assumes snake_case since that's the convention for raw DB rows elsewhere in this file):

```python
    # Fetch slots over a rolling window starting at the account's configured
    # minimum booking notice (default 16h — roughly "starts tomorrow morning"
    # for a mid-afternoon booking, without hard-blocking same-day bookings
    # for clients who allow them). This is a floor only: cal.diy's real
    # availability (business hours, days open) still gates which slots come back.
    now = datetime.now(timezone.utc)
    min_notice_hours = campaign_account.get("min_booking_notice_hours") or 16
    window_start = (now + timedelta(hours=min_notice_hours)).strftime("%Y-%m-%dT%H:%M:%SZ")
    window_end = (now + timedelta(days=8)).strftime("%Y-%m-%dT23:59:59Z")
```

Do **not** touch `conversation/reschedule.py:284` or `slot_booking.py:379` (the day-selection helper) — both were confirmed during design review to be unrelated to this offer-floor calculation (see the design doc's "Other window_start call sites" note).

- [ ] **Step 3: Manually verify via pm2 logs**

This file is served by the automations engine (`pm2` process `leadawaker-engine`), which auto-restarts on save per project convention. After saving:

Run: `pm2 logs leadawaker-engine --lines 30 --nostream`

Expected: no Python tracebacks / import errors from the reload.

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/automations
git add src/automations/conversation/slot_booking.py
git commit -m "$(cat <<'EOF'
feat(booking): read min_booking_notice_hours as the offer-window floor

Replaces the hardcoded "always starts tomorrow" window_start with a
per-account rolling-hours floor, defaulting to 16h. Real availability
(cal.diy business hours + open days) still determines which slots
actually come back — this only sets the earliest point the engine will look.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

(Note: `~/automations` is checked separately from `LeadAwakerApp` — confirm with `git remote -v` if unsure this is a distinct repo before pushing.)

---

## Task 4: Thread `openDays` through `resyncCaldiySchedule` (LeadAwakerApp side)

**Files:**
- Modify: `server/calendar/caldiy.ts:209-243` (`resyncCaldiySchedule`)
- Modify: `server/routes/accounts.ts` (PATCH route resync trigger)

**Interfaces:**
- Consumes: `account.openDays` (`number[]`, from `storage.getAccountById`, already returns full `Accounts` row including new columns after Task 1/2).
- Produces: `LA_OPEN_DAYS` env var passed to `resync-schedule.sh`, consumed by the `~/caldiy` script in Task 5.

- [ ] **Step 1: Update `resyncCaldiySchedule` to pass `openDays`**

In `server/calendar/caldiy.ts`, find:

```ts
    await execFile(`${CALDIY}/resync-schedule.sh`, [], {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        ...(account.businessHoursStart ? { LA_BUSINESS_HOURS_START: account.businessHoursStart } : {}),
        ...(account.businessHoursEnd ? { LA_BUSINESS_HOURS_END: account.businessHoursEnd } : {}),
        ...(account.timezone ? { LA_TIMEZONE: account.timezone } : {}),
        LA_BLOCKS: blocksJson,
      },
      timeout: 60000,
    });
```

Replace with:

```ts
    await execFile(`${CALDIY}/resync-schedule.sh`, [], {
      env: {
        ...process.env,
        LA_EMAIL: account.ownerEmail,
        ...(account.businessHoursStart ? { LA_BUSINESS_HOURS_START: account.businessHoursStart } : {}),
        ...(account.businessHoursEnd ? { LA_BUSINESS_HOURS_END: account.businessHoursEnd } : {}),
        ...(account.timezone ? { LA_TIMEZONE: account.timezone } : {}),
        ...(account.openDays && account.openDays.length
          ? { LA_OPEN_DAYS: account.openDays.join(",") }
          : {}),
        LA_BLOCKS: blocksJson,
      },
      timeout: 60000,
    });
```

- [ ] **Step 2: Update the docstring above the function**

Find:

```ts
/**
 * Best-effort: rewrites the account's Cal.diy user "Working Hours" schedule to a
 * new window and inserts date-override rows for any manual busy blocks in the next
 * 90 days. Called when businessHoursStart/End change OR when a manual block is
 * created/updated/deleted. No-op if no Cal.diy booking page exists. Fire-and-forget.
 */
```

Replace with:

```ts
/**
 * Best-effort: rewrites the account's Cal.diy user "Working Hours" schedule to a
 * new window/day-set and inserts date-override rows for any manual busy blocks in
 * the next 90 days. Called when businessHoursStart/End/openDays change OR when a
 * manual block is created/updated/deleted. No-op if no Cal.diy booking page exists.
 * Fire-and-forget.
 */
```

- [ ] **Step 3: Add `openDays` to the accounts PATCH resync trigger**

In `server/routes/accounts.ts`, find:

```ts
    // If working hours changed, re-sync the Cal.diy booking schedule (best-effort).
    if ("businessHoursStart" in parsed.data || "businessHoursEnd" in parsed.data) {
      void resyncCaldiySchedule(account.id!);
    }
```

Replace with:

```ts
    // If working hours or open days changed, re-sync the Cal.diy booking schedule (best-effort).
    if ("businessHoursStart" in parsed.data || "businessHoursEnd" in parsed.data || "openDays" in parsed.data) {
      void resyncCaldiySchedule(account.id!);
    }
```

- [ ] **Step 4: Manually verify the server reloads clean**

Run: `pm2 logs leadawaker-crm --lines 30 --nostream` (confirm process name via `pm2 list` first if unsure)

Expected: no TypeScript/runtime errors after the tsx watch reload (~5-8s after save).

- [ ] **Step 5: Commit**

```bash
git add server/calendar/caldiy.ts server/routes/accounts.ts
git commit -m "$(cat <<'EOF'
feat(booking): thread openDays through the cal.diy schedule resync

Adds LA_OPEN_DAYS to the resync-schedule.sh env and triggers a resync
when openDays changes via the accounts PATCH route, same as the
existing businessHoursStart/End trigger.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Support `openDays` in the `~/caldiy` schedule scripts

**Files:**
- Modify: `/home/gabriel/caldiy/scripts/_schedule.ts` (`availabilityFromHours`)
- Modify: `/home/gabriel/caldiy/scripts/resync-schedule.ts`

**Interfaces:**
- Consumes: `LA_OPEN_DAYS` env var (comma-separated string, e.g. `"1,2,3,4,5"` or `"1,2,3,4,5,6"` with Saturday).
- Produces: `availabilityFromHours(start?, end?, openDays?: number[])` — new optional third parameter; existing 2-arg callers (if any beyond `resync-schedule.ts`) keep working via the default.

This is a **separate git repository** from `LeadAwakerApp` — confirm you're editing `/home/gabriel/caldiy`, not a path under `LeadAwakerApp`, before committing.

- [ ] **Step 1: Update `availabilityFromHours` to accept an `openDays` parameter**

In `/home/gabriel/caldiy/scripts/_schedule.ts`, find:

```ts
/**
 * Mon–Fri availability for the given window. Falls back to DEFAULT_SCHEDULE
 * (Mon–Fri 09:00–17:00) when hours are missing or unparseable.
 */
export function availabilityFromHours(start?: string | null, end?: string | null): Availability[] {
  if (!start || !end) return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  const range = timeRange(start, end);
  if (!range || range.start.getTime() >= range.end.getTime()) {
    return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  }
  const schedule: Schedule = [[], [range], [range], [range], [range], [range], []];
  return getAvailabilityFromSchedule(schedule);
}
```

Replace with:

```ts
/**
 * Availability for the given window and open days. `openDays` uses
 * 0=Sun...6=Sat (JS Date.getDay() convention); defaults to Mon-Fri when
 * omitted, matching the previous hardcoded behavior. Falls back to
 * DEFAULT_SCHEDULE (Mon–Fri 09:00–17:00) when hours are missing or unparseable.
 */
export function availabilityFromHours(
  start?: string | null,
  end?: string | null,
  openDays: number[] = [1, 2, 3, 4, 5],
): Availability[] {
  if (!start || !end) return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  const range = timeRange(start, end);
  if (!range || range.start.getTime() >= range.end.getTime()) {
    return getAvailabilityFromSchedule(DEFAULT_SCHEDULE);
  }
  const schedule: Schedule = [0, 1, 2, 3, 4, 5, 6].map((day) =>
    openDays.includes(day) ? [range] : []
  ) as Schedule;
  return getAvailabilityFromSchedule(schedule);
}
```

- [ ] **Step 2: Parse `LA_OPEN_DAYS` and pass it through in `resync-schedule.ts`**

In `/home/gabriel/caldiy/scripts/resync-schedule.ts`, find:

```ts
 *   LA_TIMEZONE               – optional; IANA tz, e.g. "Europe/Amsterdam"
 *   LA_BLOCKS                 – optional; JSON array of ManualBlock objects
 */
```

Replace with:

```ts
 *   LA_TIMEZONE               – optional; IANA tz, e.g. "Europe/Amsterdam"
 *   LA_OPEN_DAYS               – optional; comma-separated weekdays, 0=Sun...6=Sat, e.g. "1,2,3,4,5"
 *   LA_BLOCKS                 – optional; JSON array of ManualBlock objects
 */
```

Then find:

```ts
  const email = process.env.LA_EMAIL;
  const start = process.env.LA_BUSINESS_HOURS_START;
  const end = process.env.LA_BUSINESS_HOURS_END;
  if (!email) throw new Error("LA_EMAIL is required");
```

Replace with:

```ts
  const email = process.env.LA_EMAIL;
  const start = process.env.LA_BUSINESS_HOURS_START;
  const end = process.env.LA_BUSINESS_HOURS_END;
  if (!email) throw new Error("LA_EMAIL is required");

  const openDays = process.env.LA_OPEN_DAYS
    ? process.env.LA_OPEN_DAYS.split(",").map((d) => parseInt(d.trim(), 10)).filter((d) => !isNaN(d))
    : [1, 2, 3, 4, 5];
```

Then find:

```ts
  // Build recurring weekly rows from business hours (or DEFAULT_SCHEDULE).
  const recurringRows = availabilityFromHours(start, end);
```

Replace with:

```ts
  // Build recurring weekly rows from business hours + open days (or DEFAULT_SCHEDULE).
  const recurringRows = availabilityFromHours(start, end, openDays);
```

- [ ] **Step 3: Manually verify the script still runs standalone**

Run:
```bash
cd /home/gabriel/caldiy
LA_EMAIL="<a real provisioned client email from a test account>" LA_BUSINESS_HOURS_START="09:00" LA_BUSINESS_HOURS_END="17:00" LA_OPEN_DAYS="1,2,3,4,5,6" ./node_modules/.bin/ts-node --transpile-only scripts/resync-schedule.ts
```

(Substitute a real `ownerEmail` from a non-production test account — check `SELECT owner_email FROM accounts WHERE id = <test-account-id>` first. Do not run this against a live client's email without confirming it's a test account.)

Expected stdout: `{"ok":true,"scheduleId":<n>,"recurringSlots":6,"overrideSlots":<n>}` (6 recurring slots = Mon-Sat, one row per open day).

- [ ] **Step 4: Verify Saturday actually shows as bookable**

Run:
```bash
psql "$CALDIY_DATABASE_URL" -c "SELECT days, \"startTime\", \"endTime\" FROM \"Availability\" WHERE \"scheduleId\" = <scheduleId from step 3> AND date IS NULL;"
```

Expected: 6 rows (or however many days were in `LA_OPEN_DAYS`), each with a single-element `days` array, `startTime`/`endTime` matching `09:00`/`17:00`, and no row for day `0` (Sunday) if it wasn't included.

- [ ] **Step 5: Commit (in the `~/caldiy` repo)**

```bash
cd /home/gabriel/caldiy
git add scripts/_schedule.ts scripts/resync-schedule.ts
git commit -m "$(cat <<'EOF'
feat(schedule): support configurable open days via LA_OPEN_DAYS

availabilityFromHours() previously hardcoded Mon-Fri. Clients whose
real hours include Saturday (or exclude a weekday) had no way to
reflect that. Defaults to Mon-Fri when LA_OPEN_DAYS is unset, so
existing accounts keep today's behavior until re-saved.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Extend the call-duration fallback chain in `leads.ts`

**Files:**
- Modify: `server/routes/leads.ts:218-224`

**Interfaces:**
- Consumes: `storage.getAccountById(lead.accountsId)` → `Accounts` row with `defaultCallDurationMinutes` (from Task 1/2).
- Produces: no new interface — internal calculation only.

- [ ] **Step 1: Fetch the account and extend the fallback chain**

Find:

```ts
      if (lead.bookedCallDate && lead.accountsId) {
        try {
          const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
          const campaign = lead.campaignsId ? await storage.getCampaignById(lead.campaignsId) : null;
          const durationMin = lead.callDurationMinutes || campaign?.defaultCallDurationMinutes || 30;
```

Replace with:

```ts
      if (lead.bookedCallDate && lead.accountsId) {
        try {
          const leadName = [lead.firstName, lead.lastName].filter(Boolean).join(" ") || "Lead";
          const campaign = lead.campaignsId ? await storage.getCampaignById(lead.campaignsId) : null;
          const account = await storage.getAccountById(lead.accountsId);
          const durationMin =
            lead.callDurationMinutes ||
            campaign?.defaultCallDurationMinutes ||
            account?.defaultCallDurationMinutes ||
            30;
```

Leave the rest of the block (the `pushBookingEvent` call and everything after) untouched — `durationMin` is consumed exactly as before.

- [ ] **Step 2: Manually verify via pm2 logs**

Run: `pm2 logs leadawaker-crm --lines 30 --nostream`

Expected: no TypeScript errors after the tsx watch reload.

- [ ] **Step 3: Commit**

```bash
git add server/routes/leads.ts
git commit -m "$(cat <<'EOF'
feat(booking): fall back to account default call duration

Extends the lead -> campaign -> 30min fallback chain to also check
the account-level defaultCallDurationMinutes before the hardcoded
30-minute default.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Add i18n strings for the Availability wizard step

**Files:**
- Modify: `client/src/locales/en/communicationProfile.json`
- Modify: `client/src/locales/nl/communicationProfile.json`
- Modify: `client/src/locales/en/accounts.json`
- Modify: `client/src/locales/nl/accounts.json`

**Interfaces:**
- Produces: `communicationProfile:sections.availability`, `communicationProfile:questions.availabilityHours.label`, `accounts:availability.*` — all consumed by Task 8's `AvailabilityCard` and Task 9's wizard wiring.

- [ ] **Step 1: Add the section + question label in `communicationProfile.json` (en)**

Find:

```json
  "sections": {
    "tone": "Identity and Style",
    "identity": "Words & identity",
    "sales": "Sales arguments",
    "facts": "Facts & policy",
    "booking": "Booking setup"
  },
```

Replace with:

```json
  "sections": {
    "tone": "Identity and Style",
    "identity": "Words & identity",
    "availability": "Availability",
    "sales": "Sales arguments",
    "facts": "Facts & policy",
    "booking": "Booking setup"
  },
```

Then find the `"questions"` block's `"meetingType"` entry:

```json
  "questions": {
    "meetingType": {
      "label": "How do you conduct booked calls with leads?"
    },
```

Add a new entry right after it (still inside `"questions"`):

```json
  "questions": {
    "meetingType": {
      "label": "How do you conduct booked calls with leads?"
    },
    "availabilityHours": {
      "label": "When can leads book a call with you?"
    },
```

- [ ] **Step 2: Mirror the same two additions in `communicationProfile.json` (nl)**

Read `client/src/locales/nl/communicationProfile.json` first to find the equivalent `sections` and `questions.meetingType` blocks (same structure, Dutch text), then apply the equivalent edits:

```json
  "sections": {
    "tone": "Identiteit en stijl",
    "identity": "Woorden & identiteit",
    "availability": "Beschikbaarheid",
    "sales": "Verkoopargumenten",
    "facts": "Feiten & beleid",
    "booking": "Boekingsinstellingen"
  },
```

(Use the exact existing Dutch translations already in the file for the other keys — only insert the new `"availability"` line in the position shown; do not retype the others from scratch, copy them from what Read shows.)

```json
    "availabilityHours": {
      "label": "Wanneer kunnen leads een gesprek bij u boeken?"
    },
```

inserted after the existing `"meetingType"` entry inside `"questions"`.

- [ ] **Step 3: Add the `availability.*` card strings to `accounts.json` (en)**

Find the existing `"meetingType"` block (ends around line 565 with `"whatsappHint": "..."` and closing `},`). Add a new top-level `"availability"` key right after it:

```json
  "availability": {
    "title": "Availability",
    "openDays": "Open days",
    "days": {
      "1": "Mon",
      "2": "Tue",
      "3": "Wed",
      "4": "Thu",
      "5": "Fri",
      "6": "Sat",
      "0": "Sun"
    },
    "openingTime": "Opening time",
    "closingTime": "Closing time",
    "callDuration": "Call duration (minutes)",
    "minBookingNotice": "Minimum booking notice (hours)",
    "minBookingNoticeHint": "How far in advance a lead must book. E.g. 4 = same-day is fine as long as it's 4+ hours out. 24 = next-day only."
  },
```

- [ ] **Step 4: Mirror the same block in `accounts.json` (nl)**

Read `client/src/locales/nl/accounts.json` first to find the equivalent `"meetingType"` block, then add the Dutch equivalent immediately after it:

```json
  "availability": {
    "title": "Beschikbaarheid",
    "openDays": "Open dagen",
    "days": {
      "1": "Ma",
      "2": "Di",
      "3": "Wo",
      "4": "Do",
      "5": "Vr",
      "6": "Za",
      "0": "Zo"
    },
    "openingTime": "Openingstijd",
    "closingTime": "Sluitingstijd",
    "callDuration": "Gespreksduur (minuten)",
    "minBookingNotice": "Minimale boekingstermijn (uren)",
    "minBookingNoticeHint": "Hoe ver van tevoren een lead moet boeken. Bijv. 4 = dezelfde dag is prima zolang het 4+ uur van tevoren is. 24 = alleen de volgende dag."
  },
```

- [ ] **Step 5: Verify all 4 files are valid JSON**

Run:
```bash
node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/communicationProfile.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('client/src/locales/nl/communicationProfile.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('client/src/locales/en/accounts.json'))" && \
node -e "JSON.parse(require('fs').readFileSync('client/src/locales/nl/accounts.json'))" && \
echo "All 4 files valid JSON"
```

Expected: `All 4 files valid JSON` with no errors.

- [ ] **Step 6: Commit**

```bash
git add client/src/locales/en/communicationProfile.json client/src/locales/nl/communicationProfile.json client/src/locales/en/accounts.json client/src/locales/nl/accounts.json
git commit -m "$(cat <<'EOF'
feat(booking): add i18n strings for the Availability wizard step

en/nl only, per project-wide PT deprecation.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Build the `AvailabilityCard` component

**Files:**
- Create: `client/src/features/accounts/components/workspace/AvailabilityCard.tsx`

**Interfaces:**
- Consumes: `IntegSection`, `SectionHead`, `IconTile` from `./integrationsAtoms`; `apiFetch` from `@/lib/apiUtils`; i18n keys from Task 7 (`accounts:availability.*`).
- Produces: `AvailabilityCard({ accountId }: Props)` — a React component, default export not used (named export, matching `MeetingTypeCard`'s convention), consumed by Task 9.

**Note on data loading:** `MeetingTypeCard` (the sibling component this mirrors) is invoked by the wizard as `<MeetingTypeCard accountId={accountId} />` — no initial-value props. The wizard's own state (`ProfileAnswers`, the `a` variable in `ProfileWizard.tsx`) tracks only style/tone/fact answers, not raw `accounts` table columns like `businessHoursStart` — those live on the account row itself, not in wizard state. So `AvailabilityCard`, like `MeetingTypeCard`, must fetch its own current values on mount rather than receiving them as props.

- [ ] **Step 1: Write the component**

```tsx
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarClock, Loader2, Check } from "lucide-react";
import { apiFetch } from "@/lib/apiUtils";
import { IntegSection, SectionHead, IconTile } from "./integrationsAtoms";

interface Props {
  accountId: number;
}

// GET /api/accounts/:id returns snake_case keys (server/dbKeys.ts's toDbKeys
// converts JS camelCase -> DB snake_case for the wire format — confirmed
// against how AccountDetailsPanel.tsx reads val("business_hours_start") from
// the same endpoint). Do NOT expect camelCase here.
interface AccountAvailability {
  open_days?: number[] | null;
  business_hours_start?: string | null;
  business_hours_end?: string | null;
  default_call_duration_minutes?: number | null;
  min_booking_notice_hours?: number | null;
}

const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0]; // Mon...Sun, matches how clients think about their week

export function AvailabilityCard({ accountId }: Props) {
  const { t } = useTranslation("accounts");
  const [loaded, setLoaded] = useState(false);
  const [openDays, setOpenDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [start, setStart] = useState("09:00");
  const [end, setEnd] = useState("17:00");
  const [duration, setDuration] = useState("30");
  const [notice, setNotice] = useState("16");
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    apiFetch(`/api/accounts/${accountId}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: AccountAvailability | null) => {
        if (cancelled || !data) return;
        if (data.open_days?.length) setOpenDays(data.open_days);
        if (data.business_hours_start) setStart(data.business_hours_start);
        if (data.business_hours_end) setEnd(data.business_hours_end);
        if (data.default_call_duration_minutes != null) setDuration(String(data.default_call_duration_minutes));
        if (data.min_booking_notice_hours != null) setNotice(String(data.min_booking_notice_hours));
      })
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId]);

  async function persist(body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const res = await apiFetch(`/api/accounts/${accountId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error(await res.text());
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err: any) {
      setError(err?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  // Mirrors MeetingTypeCard's savedNumber pattern: track the last-persisted
  // value per field so onBlur only fires a PATCH when something actually changed.
  const [savedStart, setSavedStart] = useState("09:00");
  const [savedEnd, setSavedEnd] = useState("17:00");
  const [savedDuration, setSavedDuration] = useState("30");
  const [savedNotice, setSavedNotice] = useState("16");

  useEffect(() => {
    if (!loaded) return;
    setSavedStart(start);
    setSavedEnd(end);
    setSavedDuration(duration);
    setSavedNotice(notice);
    // Only re-sync "saved" baselines the moment the fetched values land, not on every keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded]);

  function toggleDay(day: number) {
    const next = openDays.includes(day) ? openDays.filter((d) => d !== day) : [...openDays, day];
    setOpenDays(next);
    void persist({ open_days: next });
  }

  function onBlurStart() {
    if (start === savedStart) return;
    setSavedStart(start);
    void persist({ business_hours_start: start || null });
  }

  function onBlurEnd() {
    if (end === savedEnd) return;
    setSavedEnd(end);
    void persist({ business_hours_end: end || null });
  }

  function onBlurDuration() {
    const n = parseInt(duration, 10);
    const clamped = isNaN(n) ? 30 : Math.min(240, Math.max(5, n));
    setDuration(String(clamped));
    if (String(clamped) === savedDuration) return;
    setSavedDuration(String(clamped));
    void persist({ default_call_duration_minutes: clamped });
  }

  function onBlurNotice() {
    const n = parseInt(notice, 10);
    const clamped = isNaN(n) ? 16 : Math.min(168, Math.max(0, n));
    setNotice(String(clamped));
    if (String(clamped) === savedNotice) return;
    setSavedNotice(String(clamped));
    void persist({ min_booking_notice_hours: clamped });
  }

  return (
    <IntegSection>
      <SectionHead>
        <IconTile><CalendarClock size={14} /></IconTile>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--ink)", flex: 1 }}>
          {t("availability.title")}
        </span>
        {saving ? (
          <Loader2 size={14} className="animate-spin" style={{ color: "var(--mute-2)" }} />
        ) : justSaved ? (
          <Check size={14} style={{ color: "var(--good)" }} />
        ) : null}
      </SectionHead>

      {/* Open days */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.openDays")}
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {DAY_ORDER.map((day) => {
            const selected = openDays.includes(day);
            return (
              <button
                key={day}
                type="button"
                disabled={saving}
                onClick={() => toggleDay(day)}
                className="la-btn la-btn--soft"
                style={{
                  padding: "6px 12px",
                  fontSize: 12,
                  fontWeight: 600,
                  ...(selected
                    ? { background: "var(--wine)", color: "var(--wine-fg, #fff)", boxShadow: "none" }
                    : {}),
                }}
              >
                {t(`availability.days.${day}`)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Opening / closing time */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
            {t("availability.openingTime")}
          </div>
          <input
            className="neu-input"
            style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
            type="time"
            value={start}
            disabled={saving}
            onChange={(e) => setStart(e.target.value)}
            onBlur={onBlurStart}
          />
        </div>
        <div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
            {t("availability.closingTime")}
          </div>
          <input
            className="neu-input"
            style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
            type="time"
            value={end}
            disabled={saving}
            onChange={(e) => setEnd(e.target.value)}
            onBlur={onBlurEnd}
          />
        </div>
      </div>

      {/* Call duration */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.callDuration")}
        </div>
        <input
          className="neu-input"
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
          type="number"
          min={5}
          max={240}
          value={duration}
          disabled={saving}
          onChange={(e) => setDuration(e.target.value)}
          onBlur={onBlurDuration}
        />
      </div>

      {/* Minimum booking notice */}
      <div>
        <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--mute-2)", marginBottom: 6 }}>
          {t("availability.minBookingNotice")}
        </div>
        <input
          className="neu-input"
          style={{ fontSize: 13, padding: "8px 11px", width: "100%" }}
          type="number"
          min={0}
          max={168}
          value={notice}
          disabled={saving}
          onChange={(e) => setNotice(e.target.value)}
          onBlur={onBlurNotice}
        />
        <div style={{ fontSize: 11.5, color: "var(--mute)", marginTop: 5, lineHeight: 1.5 }}>
          {t("availability.minBookingNoticeHint")}
        </div>
      </div>

      {error && (
        <div style={{ marginTop: 10, fontSize: 12, color: "var(--wine)" }}>{error}</div>
      )}
    </IntegSection>
  );
}
```

- [ ] **Step 2: Manually verify the file has no obvious type errors**

Since this project doesn't run `tsc` automatically, just re-read the file with the Read tool and confirm: every `useState` call has a matching type, every `t()` call uses a key added in Task 7, and the `Props` interface matches what Task 9 will pass in.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/accounts/components/workspace/AvailabilityCard.tsx
git commit -m "$(cat <<'EOF'
feat(booking): add AvailabilityCard component

Open-days toggle pills + opening/closing time + call duration +
minimum booking notice, autosaving per-field via PATCH /api/accounts/:id
same as the existing MeetingTypeCard pattern.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Wire the new step into `ProfileWizard`

**Files:**
- Modify: `client/src/features/accounts/components/workspace/communication/profileConstants.ts`
- Modify: `client/src/features/accounts/components/workspace/communication/ProfileWizard.tsx`

**Interfaces:**
- Consumes: `AvailabilityCard` from Task 8 (`../AvailabilityCard`, sibling directory to `communication/`).
- Produces: a working `"availability"` wizard section, positioned before `"sales"`.

- [ ] **Step 1: Add the new section and step in `profileConstants.ts`**

Find:

```ts
export type SectionKey = "tone" | "identity" | "sales" | "facts" | "booking";
export const SECTIONS: SectionKey[] = ["tone", "identity", "sales", "facts", "booking"];
```

Replace with:

```ts
export type SectionKey = "tone" | "identity" | "availability" | "sales" | "facts" | "booking";
export const SECTIONS: SectionKey[] = ["tone", "identity", "availability", "sales", "facts", "booking"];
```

Then find the step list entry for `agentName` (last step of the `"identity"` section, right before `objections` which starts `"sales"`):

```ts
  { key: "agentName", kind: "style", section: "identity" },    // name + custom + avatar
  { key: "objections", kind: "qagrid", section: "sales" },     // → KB "objections"
```

Insert the new step between them:

```ts
  { key: "agentName", kind: "style", section: "identity" },    // name + custom + avatar
  { key: "availabilityHours", kind: "custom", section: "availability" }, // open days/hours/duration/notice (account-level)
  { key: "objections", kind: "qagrid", section: "sales" },     // → KB "objections"
```

- [ ] **Step 2: Render `AvailabilityCard` in `ProfileWizard.tsx`**

First add the import. Find the existing import of `MeetingTypeCard` (search for `MeetingTypeCard` near the top of the file) and add a sibling import right after it:

```tsx
import { AvailabilityCard } from "../AvailabilityCard";
```

Then find:

```tsx
        {def.kind === "custom" && def.key === "meetingType" && accountId && (
          <MeetingTypeCard accountId={accountId} />
        )}
```

Add a new branch right after it. Note this passes only `accountId`, same as `MeetingTypeCard` above it — `AvailabilityCard` fetches its own current values on mount (see Task 8's note on data loading), since the wizard's `a` state (`ProfileAnswers`) tracks style/tone/fact answers only and has no `businessHoursStart`-style fields:

```tsx
        {def.kind === "custom" && def.key === "meetingType" && accountId && (
          <MeetingTypeCard accountId={accountId} />
        )}
        {def.kind === "custom" && def.key === "availabilityHours" && accountId && (
          <AvailabilityCard accountId={accountId} />
        )}
```

- [ ] **Step 3: Manually verify in the browser**

Since this is a UI change, actually load the app and click through it rather than just trusting the diff (per this project's UI-testing convention).

Use the playwright-cli skill (or ask Gabriel to check manually) to:
1. Navigate to the CRM, open an account's communication profile wizard.
2. Click through past the Identity/Words section.
3. Confirm an "Availability" section appears before "Sales arguments", showing day toggle pills, opening/closing time inputs, call duration, and minimum notice fields.
4. Toggle Saturday on, set a duration, set a notice value; confirm the save checkmark appears after each change.
5. Reload the page / reopen the wizard; confirm the values persisted.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/accounts/components/workspace/communication/profileConstants.ts client/src/features/accounts/components/workspace/communication/ProfileWizard.tsx
git commit -m "$(cat <<'EOF'
feat(booking): add Availability step to the onboarding wizard

New section sits between Identity and Sales arguments, rendering
AvailabilityCard for open days, hours, call duration, and minimum
booking notice.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: End-to-end manual verification

**Files:** none (verification only)

- [ ] **Step 1: Verify the notice floor end-to-end with a real test lead**

Pick (or create) a test account/campaign/lead with a connected cal.diy calendar. Set `minBookingNoticeHours` to `4` via the wizard. Trigger the AI's slot-offering flow (send a message that reaches booking intent) at a time of day where `now + 4h` still falls within the account's business hours. Confirm the offered days/times include today, not only starting tomorrow.

- [ ] **Step 2: Verify Saturday bookability end-to-end**

For the same test account, toggle Saturday on with hours 10:00–14:00. Trigger the slot-offering flow again on a day where the 3-day offer window would include an upcoming Saturday. Confirm a Saturday slot is actually offered to the lead (not silently skipped).

- [ ] **Step 3: Verify call duration reaches the pushed calendar event**

Set `defaultCallDurationMinutes` to `45` for the test account (with no campaign-level or lead-level override set). Book a test call. Check the account's connected external calendar (Google/Outlook) — confirm the pushed event is 45 minutes long, not the old 30-minute default.

- [ ] **Step 4: Verify existing accounts are unaffected until they opt in**

For an account that has *not* had its Availability step touched: confirm `min_booking_notice_hours = 16` (close to old "starts tomorrow" behavior) and `open_days = [1,2,3,4,5]` (unchanged Mon-Fri) are already present from the Task 2 backfill, and that its cal.diy schedule still resolves the same as before this change (no resync happens until the account is actually PATCHed again).

- [ ] **Step 5: Report results to Gabriel**

Summarize pass/fail for each of the 4 checks above in the conversation. Do not mark this plan complete until all 4 are confirmed working against the real running app — this project's convention (per CLAUDE.md) is that UI/feature work must be verified live, not just type-checked or diffed.
