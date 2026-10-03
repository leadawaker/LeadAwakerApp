#!/usr/bin/env python3
"""Turn the "LeadAwaker AI Receptionist" claude.ai artifact into the leadawaker.com homepage.

The page is designed as a claude.ai artifact (one self-contained HTML file with
every image inlined as base64). This script makes it a real site page, so the
artifact can keep being the design surface and re-imported after each round:

    python3 script/import-site-artifact.py <artifact.html>

Writes client/public/site/index.html plus client/public/site/img/*. What it does:
  - gives the page a real <head> (lang, title, description, OG tags, favicon)
  - moves inlined images over 4KB into hashed files under /site/img/, so the
    browser caches them and the HTML drops from ~800KB to a fraction of that
  - points the old-site links at /reactivate and the legal links at the real
    /terms-of-service and /privacy-policy routes
  - adds the "Ask Sara" button to the booking block and the website widget
  - draws Sara as the widget's orb wherever the artifact shows her face

Every replacement must match exactly once (or the stated count), so a changed
artifact fails loudly instead of shipping a half-converted page.
"""
import base64
import hashlib
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT_DIR = ROOT / "client/public/site"
IMG_DIR = OUT_DIR / "img"

# The key of the Widget_Configs row for leadawaker.com (account 1, Sara).
WIDGET_KEY = "wk_pNUlirtOPVBVkViwqXgsZmFq"

TITLE = "Lead Awaker: the AI receptionist that picks up when you can't"
DESCRIPTION = ("Sara answers your phone, website chat and WhatsApp day and night, "
               "and books customers straight into your calendar.")

HEAD = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>{TITLE}</title>
<meta name="description" content="{DESCRIPTION}">
<link rel="icon" type="image/svg+xml" href="/premium/favicon.svg">
<link rel="canonical" href="https://www.leadawaker.com/">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Lead Awaker">
<meta property="og:title" content="{TITLE}">
<meta property="og:description" content="{DESCRIPTION}">
<meta property="og:url" content="https://www.leadawaker.com/">
<meta name="twitter:card" content="summary">
"""

# Styles for the booking block's second button (the block is wine, so the
# button is an outline in the block's cream text colour), and a nav that never
# wraps: between 860px and 1080px the four in-page channel anchors step aside
# (the mobile menu still has them) so Log in and Book a demo stay on one line.
BOOK_CSS = """<style>
.book-ctas{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
.btn-ghost-light{background:transparent;color:#F7F1E6;box-shadow:inset 0 0 0 1.5px rgba(244,239,227,.55)}
.btn-ghost-light:hover{background:rgba(244,239,227,.08);transform:translateY(-1px)}
.nav-links a{white-space:nowrap}
@media (max-width:1080px){.nav-links a[href="#phone"],.nav-links a[href="#website"],.nav-links a[href="#whatsapp"],.nav-links a[href="#calendar"]{display:none}}
</style>
"""

# The widget loader, plus the "Ask Sara" button: hidden until the loader has
# mounted (it announces itself with leadawaker-widget-ready), so a blocked or
# failed loader never leaves a dead button on the page.
WIDGET_JS = f"""<script>
/* Same rule as the /reactivate page's nav (premium/01-nav.jsx): someone already
   signed in to the CRM gets "Open app" straight into it instead of "Log in". */
(function(){{
  var auth=false;try{{auth=!!localStorage.getItem('leadawaker_auth')}}catch(e){{}}
  if(!auth)return;
  [].forEach.call(document.querySelectorAll('.js-login'),function(a){{a.textContent='Open app';a.href='/platform/campaigns'}});
}})();
</script>
<script>
(function(){{
  var b=document.querySelector('.js-sara');
  if(!b)return;
  function ready(){{b.hidden=false}}
  if(window.LeadAwakerWidget)ready();else window.addEventListener('leadawaker-widget-ready',ready);
  b.addEventListener('click',function(){{if(window.LeadAwakerWidget)window.LeadAwakerWidget.open()}});
}})();
</script>
<script src="https://api.leadawaker.com/widget/v1.js?v=10" data-key="{WIDGET_KEY}" async></script>
"""


# Sara's face, the same orb the real widget wears (server/widgetOrb.ts is the
# one source: its stylesheet is read from there, so the page and the widget
# cannot drift). The artifact draws her as a letter "S" or speaking bars in four
# places; each becomes the orb, in the widget's own silver metal.
def _orb_css() -> str:
    src = (ROOT / "server/widgetOrb.ts").read_text(encoding="utf-8")
    m = re.search(r"export const ORB_CSS = `(.*?)`;", src, re.S)
    if not m:
        sys.exit("import-site-artifact: ORB_CSS not found in server/widgetOrb.ts")
    return m.group(1)


def _orb(cls: str = "") -> str:
    return (f'<span class="lo{" " + cls if cls else ""}" aria-hidden="true"><span class="lo-eyes"><i></i><i></i></span>'
            '<span class="lo-ico"><svg viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg></span></span>')


SARA_CSS = """
/* The page styles bare <i> inside .wav, .launch and .ai-sara (status dot,
   launcher core, talking bars); her eyes are <i> too, so they are put back. */
.lo .lo-eyes i{position:static;inset:auto;display:block;width:calc(var(--lo-s)*.095);height:calc(var(--lo-s)*.23);border:0;border-radius:999px;
  box-shadow:none;background:var(--lo-eye,#111114);animation:lo-blink 5.4s ease-in-out infinite}
.lo.lo-still .lo-eyes i{animation:none}
.launch .lm{grid-area:1/1;position:relative;width:100%;height:100%;border-radius:50%;overflow:hidden;transition:opacity .3s}
.launch .lm .lo{--lo-s:45px;-webkit-mask:none;mask:none}
.lo-tint .launch::before{background:var(--lo-metal)}
.lo-face-photo .launch .lm .lo{background:var(--lo-photo) center/cover no-repeat}
.wav,.av3{background:none!important;color:transparent}
.wav .lo{--lo-s:34px}.teaser .wav .lo{--lo-s:36px}.wav i{z-index:2}
.av3 .lo{--lo-s:78px}
@media (max-width:480px){.av3 .lo{--lo-s:60px}}
.ai-sara .lo{--lo-s:34px}
/* In the comparison table she is alive, inside the same soft outline and
   breathing rings as "one brief" and "You decide what she says". */
.ai-sara{position:relative}
.ai-sara::before,.ai-sara::after{content:"";position:absolute;left:50%;top:50%;width:34px;height:34px;border-radius:50%;pointer-events:none}
.ai-sara::before{transform:translate(-50%,-50%);box-shadow:0 0 0 6px rgba(255,220,225,.16),0 0 22px rgba(214,120,140,.35)}
.ai-sara::after{border:1.5px solid rgba(255,220,225,.55);animation:sara-halo 2.6s ease-out infinite}
@keyframes sara-halo{0%{transform:translate(-50%,-50%) scale(1.15);opacity:.55}100%{transform:translate(-50%,-50%) scale(1.75);opacity:0}}
@media (prefers-reduced-motion:reduce){.ai-sara::after{animation:none;opacity:0}}
.orb{background:none!important;box-shadow:0 0 0 12px rgba(255,220,225,.13),0 0 70px rgba(214,120,140,.3)}
/* "You decide what she says": the same breathing rings as "one brief", not the
   rainbow ring the artifact draws. */
.orb .orb-ring{display:none}
.orb::before,.orb::after{inset:-12px;border:2px solid rgba(255,220,225,.5);animation:halo 2.6s ease-out infinite}
.orb::after{animation-delay:1.3s}
/* The widget example's launcher wears the rim chosen in the CRM too. */
.lo-rim-pulse .launch::before{animation:none;background:color-mix(in srgb,var(--lo-rim,#a1a1aa) 45%,#fff)}
.lo-rim-pulse .launch::after{content:"";position:absolute;inset:-6px;border-radius:50%;border:2px solid var(--lo-rim,#a1a1aa);animation:halo 2.6s ease-out infinite}
.lo-rim-band .launch::before{animation:none;background:var(--lo-rim,#a1a1aa)}
.lo-rim-none .launch::before{display:none}
.lo-rim-none .launch i{inset:0}
.orb .lo{--lo-s:150px;position:relative;z-index:1}
"""


# The page's orbs are drawn in default silver, then take the look set for the
# widget in the CRM (style, shade, eyes, icon or photo) as soon as the loader
# reports it, so changing her there changes her everywhere on the site.
SARA_LOOK_JS = """<script>
(function(){
  function apply(l){
    if(!l)return;var h=document.documentElement;
    (l.cls||'').split(' ').forEach(function(c){if(c)h.classList.add(c)});
    (l.vars||'').split(';').forEach(function(d){var i=d.indexOf(':');if(i>0)h.style.setProperty(d.slice(0,i).trim(),d.slice(i+1).trim())});
    if(l.photo)h.style.setProperty('--lo-photo',"url('"+l.photo+"')");
  }
  if(window.LeadAwakerWidget&&window.LeadAwakerWidget.look)apply(window.LeadAwakerWidget.look);
  window.addEventListener('leadawaker-widget-look',function(e){apply(e.detail)});
})();
</script>
"""


def sara_faces(html: str) -> str:
    html = replace(html, '<span class="wav">S<i></i></span>', f'<span class="wav">{_orb()}<i></i></span>')
    # Her face beside each of her messages in the website widget example.
    html = replace(html, '<span class="wav">S</span>', f'<span class="wav">{_orb("lo-still")}</span>', count=3)
    html = replace(html, '<span class="av3">S</span>', f'<span class="av3">{_orb()}</span>')
    html = replace(html, '<span class="sci ai-sara"><i></i><i></i><i></i><i></i><i></i></span>',
                   f'<span class="sci ai-sara">{_orb()}</span>')
    html = replace(html, '<span class="orb"><span class="orb-ring"></span><span class="bars"><i></i><i></i><i></i><i></i><i></i></span></span>',
                   f'<span class="orb"><span class="orb-ring"></span>{_orb()}</span>')
    html = replace(html, '<i><svg class="lm" viewBox="0 0 24 24"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01M12 12h.01M16 12h.01"/></svg>',
                   f'<i><span class="lm">{_orb()}</span>')
    # "Digital assistant", never "AI assistant": how Sara introduces herself.
    html = replace(html, 'AI assistant · Brightsmile Dental', 'Digital assistant · Brightsmile Dental')
    loader = '<script src="https://api.leadawaker.com/widget/v1.js'
    html = replace(html, loader, SARA_LOOK_JS + loader)
    return replace(html, "</head>", f'<style id="sara-orb">{_orb_css()}{SARA_CSS}</style>\n</head>')


def replace(html: str, old: str, new: str, count: int = 1) -> str:
    found = html.count(old)
    if found != count:
        sys.exit(f"import-site-artifact: expected {count} x {old[:80]!r}, found {found}. Has the artifact changed?")
    return html.replace(old, new)


def extract_images(html: str) -> str:
    IMG_DIR.mkdir(parents=True, exist_ok=True)
    for old in IMG_DIR.iterdir():
        old.unlink()
    ext = {"image/webp": "webp", "image/png": "png", "image/jpeg": "jpg", "image/svg+xml": "svg"}
    pattern = re.compile(r"data:(image/(?:webp|png|jpeg|svg\+xml));base64,([A-Za-z0-9+/=]+)")
    written = {}

    def sub(m: re.Match) -> str:
        mime, b64 = m.group(1), m.group(2)
        data = base64.b64decode(b64)
        if len(data) < 4096:  # icons: not worth a request
            return m.group(0)
        name = f"{hashlib.sha256(data).hexdigest()[:12]}.{ext[mime]}"
        if name not in written:
            (IMG_DIR / name).write_bytes(data)
            written[name] = len(data)
        return f"/site/img/{name}"

    html = pattern.sub(sub, html)
    for name, size in written.items():
        print(f"  img/{name}  {size // 1024}KB")
    return html


def main() -> None:
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    html = Path(sys.argv[1]).read_text(encoding="utf-8")

    # The artifact host wraps the page in its own skeleton: doctype, a base
    # <style> and then <title> inside <body>. Rebuild that as a proper <head>,
    # keeping the base style, and open <body> right before the nav.
    m = re.match(r"<!doctype html><html><head>.*?(<style>.*?</style>)</head><body>\n<title>[^<]*</title>\n", html, re.S)
    if not m:
        sys.exit("import-site-artifact: artifact skeleton not found. Has the artifact changed?")
    html = HEAD + m.group(1) + "\n" + html[m.end():]
    html = replace(html, '<div class="nav-shell">', BOOK_CSS + '</head>\n<body>\n<div class="nav-shell">')

    html = replace(html, '<a href="https://www.leadawaker.com/"', '<a href="/reactivate"', count=3)
    # A way into the CRM: desktop nav (before the Book a demo button) and the
    # mobile menu. /login is client/public/login.html (vercel.json rewrite).
    html = replace(html, '<a href="/reactivate">Old leads</a>\n',
                   '<a href="/reactivate">Old leads</a>\n        <a class="js-login" href="/login">Log in</a>\n')
    html = replace(html, '<a href="/reactivate">Database reactivation</a>\n    </div>',
                   '<a href="/reactivate">Database reactivation</a>\n      <a class="js-login" href="/login">Log in</a>\n    </div>')
    html = replace(html, 'href="https://leadawaker.com/terms"', 'href="/terms-of-service"')
    html = replace(html, 'href="https://leadawaker.com/privacy"', 'href="/privacy-policy"')

    pick = '<a class="btn btn-light" href="https://cal.com/leadawaker/quick-chat" target="_blank" rel="noopener">Pick a time in the calendar</a>'
    html = replace(html, pick,
                   '<div class="book-ctas">' + pick +
                   '<button class="btn btn-ghost-light js-sara" type="button" hidden>Not ready to book? Ask Sara now</button></div>')
    html = replace(html, "</body></html>", WIDGET_JS + "</body>\n</html>\n")

    html = sara_faces(html)
    html = extract_images(html)
    out = OUT_DIR / "index.html"
    out.write_text(html, encoding="utf-8")
    print(f"import-site-artifact: wrote {out.relative_to(ROOT)} ({len(html.encode()) // 1024}KB)")


if __name__ == "__main__":
    main()
