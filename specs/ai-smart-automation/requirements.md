# AI Smart Automation — Requirements

## Overview

Upgrade the automation engine from static template-based follow-ups to intelligent, context-aware AI interactions. Five interconnected features that transform the AI from a simple message sender into a real sales assistant.

---

## Feature 1: AI-Powered Contextual Bumps

### Problem
Bump messages are static templates (`bump_1_template`, `bump_2_template`, `bump_3_template`) with variable substitution. Every lead gets the same message regardless of conversation history or funnel stage. A lead who had a rich 10-message exchange about pricing gets the same "Hey {first_name}, just checking in!" as one who never replied.

### Solution
For leads past the "Multiple Responses" stage, replace template bumps with AI-generated messages that reference the actual conversation.

### Rules
- **Template bumps still apply** for leads at Contacted/Responded stage (no conversation context to reference)
- **AI bumps activate** when `conversion_status` is in: `Multiple Responses`, `Qualified`, `Call Booked` (but didn't complete booking)
- AI reads last 15 interactions via `get_interactions_for_lead()`
- AI generates a natural follow-up that recalls what was discussed
- Tone and persona come from campaign AI settings (agent_name, ai_style, etc.)
- Message must pass existing output guardrails before sending
- If AI generation fails, fall back to the template bump

### Examples
- Qualified lead who discussed solar panel pricing 3 days ago: "Hey Tom, was thinking about what you said about the roof orientation. Did you get a chance to check if south-facing panels would work for your setup?"
- Lead who was close to booking but went silent: "Hi Tom, last time we chatted you seemed ready to go ahead with the consultation. Still interested? Happy to find a time that works."

### Acceptance Criteria
- [ ] Bump scheduler checks `conversion_status` before choosing template vs AI path
- [ ] AI path loads conversation history and generates contextual message
- [ ] Output guardrails validate AI-generated bump before sending
- [ ] Template fallback if AI fails or times out (30s)
- [ ] Logged in Automation_Logs with `triggered_by: 'ai_bump'`
- [ ] Interaction record has `isBump: true` and a new field `isAiGenerated: true`

---

## Feature 2: Nightly Campaign Summaries

### Problem
Campaign summaries only generate on button press. No proactive reporting. Same content for admin and clients.

### Solution
Run campaign summary generation nightly at midnight (account timezone). Two distinct summary types based on user role.

### Admin Summary (Gabriel only)
Focuses on operational insights and what to fix:
- Which campaigns are underperforming and why
- Leads stalling at specific funnel stages (bottleneck detection)
- Response rate trends (improving/declining vs yesterday)
- Bump exhaustion rate (too many leads going to Lost?)
- AI conversation quality (guardrail trigger rate, handoff rate)
- Actionable recommendations: "Campaign X has 40% of leads stuck at Qualified. Consider adjusting the booking CTA." or "Bump 2 template on Campaign Y has 2% response rate. Rewrite it."
- Cross-campaign comparison when multiple active

### Client Summary
Focuses on results and reassurance:
- Leads contacted today, responses received
- New bookings/qualified leads
- Overall campaign health (on track / needs attention)
- Highlight: best-performing message or lead interaction
- Simple language, no jargon, encouraging tone
- One clear next step if action needed: "3 leads are waiting for your callback"

### Delivery
- Stored in `Campaigns.aiSummary` / `aiSummaryGeneratedAt` (overwriting previous)
- In-app notification: "Your nightly campaign report is ready"
- Optional: Telegram push for admin

### Acceptance Criteria
- [ ] Cron job runs at midnight per account timezone
- [ ] Only runs for campaigns with `status = 'active'`
- [ ] Admin gets operational/diagnostic summary
- [ ] Client gets results-focused summary
- [ ] Summary stored in DB and accessible from campaign detail
- [ ] Notification sent when summary is generated
- [ ] Manual "Generate Summary" button still works (on-demand)

---

## Feature 3: Buying Signal Detection & Instant Alerts

### Problem
When a lead says "I'm ready, call me now", the AI just responds with another message. No human gets notified. The hot moment passes.

### Solution
Add a buying signal classifier in the inbound handler pipeline. When detected, instantly notify the closer/account owner.

### Signal Categories
1. **Immediate intent**: "call me now", "I'm ready", "let's do this", "I want to sign up", "take my money"
2. **Scheduling intent**: "when can we talk?", "are you free tomorrow?", "can someone call me?"
3. **Price-ready**: "how much?", "what's the pricing?", "send me an invoice" (when in Qualified+ stage)

### Scope
- **Only for campaigns with `bookingModeOverride = 'Call Agent'`** (Direct Booking leads can self-book)
- Signal detection runs BEFORE the AI generates its response
- Groq classifier (fast, cheap) with regex pre-filter for obvious patterns

### AI Response Behavior
When a buying signal is detected:
- AI responds naturally as the persona: "Let me check my agenda and I'll call you right back. Just in the middle of something."
- If the closer doesn't act within 15 minutes, AI follows up: "Unfortunately can't do it right now, let me book you for another time. When works best for you?"
- This follow-up template is configurable per campaign in the AI Behavior settings

### Notification
- **Immediate** push to closer (Telegram + in-app + web push)
- Notification includes: lead name, phone, the exact message, conversation summary
- Link directly to the conversation in the CRM

### Acceptance Criteria
- [ ] Buying signal classifier integrated into inbound_handler pipeline
- [ ] Only triggers for Call Agent campaigns
- [ ] Instant notification to account owner/closer
- [ ] AI responds with "checking my agenda" style message (configurable template)
- [ ] 15-minute fallback if closer doesn't act
- [ ] Signal logged in Automation_Logs
- [ ] Lead tagged with `buying_signal_detected`

---

## Feature 4: Smart Human Handoff (Beyond Guardrails)

### Problem
Current human takeover only triggers on safety guardrails (prompt injection, PII leakage). Business-level handoff scenarios are unhandled:
- Lead detects AI and insists on talking to a human
- Lead asks questions the AI can't answer (even with knowledge base)
- Lead is frustrated AND explicitly requests a person

### Solution
Add business-logic handoff detection alongside existing guardrails.

### Handoff Triggers

#### Tier 1: Immediate handoff
- Lead explicitly requests human: "let me talk to a real person", "connect me with someone", "I want to speak to a human"
- Lead identifies AI after 2+ exchanges: first time AI deflects naturally ("Haha, I get that a lot"), second insistence triggers handoff
- Lead uses aggressive language + requests human

#### Tier 2: AI-initiated handoff
- AI can't answer a question even after checking the knowledge base (Feature 5)
- AI detects the conversation is going in circles (3+ messages on same topic without resolution)
- Lead asks about something requiring real-time business decisions (custom pricing, exceptions, negotiations)

### AI Behavior Before Handoff
- First "are you AI?" inquiry: Deflect naturally per persona. "Haha no, I'm just quick with my phone"
- Second insistence: Come clean. "Fair enough, I am an AI assistant. But I can still help you with most questions. What do you need?"
- If lead still insists on human after admission: Handoff. "Got it, let me connect you with [agent_name/owner]. They'll reach out shortly."

### Acceptance Criteria
- [ ] AI-detection deflection logic (1st deflect, 2nd admit, 3rd handoff)
- [ ] Knowledge-gap handoff when lookup_business_info returns no results
- [ ] Circular conversation detection (3+ loops on same topic)
- [ ] All business handoffs logged with reason in Automation_Logs
- [ ] Tag: `human_handoff_business` (distinct from `human_takeover` guardrail tag)
- [ ] Notification with handoff reason sent to account owner

---

## Feature 5: Business Knowledge Base + AI Lookup Tool

### Problem
The AI pretends to be the business owner but can't answer basic questions about pricing, services, hours, team, etc. Current business info is scattered: some in Accounts (businessDescription, serviceCategories), some in Campaigns (usp, service). None of it is accessible to the AI as a tool.

### Solution
Structured knowledge base per account, queryable by the AI via a `lookup_business_info(category)` tool.

### Knowledge Categories
| Category | Example Content |
|----------|----------------|
| `pricing` | "Solar panel installation: EUR 5,000-12,000 depending on roof size. Free consultation included." |
| `services` | "Residential solar, commercial solar, battery storage, EV charger installation" |
| `faq` | "Q: How long does installation take? A: Typically 1-2 days for residential." |
| `team` | "Jan (owner, 15yr experience), Maria (sales), Pieter (lead installer)" |
| `hours` | "Mon-Fri 8:00-17:00, Sat by appointment. Closed Sunday." |
| `location` | "Main office: Keizersgracht 123, Amsterdam. Service area: Noord-Holland, Zuid-Holland" |
| `policies` | "10-year warranty on all installations. Free maintenance first year." |
| `testimonials` | "4.8 stars on Google (127 reviews). Recent: 'Jan and his team were fantastic...'" |

### Where It Lives
- **Data storage**: New table `Account_Knowledge_Base` with fields: `id`, `accountId`, `category`, `title`, `content`, `updatedAt`
- **UI**: Accounts page, new "Knowledge Base" tab/section
- **Entry**: Manual input by admin/client during onboarding. Simple form: pick category, add title, write content.

### AI Tool: `lookup_business_info`
- Available to the AI conversation engine (not in system prompt, called on demand)
- Input: `category` (string) or `query` (free text matched against titles)
- Returns: matching knowledge entries
- AI system prompt addition: "If the lead asks about pricing, services, hours, team, or anything business-specific, use lookup_business_info before answering. NEVER make up business information."

### Future: RAG Vector Search (Task for later)
- When clients start uploading PDFs, catalogs, or large documents
- Embed content with OpenAI/Cohere embeddings, store in pgvector
- Replace category lookup with semantic search for complex queries
- Not needed now: structured categories handle 95% of SMB use cases

### Acceptance Criteria
- [ ] `Account_Knowledge_Base` table created with migration
- [ ] CRUD API endpoints for knowledge entries
- [ ] Accounts page UI for managing knowledge base
- [ ] `lookup_business_info` tool integrated into ai_conversation.py
- [ ] AI system prompt updated to instruct tool usage
- [ ] AI never fabricates business info (falls back to handoff if no data found)
- [ ] Seeder/onboarding flow that prompts filling in key categories

---

## Priority Order

1. **AI-Powered Contextual Bumps** (Feature 1) — Immediate quality uplift, builds on existing bump scheduler
2. **Buying Signal Detection** (Feature 3) — Revenue-critical, prevents lost deals
3. **Business Knowledge Base** (Feature 5) — Foundation for AI being a real business rep
4. **Smart Human Handoff** (Feature 4) — Depends on Feature 5 (knowledge gaps trigger handoff)
5. **Nightly Campaign Summaries** (Feature 2) — Nice-to-have, less urgent than conversation quality
6. **RAG Vector Search** (Future) — Only when structured categories prove insufficient

---

## Dependencies

- Feature 4 depends on Feature 5 (knowledge-gap handoff needs the knowledge base to exist)
- Feature 3 depends on campaign `bookingModeOverride` field (already exists)
- Feature 1 is independent, can start immediately
- Feature 2 is independent, can start anytime
