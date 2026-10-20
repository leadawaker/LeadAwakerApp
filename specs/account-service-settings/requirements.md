# Account service settings: one place per client

Status: agreed with Gabriel 2026-10-15. Nav order done the same day. Account → Chat tab BUILT 2026-10-15
(`workspace/chat/`, uncommitted): six sections, edits the receptionist campaign through `useCampaignDetail`
(buildDraft gained `handoff_on_first_request`). No "create campaign" button: the empty state links to the
Campaigns page, because POST /api/campaigns makes a DBR-shaped campaign (no bump_mode, a default llama prompt)
and does not wire the widget or `inbound_campaign_id`. Reactivation tab and Campaigns page changes not built.

## Why

Dashboards moved to Home (one tab per service). What is left on the Campaigns
page is mostly settings, and those were built for database reactivation (DBR).
Receptionist clients (Robben) have one campaign that quietly holds the phone
line, the website chat and inbound WhatsApp, so "campaign" is a word users
should not need to learn. Settings belong to the client, which is the Account.

## Decisions

- **Home** holds every dashboard. The Campaigns page loses its dashboard tab.
- **Account workspace** gets one tab per service, each with the left section rail
  (`workspace/SectionRail.tsx`):
  - **Phone** (exists).
  - **Chat** (new): the website widget and WhatsApp receptionist behaviour that
    lives on the receptionist campaign today: greeting, AI behaviour, the single
    receptionist follow-up (bump), stop rules, active hours. Widget wiring and
    WhatsApp connection stay on Integrations.
  - **Reactivation** (new, only when the account has DBR campaigns): the list of
    that client's reactivation campaigns; selecting one opens its settings
    (the current campaign settings sections, reused, not copied).
- **Campaigns page** stays as an agency-only list of all campaigns across clients,
  last in the nav under "Setup". Rows link into the account's tab.
- **Nav**: Home, Demos, then the rest; Campaigns at the bottom (done 2026-10-15).

## Requirements

1. Inventory every field on the campaign settings page (`features/campaigns/components/settings/`)
   and tag it: receptionist, DBR, or both. Only "receptionist/both" fields appear on Account → Chat.
2. Account → Chat edits the account's receptionist campaign (the one its widget and
   `inbound_campaign_id` point at). If there is none, offer to create it.
3. Saves reuse the existing campaign save path (`buildDraft` whitelist, 1.5s autosave;
   see memories on both gotchas). No second copy of campaign data.
4. Account → Reactivation reuses the campaign settings components with the campaign id passed in.
5. Clients (read-only) see the same tabs read-only, like Phone and Alerts.
6. i18n en/nl/pt, tokens only, no serif.

## Out of scope

- Changing the engine's campaign model (`campaign_type` stays as is).
- Merging Voice calls or Chats into the account page.

## Done when

- A receptionist client can be fully set up from Accounts (Integrations, Phone, Chat, Alerts) without opening the Campaigns page.
- A DBR campaign can be configured from Account → Reactivation, and the Campaigns page still lists and links it.
