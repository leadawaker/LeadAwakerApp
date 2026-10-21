# 04. Como emagrecer sem recuperar todo o peso perdido?

Status: draft v3 · target ~60s · model `eleven_v4`

## Script

```
Dá pra emagrecer sem recuperar todo o peso depois? Dá, sim. Mas a maioria das pessoas recupera, e não é falta de força de vontade. É o corpo que tenta voltar pro peso antigo, aumenta a fome e passa a gastar menos. Então, doutor Augusto, o que devo fazer?

Vamos lá. Primeiro, a musculação. Músculo gasta energia até parado, então quem emagrece sem treinar perde músculo junto, e aí fica muito mais fácil engordar de novo.

Segundo, se você usa caneta, não para por conta própria. Quem para de uma vez recupera em torno de dois terços do peso em um ano. Muitas vezes a gente vai ajustando até achar uma dose de manutenção.

Terceiro, aquele que ninguém quer ouvir: é o hábito, não a dieta. Dieta tem começo e fim, e quando acaba a pessoa volta a comer como antes. Então não adianta a dieta da segunda-feira, tem que ser um jeito de comer que você consegue manter pro resto da vida. E fica de olho na balança: subiu dois, três quilos, já corrige ali, não espera chegar nos dez.

Obviamente que a manutenção também precisa de acompanhamento médico, não é chegar no peso e acabou.

Então, se você quer perder peso e não ver ele voltar, é só entrar em contato.
```

## HeyGen scenes (optional)

Default: whole script in one scene, Avatar IV, no custom motion. Use this split only if the one-shot render looks stiff.

| # | Look | Text starts with | ~sec | Motion prompt |
|---|---|---|---|---|
| 1 | A | "Dá pra emagrecer sem recuperar..." to "...falta de força de vontade." | 6 | Slight head tilt, confident nod on "Dá, sim", then open palm, empathetic |
| 2 | A | "É o corpo que tenta voltar..." to "...o que devo fazer?" | 5 | Explaining with both hands, then raises hand questioningly |
| 3 | B | "Vamos lá. Primeiro, a musculação..." | 8 | Holds up one finger, then flexes arm lightly, confident |
| 4 | B | "Segundo, se você usa caneta..." | 9 | Holds up two fingers, then small calming hand gesture |
| 5 | C | "Terceiro, aquele que ninguém quer ouvir..." to "...pro resto da vida." | 10 | Holds up three fingers, small head shake on "dieta" |
| 6 | C | "E fica de olho na balança..." | 5 | Small knowing smile, light finger wag |
| 7 | A | "Obviamente que a manutenção..." | 4 | Hand on chest, serious, reassuring |
| 8 | A | "Então, se você quer perder peso e não ver ele voltar..." | 4 | Warm smile, small nod to camera |

## Notes
- v3 (2026-10-19): Gabriel's edits (viewer asks "doutor Augusto, o que devo fazer?", "Vamos lá", "aquele que ninguém quer ouvir", no [thoughtful] tag) plus a reworked habit point: "dieta da segunda-feira" and "manter pro resto da vida" replace the written-sounding "Opte por fazer uma mudança no seu estilo de vida permanente", and the scale tip moved to the end of the point.
- v2 changes from v1:
  - Hook answers the theme question in the first line ("Dá pra...? Dá, sim."), his direct-question pattern. v1 opened on "medo de ver o peso voltar", which only speaks to people who already lost weight.
  - "Não é falta de força de vontade" takes the blame off the viewer before explaining the biology.
  - Point two only speaks to pen users ("se você usa caneta"), so viewers without a pen aren't lost. "Não para por conta própria" replaces "ir diminuindo aos poucos" (tapering has weak trial evidence; not stopping alone is solid).
  - "Músculo gasta energia até parado" replaces "mantém o metabolismo funcionando" (more accurate, still lay).
  - Self-weighing joins the habit point (a core habit of people who keep weight off, per the US National Weight Control Registry).
- Scope vs theme 10: this one is about keeping weight off after losing it. Theme 10 is for people with many failed attempts and how medical treatment helps.
- "A maioria das pessoas recupera": after diet-only weight loss, most people regain most of it within 3 to 5 years (Anderson et al. 2001 meta-analysis).
- "Dois terços do peso em um ano": STEP-1 extension (semaglutida stopped after 68 weeks, about two thirds regained one year later). SURMOUNT-4 shows the same for tirzepatida.
- Avoids repeating 01 (proteína, fibra, sono) and 03 (musculação/proteína in one line): here musculação is framed as protecting the metabolism.

## Previous version (v1)

```
Você em casa que já conseguiu emagrecer, mas está com medo de ver todo aquele peso voltar... saiba que isso tem explicação. Depois que emagrece, o corpo tenta voltar pro peso antigo, aumenta a fome e passa a gastar menos. Então, o que fazer pra não recuperar?

Primeiro, musculação. Músculo é o que mantém o teu metabolismo funcionando, então quem emagrece sem treinar perde músculo junto, e aí fica muito mais fácil engordar de novo.

Segundo, não parar a caneta de uma vez. Quem para de repente recupera em torno de dois terços do peso em um ano. O ideal é ir diminuindo a dose aos poucos, até achar uma dose de manutenção.

Terceiro, pensar em hábito, não em dieta. Dieta tem começo e fim, e quando acaba a pessoa volta a comer como antes. Então tem que ser um jeito de comer que você consegue manter. E se subir dois, três quilos, já corrige ali, não espera chegar nos dez.

[thoughtful] Obviamente que a manutenção também precisa de acompanhamento médico, não é chegar no peso e acabou.

Então, se você quer perder peso e não ver ele voltar, é só entrar em contato.
```
