// client/public/social-demo/main.js
import { createTransport } from "/premium/demo/transport.js";
import { settleTracker } from "/premium/demo/tracker.js";
import { confetti } from "/premium/demo/confetti.js";
import { signature } from "/premium/demo/format.js";
import * as admin from "/premium/demo/admin.js";
import { setLang } from "/premium/demo/copy.js";
import { matchesKeyword } from "./keyword.js";
import { feedHtml } from "./feed.js";
import { dmHtml } from "./dm.js";
import { tr } from "./copy.js";

const BOOT = window.__SOCIAL__ || {};
const lang = ["en", "nl", "pt"].includes(BOOT.language) ? BOOT.language : "en";
setLang(lang);
const root = document.getElementById("root");
const post = BOOT.post;

let view = BOOT.started ? "dm" : "feed";
let comments = [];
let hint = false;
let state = null;
let pending = false;
let recap = null;
let showList = false;
let seenStage = null;
let celebrated = false;
let draft = "";
let dmOpening = false;
// Cheap change detector so a poll that returns nothing new does not repaint
// the DM view, which would otherwise steal focus from the composer and
// re-run the scroll-to-bottom every 6s (1.6s while pending). Mirrors
// premium/demo/main.js's own lastSig guard.
let lastSig = "";

const wide = () => window.matchMedia("(min-width: 900px)").matches;

function fullSignature(s, p) {
  if (!s) return "";
  return [signature(s), p ? "1" : "0", s.admin ? "1" : "0", JSON.stringify(s.quote || null)].join("|");
}

const transport = createTransport({
  token: BOOT.token,
  onState(s, m) {
    const grew = !!(state && s.messages && state.messages && s.messages.length > state.messages.length);
    state = s; pending = m.pending;
    if (seenStage && seenStage !== "objective" && s.stage === "objective" && !celebrated) { celebrated = true; confetti(); }
    if (s.stage) seenStage = s.stage;
    // A restart already returned to the feed; nothing about this poll
    // belongs there, and repainting it would wipe a half-typed comment.
    if (view === "feed") return;
    const next = fullSignature(state, pending);
    if (next === lastSig) return;
    lastSig = next;
    render({ grew });
  },
  onRecap(r) {
    recap = r;
    if (view === "feed") return;
    render({ grew: false });
  },
  onError() { /* keep the last good screen; the poll retries */ },
});

admin.init({
  token: BOOT.token,
  getState: () => state,
  reload: () => transport.pollSoon(150),
  // transport.restart() resolves false on a skip (already busy, no state
  // yet) or a failed request; only a true return means a fresh conversation
  // actually landed, and only then does the page belong back on the feed.
  restart: (scenario) => transport.restart(scenario).then((ok) => {
    if (!ok) return false;
    view = "feed"; comments = []; hint = false; recap = null; celebrated = false; lastSig = "";
    render();
    window.scrollTo(0, 0);
    return true;
  }),
});

function render(opts) {
  const grew = !!(opts && opts.grew);
  if (view === "feed" || !state) {
    root.innerHTML = feedHtml({ lang, post, imageUrl: BOOT.imageUrl, company: BOOT.company, comments, hint });
    bindFeed();
    return;
  }
  // Captured from the OUTGOING DOM, just before it is replaced, so the
  // decision about what to preserve is made from what was actually on
  // screen a moment ago rather than from state that has already moved on.
  const hadFocus = !!(document.activeElement && document.activeElement.id === "msg");
  const prevStream = document.getElementById("stream");
  const atBottom = !prevStream || (prevStream.scrollHeight - prevStream.scrollTop - prevStream.clientHeight < 48);
  root.innerHTML = dmHtml({ lang, company: BOOT.company, handle: post ? post.handle : "", state, pending, recap, admin: !!state.admin, wide: wide(), showList });
  bindDm({ restoreFocus: hadFocus, snap: grew || atBottom });
}

function bindFeed() {
  const pill = document.getElementById("ig-scroll-pill");
  if (pill) window.addEventListener("scroll", () => pill.classList.add("is-gone"), { once: true, passive: true });
  const form = document.getElementById("ig-comment-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = document.getElementById("ig-comment");
    const text = input.value.trim();
    if (!text) return;
    comments.push({ author: tr(lang, "you"), text });
    const hit = matchesKeyword(text, post.keyword);
    hint = !hit;
    render();
    if (hit) openDmSoon();
  });
}

function openDmSoon() {
  // A second matching comment within the toast's own window (or while the
  // engine call from the first one is still in flight) used to spawn a
  // second toast and a second 2.2s timer. One opener at a time.
  if (dmOpening) return;
  dmOpening = true;
  const toast = document.createElement("button");
  toast.className = "ig-toast";
  toast.textContent = tr(lang, "dmToast", { handle: post.handle });
  document.body.appendChild(toast);
  let opened = false;
  const open = () => {
    if (opened) return; opened = true; toast.remove();
    // Only now does the page call the engine, so the opener is created at
    // comment time, not page load. A failed load must not strand dmOpening
    // as true, or the visitor could never retry.
    transport.load().then(() => {
      dmOpening = false;
      view = "dm";
      lastSig = fullSignature(state, pending);
      render({ grew: true });
      window.scrollTo(0, 0);
    }).catch(() => {
      dmOpening = false;
      dmErrorToast();
    });
  };
  toast.addEventListener("click", open);
  setTimeout(open, 2200);
}

function dmErrorToast() {
  const t = document.createElement("button");
  t.className = "ig-toast ig-toast--error";
  t.textContent = tr(lang, "dmOpenError");
  document.body.appendChild(t);
  const retry = () => { t.remove(); openDmSoon(); };
  t.addEventListener("click", retry);
  setTimeout(() => { if (t.parentNode) t.remove(); }, 4000);
}

function bindDm(opts) {
  const o = opts || {};
  const form = document.getElementById("ig-composer");
  const input = document.getElementById("msg");
  if (input) {
    input.value = draft;
    input.addEventListener("input", () => { draft = input.value; });
    if (o.restoreFocus && !admin.isOpen()) {
      input.focus();
      const len = input.value.length;
      try { input.setSelectionRange(len, len); } catch (_) { /* not all input states support it */ }
    }
  }
  if (form) form.addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value;
    draft = "";
    transport.send(text);
  });
  const back = document.getElementById("ig-back");
  if (back) back.addEventListener("click", () => { showList = true; render(); });
  const open = document.getElementById("ig-open-thread");
  if (open) open.addEventListener("click", () => { showList = false; render(); });
  const stream = document.getElementById("stream");
  if (stream && o.snap !== false) stream.scrollTop = stream.scrollHeight;
  settleTracker(root);
  if (state && state.admin) admin.bindTrigger();
}

window.matchMedia("(min-width: 900px)").addEventListener("change", () => render());

if (view === "dm") {
  // A blank #root until the first GET resolves reads as a broken page on a
  // link that was minted with `started: true`; hold a light placeholder.
  // view is already "dm" here, so transport.load()'s own onState callback
  // (fired from inside accept()) paints the real thread; nothing further to
  // do on success. Only the failure path needs handling here.
  root.innerHTML = `<div class="ig-dm-loading">${tr(lang, "loading")}</div>`;
  transport.load().catch(() => { view = "feed"; render(); });
} else {
  render();
}
