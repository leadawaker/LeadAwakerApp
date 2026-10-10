# Action Required: Voice Caller Memory

Manual steps that must be completed by a human.

## Before Implementation
- [ ] **Read the draft copy in implementation-plan.md (Phase 2, Renderers)** - this is what Sara is told about a returning caller; easier to adjust wording now than after a test call

## During Implementation
No manual steps required. The migration is additive (one nullable column and one index) and the engine restart only happens after `preflight.sh` passes.

## After Implementation
- [ ] **Test call 1: returning caller** - ring the demo line from +31737044356, which has earlier calls named "Gabriel". Expect "is this Gabriel again?" and a reference to the last call's topic
- [ ] **Test call 2: not that person** - answer "no, this is someone else". Expect her to ask who it is and drop the old details
- [ ] **Test call 3: dropped call** - talk for at least three turns, hang up mid-sentence without saying bye, ring back within 15 minutes. Expect "looks like we got cut off" and an offer to continue
- [ ] **Test call 4: Dutch** - one returning-caller call in Dutch, to hear whether the nl copy sounds natural
- [ ] **Decide on the demo line** - your own number will now be recognised on every demo call. Fine for showing the feature, possibly odd mid-pitch. Say if you want a per-line "remember callers" toggle
