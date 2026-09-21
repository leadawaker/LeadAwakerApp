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

var BOOT = window.__WIDGET__ || {};
var CFG = BOOT.config || {};
var DEMO = BOOT.mode === "demo";
// The agent's photo. The same one on the header and every AI bubble, so the
// visitor is talking to one person, not a row of initials.
var AVATAR = CFG.avatar || "/avatars/receptionist.webp";

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

function headerHtml(agent) {
  // "AI assistant · Company": what she is, and whose. The company is the one the
  // prompt speaks for (the account on a live widget, the persona in a demo).
  var company = CFG.companyName || (state && state.company) || "";
  var role = w("role") + (company ? " · " + company : "");
  return '<header class="wdg-hdr">' +
      '<div class="wdg-id">' +
        '<span class="wdg-ph"><img src="' + esc(AVATAR) + '" alt="" /><i class="wdg-dot"></i></span>' +
        '<span class="wdg-who">' +
          '<span class="wdg-name">' + esc(agent || w("assistant")) + "</span>" +
          '<span class="wdg-role">' + esc(role) + "</span>" +
        "</span>" +
      "</div>" +
      '<div class="wdg-acts">' +
        (canRestart()
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
  return '<div class="wdg-field">' +
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
  root.innerHTML =
    '<div class="wdg">' +
      headerHtml(agent) +
      '<div class="wdg-stream" id="stream">' +
        messagesHtml({ messages: msgs, agent: agent }, pending, memo.playerState(), { avatarSrc: AVATAR }) +
      "</div>" +
      chipsHtml(msgs, done) +
      '<div class="wdg-composer">' + composerHtml(done) + "</div>" +
    "</div>";
  wire();
  scrollToEnd();
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

function wire() {
  var input = root.querySelector(".wdg-input");
  if (input) {
    input.value = draft;
    autoGrow(input);
    input.addEventListener("input", function () { draft = input.value; autoGrow(input); setSendMode(); });
    input.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
    input.focus();
  }
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
    schedulePoll(1200);
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
    schedulePoll(1200);
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

// ── poll ────────────────────────────────────────────────────────────────────

function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delay);
}

function poll() {
  if (busy) { schedulePoll(1500); return; }
  var pollEpoch = epoch;
  api(qs()).then(function (next) {
    if (pollEpoch !== epoch) { schedulePoll(pending ? 1600 : 6000); return; }
    var grew = state && next.messages.length > (state.messages || []).length;
    var fresh = grew ? next.messages.slice((state.messages || []).length).filter(function (m) { return m.role === "ai"; }).length : 0;
    if (confirming) fresh = 0;
    if (grew) pending = false;
    memo.adopt(state && state.messages, next);
    state = next;
    var sig = signature(next);
    if (sig !== lastSig) {
      lastSig = sig;
      render();
      // A reply that lands while the panel is closed should be visible from the
      // outside, which only the loader can do.
      if (fresh) parent.postMessage({ type: "la-widget-unread", count: fresh }, "*");
    }
    schedulePoll(pending ? 1600 : 6000);
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
