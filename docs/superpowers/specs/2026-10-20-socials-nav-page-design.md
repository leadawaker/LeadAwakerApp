# Socials in the nav bar (Phase A of the social studio build)

Date: 2026-10-20
Status: built on `feat/social-studio`, awaiting Gabriel's review

## Why

Gabriel: "I want Socials on the left menu bar, not tucked within the account." Project 1 put the
scheduled Reels in a `social` tab of the account workspace. Daily use (posts, approvals, and the
studio, comment-to-DM and insights that follow) belongs on its own page.

## What changes

- New page `/platform/social` (`client/src/features/social/pages/SocialPage.tsx`), lazy in `pages/app.tsx`.
  `App.tsx` already sends every `/platform/*` path to the app area, so it needs no entry of its own.
- Nav key `social` in `ClientNavKey` and `AgencyBarKey` (`navGates.ts`), icon `Clapperboard` (`navIcons.ts`),
  label `sidebar.social` in `crm.json` (en "Socials", nl "Socials", pt "Redes sociais").
- Agency: the nav bar shows Socials in the Engage group, the mobile More page lists it under Engage, the
  command palette finds it. The agency bottom bar does not change.
- Client (Manager, Viewer): Socials appears only when the account has `social_enabled`
  (`useClientNavFacts().hasSocial`, read from the same `social-status` query the page uses). Desktop: after
  Calendar. Mobile: it takes the free fourth bottom-bar slot when there is one (a client without a voice
  line has three tabs), otherwise it is first on More.
- Account picker: agency users get a compact picker in the page header listing only accounts with Social on.
  It drives the global account switcher, so the nav bar and the page always agree. When the switcher holds
  an account without Social (or agency view), the page shows the first account that has it.
- Client users see their own account, no picker. A client whose account has Social off is sent to Home.
  The server keeps refusing them anyway (`accountGate`, 403 `not_enabled`).
- The `social` workspace tab is gone. `?tab=social` links (notifications sent before this) open
  `/platform/social`. New notifications link there directly (`POST_LINK` in `postRoutes.ts`, `publisher.ts`).
- Integrations keeps the Connect / Disconnect card and the Social on/off switch (account setup). The
  connected card gets a "Go to Socials" link; the switch also refreshes the accounts list so the page picker
  updates. After the OAuth return the toast has an "Open Socials" action. The return URL stays
  `/platform/accounts?instagram=...`.
- New i18n namespace `social` (`locales/{en,nl,pt}/social.json`) for every new Socials string. The Project 1
  strings stay in `accounts.json` under `social.*`.

## My calls

- Picker drives the global switcher instead of a page-local selection: one source of truth.
- Socials takes a free bottom-bar slot for clients (Augusto has three tabs), else More. Nobody's bar changes
  unless Social is on for them.
- Icon `Clapperboard` (Reels), not a brand logo.

## Tests

`navGates.test.ts` (Socials order, bar slot, More, agency bar unchanged), `socialPage.test.ts` (picker list,
which account the page shows), `socialLocales.test.ts` (nav label in three languages, old tab label gone,
`social` namespace parity, no em dashes).
