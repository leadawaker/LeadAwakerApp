// The website widget's server-rendered documents: the chat frame, the widget
// demo page and the loader script. Split out of server/routes/widget.ts so the
// routes file holds routing and trust decisions, and this one holds markup.
//
// The launcher (liquid-metal button, greeting teaser, panel) is ONE stylesheet
// shared by the loader (inside a shadow root on the client's site) and the demo
// page (over a full-screen screenshot of the prospect's site), so the demo a
// prospect sees is the widget they would get. `--la-pos` / `--la-h` let a host
// pin it inside a container instead of the viewport.

import { inkFor } from "./brandColor";
import { ORB_CSS, orbHtml, orbLook, photoVar } from "./widgetOrb";

export interface FrameConfig {
  key: string;
  /** Starter chips, already resolved to {label, text} by widgetQuickReplies. */
  quickReplies?: { label: string; text: string }[];
  /** The launcher's colour. The panel wears it only where a colour means
   *  something (selected text), never as decoration. */
  accent?: string | null;
  greeting: string;
  agentName: string;
  companyName: string;
  avatar: string;
  language: string;
  maxTurns: number;
  /** The orb face: 'metal' | 'tinted' | 'solid' (colour = accent), eyes 'auto' | 'black' | 'white'. */
  orbStyle?: string | null;
  orbEyes?: string | null;
  /** Metal only: a shade for the metal (gold, copper...); null keeps silver. */
  orbTint?: string | null;
  /** 'eyes' | 'icon' | 'photo'. */
  orbFace?: string | null;
  /** The face photo's URL on our own origin, when orbFace is 'photo'. */
  orbPhoto?: string | null;
  /** The launcher's rim: 'metal' | 'pulse' | 'band' | 'none', and its colour. */
  orbRim?: string | null;
  orbRimColor?: string | null;
}

export interface DemoFrame {
  token: string;
  accent?: string | null;
  quickReplies?: { label: string; text: string }[];
  avatar: string;
  agentName: string;
  companyName: string;
  language: string;
}

// ── Teaser copy ──────────────────────────────────────────────────────────────
// The bubble beside the launcher before anyone has opened the chat. An
// invitation, not the greeting: the greeting is the chat's first message, and
// repeating it outside the panel would say the same thing twice.
const TEASER: Record<string, string> = {
  en: "Need some help? Ask me here.",
  nl: "Hulp nodig? Vraag het me hier.",
  pt: "Precisa de ajuda? Fale comigo aqui.",
};
const OPEN_LABEL: Record<string, string> = { en: "Open chat", nl: "Chat openen", pt: "Abrir chat" };
const CLOSE_LABEL: Record<string, string> = { en: "Close", nl: "Sluiten", pt: "Fechar" };

function lang2(l: string): string {
  const s = String(l || "").slice(0, 2).toLowerCase();
  return TEASER[s] ? s : "en";
}

// ── Launcher ─────────────────────────────────────────────────────────────────
// Sara's orb face (widgetOrb.ts) inside a slowly turning chrome ring: the ring
// is a conic gradient of greys with one warm and one cool fleck, rotated, which
// is what reads as liquid metal catching light. Pure CSS on purpose: this runs
// on a client's page, where a WebGL shader for a 60px button would be a cost
// they never agreed to.
const ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';

export const LAUNCHER_CSS = `
.la-root{--la-gap:20px;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,system-ui,sans-serif;-webkit-font-smoothing:antialiased}
.la-root *{box-sizing:border-box}
.la-btn{position:var(--la-pos,fixed);bottom:var(--la-gap);right:var(--la-gap);width:60px;height:60px;padding:0;border:0;border-radius:50%;
  background:transparent;cursor:pointer;isolation:isolate;z-index:2;
  box-shadow:0 16px 32px -10px rgba(0,0,0,.55),0 4px 10px -3px rgba(0,0,0,.35);
  transition:transform .28s cubic-bezier(.2,.8,.2,1),box-shadow .28s ease}
.la-btn::before,.la-btn::after{content:"";position:absolute;border-radius:50%;
  background:conic-gradient(from 0deg,#fafafa,#8a8a90 11%,#f4f4f5 21%,#35353a 33%,#e4e4e7 44%,#d9c2a3 52%,#ffffff 61%,#62626a 73%,#b9c4cf 82%,#ececef 91%,#fafafa);
  animation:la-spin 8s linear infinite}
.la-btn::before{inset:0;z-index:-1}
.la-btn::after{inset:-4px;z-index:-2;filter:blur(9px);opacity:0;transition:opacity .35s ease}
.la-btn:hover{transform:translateY(-2px) scale(1.04);box-shadow:0 22px 40px -12px rgba(0,0,0,.6),0 6px 14px -4px rgba(0,0,0,.35)}
.la-btn:hover::after{opacity:.55}
.la-btn:focus-visible{outline:2px solid #a1a1aa;outline-offset:3px}
/* The core IS the assistant: the orb face fills the chrome ring. Open, her eyes
   give way to the close glyph, drawn in the eyes' colour so it reads on any
   orb. The ring, teaser and chat stay neutral whatever the orb wears. */
.la-core{position:absolute;inset:2.5px;border-radius:50%;overflow:hidden;display:flex;align-items:center;justify-content:center;color:var(--lo-eye,#18181b);background:var(--lo-c,#d4d4d8)}
.la-core .lo{--lo-s:55px;position:absolute;inset:0;-webkit-mask:none;mask:none}
.la-root.is-open .la-core .lo-eyes,.la-root.is-open .la-core .lo-ico{opacity:0}
/* Metal in another shade: the chrome ring takes the same shade as the orb. */
.la-root.lo-tint .la-btn::before,.la-root.lo-tint .la-btn::after{background:var(--lo-metal)}
/* Over a photo the close glyph needs its own contrast. */
.la-root.lo-face-photo .la-core{color:#fff}
.la-root.is-open.lo-face-photo .la-core .lo{filter:brightness(.55)}
/* Other rims. Pulse: a soft lighter outline with rings breathing out of it
   (the homepage's "one brief" look). Band: a still ring in one colour. None:
   the orb alone, edge to edge. The glint only belongs on metal. */
.la-root.lo-rim-pulse .la-btn::before{background:color-mix(in srgb,var(--lo-rim,#a1a1aa) 45%,#fff);animation:none}
.la-root.lo-rim-pulse .la-btn::after{inset:-6px;background:none;filter:none;border:2px solid var(--lo-rim,#a1a1aa);opacity:.4;animation:la-pulse 2.6s ease-out infinite}
.la-root.lo-rim-pulse .la-btn:hover::after{opacity:.4}
@keyframes la-pulse{0%{transform:scale(1);opacity:.45}100%{transform:scale(1.35);opacity:0}}
.la-root.lo-rim-band .la-btn::before{background:var(--lo-rim,#a1a1aa);animation:none}
.la-root.lo-rim-band .la-btn::after{display:none}
.la-root.lo-rim-none .la-btn::before,.la-root.lo-rim-none .la-btn::after{display:none}
.la-root.lo-rim-none .la-core{inset:0}
.la-root.lo-rim-pulse .la-glint,.la-root.lo-rim-band .la-glint,.la-root.lo-rim-none .la-glint{display:none}
.la-root.is-open.lo-rim-pulse .la-btn::after{animation:none;opacity:0}
.la-core .la-i-x{position:absolute;display:flex;z-index:2;opacity:0;transform:rotate(-90deg) scale(.6);transition:transform .28s cubic-bezier(.2,.8,.2,1),opacity .2s ease}
.la-core svg{width:24px;height:24px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.la-root.is-open .la-core .la-i-x{opacity:1;transform:none}
/* Every so often a light catches the rim: a bright arc masked to the ring that
   sweeps once around and fades. Enough to draw the eye, rare enough to ignore. */
.la-glint{position:absolute;inset:-1px;border-radius:50%;pointer-events:none;z-index:1;
  background:conic-gradient(from 0deg,transparent 0 76%,rgba(255,255,255,.95) 86%,transparent 96%);
  -webkit-mask:radial-gradient(circle,transparent 27px,#000 28px);mask:radial-gradient(circle,transparent 27px,#000 28px);
  opacity:0;animation:la-glint 9s ease-in-out 4s infinite}
@keyframes la-glint{0%,80%{opacity:0;transform:rotate(-40deg)}84%{opacity:1}95%{opacity:1}100%{opacity:0;transform:rotate(320deg)}}
.la-root.is-open .la-glint{animation:none}
.la-dot{position:absolute;top:-3px;right:-3px;min-width:20px;height:20px;padding:0 5px;border-radius:10px;background:#ef4444;color:#fff;border:2px solid #fff;
  font:700 11px/16px -apple-system,BlinkMacSystemFont,"Segoe UI",Inter,Roboto,system-ui,sans-serif;text-align:center;display:none;z-index:3;
  animation:la-pop .35s cubic-bezier(.2,.8,.2,1)}
@keyframes la-pop{from{transform:scale(.4)}to{transform:none}}
@keyframes la-spin{to{transform:rotate(360deg)}}

.la-teaser{position:var(--la-pos,fixed);bottom:calc(var(--la-gap) + 74px);right:var(--la-gap);width:216px;max-width:calc(100vw - 40px);
  display:block;padding:11px 30px 11px 14px;border-radius:16px;cursor:pointer;
  background:#fff;color:#18181b;font-size:13px;line-height:1.4;text-align:left;
  box-shadow:0 18px 40px -12px rgba(0,0,0,.3),0 0 0 1px rgba(0,0,0,.06);
  opacity:0;transform:translateY(10px) scale(.98);transform-origin:bottom right;pointer-events:none;
  transition:opacity .3s ease,transform .35s cubic-bezier(.2,.8,.2,1)}
.la-teaser.show{opacity:1;transform:none;pointer-events:auto}
.la-teaser b{display:block;font-size:12.5px;font-weight:600;color:#09090b;margin-bottom:1px}
.la-teaser span{display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden;color:#3f3f46}
.la-tx{position:absolute;top:7px;right:7px;width:24px;height:24px;padding:0;border:0;border-radius:50%;background:transparent;color:#a1a1aa;cursor:pointer;
  display:flex;align-items:center;justify-content:center}
.la-tx:hover{background:#f4f4f5;color:#52525b}
.la-tx svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}

.la-panel{position:var(--la-pos,fixed);bottom:calc(var(--la-gap) + 76px);right:var(--la-gap);width:380px;
  height:min(640px,calc(var(--la-h,100vh) - 190px));border:0;border-radius:20px;overflow:hidden;background:#fff;display:none;z-index:1;
  box-shadow:0 28px 60px -14px rgba(0,0,0,.38),0 0 0 1px rgba(0,0,0,.06)}
.la-panel.open{display:block;animation:la-rise .32s cubic-bezier(.2,.8,.2,1)}
@keyframes la-rise{from{opacity:0;transform:translateY(12px) scale(.98)}to{opacity:1;transform:none}}

.la-root.left .la-btn,.la-root.left .la-teaser,.la-root.left .la-panel{right:auto;left:var(--la-gap)}
.la-root.left .la-teaser{transform-origin:bottom left}
@media (max-width:520px){
  .la-root .la-panel{inset:0;width:100%;height:100%;border-radius:0}
  .la-root.is-open .la-btn,.la-root.is-open .la-teaser{display:none}
}
@media (prefers-reduced-motion:reduce){
  .la-btn::before,.la-btn::after,.la-glint,.la-root.lo-rim-pulse .la-btn::after{animation:none}
  .la-btn,.la-teaser,.la-core .la-i-x{transition:none}
  .la-panel.open{animation:none}
}` + ORB_CSS;

const BUTTON_INNER =
  `<span class="la-core">${orbHtml()}<span class="la-i-x">${ICON_X}</span></span><span class="la-glint"></span><span class="la-dot"></span>`;


// Unread badge + ding, shared by the loader and the demo page. The ding is
// synthesised (two short sine tones) so there is no audio file to host. Browsers
// only let a page make sound after the visitor has interacted with it; when
// that has not happened the context stays suspended and the ding is skipped,
// which is the "only if allowed" behaviour, with no error surfaced.
const UNREAD_JS = String.raw`
  var unread=0,actx=null;
  function ding(){
    try{
      var AC=window.AudioContext||window.webkitAudioContext;
      if(!AC)return;
      actx=actx||new AC();
      if(actx.state==="suspended")actx.resume();
      if(actx.state!=="running")return;
      [[880,0],[1318,.11]].forEach(function(n){
        var o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime+n[1];
        o.type="sine";o.frequency.value=n[0];
        g.gain.setValueAtTime(0.0001,t);g.gain.exponentialRampToValueAtTime(.16,t+.02);g.gain.exponentialRampToValueAtTime(.0001,t+.35);
        o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.4);
      });
    }catch(e){}
  }
  // Called from the launcher's click: creating/resuming the context inside a
  // user gesture is what lets later dings actually play.
  function primeAudio(){
    try{var AC=window.AudioContext||window.webkitAudioContext;if(!AC)return;actx=actx||new AC();if(actx.state==="suspended")actx.resume();}catch(e){}
  }
  function showUnread(dotEl,n){
    unread+=Math.max(1,n|0);
    dotEl.textContent=unread>9?"9+":String(unread);
    dotEl.style.display="block";
    ding();
  }
  function clearUnread(dotEl){unread=0;dotEl.style.display="none";}
`;

// When the greeting teaser appears, shared by the loader and the demo page: once
// the visitor is 60% of the way down the page, which on the Lead Awaker
// homepage is just past the WhatsApp section: someone who got that far has seen
// what it does. A page too short to scroll that far gets it after 8 seconds
// instead. The caller's show() also takes it away again after TEASER_MS.
const TEASER_JS = String.raw`
  var TEASER_MS=8000;
  function armTeaser(show){
    var done=false,fb=null;
    function need(){
      var de=document.documentElement,b=document.body;
      var s=Math.max(de.scrollHeight,b?b.scrollHeight:0)-window.innerHeight;
      return s<250?-1:Math.max(250,s*.6);
    }
    function fire(){if(done)return;done=true;window.removeEventListener("scroll",onScroll);clearTimeout(fb);show();}
    function onScroll(){var n=need();if(n>0&&(window.scrollY||window.pageYOffset||0)>=n)fire();}
    window.addEventListener("scroll",onScroll,{passive:true});
    setTimeout(function(){if(!done&&need()<0)fb=setTimeout(fire,8000);},1500);
  }
`;

// On a phone the open panel fills the screen, but Android's keyboard shrinks only
// the visual viewport: the panel stays full height and the browser scrolls the
// page to reveal the input, pushing the chat header off the top. While open on a
// phone, the panel is pinned to the visual viewport instead, so the header stays
// put and the composer sits right above the keyboard.
const FIT_JS = String.raw`
  function armFit(panel,isOpen){
    var vv=window.visualViewport;
    function fit(){
      if(!vv||!isOpen()||window.innerWidth>520){panel.style.top=panel.style.height=panel.style.bottom="";return;}
      panel.style.top=vv.offsetTop+"px";panel.style.height=vv.height+"px";panel.style.bottom="auto";
    }
    if(vv){vv.addEventListener("resize",fit);vv.addEventListener("scroll",fit);}
    return fit;
  }
`;

// Changes on every server restart (pm2 reloads on each file save), so the browser
// and Cloudflare never serve the frame's JS/CSS from before the last edit.
//
// Cloudflare rewrites our `cache-control: no-cache` on /widget/* to a 4-hour
// browser TTL, so the version query is the only thing that actually busts a
// visitor's cache. It has to cover the WHOLE module graph, not just the entry
// file: a fresh widget.js importing a four-hour-old copy.js is how a rename
// shows up as raw translation keys on screen. Static imports cannot carry a
// query, hence the import map, which rewrites each resolved URL before fetch.
const ASSET_V = Date.now().toString(36);

const FRAME_MODULES = [
  "/widget/copy.js",
  "/widget/voicememo.js",
  "/premium/demo/chat.js",
  "/premium/demo/format.js",
  "/premium/demo/copy.js",
  "/premium/demo/icons.js",
  "/premium/demo/voice.js",
];

function frameImportMap(): string {
  const imports: Record<string, string> = {};
  for (const path of FRAME_MODULES) imports[path] = `${path}?v=${ASSET_V}`;
  return `<script type="importmap">${JSON.stringify({ imports })}</script>`;
}

// ── The frame document ───────────────────────────────────────────────────────
// Kept server-side because the CSP header and the injected config must be
// decided per request, and a static file cannot carry either.
export function renderFrameHtml(opts: { mode: "live"; config: FrameConfig } | { mode: "demo"; demo: DemoFrame }): string {
  const boot = opts.mode === "live"
    ? { mode: "live", config: opts.config }
    : {
        mode: "demo",
        token: opts.demo.token,
        config: {
          agentName: opts.demo.agentName,
          companyName: opts.demo.companyName,
          avatar: opts.demo.avatar,
          language: opts.demo.language,
          quickReplies: opts.demo.quickReplies || [],
        },
      };
  const lang = opts.mode === "live" ? opts.config.language : opts.demo.language;
  const raw = opts.mode === "live" ? opts.config.accent : opts.demo.accent;
  const accent = raw && /^#[0-9a-fA-F]{6}$/.test(raw) ? raw.toLowerCase() : "";
  // A live widget wears its configured orb; a demo swirls the colour the demo
  // page tinted its launcher with, so the chat matches the button it opened from.
  const look = opts.mode === "live"
    ? orbLook({
        style: opts.config.orbStyle, color: accent, eyes: opts.config.orbEyes,
        tint: opts.config.orbTint, face: opts.config.orbFace, photo: opts.config.orbPhoto,
        rim: opts.config.orbRim, rimColor: opts.config.orbRimColor,
      }, inkFor)
    : orbLook({ style: accent ? "tinted" : "metal", color: accent }, inkFor);
  return `<!doctype html>
<html lang="${escapeHtml(lang2(lang))}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Chat</title>
<link rel="stylesheet" href="/premium/design-tokens.css?v=${ASSET_V}">
<link rel="stylesheet" href="/premium/demo/demo.css?v=${ASSET_V}">
<link rel="stylesheet" href="/widget/widget.css?v=${ASSET_V}">
${accent ? `<style>:root{--w-accent:${accent};--w-accent-ink:${inkFor(accent)}}</style>` : ""}
<style>${ORB_CSS}</style>
${frameImportMap()}
</head>
<body class="wdg-body${look.cls ? " " + look.cls : ""}" style="${escapeHtml(look.vars + photoVar(look.photo))}">
<div id="root"></div>
<script>window.__WIDGET__ = ${JSON.stringify(boot).replace(/</g, "\\u003c")};</script>
<script type="module" src="/widget/widget.js?v=${ASSET_V}"></script>
</body>
</html>`;
}

// ── The widget demo page ─────────────────────────────────────────────────────
export function escapeHtml(value: string): string {
  return String(value).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c] as string));
}

export function renderDemoPageHtml(o: {
  token: string; shotUrl: string; company: string;
  avatar: string; agentName: string; language: string;
  /** The launcher's brand colour; null keeps the black default. */
  color: string | null;
}): string {
  const l = lang2(o.language);
  const color = o.color && /^#[0-9a-f]{6}$/i.test(o.color) ? o.color : null;
  const look = orbLook({ style: color ? "tinted" : "metal", color }, inkFor);
  const tint = `${look.cls ? " " + look.cls : ""}" style="${look.vars}`;
  // The prospect's homepage IS the page: full width, scrolling like their real
  // site, with the launcher fixed to the viewport corner exactly where it would
  // sit on it. No browser mock-up or caption around it; anything we add is
  // something that is not their site.
  return `<!doctype html>
<html lang="${escapeHtml(l)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${escapeHtml(o.company || "Website chat")}</title>
<meta name="robots" content="noindex, nofollow">
<style>
  *{box-sizing:border-box}
  html,body{margin:0;min-height:100dvh;background:#000}
  img.bg{display:block;width:100%;height:auto;user-select:none;-webkit-user-drag:none}
  .empty{min-height:100dvh;display:flex;align-items:center;justify-content:center;padding:24px;
         font:14px/1.5 -apple-system,BlinkMacSystemFont,"Segoe UI",system-ui,sans-serif;color:#a1a1aa}
  ${LAUNCHER_CSS}
</style>
</head>
<body>
${o.shotUrl
  ? `<img class="bg" src="${escapeHtml(o.shotUrl)}" alt="${escapeHtml(o.company)}" />`
  : `<div class="empty">No screenshot for this demo yet.</div>`}
<div class="la-root${tint}" id="la-root">
  <iframe class="la-panel" id="la-panel" title="Chat" allow="microphone"></iframe>
  <div class="la-teaser" id="la-teaser" role="button" tabindex="0">
    <div>${o.agentName ? `<b>${escapeHtml(o.agentName)}</b>` : ""}<span>${escapeHtml(TEASER[l])}</span></div>
    <button class="la-tx" id="la-tx" type="button" aria-label="${escapeHtml(CLOSE_LABEL[l])}">${ICON_X}</button>
  </div>
  <button class="la-btn" id="la-btn" type="button" aria-label="${escapeHtml(OPEN_LABEL[l])}">${BUTTON_INNER}</button>
</div>
<script>
(function(){
  ${UNREAD_JS}
  ${TEASER_JS}
  ${FIT_JS}
  var dot=document.querySelector(".la-dot");
  var root=document.getElementById("la-root"),panel=document.getElementById("la-panel"),btn=document.getElementById("la-btn"),
      teaser=document.getElementById("la-teaser"),tx=document.getElementById("la-tx");
  var loaded=false,open=false;
  var fit=armFit(panel,function(){return open;});
  function toggle(){
    open=!open;
    if(open&&!loaded){panel.src="/widget/frame?token=${encodeURIComponent(o.token)}${o.color ? `&c=${encodeURIComponent(o.color)}` : ""}";loaded=true;}
    panel.classList.toggle("open",open);
    root.classList.toggle("is-open",open);
    teaser.classList.remove("show");
    fit();
    if(open){clearUnread(dot);primeAudio();}
  }
  btn.addEventListener("click",toggle);
  teaser.addEventListener("click",function(){if(!open)toggle();});
  tx.addEventListener("click",function(e){e.stopPropagation();teaser.classList.remove("show");});
  // Armed on every load here (no once-per-session memory like the loader): the
  // prospect should see exactly what a first-time visitor to their site sees.
  armTeaser(function(){
    if(open)return;
    teaser.classList.add("show");
    setTimeout(function(){teaser.classList.remove("show");},TEASER_MS);
  });
  window.addEventListener("message",function(e){
    if(e.data&&e.data.type==="la-widget-close"&&open)toggle();
    if(e.data&&e.data.type==="la-widget-unread"&&!open)showUnread(dot,e.data.count);
  });
})();
</script>
</body>
</html>`;
}

// ── The loader ───────────────────────────────────────────────────────────────
// One file to serve with no build step. The launcher stylesheet and icons are
// embedded as JSON strings so the loader and the demo page cannot drift apart.
export const LOADER_JS = String.raw`(function () {
  "use strict";
  ` + UNREAD_JS + TEASER_JS + FIT_JS + String.raw`
  var LAUNCHER_CSS = ` + JSON.stringify(LAUNCHER_CSS) + String.raw`;
  var BUTTON_INNER = ` + JSON.stringify(BUTTON_INNER) + String.raw`;
  var ICON_X = ` + JSON.stringify(ICON_X) + String.raw`;
  // The script tag that loaded us carries the key and (optionally) overrides.
  var self = document.currentScript || (function () {
    var all = document.getElementsByTagName("script");
    for (var i = all.length - 1; i >= 0; i--) if (all[i].src && all[i].src.indexOf("/widget/v1.js") > -1) return all[i];
    return null;
  })();
  if (!self) return;
  var key = self.getAttribute("data-key") || "";
  if (!key) return;
  var origin = new URL(self.src, location.href).origin;
  var left = self.getAttribute("data-position") === "left";
  if (window.__leadawakerWidget) return;        // never mount twice
  window.__leadawakerWidget = true;

  // A visitor id, not a user id: it identifies this browser's thread so a
  // returning visitor keeps their conversation. Storage can throw in a private
  // window, so every access is guarded and falls back to a per-page id.
  var vid = "";
  try { vid = localStorage.getItem("la_widget_visitor") || ""; } catch (e) {}
  if (!/^[A-Za-z0-9]{8,40}$/.test(vid)) {
    var bytes = new Uint8Array(16);
    (window.crypto || {}).getRandomValues ? window.crypto.getRandomValues(bytes) : bytes.forEach(function (_, i) { bytes[i] = Math.floor(Math.random() * 256); });
    vid = Array.prototype.map.call(bytes, function (b) { return ("0" + b.toString(16)).slice(-2); }).join("");
    try { localStorage.setItem("la_widget_visitor", vid); } catch (e) {}
  }

  // Shadow DOM: the host page's CSS cannot reach in, and ours cannot leak out.
  var mount = document.createElement("div");
  mount.setAttribute("data-leadawaker-widget", "");
  mount.style.cssText = "position:fixed;z-index:2147483000;bottom:0;" + (left ? "left" : "right") + ":0;width:0;height:0;";
  var shadow = mount.attachShadow ? mount.attachShadow({ mode: "open" }) : mount;
  document.body.appendChild(mount);

  var style = document.createElement("style");
  style.textContent = ":host{all:initial}" + LAUNCHER_CSS;
  shadow.appendChild(style);

  var root = document.createElement("div");
  root.className = "la-root" + (left ? " left" : "");
  shadow.appendChild(root);

  var frame = document.createElement("iframe");
  frame.className = "la-panel";
  frame.title = "Chat";
  frame.setAttribute("loading", "lazy");
  frame.setAttribute("allow", "microphone");
  root.appendChild(frame);

  var teaser = document.createElement("div");
  teaser.className = "la-teaser";
  teaser.setAttribute("role", "button");
  teaser.tabIndex = 0;
  root.appendChild(teaser);

  var btn = document.createElement("button");
  btn.className = "la-btn";
  btn.type = "button";
  btn.setAttribute("aria-label", "Open chat");
  btn.innerHTML = BUTTON_INNER;
  root.appendChild(btn);
  var dot = btn.querySelector(".la-dot");

  var loaded = false, open = false;
  var fit = armFit(frame, function () { return open; });
  function toggle() {
    open = !open;
    if (open && !loaded) {
      frame.src = origin + "/widget/frame?key=" + encodeURIComponent(key) + "#v=" + encodeURIComponent(vid);
      loaded = true;
    }
    frame.classList.toggle("open", open);
    root.classList.toggle("is-open", open);
    btn.setAttribute("aria-label", open ? "Close chat" : "Open chat");
    fit();
    if (open) { clearUnread(dot); hideTeaser(); primeAudio(); }
  }
  btn.addEventListener("click", toggle);

  // A small public handle so the host page can open the chat from its own
  // buttons (e.g. "Ask Sara now"). The ready event lets those buttons stay
  // hidden until the launcher actually exists.
  window.LeadAwakerWidget = {
    open: function () { if (!open) toggle(); },
    close: function () { if (open) toggle(); },
    toggle: toggle
  };
  try { window.dispatchEvent(new Event("leadawaker-widget-ready")); } catch (e) {}

  // The greeting teaser: once per browser session, a few seconds after load,
  // and not again once dismissed or opened. Built from /widget/meta so the
  // loader stays one static file with no per-key templating.
  function hideTeaser() {
    teaser.classList.remove("show");
    try { sessionStorage.setItem("la_widget_teased", "1"); } catch (e) {}
  }
  var teased = false;
  try { teased = sessionStorage.getItem("la_widget_teased") === "1"; } catch (e) {}
  // Fetched on every load, teaser or not: it also carries the orb's look, which
  // is set in the CRM rather than in this script tag.
  if (window.fetch) {
    fetch(origin + "/widget/meta?key=" + encodeURIComponent(key)).then(function (r) { return r.ok ? r.json() : null; }).then(function (m) {
      if (!m) return;
      if (m.look) {
        if (m.look.cls) m.look.cls.split(" ").forEach(function (c) { root.classList.add(c); });
        if (m.look.vars) root.style.cssText += ";" + m.look.vars;
        // The photo URL is relative to the API origin, not the page's.
        var photo = m.look.photo ? (/^https?:/.test(m.look.photo) ? "" : origin) + m.look.photo : null;
        if (photo) root.style.setProperty("--lo-photo", "url('" + photo + "')");
        // Handed to the host page too, so a site that draws the assistant
        // elsewhere (leadawaker.com does) can wear the same face as the widget.
        var look = { cls: m.look.cls || "", vars: m.look.vars || "", photo: photo };
        window.LeadAwakerWidget.look = look;
        try { window.dispatchEvent(new CustomEvent("leadawaker-widget-look", { detail: look })); } catch (e) {}
      }
      if (teased || !m.teaser) return;
      var body = document.createElement("div");
      if (m.agentName) { var b = document.createElement("b"); b.textContent = m.agentName; body.appendChild(b); }
      var s = document.createElement("span"); s.textContent = m.teaser; body.appendChild(s);
      var x = document.createElement("button");
      x.className = "la-tx"; x.type = "button"; x.setAttribute("aria-label", m.closeLabel || "Close"); x.innerHTML = ICON_X;
      x.addEventListener("click", function (e) { e.stopPropagation(); hideTeaser(); });
      teaser.appendChild(body); teaser.appendChild(x);
      teaser.addEventListener("click", function () { if (!open) toggle(); });
      armTeaser(function () {
        if (open) return;
        teaser.classList.add("show");
        setTimeout(function () { if (teaser.classList.contains("show")) hideTeaser(); }, TEASER_MS);
      });
    }).catch(function () {});
  }

  // The frame asks to be closed (its own X button) and reports unread replies.
  window.addEventListener("message", function (e) {
    if (e.origin !== origin || !e.data || typeof e.data !== "object") return;
    if (e.data.type === "la-widget-close" && open) toggle();
    // Only a closed panel dings: with the chat open, the reply on screen is the
    // notification, and a sound on top of every message is just noise.
    if (e.data.type === "la-widget-unread" && !open) showUnread(dot, e.data.count);
  });
})();`;

/** What the loader's teaser needs, in the widget's own language. A relative
 *  avatar path stays relative: the loader resolves it against the API origin it
 *  already knows, which is more reliable than guessing the scheme here behind
 *  Cloudflare. */
/** The launcher alone, for the CRM's appearance controls: the real button and
 *  stylesheet, wearing the widget's look, on a plain ground. */
export function renderLauncherPreviewHtml(cfg: FrameConfig, photo: string | null): string {
  const look = orbLook({
    style: cfg.orbStyle, color: cfg.accent, eyes: cfg.orbEyes,
    tint: cfg.orbTint, face: cfg.orbFace, photo, rim: cfg.orbRim, rimColor: cfg.orbRimColor,
  }, inkFor);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${LAUNCHER_CSS}
html,body{margin:0;height:100%;background:transparent}
.la-root{--la-pos:absolute;--la-gap:0px;position:absolute;left:50%;top:50%;width:60px;height:60px;transform:translate(-50%,-50%)}
</style></head><body><div class="la-root${look.cls ? " " + look.cls : ""}" style="${escapeHtml(look.vars + photoVar(look.photo))}">
<button class="la-btn" type="button" tabindex="-1">${BUTTON_INNER}</button></div></body></html>`;
}

export function teaserMeta(cfg: FrameConfig) {
  const l = lang2(cfg.language);
  return {
    agentName: cfg.agentName, avatar: cfg.avatar, teaser: TEASER[l], closeLabel: CLOSE_LABEL[l],
    look: orbLook({
      style: cfg.orbStyle, color: cfg.accent, eyes: cfg.orbEyes,
      tint: cfg.orbTint, face: cfg.orbFace, photo: cfg.orbPhoto,
      rim: cfg.orbRim, rimColor: cfg.orbRimColor,
    }, inkFor),
  };
}
