# 05. Gordura abdominal: como reduzir a barriga de forma saudável?

Status: draft v1 · target ~60s · model `eleven_v4` · 3 parts, one look each

## Script

### Part 1 (look 1): the problem

```
Você em casa que está fazendo abdominal todo dia pra perder a barriga... saiba que não é assim que funciona. Não dá pra tirar gordura só de um lugar. E essa gordura da barriga é a mais perigosa, porque fica onde? Em volta dos teus órgãos, e aumenta o risco de diabetes, infarto e fígado gorduroso. Cintura acima de oitenta e oito centímetros na mulher, e cento e dois no homem, já é sinal de alerta.
```

### Part 2 (look 2): what to do

```
Então, como reduzir? Primeiro, a alimentação. Cortar açúcar, ultraprocessado e bebida alcoólica, que a barriga de cerveja não tem esse nome à toa. Segundo, exercício. Então não é só abdominal, é aeróbico e musculação juntos, que queimam essa gordura de dentro mesmo quando a balança mexe pouco. Terceiro, sono e estresse. Dormir mal e viver estressado aumenta o cortisol, que acumula gordura justamente na barriga.
```

### Part 3 (look 3): treatment and close

```
E se mesmo assim a barriga não sai, as canetinhas ajudam bastante, porque reduzem justamente essa gordura de dentro. Claro que antes tem que fazer uns exames, ver como está o fígado, a glicose, e ter acompanhamento médico. Então, se essa barriga está te incomodando, entre em contato que a gente te ajuda.
```

## HeyGen setup

Three scenes, one per part, each with a different look. No custom motion prompt by default (each part is 15 to 25s, longer than the ~10s motion-prompt limit).

| Part | Look | ~sec | Feel |
|---|---|---|---|
| 1 | Look 1 | 26 | Direct, a little provocative at the start, then serious on the risks |
| 2 | Look 2 | 22 | Practical, confident, counting the three points |
| 3 | Look 3 | 18 | Reassuring, warm at the close |

If generating audio in ElevenLabs per part, keep the same voice settings for all three so the voice doesn't shift between looks.

## Notes
- Each part starts cleanly so it works as its own scene and its own audio take: part 2 opens with the "Então, como reduzir?" question instead of part 1 ending on it.
- Opener: his signature "Você em casa que..." with a myth-bust ("abdominal todo dia"). Series so far: 01 Você em casa, 02 direct question, 03 patient question, 04 direct question, 05 Você em casa.
- No audio tags: Gabriel removed the [thoughtful] tag in 04, and HeyGen's V3 engine carries a tag until the next one.
- Facts: spot reduction doesn't work; visceral fat raises diabetes, heart and fatty-liver risk; waist cut-offs 88 cm (women) and 102 cm (men) are the classic WHO/NCEP values (stricter IDF values are 80/94); exercise lowers visceral fat even with little weight loss; cortisol is linked to central fat; tirzepatida reduced visceral fat in the SURMOUNT-1 body-composition substudy.
- Hormones (menopause, testosterone) are left for themes 6 and 7.
