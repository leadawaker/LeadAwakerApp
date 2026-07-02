# Opt-In Calendar Invite (.ics) for Chat Bookings — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After a chat booking, the AI offers a calendar invite; on the lead's yes it emits a `{{SEND_ICS}}` signal, and the engine drops a one-tap `.ics` link (served publicly by Express) into the chat. No email, no unsolicited file.

**Architecture:** Express (`CRM`) gains a pure iCal builder and a public `GET /calendar/ics/:uid.ics` endpoint that looks up the lead by `calcom_booking_uid` and renders a `VEVENT`. The Python engine (`ENGINE`) adds the opt-in offer to the STAGE-3 booking guidance and, on `{{SEND_ICS}}`, substitutes the signal with the real link. A final optional task routes the link through the client's white-label booking domain.

**Tech Stack:** Express + Drizzle (TypeScript, run via `tsx`), Python engine, Cloudflare Worker (white-label domains).

## Global Constraints

- **Two repos.** `CRM` = `/home/gabriel/LeadAwakerApp/`, `ENGINE` = `/home/gabriel/automations/`. Every path is prefixed.
- **Opt-in only.** The `.ics` is never sent unless the lead explicitly accepts the offer. No email is ever requested.
- **Copy is en/nl only, default nl.**
- **Depends on the reminders/cancel plan for nothing** — it is independent and can ship on its own. It does depend on the already-built custom-booking-domain work only for the optional Task 5.
- **Never run `tsc` automatically.** Server + shared auto-reload via `tsx watch`; the engine may need `pm2 restart leadawaker-engine`.
- **Do not deploy/restart during a live demo.** Writing/committing the plan is fine anytime.
- **`.ics` must use CRLF line endings and UTC basic timestamps** (`YYYYMMDDTHHMMSSZ`) — this is what calendar clients require.

---

### Task 1: Pure iCal builder

**Files:**
- Create: `CRM/server/calendar/ics.ts`
- Test: `CRM/scripts/test-ics.ts` (create)

**Interfaces:**
- Produces: `buildIcs(opts: { uid: string; start: Date; end: Date; summary: string; description?: string }) -> string`.

- [ ] **Step 1: Write the failing test**

Create `CRM/scripts/test-ics.ts`:

```typescript
// Run: npx tsx scripts/test-ics.ts
import { buildIcs } from "../server/calendar/ics";
import assert from "node:assert";

const ics = buildIcs({
  uid: "abc123",
  start: new Date("2026-07-10T14:00:00Z"),
  end: new Date("2026-07-10T14:30:00Z"),
  summary: "Your call",
  description: "We'll call you shortly.",
});

assert.ok(ics.startsWith("BEGIN:VCALENDAR"), "starts with VCALENDAR");
assert.ok(ics.includes("BEGIN:VEVENT"), "has a VEVENT");
assert.ok(ics.includes("UID:abc123@leadawaker.com"), "has the UID");
assert.ok(ics.includes("DTSTART:20260710T140000Z"), "UTC basic DTSTART");
assert.ok(ics.includes("DTEND:20260710T143000Z"), "UTC basic DTEND");
assert.ok(ics.includes("SUMMARY:Your call"), "has the summary");
assert.ok(ics.includes("\r\n"), "uses CRLF line endings");
assert.ok(ics.trimEnd().endsWith("END:VCALENDAR"), "ends with VCALENDAR");

console.log("✅ buildIcs OK");
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd /home/gabriel/LeadAwakerApp && npx tsx scripts/test-ics.ts`
Expected: FAIL (`Cannot find module '../server/calendar/ics'`).

- [ ] **Step 3: Implement the builder**

Create `CRM/server/calendar/ics.ts`:

```typescript
/** Minimal RFC-5545 iCalendar builder for a single booked call. */
export function buildIcs(opts: {
  uid: string;
  start: Date;
  end: Date;
  summary: string;
  description?: string;
}): string {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const esc = (s: string) => s.replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//LeadAwaker//Booking//EN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${opts.uid}@leadawaker.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(opts.start)}`,
    `DTEND:${fmt(opts.end)}`,
    `SUMMARY:${esc(opts.summary)}`,
    ...(opts.description ? [`DESCRIPTION:${esc(opts.description)}`] : []),
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return lines.join("\r\n") + "\r\n";
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd /home/gabriel/LeadAwakerApp && npx tsx scripts/test-ics.ts`
Expected: `✅ buildIcs OK`

- [ ] **Step 5: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add server/calendar/ics.ts scripts/test-ics.ts
git commit -m "feat(calendar): pure iCal (.ics) builder"
```

---

### Task 2: Lead lookup by booking uid

**Files:**
- Modify: `CRM/server/storage/leads.ts` (add a method near `getLead`, line ~124)

**Interfaces:**
- Produces: `getLeadByBookingUid(uid: string)` returning the lead row or `undefined`.

- [ ] **Step 1: Add the storage method**

In `CRM/server/storage/leads.ts`, next to the existing `getLead` method (line ~124), add:

```typescript
  async getLeadByBookingUid(uid: string) {
    const [row] = await db.select().from(leads).where(eq(leads.calcomBookingUid, uid));
    return row;
  },
```

(Match the surrounding object/method style in this file — if the neighbouring functions are `export async function`, use that form instead and export it, then re-export from the storage barrel `server/storage.ts` alongside the other leads methods.)

- [ ] **Step 2: Verify it compiles under tsx (no separate `tsc`)**

Run: `cd /home/gabriel/LeadAwakerApp && npx tsx -e "import { storage } from './server/storage'; console.log(typeof storage.getLeadByBookingUid)"`
Expected: `function`

- [ ] **Step 3: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add server/storage/leads.ts server/storage.ts
git commit -m "feat(storage): getLeadByBookingUid lookup"
```

---

### Task 3: Public `.ics` endpoint

**Files:**
- Modify: `CRM/server/routes/calendar.ts` (add a public route inside `registerCalendarRoutes`, and import `buildIcs`)

**Interfaces:**
- Consumes: `buildIcs` (Task 1), `storage.getLeadByBookingUid` (Task 2).
- Produces: `GET /calendar/ics/:file` (public, no auth) → `text/calendar` with `Content-Disposition: attachment; filename="booking.ics"`.

- [ ] **Step 1: Import the builder**

In `CRM/server/routes/calendar.ts`, add near the top imports:

```typescript
import { buildIcs } from "../calendar/ics";
```

- [ ] **Step 2: Register the public route**

In `CRM/server/routes/calendar.ts`, inside `registerCalendarRoutes(app)`, add (public — intentionally NOT under `/api` and with no `requireAuth`, so a WhatsApp link opens it directly):

```typescript
  // ─── Public one-tap .ics for a booked call (opt-in, sent by the engine) ────
  const ICS_EVENT_MINUTES = 30;
  app.get("/calendar/ics/:file", wrapAsync(async (req, res) => {
    const uid = String(req.params.file || "").replace(/\.ics$/i, "");
    if (!uid) return res.status(404).send("Not found");

    const lead = await storage.getLeadByBookingUid(uid);
    if (!lead || !lead.bookedCallDate) return res.status(404).send("Booking not found");

    const start = new Date(lead.bookedCallDate);
    const end = new Date(start.getTime() + ICS_EVENT_MINUTES * 60_000);
    const ics = buildIcs({
      uid,
      start,
      end,
      summary: "Your call",
      description: "Your booked call. We look forward to speaking with you.",
    });

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="booking.ics"');
    res.send(ics);
  }));
```

- [ ] **Step 3: Verify against a real booked lead (manual)**

Find a booked uid: `cd /home/gabriel/LeadAwakerApp && node --env-file=.env -e "import('pg').then(async({default:pg})=>{const p=new pg.Pool({connectionString:process.env.DATABASE_URL});const{rows}=await p.query(\`SELECT calcom_booking_uid FROM \"p2mxx34fvbf3ll6\".\"Leads\" WHERE calcom_booking_uid IS NOT NULL AND booked_call_date IS NOT NULL LIMIT 1\`);console.log(rows[0]||'none');await p.end();})"`

Then (server already running via pm2/tsx): `curl -s http://localhost:$PORT/calendar/ics/<uid>.ics` (use the app's port).
Expected: a `BEGIN:VCALENDAR ... END:VCALENDAR` body. A bad uid returns 404.

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/LeadAwakerApp
git add server/routes/calendar.ts
git commit -m "feat(calendar): public one-tap .ics endpoint for booked calls"
```

---

### Task 4: Engine — offer the invite + send the link on `{{SEND_ICS}}`

**Files:**
- Modify: `ENGINE/src/config.py` (add `ics_base_url`)
- Modify: `ENGINE/src/automations/conversation/slot_booking.py` (STAGE-3 guidance in the `[AVAILABLE SLOTS]` block, ~line 317)
- Modify: `ENGINE/src/automations/ai_conversation.py` (signal regex near line 74; handler near the `{{SLOT_SELECTED}}` block ~line 735)
- Test: `ENGINE/scripts/test_send_ics_signal.py` (create)

**Interfaces:**
- Produces: `_SEND_ICS_RE` and inline substitution of `{{SEND_ICS}}` with `"{ics_base_url}/{uid}.ics"`.

- [ ] **Step 1: Add the base-URL setting**

In `ENGINE/src/config.py`, in the "AI Conversation" block, add:

```python
    # Base URL for one-tap calendar invites. Engine appends /<booking_uid>.ics.
    ics_base_url: str = "https://api.leadawaker.com/calendar/ics"
```

- [ ] **Step 2: Add the opt-in offer to STAGE-3 guidance**

In `ENGINE/src/automations/conversation/slot_booking.py`, in the `[AVAILABLE SLOTS ...]` context string, append to the STAGE 3 instruction (right after the sentence ending "...books the call automatically."):

```python
        f"After the booking is confirmed, you may ALSO offer to send a calendar "
        f"file so the appointment saves to their phone automatically (e.g. 'Zal ik "
        f"een agenda-bestand sturen zodat het meteen in je agenda staat?'). Offer it "
        f"at most once. ONLY if the lead says yes, put the signal {{{{SEND_ICS}}}} on "
        f"its own line at the very end of your next message — it is invisible and "
        f"sends the calendar link. Never send it unless the lead accepts.\n"
```

- [ ] **Step 3: Write the failing test (signal substitution)**

Create `ENGINE/scripts/test_send_ics_signal.py`:

```python
"""Direct test: {{SEND_ICS}} substitution. Run: python scripts/test_send_ics_signal.py"""
from src.automations.ai_conversation import _SEND_ICS_RE, _apply_send_ics

# no signal → unchanged, no link
assert _apply_send_ics("all set!", "uid1", "https://x/ics") == ("all set!", False)

# signal present → replaced by the link, flagged True
out, sent = _apply_send_ics("Here you go 👇\n{{SEND_ICS}}", "uid1", "https://x/ics")
assert sent is True
assert "{{SEND_ICS}}" not in out
assert "https://x/ics/uid1.ics" in out

# signal but no uid → strip the token, do not invent a link
out2, sent2 = _apply_send_ics("ok {{SEND_ICS}}", "", "https://x/ics")
assert "{{SEND_ICS}}" not in out2 and sent2 is False

print("✅ SEND_ICS substitution OK")
```

- [ ] **Step 4: Run it to verify it fails**

Run: `cd /home/gabriel/automations && python scripts/test_send_ics_signal.py`
Expected: FAIL (`ImportError: cannot import name '_SEND_ICS_RE'`).

- [ ] **Step 5: Implement the regex + helper**

In `ENGINE/src/automations/ai_conversation.py`, near `_SLOT_SELECTED_RE` (line ~74) add:

```python
_SEND_ICS_RE = re.compile(r"\{\{SEND_ICS\}\}", re.IGNORECASE)


def _apply_send_ics(ai_content: str, booking_uid: str | None, ics_base_url: str) -> tuple[str, bool]:
    """Replace a {{SEND_ICS}} signal with the real .ics link. Returns (content, sent).
    If there is no booking uid we strip the token and send nothing."""
    if not _SEND_ICS_RE.search(ai_content):
        return ai_content, False
    if not booking_uid:
        return _SEND_ICS_RE.sub("", ai_content).strip(), False
    link = f"{ics_base_url.rstrip('/')}/{booking_uid}.ics"
    return _SEND_ICS_RE.sub(link, ai_content).strip(), True
```

- [ ] **Step 6: Wire the helper into the reply pipeline**

In `ENGINE/src/automations/ai_conversation.py`, right after the `{{SLOT_SELECTED}}` block strips its signal (after line ~745, before the `[QUALIFIED]/[BOOKED]` cleanup), add:

```python
        # {{SEND_ICS}} — the AI emits this only after the lead accepts the calendar
        # invite offer. Replace it inline with the real one-tap link.
        ai_content, _ics_sent = _apply_send_ics(
            ai_content, lead.get("calcom_booking_uid"), settings.ics_base_url
        )
        if _ics_sent:
            log.info("ai_conversation.ics_link_sent", lead_id=lead_id)
```

(`settings` is already imported in `ai_conversation.py`.)

- [ ] **Step 7: Run the test to verify it passes**

Run: `cd /home/gabriel/automations && python scripts/test_send_ics_signal.py`
Expected: `✅ SEND_ICS substitution OK`

- [ ] **Step 8: Verify the module imports**

Run: `cd /home/gabriel/automations && python -c "import src.automations.ai_conversation, src.automations.conversation.slot_booking; print('OK')"`
Expected: `OK`

- [ ] **Step 9: Commit**

```bash
cd /home/gabriel/automations
git add src/config.py src/automations/conversation/slot_booking.py src/automations/ai_conversation.py scripts/test_send_ics_signal.py
git commit -m "feat(booking): opt-in .ics offer + {{SEND_ICS}} link substitution"
```

---

### Task 5 (optional enhancement): white-label the `.ics` link

Only worth doing after Tasks 1–4 are live and Gabriel wants the link on the client's own domain instead of `api.leadawaker.com`. Skip otherwise.

**Files:**
- Modify: `CRM/infra/cloudflare-worker/booking-rewrite/worker.js`
- Modify: `ENGINE/src/automations/ai_conversation.py` (`_apply_send_ics` call site — pass a per-account base URL)

**Interfaces:**
- The engine builds the link from the account's active `customDomain` (`book.client.com/ics/<uid>.ics`) when present, else falls back to `settings.ics_base_url`.

- [ ] **Step 1: Route `/ics/*` through the worker to the API origin**

In `CRM/infra/cloudflare-worker/booking-rewrite/worker.js`, add an early branch inside `fetch()` (before the username lookup), and add `API_ORIGIN` to the worker's env/vars (`https://api.leadawaker.com`):

```javascript
    // White-label calendar invites: book.client.com/ics/<uid>.ics → API origin.
    if (url.pathname.startsWith("/ics/")) {
      const apiOrigin = env.API_ORIGIN || "https://api.leadawaker.com";
      const uid = url.pathname.slice("/ics/".length);
      return fetch(`${apiOrigin}/calendar/ics/${uid}`, {
        method: "GET",
        headers: new Headers({ accept: "text/calendar" }),
      });
    }
```

- [ ] **Step 2: Build the per-account link in the engine**

In `ENGINE/src/automations/ai_conversation.py`, replace the `_apply_send_ics(...)` call (Task 4 Step 6) with a base-URL that prefers the account's active custom domain:

```python
        _custom_domain = (campaign_account.get("custom_domain") or "").strip()
        _ics_base = (
            f"https://{_custom_domain}/ics"
            if _custom_domain and (campaign_account.get("custom_domain_status") == "active")
            else settings.ics_base_url
        )
        ai_content, _ics_sent = _apply_send_ics(
            ai_content, lead.get("calcom_booking_uid"), _ics_base
        )
        if _ics_sent:
            log.info("ai_conversation.ics_link_sent", lead_id=lead_id, base=_ics_base)
```

Note: confirm `custom_domain` / `custom_domain_status` are present on the `campaign_account` dict the engine loads (they live on the account's caldiy connection row). If not, extend that query first, or keep `settings.ics_base_url` for all accounts and treat white-labeling as future work.

- [ ] **Step 3: Deploy the worker (only with Gabriel's go-ahead, never mid-demo)**

Run (from the worker dir): `wrangler deploy`
Then verify: `curl -s https://book.<a-live-client-domain>/ics/<uid>.ics` returns the `VCALENDAR` body.

- [ ] **Step 4: Commit**

```bash
cd /home/gabriel/LeadAwakerApp && git add infra/cloudflare-worker/booking-rewrite/worker.js && git commit -m "feat(worker): route white-label /ics/* to the API .ics endpoint"
cd /home/gabriel/automations && git commit -am "feat(booking): prefer the account custom domain for the .ics link"
```

---

## Self-Review

**Spec coverage:**
- Opt-in offer, AI explains what it is → Task 4 Step 2 (STAGE-3 guidance). ✅
- `{{SEND_ICS}}` signal → engine link substitution → Task 4 Steps 5–6. ✅
- `.ics` generation (VEVENT, UTC, CRLF) → Task 1. ✅
- Public hosting (Express), served as `text/calendar` attachment → Tasks 2–3. ✅
- Link delivery in chat, not a file → Task 4 (link substituted inline). ✅
- White-label on the client's own domain → Task 5 (optional). ✅
- No email ever → nothing in the plan requests one. ✅

**Placeholder scan:** No TBDs. Task 3 Step 3 and Task 5 are labelled manual/optional and depend on real data / Gabriel's go-ahead; the pure builder and the signal helper are unit-tested.

**Type consistency:** `buildIcs({uid,start,end,summary,description?})` defined in Task 1 and called with those exact keys in Task 3. `getLeadByBookingUid` defined in Task 2, used in Task 3. `_apply_send_ics(ai_content, booking_uid, ics_base_url) -> (str, bool)` defined in Task 4 Step 5 and called in Steps 6 and Task 5 Step 2.

## On-device check (before calling it done)

Per the research note, `.ics`-over-WhatsApp is extension-driven client behavior. Before declaring this shippable, send one real booking link to an iPhone and an Android handset and confirm the "Add to Calendar" prompt appears and the event lands with the right time. Do this in the dev environment, never during a live demo.
