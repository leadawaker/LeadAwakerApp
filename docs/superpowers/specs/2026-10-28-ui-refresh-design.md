# UI refresh: tabs, Calls, Chats, Home, sidebar fold (2026-10-28)

Gabriel's goals: one consistent tab look across the CRM, a calmer Calls list (2-row cards), less chrome in topbars, and a Home (ex-Stats) page that reads as one filterable dashboard. Every change ships desktop AND mobile. All text via `t()` in en/nl/pt (pt = Brazilian). Tokens only, no raw hex, no `transition-all`, no tsc runs.

## 1. Tab styles
- **Main tabs (every page's primary tab strip):** pill shape of `PillSwitch` (inset `--bg` track, `--r-pill`, 3px pad, sans 12.5px, icon). Selected = solid `--wine` fill, `--on-wine` text, weight 700, `--sh-raised-crisp` (the Accounts look). Applies to `PillSwitch` default, `TopbarTabs` (Accounts, Prompts, Prospects, Demos, Reputation, Docs, hidden pages), Social Insights|Work, inline `la-seg` main tabs in Leads, Calendar, Billing, and mobile `MobileTabSeg`.
- **Soft variant** (`PillSwitch variant="soft"`): the old PillSwitch selected look (14% wine tint into `--card`, 1px inset ring 35%, wine text, flat). Used for: People | All calls, `ScopeSwitch` (Live/Tests/Demo, keeps its own colours).
- Not changed: Settings `SectionRail`, filter-type `la-seg--pill` (Automation Logs, Traffic), Chats channel tabs.
- Consolidate the duplicate `.la-seg` / `.la-seg-btn` definitions (`design-system.css` vs `components.css`).

## 2. Calls page (features/voiceCalls)
- Calls | Settings switch is replaced by a "Call settings" button (gear) in the topbar; inside settings a "Calls" back button (arrow). Same on mobile.
- Stats line (`WeekSummary`) leaves the topbar and sits under the People | All calls switch in the list panel. All calls: "Calls · Booked · Avg length". People: "N people" only.
- People | All calls switch uses PillSwitch `variant="soft"`.
- Owner `AccountFilter` chip leaves the topbar; becomes an "Account" submenu inside the Filter menu of both tabs (Owner + Live only), filter dot reflects it. Mobile too.
- The page follows the sidebar account picker (`useWorkspace().currentAccountId`): switching account refreshes Calls immediately. Filter submenu and sidebar stay in sync.
- Account name on cards shows only when no single account is selected (all-accounts view). One account selected = sub-account view = hidden.
- **All calls card, 2 rows:** row 1 name (+ muted ` · Account` in all-accounts view) | right: date `·` duration as `m:ssm` (e.g. `0:13m`). Row 2: recap clamped to 1 line | outcome tag right. Tag: no dot, smaller text. "Answered" tag hidden. On hover (hover-capable devices) the card grows to show a 2nd recap line (animate max-height, not transition-all).
- **People card, 2 rows:** row 1 name (+ account in all-accounts view) | last call time. Row 2 phone number | status tag. Drop company and call count.
- Callback button: soft white raised style (same as WhatsApp button). "Message on WhatsApp" label becomes "WhatsApp".
- Identities (`PresentingToggle`): icon only (eye), Owner only, shown on the Calls list view, not in Call settings.

## 3. Chats page (features/leads)
- Chats | Settings switch replaced by "Chat settings" button; in settings a "Chats" back button. Mobile too.
- Identities eye icon (Owner only) in the Chats topbar right cluster, not in Chat settings. Shares `usePresenting` state with Calls. When on, mask lead names and phone numbers (list cards, conversation header, numbers inside message text) with `maskIdentity.ts`.
- Rename "Website" channel label to "Webchat" everywhere in UI strings ("Website chat" too). DB key `website` unchanged.
- Reactivation conversations (type `dbr`) get a small "Reactivation" badge on their chat card. Chats > Settings gets an agency-only "Reactivation settings" link to Accounts > Reactivation.
- Rename campaign settings "Launch Campaign" (wa.me test link) to "Test on my phone".

## 4. Home page (ex-Stats, features/home)
- Rename Stats to Home (nav label, page header).
- Service cards: one horizontally scrolling row with a fade at the right edge. Taller image; card title on the image's top-right corner. No Open button: whole card clickable (same destinations as before, keyboard accessible).
- Layout under the cards: row 1 = By channel (current 1/3 width) + Conversations per day (rest). Row 2 = Recent Activity + Needs attention, 50/50, equal height (internal scroll if long).
- By channel becomes a vertical tab switcher: "All" on top then one row per channel, selected row solid wine. Rows keep their conversations/bookings numbers, compact. Selection filters Recent Activity, Needs attention and Conversations per day (server `channel` param). Recent Activity's own channel switch is removed; "All" mixes channels.
- Every Recent Activity / Needs attention entry shows its channel icon. Call recaps truncate to 1 line. "Questions answered" tag hidden; other tags get distinct token colours (Booked, Callback, Transferred, Hung up, channel tags).
- Period dropdown (top-right of By channel): All time (default), This year, This month, This week, Today. Replaces the header period select and drives the whole page including the cards. All time has no trend comparison. Day chart buckets: month for All time/This year, day for month/week, hour for Today. Needs attention stays period-independent (open items).

## 5. Sidebar and shell
- The list-panel fold button (`PanelLeft`, driven by `useListPanelState`) moves from every page topbar to the bottom-right of the sidebar footer (right of the profile row). Only shown on pages that have a list panel.
- Check other pages follow the sidebar account picker without navigation.

## Calls made by Claude (Gabriel delegated)
By channel keeps numbers; period drives cards; Needs attention ignores period; Chats channel tabs unchanged; "Test on my phone" naming.
