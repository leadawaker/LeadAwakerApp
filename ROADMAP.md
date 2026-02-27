# Lead Awaker — Roadmap

> Future features and improvements, organized by system layer.
> Updated: 2026-02-27

---

## 1. Reactivation Engine ("The Blood")

### Outreach & Messaging
- [ ] WhatsApp integration (Twilio or Meta Cloud API)
- [ ] SMS integration (Twilio)
- [ ] Instagram DM integration
- [ ] AI initial conversation handling
- [ ] Human takeover system
- [ ] Display which user joined conversation
- [ ] Stop automation when human takeover happens
- [ ] Keyword/intent detection → auto-tagging
- [ ] Auto-send booking link when interest detected

### Follow-Up Automations
- [ ] Auto-follow-up if no reply (24h → 48h → 72h)
- [ ] Auto-reminder before booked call (SMS/WhatsApp)
- [ ] Auto-move pipeline stage after: Reply / Booking / No-show / Closed

### Pipeline Logic
- [ ] Automatic stage movement
- [ ] Lead owner assignment
- [ ] Hot lead tagging logic
- [ ] Lead score computation (engagement_score + activity_score → lead_score, calculated after each interaction)

---

## 2. Notification Layer

### Inside CRM
- [ ] Unread message badge counter
- [ ] "New reply" banner
- [ ] Conversation activity indicator
- [ ] Show which team member is speaking

### Alerts
- [ ] Optional email notification toggle
- [ ] Optional SMS alert for hot leads
- [ ] WhatsApp reply notifications inside CRM
- [ ] Notification settings per booked call (calendar-based)

---

## 3. Agency View (Control Center)

- [ ] Multi-subaccount management
- [ ] Campaign-level overview
- [ ] Collapsible campaign left panel (default folded if only 1 campaign)
- [ ] Subaccount performance metrics: messages sent, replies, conversations active, calls booked, revenue generated
- [ ] Automation builder interface
- [ ] Twilio integrated authentication (SMS login like GHL)
- [ ] Broken page fix (stability first)
- [ ] Subaccount page optimization

---

## 4. Subaccount View (Client Experience)

- [ ] Simplified dashboard: leads revived, active conversations, calls booked, revenue generated
- [ ] Messaging center
- [ ] Display of active human operator
- [ ] Calendar integration
- [ ] Notification preferences
- [ ] Simple invoice system (upgrade later)
- [ ] Contracts (possibly inside settings)

---

## 5. Financial Layer

- [ ] Invoice page (existing)
- [ ] Stripe embedded payment (future upgrade)
- [ ] Expense tracking
- [ ] Revenue section in left menu (recommended structure)

---

## 6. Call & Calendar System

- [ ] Instant "Book Call Now" feature
- [ ] Calendar integration
- [ ] Per-booked-call notification settings
- [ ] SMS/WhatsApp reminders
- [ ] Integration with task associations (future phase)

---

## 7. Advanced / Phase 2–3

### Voice AI
- [ ] Inbound & outbound voice AI
- [ ] Call recording
- [ ] Full transcription
- [ ] Transcript + audio toggle button
- [ ] AI-generated call summaries
- [ ] Sentiment detection

### Outreach Enhancements
- [ ] AI-generated WhatsApp voice follow-ups
- [ ] Performance analytics per campaign
- [ ] Conversation scoring

---

## 8. Internal / Optional

- [ ] Internal task manager (associated with accounts & campaigns, integrated into calendar — deprioritized while Notion exists)
- [ ] Autoforge exploration for adding features
- [ ] User tutorial system / onboarding walkthrough (possibly interactive guidance)

---

## 9. UX & Structure

- [ ] Settings button moved to bottom of left panel
- [ ] Revenue section separated from Settings
- [ ] Color palette refinement
- [ ] Clean UI hierarchy between Agency view and Subaccount view

---

## 10. Infrastructure

- [ ] Twilio automations (deep integration)
- [ ] WhatsApp official API compliance
- [ ] SMS authentication login
- [ ] Automation engine stability

---

## Strategic Summary

| Layer | Purpose |
|---|---|
| Reactivation Engine | Core AI-powered outreach and follow-up |
| Automation Brain | Pipeline logic, auto-tagging, stage movement |
| Notification Layer | Real-time alerts, badges, team awareness |
| Client Retention Dashboard | Subaccount-facing simplified view |
| Financial Layer | Invoices, expenses, Stripe, revenue tracking |
| Future AI Expansion | Voice AI, sentiment, conversation scoring |
