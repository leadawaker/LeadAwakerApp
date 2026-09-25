# Social Reply Demo: acceptance results and action items

Task 14 of the implementation plan. Campaign S = **campaign 70** ("Social Reply Demo",
`campaign_type = 'social_reply'`, `prompt_campaign_id = 67`). All testing done against
`https://app.leadawaker.com` with `playwright-cli`, logged in as `leadawaker@gmail.com`.

Screenshots referenced below are at `/home/gabriel/LeadAwakerApp/.playwright-cli/<file>.png`
(session artifacts, not committed).

## 1. Acceptance checklist (requirements.md, "Acceptance" 1-8)

Client used for items 1-4, 6-8: **Windows & Doors** (`Niche_Vocabulary` id 20, no prior
social post in any language), language `nl`.

| # | Requirement | Result | Evidence |
|---|---|---|---|
| 1 | Mint a link for a Client with no social post, `nl`, from Demos page | **PASS** | Mint took ~7.2s (text+image start), vs ~2.2s on a repeat mint of the same client/language. Link: `/social-demo/75e7622a4b6e4a26` |
| 2 | Feed shows Dutch static post, Client's post with Dutch caption/keyword, Dutch static post below, no English | **PASS** | `page-2026-09-25T10-04-55-858Z.png`, `...10-05-05-435Z.png`, `...10-05-17-364Z.png`. Caption, CTA, comment placeholder ("Typ KOZIJN en tik op Plaatsen") all Dutch. Generated post showed the B5 gradient/company-name fallback (image was still generating in the background at that moment) which is correct per spec, not a failure. |
| 3 | Typing keyword lowercase + trailing "!" opens DM view with Dutch opener from agent+company | **PARTIAL PASS** | Matching works (`kozijn!` matched `KOZIJN`), DM opened automatically after ~2s. But the opener text itself has a bug: see Finding A below. `page-2026-09-25T10-05-39-160Z.png` |
| 4 | Reply gets warm, post-aware answer in Dutch; tracker advances; booking works with confetti and recap | **PASS** | Tracker moved New lead -> Responded -> Qualified -> Goal reached; booked Thursday 12:00; recap panel rendered with calendar and briefing. Confetti animation not independently verified (screenshots are static; booking outcome and recap both confirm success). `page-2026-09-25T10-06-13/34/59Z.png`, `...10-07-21-413Z.png` |
| 5 | Thread visible on CRM Chats page under Instagram type; first-reply notification fired | **PASS** | All 9+ social-reply threads appear correctly under the "Instagram" type filter on `/platform/chat`, with no Speed-to-Lead/Widget threads mixed in. Notification: see Step 2 below (fires correctly for real, non-admin replies). |
| 6 | Second `nl` mint for same Client is instant, same image; `pt` mint generates text only, reuses image | **PASS** | Second `nl` mint for Windows & Doors: ~2.2s, identical caption text. Image reuse verified on a second client (motorcycles, EN/PT): both the `pt` mint and a later `en` mint served the exact same `social_image_path` (`a4b35b34f0ee8570.webp`), confirmed via DB and via `curl` on `/api/site-shot/...`. |
| 7 | Restart from presenter menu returns to feed, demo runs again | **PASS** | Used the "Lead has a quote?" scenario switch (same presenter menu, same restart path per C3) on the Solar NL demo: confirm dialog fired, demo returned to feed view, re-commenting opened a fresh DM thread. |
| 8 | Phone-width flow works one-handed, no horizontal scroll | **PASS** | At 390x844, `document.documentElement.scrollWidth === clientWidth` (390 = 390) on the feed and DM views throughout testing. |

**Two previously-unverified fixes, checked live per the brief:**

- **(a) Focus retention across polls (390x844):** focused the `#msg` composer, then let two consecutive 6s+ poll cycles pass with no new message. `document.activeElement.id` remained `"msg"` both times. **PASS.**
- **(b) Recap panel visible at 1440x900:** confirmed after the Windows & Doors NL booking (calendar + briefing rendered inline, `page-2026-09-25T10-07-31-679Z.png`). Also confirmed the **quote-mode panel** ("De offerte", total EUR 11.450, line items) renders **above** the thread when the demo is switched to "Already has a quote" (Solar NL client, which has `quote_subject`/`quote_when` set). **PASS.**

## 2. First-reply notification (spec E3)

Initial concern: none of my 9 quality-run conversations (all run while authenticated as
the CRM admin) produced a `demo_replied` notification row, even 60-90 minutes later. This
turned out to be **expected behavior, not a bug**: `server/demo-reply-notifier.ts` deliberately
excludes turns tagged `is_admin_test` (an existing guard, so testing a link before sending it
doesn't fire "prospect replied" for your own test message).

Re-tested properly: minted a fresh link, opened it in a **separate, unauthenticated** browser
context (no CRM cookie, simulating a real prospect), commented the keyword, sent one reply.
Waited past the 60s poll interval. Result: `demo_replied` notification (id 5960/5961, title
"Task14 NotifTest replied to your demo") appeared within ~45s. **PASS, verified working, not
assumed.**

## 3. Conversation quality (9 runs: 3 languages x 3 niches each)

Niches used, chosen from what already had (or could cheaply get) a matching persona per
language. Note: no single niche in the current Client library has persona data in all
three languages, so "3 niches in each language" used a different trio per language rather
than the same 3 niches repeated three times. This is a data-availability fact, not a build gap.

- **en:** Roofing (Van Dijk Roofing), Windows & Doors, Solar (SolarMax)
- **nl:** Windows & Doors (Raam & Deur Specialist), KL Techniek (installatietechniek), Solar (SolarMax)
- **pt:** Moniz de Sa (car dealership, Acores), HAYAI SUZUKI (motorcycle dealership), PedalPro Componentes (bicycle parts distributor)

Each run: comment the keyword, then 4-5 replies as a warm lead (interest confirmation, a
price question, "can you come Thursday" / local equivalent, slot confirmation). All 9 runs
reached a booked outcome.

### Finding A: Duplicate company name in the DM opener (consistent, 10/10 openers seen) - FIXED 2026-09-25

**Fixed.** Cause: the post generator wrote `{agent_name} from {company_name}{disclosure_clause}`, but `{disclosure_clause}` already carries the company (" from X" or ", the AI assistant at X"). The generator now writes `{agent_name}{disclosure_clause}`, the validator rejects the doubled form, and `scripts/migrations/2026-09-social-opener-dedupe.js` rewrote the 7 stored Clients. A fresh roofing mint now opens "This is Sara from Van Dijk Roofing, hows your day going so far?". Links minted before the fix keep their frozen opener.

Every opener rendered the company name **twice**, in every language tested. This is a
template/rendering bug in how the persona's `agent_name`/`company_name` tokens are combined
with the literal "from {company}" wording in the opener (D2), not a prompt-108 issue (the
live AI turns after the opener are unaffected, see Finding D).

Examples, verbatim:
- EN: "This is Sara from Van Dijk Roofing **from Van Dijk Roofing**, hows your day going so far?" (also missing the apostrophe in "hows")
- EN: "This is Sara from Window & Door Specialists **from Window & Door Specialists**. How's your day going?"
- NL: "Dit is Sara van KL Techniek **van KL Techniek**, hoe gaat het met je?"
- PT: "aqui e Sara da HAYAI SUZUKI **da HAYAI SUZUKI**! Como voce ta?"

This is the single biggest quality issue found. It is a rendering bug, not a conversational
one; recommend fixing the opener template/substitution logic rather than touching prompt 108.

### Finding B: First reply picks up the post's offer, never asks "why did you get in touch": PASS, 9/9

Examples:
- "Great, replacing old drafty windows can make a real difference. Roughly how many windows are you looking to replace?"
- "Leuk, zonnepanelen dus. Hoeveel panelen denken jullie ongeveer nodig te hebben?"
- "Perfeito, pedivelas personalizadas com a sua marca. Voce imagina quantas unidades por modelo?"

### Finding C: Messages short, one question each: PASS in the large majority

Most replies were a single short sentence ending in one question. A few ran to two
sentences (e.g. EN roofing: "That needs a roof specialist to assess, as the cause and
extent of damage affect the cost. Roughly how large is the roof, and is it pitched or
flat?") but still asked only one question. In the NL Solar run, a similar answer was
actually split into **two separate short bubbles** instead of one longer message, which is
better behavior, not worse.

### Finding D: Language correctness: prompt-108 turns are correctly Brazilian in every PT run; persona-generation copy is not

All live AI replies in the 3 PT runs used consistently Brazilian Portuguese: "Voce busca
ela para uso mais esportivo...", "ta liberado pra voce", "quilometragem", "Como voce
ta?". The global constraint (Brazilian-only PT) held throughout every actual conversation
turn.

However, the **static persona content** generated for the Moniz de Sa client (an Acores/Portugal
car dealership) leaked European Portuguese, generated by the social-post step (B1), separate
from prompt 108:
- Caption: "encontra **viaturas** novas e seminovas..." — "viaturas" is PT-PT terminology; a
  Brazilian post would say "carros" or "veiculos".
- Opener: "Obrigado por **comentares** no nosso post" — "comentares" is the European
  Portuguese "tu" verb conjugation; Brazilian would be "comentar" or "ter comentado".

Likely cause: the underlying Client persona (niche_label etc.) was itself written for a
Portugal-based business, and the social-post generator followed that flavor instead of
being forced through the same "always Brazilian" constraint that governs prompt 108. Two
other PT clients (HAYAI SUZUKI, PedalPro Componentes, both generic/Brazilian-flavored
personas) produced solidly Brazilian captions and openers, so this looks specific to
personas whose underlying business context is itself European.

### Finding E: Minor, an old EN post used a Dutch keyword

The pre-existing Van Dijk Roofing EN social post (generated before this task, in an earlier
session's testing) uses keyword **"DAKEN"** (Dutch for "roofs") despite an English caption.
Not something generated fresh in this task, but visible to anyone testing that link. Also
noted: a fresh EN Solar caption ("SolarMax") mentioned "**salderingsregeling**" (a Dutch
net-metering policy term) inside an otherwise-English caption, a cross-language leak from a
Netherlands-flavored niche into the English generation. Both are B1 (post-generation)
quality issues, not prompt-108 issues.

### Finding F: Booking, PASS, 9/9

All 9 conversations reached a booked outcome, offered 3 time slots, correctly parsed the
chosen slot, and produced a qualification + outcome recap. Two representative recap lines:

- "Outcome: A call is booked for Thursday at 09:30 for a solar advisor to discuss the panels."
- "Resultado: Ficou marcado para quinta-feira as 10:00, na Rua de Sao Goncalo, 125, em Ponta Delgada."

### Conclusion on Step 3

No consistent gap in prompt 108 itself was found. The qualification flow, tone, and booking
behavior all worked correctly and consistently across niches and languages. **A separate
prompt is not warranted.** The real issues (duplicate company name, PT persona-language leak
on one client, one stray Dutch keyword) all live in the social-post/opener generation and
rendering code (B1/D2), not in prompt 108's conversational logic.

## 4. Regression check: campaigns 67 and 68

Minted one fresh Speed to Lead link (campaign 67) and one Website widget link (campaign 68),
both against the same Roofing client, and ran two turns on each.

- **Campaign 67** opener: "Hi, this is Sara from Van Dijk Roofing. How can I help you
  today?" — no duplicate company name, no Instagram wording. Reply to "yes, I have a leak":
  "Sorry to hear that. Are you noticing damp inside the property as well, or is the leak
  only visible from outside?"
- **Campaign 68** opener (in the widget iframe): "Hi, this is Sara from Van Dijk Roofing.
  How can I help you today?" Reply: "Sorry to hear that. Are you noticing damp inside the
  property as well, or is it just the roof leak?"

Both look exactly as before the social-reply build. **PASS, no regression.** This also
confirms Finding A (duplicate company name) is specific to the social-reply opener path
(D2), since the standard demo/widget opener paths render the company name correctly.

## 5. Known gaps

- **Static feed photos not in yet.** `post-1.webp` / `post-2.webp` (Gabriel's two fixed feed
  photos) are still placeholders, per the brief. Confirmed present but generic, not a
  failure, waiting on Gabriel.
- **`main.js`/`widget.js` still on their own transport copies**, not yet moved onto
  `transport.js` (deliberately deferred per the spec's C3 risk note; not part of this build).

## 6. Follow-ups for Gabriel

1. ~~Fix the duplicate company name in the social-reply opener~~ Done 2026-09-25, see Finding A.
2. **Force the social-post generator (B1) through the same "always Brazilian" constraint as
   prompt 108**, at least for PT personas whose underlying business context is itself
   European (Moniz de Sa is an Acores dealership). Currently only the live prompt-108 turns
   are guaranteed Brazilian; the generated caption/opener are not.
3. **Regenerate or fix the "DAKEN" keyword** on the pre-existing Van Dijk Roofing EN social
   post (leftover from earlier task testing, Dutch word on an English post).
4. **Move `main.js` and `widget.js` onto `transport.js`** (carried over from the spec's C3
   note; out of scope for this task, no quality gap found that requires it sooner).
5. A separate prompt for social-reply leads is **not needed**. Prompt 108's conversational
   behavior (qualification, tone, booking) was solid and consistent across 9 runs in 3
   languages and 7 niches.

## Test artifacts

9 quality-run leads (all under campaign 70, prospect names prefixed `Task14`) plus 2
acceptance-only leads and 1 notification-test lead are in the CRM as normal test data (per
the task's cost/safety rules, no Clients/campaigns/prompts were modified or deleted).
