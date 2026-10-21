# ElevenLabs v4: scripting rules

Model: `eleven_v4` (launched 2026-09-28). Use it over v3: better tag adherence and full Professional Voice Clone support.

## Tags
- Square brackets, placed right before the words they affect: `[curious]`, `[excited]`, `[thoughtful]`, `[surprised]`, `[sighs]`, `[chuckles]`, `[laughs]`, `[whispers]`, `[clears throat]`, `[inhales deeply]`, `[short pause]`, `[long pause]`.
- Delivery tags only. No scene or visual tags (`[smiling]`, `[pacing]`), they can be read as sound effects.
- Keep them sparse (3 to 5 per 60s script) and fitting a calm doctor. Playful tags land poorly on a serious clone.
- `[serious]` is not an official tag: untested.

## Pauses and emphasis
- No SSML `<break>`. Use `...`, `[short pause]`, and sentence breaks.
- CAPS on one word = extra emphasis. Use once or twice per script at most.
- `?` and `!` shape intonation.

## Numbers and names
- Spell numbers out: "vinte e cinco por cento", not "25%".
- Drug names: write them normally first and listen. If wrong, try a phonetic respelling ("Monjáro") or inline IPA between slashes.
- Language is plain "Portuguese"; the Brazilian accent comes from the cloned voice.

## Settings (from the v3 guide, not confirmed for v4)
- Stability: Creative = most expressive (can drift), Natural = closest to the clone, Robust = stable but ignores tags. Start with Natural.
- Generate 2 or 3 takes and pick the best.

Sources: elevenlabs.io/docs/best-practices/prompting, elevenlabs.io/docs/models
