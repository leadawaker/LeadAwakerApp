# Receptionist onboarding: implementation plan

1. [x] DB: add `services jsonb`, `setup jsonb` to `p2mxx34fvbf3ll6."Account_Communication_Profile"` (direct pg script, db:push needs a TTY).
2. [x] `shared/schema.ts`: the two columns plus zod (`services` = array of service keys, `setup` = loose object).
3. [x] `communication/setupConstants.ts`: service keys, `ReceptionistSetup` type + empty value, voice/locale options, the step definitions each service adds.
4. [x] `profileConstants.ts`: new section and step keys, `ProfileAnswers.services` + `.setup`, `buildSteps(services)` / `buildSections(steps)`; `STEPS` stays the core list.
5. [x] `useCommunicationProfile.ts`: map `services` / `setup` to and from the API.
6. [x] `communication/ServiceSteps.tsx`: renderers for services, stock, handoff, voice, whatsapp steps; embeds WebsiteChatCard, MessagingCard, InboundWhatsAppCard.
7. [x] `ProfileWizard.tsx`: dynamic steps and sections from `a.services`, dispatch new custom keys to ServiceSteps.
8. [x] `ProfileSummary.tsx`: take the dynamic step list, values for new keys, new section groups.
9. [x] `CommunicationProfilePanel.tsx` + `OverviewTab.tsx`: pass account, detail and onSave down; widget + WhatsApp status into the summary snapshot.
10. [x] i18n: en, nl, pt (Brazilian) keys under `communicationProfile`.
11. [x] Verified in the browser on Sandbox Client (47): all 11 sections render, ticks add and remove sections, Finish saves `services` + `setup` (profile restored afterwards).
12. [x] Widget key bug: `generateWidgetKey` could return a 23-character key (base64url "-" and "_" stripped), which failed `KEY_RE` so the preview iframe got a 403 and stayed blank. Generator fixed in `server/routes/widget.ts`; Robben's key (config 10) replaced.
13. [x] Call notes: `communication/CallNotes.tsx`, pinned to the bottom of the Communication tab, autosaves to the account's internal `notes` field (never the KB), collapsible, agency only.
