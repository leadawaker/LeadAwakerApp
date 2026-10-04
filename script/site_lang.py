"""The homepage's language pieces, shared by the build-site-*.py scripts.

The English page (client/public/site/index.html) carries these blocks exactly as
`switcher("en")` and `mobile_switcher("en")` print them, plus REDIRECT. Each
language build swaps them for its own version, so the three pages only differ
in which language is marked current.
"""

LANGS = [
    # code, path, hreflang, short label, own name
    ("en", "/", "en", "EN", "English"),
    ("nl", "/nl", "nl", "NL", "Nederlands"),
    ("pt", "/pt", "pt-BR", "PT", "Português"),
]

ARIA = {"en": "Language", "nl": "Taal", "pt": "Idioma"}

GLOBE = ('<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/>'
         '<path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z"/></svg>')
CHEVRON = '<svg class="lang-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m7 10 5 5 5-5"/></svg>'


def switcher(cur: str) -> str:
    """Desktop: a small globe pill at the far right of the nav, with a menu."""
    short = next(s for c, _, _, s, _ in LANGS if c == cur)
    items = "".join(
        f'<a class="lang-sw" href="{path}" hreflang="{hl}" lang="{hl}"'
        + (' aria-current="true"' if code == cur else "")
        + f'>{name}</a>'
        for code, path, hl, _, name in LANGS
    )
    return (
        f'<div class="lang" id="lang"><button class="lang-btn" type="button" aria-haspopup="true" '
        f'aria-expanded="false" aria-controls="lang-menu" aria-label="{ARIA[cur]}: {short}">'
        f'{GLOBE}<b>{short}</b>{CHEVRON}</button>'
        f'<div class="lang-menu" id="lang-menu" hidden>{items}</div></div>'
    )


def mobile_switcher(cur: str) -> str:
    """Mobile menu: the three codes side by side, current one filled."""
    items = "".join(
        f'<a class="lang-sw" href="{path}" hreflang="{hl}" lang="{hl}" title="{name}"'
        + (' aria-current="true"' if code == cur else "")
        + f'>{short}</a>'
        for code, path, hl, short, name in LANGS
    )
    return f'<div class="mlang" aria-label="{ARIA[cur]}">{items}</div>'


REDIRECT = """<script id="lang-redirect">
/* Dutch and Portuguese browsers land on /nl or /pt, the same rule the
   /reactivate page follows. A language picked in the nav is remembered. */
(function(){var p='';try{p=localStorage.getItem('la_site_lang')||''}catch(e){}
  if(p==='en')return;
  var l=(navigator.language||'').toLowerCase(),t=p||(l.indexOf('nl')===0?'nl':l.indexOf('pt')===0?'pt':'');
  if(t==='nl'||t==='pt')location.replace('/'+t+location.search+location.hash)})();
</script>
"""


def common_pairs(cur: str, path: str):
    """The language plumbing every non-English build applies."""
    return [
        ('<link rel="canonical" href="https://www.leadawaker.com/">', f'<link rel="canonical" href="https://www.leadawaker.com{path}">'),
        ('<meta property="og:url" content="https://www.leadawaker.com/">', f'<meta property="og:url" content="https://www.leadawaker.com{path}">'),
        (REDIRECT, ""),
        (switcher("en"), switcher(cur)),
        (mobile_switcher("en"), mobile_switcher(cur)),
    ]


ANY = 0  # pair count: replace every occurrence, at least one

ROOT = __import__("pathlib").Path(__file__).resolve().parent.parent
SITE = ROOT / "client/public/site"


def build(out_name: str, pairs) -> None:
    """Apply (english, translated[, count]) pairs to index.html and write out_name.

    Every English string must be found exactly `count` times (default once), so
    an edit to the English page fails loudly instead of leaking English.
    """
    import sys
    html = (SITE / "index.html").read_text(encoding="utf-8")
    problems = []
    for pair in pairs:
        en, tr = pair[0], pair[1]
        want = pair[2] if len(pair) > 2 else 1
        found = html.count(en)
        if (want == ANY and found == 0) or (want != ANY and found != want):
            problems.append(f"expected {'1+' if want == ANY else want}, found {found}: {en[:90]!r}")
            continue
        html = html.replace(en, tr)
    if problems:
        print(f"English page changed; update these pairs for {out_name}:", file=sys.stderr)
        for p in problems:
            print("  - " + p, file=sys.stderr)
        sys.exit(1)
    (SITE / out_name).write_text(html, encoding="utf-8")
    print(f"wrote client/public/site/{out_name} ({len(html):,} chars, {len(pairs)} replacements)")
