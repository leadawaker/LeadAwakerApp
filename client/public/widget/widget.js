// The widget's chat document. Runs inside the iframe served by
// GET /widget/frame (server/routes/widget.ts), never on the host page.
//
// Deliberately reuses the demo page's renderer (chat.js) and its helpers rather
// than carrying a second chat UI: the iframe already gives us the CSS isolation
// that made a separate implementation look necessary. What it does NOT reuse is
// everything demo-shaped — presenter panel, recap rail, stage tracker, restart,
// bump, confetti — none of which a client's visitor should ever see.
//
// Same post-then-poll contract as the demo: POST enqueues a turn, the page polls
// state and shows a typing indicator meanwhile.

import { messagesHtml } from "/premium/demo/chat.js";
import { esc, signature, mmss } from "/premium/demo/format.js";
// chat.js reads its own labels (voice note, transcript) from the demo copy
// module, so the language has to be set there too, not only here.
import { setLang, browserLang, t } from "/premium/demo/copy.js";
import { icon } from "/premium/demo/icons.js";
import { setWidgetLang, w } from "./copy.js";
import * as memo from "./voicememo.js";

var voice = memo.voice;

// icons.js has no "x"; the close glyph lives here rather than being added to a
// module the demo page also loads.
var X_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M18 6 6 18M6 6l12 12"/></svg>';
var SEND_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>';

var CLIP_SVG = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m21.4 11.1-9.2 9.2a6 6 0 0 1-8.5-8.5l8.6-8.6a4 4 0 0 1 5.7 5.7l-8.6 8.6a2 2 0 0 1-2.8-2.8l8.5-8.5"/></svg>';

var BOOT = window.__WIDGET__ || {};
var CFG = BOOT.config || {};
var DEMO = BOOT.mode === "demo";

// The agent's face: the orb (styles in server/widgetOrb.ts, inlined into this
// document). The same character on the welcome screen, the header and every AI
// message, so the visitor is talking to one someone, not a row of initials.
function orb(cls) {
  return '<span class="lo' + (cls ? " " + cls : "") + '" aria-hidden="true"><span class="lo-eyes"><i></i><i></i></span></span>';
}
var AI_AVATAR = '<div class="av av-orb">' + orb() + "</div>";

// Phones open the keyboard on focus, so the input is only focused for them when
// they were already typing; a desktop gets it focused on open.
var FINE_POINTER = window.matchMedia && window.matchMedia("(hover: hover) and (pointer: fine)").matches;

// The visitor id is handed over in the URL fragment by the loader. A fragment,
// not a query string: it never reaches the server log, and the server does not
// need it to render this document (only the API calls below carry it).
var VISITOR = (location.hash || "").replace(/^#v=/, "");
if (!DEMO && !/^[A-Za-z0-9]{8,40}$/.test(VISITOR)) VISITOR = "";

var API = DEMO
  ? "/api/web-demo/" + encodeURIComponent(BOOT.token)
  : "/api/widget/" + encodeURIComponent(CFG.key || "");

var root = document.getElementById("root");
var state = null;
var pending = false;      // a turn is queued and we are waiting for the reply
var busy = false;         // a send is in flight
var draft = "";
var lastSig = "";
var pollTimer = null;
var epoch = 0;            // invalidates polls that were in flight across a send
var fatal = "";
// The composer is showing the recording bar. While true, render() refuses to
// repaint: a poll landing mid-sentence would otherwise rebuild the bar and the
// running recorder's buttons under the visitor's thumb. Every path that ends a
// recording repaints once it is false again.
var recording = false;
var starting = false;
// The restart confirmation has replaced the composer. A restart throws the
// thread away, so it is never one stray tap.
var confirming = false;
// A one-line problem shown above the composer (a photo that would not send).
var notice = "";

var LANG = (CFG.language || browserLang() || "en").toLowerCase();
setLang(LANG);
setWidgetLang(LANG);

// ── network ─────────────────────────────────────────────────────────────────

function api(path, opts) {
  return fetch(API + (path || ""), opts).then(function (r) {
    return r.json().then(function (body) {
      if (!r.ok) throw Object.assign(new Error(body.message || "error"), { body: body });
      return body;
    });
  });
}

function withContext(extra) {
  // The proxy overwrites account, campaign and caps on every request, so these
  // are conveniences for the engine, never a trust boundary.
  return Object.assign({ visitorId: VISITOR }, extra || {});
}

// GET query strings: the live proxy needs the visitor id on every read.
function qs(extra) {
  var parts = [];
  if (!DEMO) parts.push("visitorId=" + encodeURIComponent(VISITOR));
  if (extra) parts.push(extra);
  return parts.length ? "?" + parts.join("&") : "";
}

// ── render ──────────────────────────────────────────────────────────────────

// "AI assistant · Company": what she is, and whose. The company is the one the
// prompt speaks for (the account on a live widget, the persona in a demo).
function roleLine() {
  var company = CFG.companyName || (state && state.company) || "";
  return w("role") + (company ? " · " + company : "");
}

// On the welcome screen the header carries only the controls: the big orb
// below already says who this is.
function headerHtml(agent, bare) {
  return '<header class="wdg-hdr' + (bare ? " is-bare" : "") + '">' +
      (bare ? "<span></span>" :
      '<div class="wdg-id">' +
        orb("wdg-ph") +
        '<span class="wdg-who">' +
          '<span class="wdg-name">' + esc(agent || w("assistant")) + "</span>" +
          '<span class="wdg-role">' + esc(roleLine()) + "</span>" +
        "</span>" +
      "</div>") +
      '<div class="wdg-acts">' +
        (!bare && canRestart()
          ? '<button class="wdg-act wdg-restart" type="button" aria-label="' + esc(w("restart")) +
            '" title="' + esc(w("restart")) + '">' + icon("rotate-ccw", 16) + "</button>"
          : "") +
        '<button class="wdg-act wdg-x" type="button" aria-label="' + esc(w("close")) + '">' + X_SVG + "</button>" +
      "</div>" +
    "</header>";
}

// One round button, two jobs, the WhatsApp arrangement: an empty input offers
// the mic, and the moment anything is typed the same button sends.
function micMode() {
  return voice.micAvailable() && !draft.trim();
}

// The live surface answers this directly; the demo surface counts its own
// restart budget instead, so the same button reads whichever one is present.
function canRestart() {
  if (!state) return false;
  if (DEMO) return !state.done && (state.restartsMax || 0) - (state.restartsUsed || 0) > 0;
  return !!state.canRestart;
}

function confirmHtml() {
  return '<div class="wdg-confirm" role="group">' +
      "<p>" + esc(w("restartAsk")) + "</p>" +
      '<div class="wdg-confirm-row">' +
        '<button type="button" class="wdg-cbtn" data-confirm="no">' + esc(w("cancel")) + "</button>" +
        '<button type="button" class="wdg-cbtn is-go" data-confirm="yes">' + esc(w("restartYes")) + "</button>" +
      "</div>" +
    "</div>";
}

// Starter chips. They answer "what can I even ask this thing?", which is the
// question that closes a widget in the first three seconds. Offered ONCE: the
// moment the visitor has said anything they are gone, because a row of buttons
// that never leaves turns the chat into a phone menu, which is exactly the
// impression the AI is there to kill.
function chipsHtml(msgs, done) {
  var chips = CFG.quickReplies || [];
  if (done || recording || confirming || !chips.length) return "";
  for (var i = 0; i < msgs.length; i++) if (msgs[i].role === "visitor") return "";
  var out = '<div class="wdg-chips">';
  for (var c = 0; c < chips.length && c < 3; c++) {
    out += '<button type="button" class="wdg-chip" data-chip="' + c + '">' + esc(chips[c].label) + "</button>";
  }
  return out + "</div>";
}

function composerHtml(done) {
  if (confirming) return confirmHtml();
  if (done) return '<div class="wdg-done">' + esc(w("ended")) + "</div>";
  if (recording) {
    return '<div class="wdg-rec" role="group" aria-label="' + esc(t("voiceRecording")) + '">' +
        '<button type="button" class="wdg-rec-x" aria-label="' + esc(t("voiceDiscard")) + '">' + icon("trash", 15) + "</button>" +
        '<span class="rec-dot" aria-hidden="true"></span>' +
        '<span class="rec-time" id="rec-time">0:00</span>' +
        '<span class="rec-meter" aria-hidden="true">' + memo.meterBars() + "</span>" +
        '<button type="button" class="wdg-send" id="rec-send" aria-label="' + esc(t("voiceSendMemo")) + '">' + SEND_SVG + "</button>" +
      "</div>";
  }
  var mic = micMode();
  var label = mic ? t("voiceRecord") : w("send");
  // Photos go through the live widget's own endpoint; the demo surface has none.
  var clip = DEMO ? "" :
    '<button class="wdg-clip" type="button" aria-label="' + esc(w("attach")) + '" title="' + esc(w("attach")) + '"' +
      (busy || pending ? " disabled" : "") + ">" + CLIP_SVG + "</button>";
  return clip + '<div class="wdg-field">' +
      '<textarea class="wdg-input" rows="1" placeholder="' + esc(w("placeholder")) + '"></textarea>' +
      '<button class="wdg-send" type="button" data-mode="' + (mic ? "mic" : "send") + '" aria-label="' + esc(label) + '"' +
        (busy ? " disabled" : "") + ">" + (mic ? icon("mic", 16) : SEND_SVG) + "</button>" +
    "</div>";
}

function paint() {
  if (fatal) {
    root.innerHTML = '<div class="wdg-fatal">' + esc(fatal) + "</div>";
    return;
  }
  var s = state || { messages: [], agent: CFG.agentName || "" };
  var agent = s.agent || CFG.agentName || "";
  var greeting = (state && state.greeting) || CFG.greeting || "";

  // Before the first message there is no lead and no stored transcript, so the
  // configured greeting is rendered locally. Once the conversation starts the
  // engine records it as the first outbound message and it arrives in messages,
  // which is why it is only synthesised while the thread is empty.
  var msgs = s.messages && s.messages.length
    ? s.messages
    : (greeting ? [{ id: "greeting", role: "ai", text: greeting, at: null }] : []);

  var done = !!(state && state.done);
  var hadFocus = !!(document.activeElement && document.activeElement.classList.contains("wdg-input"));
  var welcome = isWelcome(msgs, done);
  root.innerHTML =
    '<div class="wdg' + (welcome ? " is-welcome" : "") + '">' +
      headerHtml(agent, welcome) +
      (welcome
        ? welcomeHtml(agent, greeting)
        : '<div class="wdg-stream" id="stream">' +
            messagesHtml({ messages: msgs, agent: agent }, pending, memo.playerState(),
              { avatarHtml: AI_AVATAR, imageSrc: imageSrc }) +
          "</div>") +
      chipsHtml(msgs, done) +
      (notice ? '<div class="wdg-notice" role="alert">' + esc(notice) + "</div>" : "") +
      '<div class="wdg-composer">' + composerHtml(done) + "</div>" +
    "</div>";
  wire(hadFocus || FINE_POINTER);
  scrollToEnd();
}

// Until the visitor has said anything, the panel is a welcome screen rather
// than a thread holding one greeting bubble.
function isWelcome(msgs, done) {
  if (done || pending || msgs.length > 1) return false;
  return !msgs.length || msgs[0].role === "ai";
}

function welcomeHtml(agent, greeting) {
  return '<div class="wdg-welcome">' +
      '<div class="wdg-hero">' + orb("wdg-hero-orb") + '<span class="wdg-hero-shadow"></span></div>' +
      '<h1 class="wdg-hi">' + esc(agent ? w("hi").replace("{name}", agent) : w("hiAnon")) +
        '<span class="wdg-hi-sub">' + esc(roleLine()) + "</span></h1>" +
      (greeting ? '<p class="wdg-greet">' + esc(greeting) + "</p>" : "") +
    "</div>";
}

function scrollToEnd() {
  var stream = document.getElementById("stream");
  if (stream) stream.scrollTop = stream.scrollHeight;
}

// Swapped in place per keystroke rather than through render(), which would
// rebuild the textarea and drop the caret.
function setSendMode() {
  var btn = root.querySelector(".wdg-send[data-mode]");
  if (!btn) return;
  var mic = micMode();
  var mode = mic ? "mic" : "send";
  if (btn.getAttribute("data-mode") === mode) return;
  btn.setAttribute("data-mode", mode);
  btn.setAttribute("aria-label", mic ? t("voiceRecord") : w("send"));
  btn.innerHTML = mic ? icon("mic", 16) : SEND_SVG;
}

function wire(focus) {
  var input = root.querySelector(".wdg-input");
  if (input) {
    input.value = draft;
    autoGrow(input);
    input.addEventListener("input", function () { draft = input.value; autoGrow(input); setSendMode(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    if (focus) input.focus();
  }
  var clip = root.querySelector(".wdg-clip");
  if (clip) clip.addEventListener("click", function () { if (!busy && !pending) picker.click(); });
  var send = root.querySelector(".wdg-send[data-mode]");
  if (send) send.addEventListener("click", function () {
    if (send.getAttribute("data-mode") === "mic") beginRecording();
    else doSend();
  });
  var recSend = document.getElementById("rec-send");
  if (recSend) recSend.addEventListener("click", function () { voice.stopRecording(); });
  var recX = root.querySelector(".wdg-rec-x");
  if (recX) recX.addEventListener("click", function () { voice.cancelRecording(); });
  var chips = root.querySelectorAll("[data-chip]");
  for (var c = 0; c < chips.length; c++) {
    chips[c].addEventListener("click", function (e) {
      var chip = (CFG.quickReplies || [])[Number(e.currentTarget.getAttribute("data-chip"))];
      if (!chip || busy) return;
      draft = chip.text;
      doSend();
    });
  }
  var restart = root.querySelector(".wdg-restart");
  if (restart) restart.addEventListener("click", function () {
    if (recording) voice.cancelRecording();
    confirming = true;
    paint();
  });
  var confirmBtns = root.querySelectorAll("[data-confirm]");
  for (var i = 0; i < confirmBtns.length; i++) {
    confirmBtns[i].addEventListener("click", function (e) {
      confirming = false;
      if (e.currentTarget.getAttribute("data-confirm") === "yes") doRestart();
      else paint();
    });
  }
  var x = root.querySelector(".wdg-x");
  if (x) x.addEventListener("click", function () {
    // The loader owns the panel, so closing is a request, not an action.
    parent.postMessage({ type: "la-widget-close" }, "*");
  });
}

function autoGrow(el) {
  el.style.height = "auto";
  var h = el.scrollHeight;
  // Hidden until the cap: a fractional line box makes scrollHeight a hair
  // taller than the box, and the browser flashes a scrollbar per keystroke.
  el.style.overflowY = h > 120 ? "auto" : "hidden";
  el.style.height = Math.min(h, 120) + "px";
}

function render() { if (!recording) paint(); }

// ── send + poll ─────────────────────────────────────────────────────────────

// Optimistic bubbles need the greeting in front of them while the server has
// not recorded it yet, or the visitor's first message appears with nothing
// above it for a second.
function localThread() {
  var local = (state && state.messages ? state.messages.slice() : []);
  var greeting = CFG.greeting || (state && state.greeting);
  if (!local.length && greeting) local.push({ id: "greeting", role: "ai", text: greeting, at: null });
  return local;
}

function failSend(err) {
  var code = (err.body && err.body.code) || "";
  if (code === "daily_cap" || code === "rate_limited" || code === "finished") fatal = err.message;
}

function doSend() {
  var text = (draft || "").trim();
  if (!text || busy) return;
  notice = "";
  busy = true;
  pending = true;
  epoch++;
  draft = "";

  var local = localThread();
  local.push({ id: "local-" + Date.now(), role: "visitor", text: text, at: new Date().toISOString() });
  state = Object.assign({}, state || {}, { messages: local });
  render();

  api("/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withContext({ text: text })),
  }).then(function () {
    busy = false;
    lastSig = "";
    schedulePoll(FAST_POLL);
  }).catch(function (err) {
    busy = false;
    pending = false;
    failSend(err);
    if (!fatal) draft = text;   // give them their words back rather than losing them
    render();
  });
}

// A restart does not clear anything on the server: the engine writes a marker,
// the contact keeps every conversation, and this thread starts at the greeting
// again. The local state is dropped so the next poll cannot paint the old
// messages back for a second.
function doRestart() {
  if (busy) return;
  busy = true;
  epoch++;
  draft = "";
  state = null;
  lastSig = "";
  pending = false;
  paint();

  api("/restart", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(withContext({})),
  }).catch(function (err) {
    failSend(err);
  }).then(function () {
    busy = false;
    schedulePoll(400);
    render();
  });
}

// ── voice memos ─────────────────────────────────────────────────────────────
// Tap to start, tap to send. The bar only appears once the recorder is really
// running, so a declined permission prompt never leaves a dead timer behind.

function beginRecording() {
  if (busy || pending || starting || recording || (state && state.done)) return;
  starting = true;
  voice.startRecording({ tick: onRecTick, done: onRecDone, fail: onRecFail });
}

function onRecTick(seconds) {
  if (!recording) {
    starting = false;
    recording = true;
    paint();
    return;
  }
  var el = document.getElementById("rec-time");
  if (!el) return;
  el.textContent = mmss(seconds);
  el.classList.toggle("is-amber", seconds >= voice.AMBER_SECONDS);
}

function onRecFail() {
  starting = false;
  recording = false;
  paint();
}

function onRecDone(blob, mime, ms) {
  starting = false;
  recording = false;
  if (state && state.done) { paint(); return; }
  epoch++;
  var localId = memo.holdLocal(blob, ms);
  var local = localThread();
  local.push({ role: "visitor", kind: "voice", id: localId, text: "", awaitingTranscript: true, at: new Date().toISOString() });
  state = Object.assign({}, state || {}, { messages: local });
  pending = true;
  busy = true;
  paint();

  voice.blobToBase64(blob).then(function (dataUrl) {
    return api("/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withContext({ audio: dataUrl, durationMs: ms })),
    });
  }).then(function () {
    busy = false;
    lastSig = "";
    schedulePoll(FAST_POLL);
  }).catch(function (err) {
    busy = false;
    pending = false;
    state.messages = state.messages.filter(function (m) { return m.id !== localId; });
    memo.dropLocal(localId);
    failSend(err);
    render();
  });
}

memo.wirePlayback(function (id) {
  return api("/audio" + qs("id=" + encodeURIComponent(id)));
});

// ── photos ──────────────────────────────────────────────────────────────────
// The paperclip. A photo is shrunk here (longest side 1280px, JPEG) before it
// leaves the phone: a camera original is 3 to 8MB, the vision model reads 1280px
// just as well, and the proxy refuses anything near the original's size.

var picker = document.createElement("input");
picker.type = "file";
picker.accept = "image/*";
picker.hidden = true;
document.body.appendChild(picker);
picker.addEventListener("change", function () {
  var file = picker.files && picker.files[0];
  picker.value = "";
  if (file) sendPhoto(file);
});

var photoCache = {};      // server message id -> data URL
var photoLoading = {};
var heldPhotos = [];      // sent from this tab, waiting for their server row
var unconfirmed = null;   // the optimistic bubble, kept until that row exists

function imageSrc(msg) {
  if (msg.localSrc) return msg.localSrc;
  if (photoCache[msg.id]) return photoCache[msg.id];
  if (msg.hasImage && !DEMO && !photoLoading[msg.id]) {
    photoLoading[msg.id] = true;
    api("/image" + qs("id=" + encodeURIComponent(msg.id))).then(function (r) {
      photoCache[msg.id] = r.dataUrl;
      render();
    }).catch(function () {});
  }
  return "";
}

// The vision model takes a few seconds to describe the photo, and the server
// row only exists after that. Until then the visitor's own bubble stays on
// screen; once the row lands, the photo they sent is pinned to it so it never
// has to be downloaded again.
function adoptPhotos(prevMessages, next) {
  if (!next || !next.messages) return;
  var known = {};
  (prevMessages || []).forEach(function (m) { known[m.id] = true; });
  var arrived = false;
  for (var i = 0; i < next.messages.length; i++) {
    var m = next.messages[i];
    if (m.kind !== "image" || m.role !== "visitor" || known[m.id] || photoCache[m.id]) continue;
    if (heldPhotos.length) photoCache[m.id] = heldPhotos.shift();
    arrived = true;
  }
  if (arrived) unconfirmed = null;
  if (unconfirmed) next.messages = next.messages.concat([unconfirmed]);
}

function shrinkPhoto(file) {
  return new Promise(function (resolve, reject) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      var scale = Math.min(1, 1280 / Math.max(img.naturalWidth, img.naturalHeight));
      var canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      var ctx = canvas.getContext("2d");
      ctx.fillStyle = "#fff";   // a transparent PNG would otherwise turn black
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      URL.revokeObjectURL(url);
      var q = 0.85, data = canvas.toDataURL("image/jpeg", q);
      while (data.length > 1300000 && q > 0.4) { q -= 0.15; data = canvas.toDataURL("image/jpeg", q); }
      resolve(data);
    };
    img.onerror = function () { URL.revokeObjectURL(url); reject(new Error("unreadable")); };
    img.src = url;
  });
}

function sendPhoto(file) {
  if (busy || pending || recording || (state && state.done)) return;
  if (!/^image\//.test(file.type || "")) { notice = w("photoFailed"); render(); return; }
  busy = true;
  notice = "";
  var caption = (draft || "").trim();
  var localId = "local-img-" + Date.now();
  shrinkPhoto(file).then(function (dataUrl) {
    epoch++;
    draft = "";
    unconfirmed = { id: localId, role: "visitor", kind: "image", localSrc: dataUrl, text: caption, at: new Date().toISOString() };
    heldPhotos.push(dataUrl);
    var local = localThread();
    local.push(unconfirmed);
    state = Object.assign({}, state || {}, { messages: local });
    pending = true;
    render();
    return api("/image", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(withContext({ image: dataUrl, text: caption })),
    });
  }).then(function () {
    busy = false;
    lastSig = "";
    schedulePoll(FAST_POLL);
  }).catch(function (err) {
    busy = false;
    pending = false;
    if (unconfirmed && unconfirmed.id === localId) {
      heldPhotos.pop();
      unconfirmed = null;
    }
    if (state && state.messages) state.messages = state.messages.filter(function (m) { return m.id !== localId; });
    failSend(err || {});
    if (!fatal) { notice = w("photoFailed"); draft = caption; }
    render();
  });
}

// ── poll ────────────────────────────────────────────────────────────────────

// While a reply is on its way, and for a few seconds after one lands (the AI
// often sends two messages back to back), poll fast so each one shows the
// moment it exists. Otherwise idle slowly.
var FAST_POLL = 700, burstUntil = 0;
function nextPoll() { return pending || Date.now() < burstUntil ? FAST_POLL : 6000; }

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delay);
}

function poll() {
  if (busy) { schedulePoll(1500); return; }
  var pollEpoch = epoch;
  api(qs()).then(function (next) {
    if (pollEpoch !== epoch) { schedulePoll(nextPoll()); return; }
    var grew = state && next.messages.length > (state.messages || []).length;
    var fresh = grew ? next.messages.slice((state.messages || []).length).filter(function (m) { return m.role === "ai"; }).length : 0;
    if (confirming) fresh = 0;
    if (grew) { pending = false; burstUntil = Date.now() + 6000; }
    memo.adopt(state && state.messages, next);
    adoptPhotos(state && state.messages, next);
    state = next;
    var sig = signature(next);
    if (sig !== lastSig) {
      lastSig = sig;
      render();
      // A reply that lands while the panel is closed should be visible from the
      // outside, which only the loader can do.
      if (fresh) parent.postMessage({ type: "la-widget-unread", count: fresh }, "*");
    }
    schedulePoll(nextPoll());
  }).catch(function () {
    schedulePoll(6000);
  });
}

// ── boot ────────────────────────────────────────────────────────────────────

if (!DEMO && !VISITOR) {
  fatal = w("startFailed");
  paint();
} else {
  paint();
  poll();
}
