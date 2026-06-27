# Conversations / Contacts Split + Multi-Service Nav

**Status:** Draft (design agreed, not yet built)
**Date:** 2026-06-26
**Touches:** the "done" Leads page (`LeadsCardView`), `RightSidebar` nav, routing.
Nothing is built from this doc yet — it's the agreed model to sign off before code.

---

## 1. Why

The Leads page was built for the reactivation campaign: a contact list with a
WhatsApp-style chat panel. We now run multiple services (Reactivation,
Speed-to-Lead, an AI website widget, Reputation, Missed-Call Text-Back). They are
**different kinds of work**, so one page can't be the home for all of them without
getting messy. This splits the model along a clean axis a newcomer can repeat:

> **Contacts = who. Conversations = talking to them. Each service page = running that service.**

## 2. The split rule (decides where anything new goes)

**Does it produce a real two-way text thread?**

- **Yes → Conversations.** Reactivation, Speed-to-Lead, AI website widget, and the
  texts that come out of a missed call.
- **No → its own service cockpit.** Reputation (a single public review reply, not a
  balloon thread) and the Missed-Call call log / callback queue.

A missed call legitimately splits: the **call log** lives on the Missed-Call page,
the **text thread it spawns** lives in Conversations. That's correct, not duplicated.

## 3. Pages

### Contacts (new — absorbs today's Leads TABLE + PIPELINE tabs)
- The universal directory: **every** lead, every service (gated by activation).
  Includes people with **no thread yet** (fresh import, just-arrived lead).
- Views: **Table** (default) and **Pipeline** (kanban). Switched like tabs.
- Score column is **reactivation-only** — blank/"—" for other services.

### Conversations (rename of today's Leads page / `LeadsCardView`)
- Two-way text threads only, in the existing chat UI. Recency/unread ordered.
- **Service filter** at the top (only services the account activated; see §6).
- Visibility (permission layer, rides along wherever chat shows):
  - **Owner/Admin:** full chat balloons.
  - **Client:** summary of the interaction + contact + score (no balloons).

### Service cockpits
- **Reactivation** — Campaigns dashboard (existing).
- **Speed-to-Lead** — Performance + Settings (built). Live-feed rows deep-link into
  the Conversations chat for that lead (filtered to Speed-to-Lead).
- **Reputation** — its own interface (not a chat).
- **Missed-Call** — call log / callback queue (resulting texts spill into Conversations).

## 4. The shared pipeline (one funnel, per-service entry stage)

One ordered funnel for everyone:

`NEW → CONTACTED → RESPONDED → MULTI → QUALIFIED → BOOKED`

Each `campaign_type` declares an **entry stage**. The cold front-end columns
(NEW, CONTACTED) only exist for cold/outbound services:

| Service | Entry stage | Uses columns |
|---------|-------------|--------------|
| Reactivation (cold) | NEW | all six |
| Speed-to-Lead (inbound) | RESPONDED | RESPONDED → BOOKED |
| AI website widget (inbound) | RESPONDED | RESPONDED → BOOKED |
| Missed-call follow-up (inbound) | RESPONDED | RESPONDED → BOOKED |

Kanban rendering rule:
- **Filtered to one service** → hide every column left of that service's entry stage.
- **"All"** → show all six; inbound leads simply never appear in NEW/CONTACTED, so
  those columns naturally contain only reactivation leads (informative, not a bug).

Notes:
- MULTI is a position a lead *can* sit in, not a mandatory step (Speed-to-Lead can go
  RESPONDED → QUALIFIED → BOOKED fast).
- **Lost / DND are visible terminal columns** (confirmed 2026-06-26). The kanban already
  renders `Lost` and `DND` as real columns (`LeadsKanban.PIPELINE_STAGES`); we keep them
  on the board so dead/lost leads stay seen, rather than hiding them in an archive.

Implementation shape: one funnel constant + an `entryStage` per `campaign_type`;
the kanban hides columns left of the active filter's entry point. Scoring stays a
reactivation-only field.

## 5. Navbar layout (agreed placements)

Current: **Services** = Reputation, Speed-to-Lead, Missed Calls (Reactivation
excluded, lives in Engage). **Engage** = Reactivation/Campaigns, Leads(→/contacts),
Calendar.

Target:

```
HOME

SERVICES         ← gated by activated services (§6)
  Reactivation   ← MOVED here, top of the section
  Speed-to-Lead
  Reputation
  Missed Calls

ENGAGE
  Conversations  ← rename of today's Leads page (proposed placement — confirm)
  Calendar
  Contacts       ← BELOW Calendar (new page)

ADMIN / BACKEND / OUTREACH — unchanged
```

- **Reactivation → top of Services.** Remove the "Reactivation lives in Engage"
  exclusion; it becomes the first service. The `/platform/campaigns` route is unchanged.
- **Contacts below Calendar** in Engage, as a distinct page/route (`/platform/contacts`
  is currently the Leads chat page — routing needs untangling; see §7).
- **Conversations** sits at the **top of Engage** (confirmed 2026-06-26).

## 6. Activated-services gating

An account has a set of activated `campaign_type`s. That set drives, in one place:
- which **Services** nav items render (vs hidden — not just "Soon"),
- which **Conversations** service-filter tabs render,
- which **Pipeline** columns/stage-sets are reachable.

A reactivation-only client never sees a Speed-to-Lead tab, filter, or column anywhere.

## 7. Open items / risks before build

1. ~~**Routing untangle**~~ — RESOLVED (Slice 1, below). `/platform/conversations` =
   chat, `/platform/contacts` = directory (table+pipeline), `/platform/leads` = legacy
   combined. Chat-opening call sites now target `/conversations`.
2. ~~**Conversations nav placement**~~ — RESOLVED: top of Engage.
3. ~~**Pipeline "All" view" terminal/lost handling**~~ — RESOLVED: Lost/DND stay visible
   columns (see §4).
4. **AI website widget** is named as its own service/filter but **not built yet**.
5. The Leads page is marked "done" in CLAUDE.md — this is a deliberate, signed-off
   re-architecture of it, not structural-debt rework.

## 9. Build status

**Slice 1 — page split + nav reorg (BUILT 2026-06-26):**
- `LeadsTable` takes a `mode` prop (`conversations` | `contacts` | `all`); `allowedViews`
  derives from it. Conversations forces the chat list (switcher hidden); Contacts defaults
  to Table and offers Table+Pipeline; `all` is the legacy three-view page. View-mode
  persistence is scoped per mode.
- Routes: `/platform/conversations`, `/platform/contacts`, `/platform/leads` (legacy).
- Nav: Reactivation → top of Services (Reactivation, Speed-to-Lead, Reputation, Missed
  Calls); Engage = Conversations, Calendar, Contacts. Mobile primary tab → Conversations.
- i18n: `crm.sidebar.conversations` + `crm.sidebar.contacts` (en/nl/pt).

**Not yet built (next slices):** per-service entry-stage column hiding (needs the service
filter UI + `campaign_type` on the leads query), activated-services gating of nav/filters,
client-vs-owner chat visibility layer, AI website widget service.

## 8. Out of scope (for this doc)

- Backend `campaign_type` plumbing already exists (Hulk strategy); this doc is the
  frontend page/nav model only.
- Reputation and Missed-Call cockpit internals (covered by their own specs).
