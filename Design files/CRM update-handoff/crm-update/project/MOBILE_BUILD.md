# Lead Awaker — Mobile build notes (handoff)

Context for continuing the mobile app. **Read this + the files it points to, then build.**
Deliverable so far: `Lead Awaker Mobile.html` — one Android phone running the whole mobile app.
**Campaigns**, **Leads**, **Tasks**, and **Calendar** tabs are all done — no placeholders remain.

## Locked decisions (don't re-litigate)
- **One unified mobile app**, NOT per-page responsive files. The bottom tab bar IS the
  navigation, so all screens live in one HTML and switch via the router.
- **Transition = variation B (bottom sheet).** Every list→detail drill-down rises as a
  dimmed sheet with a drag handle. (We explored push/expand and dropped them.)
- **Calendar default view on phone = agenda / day list** (month grid is unusable at phone
  width; offer it only as a secondary toggle if at all).
- Design system unchanged: warm-bone neumorphic, wine accent. Tokens in `design-system.css`
  (`--bg`, `--surface`, `--card`, `--ink`, `--wine`, `--mono`, `--serif`, `--sh-raised-crisp`,
  `--sh-inset-crisp`, `--good`, `--warn`, `--stage-lost`, etc.). Touch targets ≥44px.

## Architecture
- `Lead Awaker Mobile.html` — host. Loads React+Babel, then data files, then jsx. Renders one
  `<AndroidDevice bg="var(--bg)">` containing `<MobileApp/>`, centered on a dark stage.
- `mobile-app.jsx` — **the router.** `MobileApp` holds `tab` state, renders the active screen
  + `<MobBottomNav>`. Also contains `MobCampaignsScreen`, `MobListScreen`, `MobCampaignCard`,
  `MobDetailBody`, `MobMore`.
- `mobile-shell.jsx` — **shared chrome.** Exports `MobBottomNav`, `MobListBar`, `MobDetailBar`,
  `IconBtn`, `MobPlaceholder`, **`MobSheet`** (the reusable bottom sheet), **`MobRecede`**
  (wrapper that scales the screen back when a sheet is open).
- `mobile-detail.jsx` — Campaign detail body (`MobStats`, `MobSettings`, `MobCard`).
- `mobile-tasks.jsx` — **reference implementation of a full tab.** Self-contained Tasks screen
  (agenda + board + filters + assignee toggle + detail sheet). Copy this file's structure.
- `mobile-leads.jsx` — **done.** Second full tab, same recipe: `MobLeadsScreen` with a grouped
  list view + Chats-peek toggle + filter chips + horizontal pipeline board, and a detail sheet
  whose hero carries a pipeline bar and Chat/Summary/Score/Info tabs. All helpers `ML*`-prefixed.
  Good second example to copy alongside Tasks.

### The pattern for a new tab (follow Tasks / Leads exactly) — NOW: Calendar
1. New file `mobile-calendar.jsx` exporting `MobCalendarScreen` via `Object.assign(window, {...})`.
2. The screen is **self-contained**: owns its own `useState` for selection + sheet `open`,
   wraps its scrollable content in `<MobRecede open={open}>`, and renders `<MobSheet open onClose>`
   with the detail body inside. (See `MobTasksScreen` at the bottom of `mobile-tasks.jsx`.)
3. Add `<script type="text/babel" src="mobile-calendar.jsx">` to the HTML (before `mobile-app.jsx`),
   and add the data file `<script src="calendar-data.js">`.
4. In `mobile-app.jsx` `MobileApp`, replace the `MobPlaceholder` line:
   `{tab === 'Calendar' && <MobCalendarScreen />}`. (This is the last placeholder.)

## GOTCHA — global name collisions (this bit us once)
Each `<script type="text/babel">` runs in its own scope; cross-file refs resolve via
`window`, and every file ends with `Object.assign(window, {...})`. So **two files that both
define a component called `StatusPill` will clobber each other.** `components.jsx` has a
campaign `StatusPill(status=)`; `tasks-views.jsx` has a task `StatusPill(k=)`.
**Fix we used:** do NOT load `tasks-views.jsx`/`leads-views.jsx`/`calendar.jsx` wholesale into the
mobile host. Instead load only the **data** file (`calendar-data.js`) and re-implement the small bits
you need inside `mobile-calendar.jsx` with **prefixed names** (e.g. `MC*`, like Tasks used `MT*`
and Leads used `ML*`).
Reuse desktop logic by reading the source and porting helpers, not by loading the view file.

## Desktop source to reflow (Calendar — the remaining tab)
- **Calendar:** `Calendar Page.html` → `calendar-data.js`, `calendar-app.jsx`, `calendar.jsx`.
  Mobile: **agenda/day list** default (locked decision — month grid is unusable at phone width;
  offer month only as a secondary toggle if at all). Tap an event → detail sheet (`MobSheet`).
  Read the desktop event data + helpers and port them with `MC*` prefixes; mirror how
  `MobTasksScreen`'s agenda groups by day.
- **Done (reference):** Leads → `mobile-leads.jsx`; Tasks → `mobile-tasks.jsx`.

## Icons & primitives
- Icons live in `components.jsx` (`IconLeads`, `IconCal`, `IconSearch`, `IconBell`, `IconChev`,
  `IconSwap`, `IconFilter`, `IconSort`, `IconMore`, `IconSettings`, `IconLayers`, `IconTasks`…),
  all `(props)=><Icon {...p} d={<>…</>}/>`. For glyphs not present (plus, check, clock) use inline
  `<svg>` like `mobile-tasks.jsx` does.
- `MobListBar` currently hardcodes the title "Campaigns" — for a new tab, build a small bar in
  the tab file (see `MTTasksBar` in `mobile-tasks.jsx`) rather than reusing `MobListBar`.

## Verify
After building: `done` on `Lead Awaker Mobile.html`, fix any console errors, then
`fork_verifier_agent` with a directed task clicking through the new tab + its sheet.
