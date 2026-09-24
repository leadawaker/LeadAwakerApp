// client/public/social-demo/main.js
import { createTransport } from "/premium/demo/transport.js";
import { settleTracker } from "/premium/demo/tracker.js";
import { confetti } from "/premium/demo/confetti.js";
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

const wide = () => window.matchMedia("(min-width: 900px)").matches;

const transport = createTransport({
  token: BOOT.token,
  onState(s, m) {
    state = s; pending = m.pending;
    if (seenStage && seenStage !== "objective" && s.stage === "objective" && !celebrated) { celebrated = true; confetti(); }
    if (s.stage) seenStage = s.stage;
    render();
  },
  onRecap(r) { recap = r; render(); },
  onError() { /* keep the last good screen; the poll retries */ },
});

admin.init({
  token: BOOT.token,
  getState: () => state,
  reload: () => transport.pollSoon(150),
  restart: (scenario) => transport.restart(scenario).then(() => {
    view = "feed"; comments = []; hint = false; recap = null; celebrated = false; render();
    window.scrollTo(0, 0);
  }),
});

function render() {
  if (view === "feed" || !state) {
    root.innerHTML = feedHtml({ lang, post, imageUrl: BOOT.imageUrl, company: BOOT.company, comments, hint });
    bindFeed();
    return;
  }
  const keepDraft = document.getElementById("msg");
  if (keepDraft) draft = keepDraft.value;
  root.innerHTML = dmHtml({ lang, company: BOOT.company, handle: post ? post.handle : "", state, pending, recap, admin: !!state.admin, wide: wide(), showList });
  bindDm();
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
  const toast = document.createElement("button");
  toast.className = "ig-toast";
  toast.textContent = tr(lang, "dmToast", { handle: post.handle });
  document.body.appendChild(toast);
  let opened = false;
  const open = () => {
    if (opened) return; opened = true; toast.remove();
    transport.load().then(() => { view = "dm"; render(); window.scrollTo(0, 0); });
  };
  toast.addEventListener("click", open);
  setTimeout(open, 2200);
}

function bindDm() {
  const form = document.getElementById("ig-composer");
  const input = document.getElementById("msg");
  if (input) { input.value = draft; input.addEventListener("input", () => { draft = input.value; }); }
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
  if (stream) stream.scrollTop = stream.scrollHeight;
  settleTracker(root);
  if (state && state.admin) admin.bindTrigger();
}

window.matchMedia("(min-width: 900px)").addEventListener("change", render);

if (view === "dm") transport.load().then(render).catch(() => { view = "feed"; render(); });
else render();
