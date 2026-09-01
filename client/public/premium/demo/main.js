// Entry point for the browser demo page. Owns the DOM, the session state and
// the network, and nothing else: everything that turns data into markup lives
// in the sibling modules, which is what lets them be tested without a browser.
//
// Split out of demo.html (which had grown past 1600 lines). Plain ES modules,
// same-origin, no bundler and no third-party script. The old file wrapped
// everything in an IIFE to stay off the global scope; a module already is.

import { setLang, t } from "./copy.js";
import { icon } from "./icons.js";
import { esc, signature, mmss } from "./format.js";
import { trackerHtml, settleTracker, isDnc } from "./tracker.js";
import { messagesHtml, PLAY_SVG, PAUSE_SVG } from "./chat.js";
import { railAsideHtml, railInlineHtml } from "./recap.js";
import { confetti } from "./confetti.js";
import * as voice from "./voice.js";
import * as admin from "./admin.js";

"use strict";

// ---- token ------------------------------------------------------------
// The URL is /demo/<token>. Both Vercel and the Pi rewrite that to this
// file with the path preserved, the same trick the landing page uses for
// its /home variant, so the token is read from the path rather than a query
// string. A query fallback exists only so the page can be opened directly
// during development.
var m = location.pathname.match(/\/demo\/([A-Za-z0-9]{4,64})/);
var TOKEN = m ? m[1] : new URLSearchParams(location.search).get("token") || "";

// Same-origin: Vercel rewrites /api/* to api.leadawaker.com, and the Pi
// serves both. The page never needs to know which host it is on.
var API = "/api/web-demo/" + encodeURIComponent(TOKEN);

var root = document.getElementById("root");
var state = null;
var recap = null;
var pending = false;     // a visitor message is queued, awaiting a reply
var busy = false;        // a fetch is in flight (send/restart)
var pollTimer = null;
var lastSig = "";
var draft = "";
var fatal = null;
// Whether the restart popover is open. Kept out here rather than in the DOM
// so a poll re-render (which rebuilds the whole tree) doesn't slam it shut
// under the visitor mid-decision.
var popOpen = false;
// Bumped by any action that replaces `state` outside of poll() itself
// (send, restart). poll() captures this before it fetches and checks it
// again when the response lands; a mismatch means a restart/send already
// moved state on while this fetch was in flight, so the response is
// discarded instead of clobbering fresher state.
var epoch = 0;
// Whether the rail was on screen at the end of the last render, so its entrance
// animation runs when it first appears and not on every poll after that. Same
// problem, and the same fix, as the message bubbles' `is-new`.
var paintedRail = false;

// ---- voice memo state -------------------------------------------------
// The composer is showing the recording bar, and a tap is waiting on the
// permission prompt. While `recording` is true render() refuses to repaint
// (see there), because a poll landing mid-sentence would otherwise rebuild the
// bar, the timer and the running recorder's own buttons under the visitor's
// thumb. Nothing is lost by skipping that repaint: every path that ends
// recording (onRecDone, onRecFail) calls paint()/render() itself once
// `recording` is back to false, at which point it reads current `state`.
var recording = false;
var starting = false;
// Audio by message id. Entries start as blob: URLs from the visitor's own
// recording and are re-keyed onto the server's interaction id when the poll
// brings it back (adoptVoice), so playing back a memo recorded in this tab
// never touches the network. A memo from an earlier session gets a data: URL
// fetched from /audio on first play.
var voiceUrls = {};
// Lengths in seconds, by the same ids: known immediately for a recording made
// here, and learned from the audio element's metadata otherwise.
var voiceDur = {};
// Recordings sent but not yet seen coming back, oldest first.
var awaitingIds = [];
var localSeq = 0;
// Ids fetched from /audio (not recorded in this tab), oldest first, so the
// oldest can be evicted once there are too many held at once — see
// rememberFetchedAudio(). A recording made in this tab is not tracked here;
// its blob: URL is cheap and cleared on restart regardless (clearVoice).
var fetchedIds = [];
var FETCHED_AUDIO_CAP = 8;

// Each entry is a base64 data: URL, up to ~80KB apiece. Uncapped, replaying
// many old memos back-to-back in one long session (a live demo, presenting
// several) would hold megabytes of base64 in memory for the life of the tab.
function rememberFetchedAudio(id) {
  fetchedIds.push(id);
  if (fetchedIds.length <= FETCHED_AUDIO_CAP) return;
  var evictId = fetchedIds.shift();
  delete voiceUrls[evictId];
}

var SEND_SVG = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>';

function api(path, opts) {
  return fetch(API + (path || ""), opts).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (body) {
      if (!r.ok) {
        var e = new Error(body.message || "Request failed");
        e.code = body.code; e.status = r.status;
        throw e;
      }
      return body;
    });
  });
}

// The glyph for one restart scenario. The two option labels differ by a single
// word ("never got a quote" / "already has a quote"), so the icon is what tells
// them apart at a glance. Keyed on the value the engine sends
// (src/automations/demo_restart.py RESTART_OPTIONS); "deciding" is the alias
// the presenter panel's select uses for the same quoted scenario. An unknown
// value renders no icon rather than a wrong one.
var SCENARIO_ICONS = {
  inquired: "message-circle-question",
  quoted: "receipt",
  deciding: "receipt"
};

function scenarioIcon(value) {
  var name = SCENARIO_ICONS[value];
  return name ? icon(name, 15) : "";
}

// Everything routes through here, and it is a guard rather than the paint
// itself: a poll that lands mid-recording must NOT rebuild the composer, since
// that would replace the bar, the timer and the running recorder's own buttons
// between one second and the next. The thread behind the bar can wait; the flag
// is what stops the update being forgotten instead of merely deferred. Same
// shape as setPop() below, which keeps the popover open across a poll for the
// same reason.
function render() {
  if (recording) return;
  paint();
}

function paint() {
  // Before anything reads a string: t() resolves against this, and the fatal
  // branch below runs when there is no state at all, where it must fall back to
  // the browser's language rather than to English.
  setLang(state && state.language);

  if (fatal) {
    // `fatal` is a copy KEY, not a rendered string: these fire when there is
    // no state to read a demo language from, so they are resolved at paint
    // time against the browser's language instead (see browserLang).
    root.innerHTML =
      '<div class="center-msg"><h1>' + esc(t(fatal + "Title")) + "</h1><p>" +
      esc(t(fatal + "Body")) + "</p></div>";
    return;
  }
  if (!state) {
    root.innerHTML = '<div class="center-msg"><p>' + esc(t("loading")) + "</p></div>";
    return;
  }

  var s = state;
  // Server-provided: it carries the demo's real WhatsApp number, which only
  // the CRM knows. Absent it, the handoff line is hidden rather than
  // rendered as a wa.me link with no recipient.
  var waUrl = s.waLink || "";
  var restartsLeft = Math.max(0, (s.restartsMax || 0) - (s.restartsUsed || 0));
  // Only invited links (a prospect Gabriel sent this to) get to restart as
  // the OTHER scenario. Null on a public homepage session and on a link
  // that has spent its restarts; the server decides, not the page.
  var opts = restartsLeft > 0 && s.restartOptions && s.restartOptions.length
    ? s.restartOptions
    : null;

  // The rail carries the quote for the whole conversation and gains the recap
  // above it at the end, so it is no longer tied to s.done. It renders to ""
  // when there is nothing to show (a scoping demo mid-conversation), which is
  // what keeps the column from appearing empty.
  var railOpts = { done: s.done, recap: recap, quote: s.quote };
  var aside = railAsideHtml(railOpts, !paintedRail);
  paintedRail = aside !== "";

  root.innerHTML =
    '<header class="hdr">' +
      // Presenter-only, and absent (not hidden) for everyone else: s.admin is
      // set server-side from the CRM session, so a prospect never receives this
      // markup. ⋯ rather than ☰ because a hamburger promises navigation and
      // there is none on this page. Anchored to .hdr rather than placed inside
      // .hdr-inner, for the reason the .bump-btn comment gives: joining the
      // centred cluster would off-centre it.
      (s.admin
        ? '<button class="admin-toggle" id="admin-toggle" title="Presenter settings" ' +
            'aria-label="Presenter settings" aria-haspopup="dialog" aria-expanded="false">' +
            icon("more-horizontal", 16) +
          "</button>"
        : "") +
      '<div class="hdr-inner">' +
        '<div class="hdr-logo"><img src="/premium/logo-v2.svg" alt="Lead Awaker" /></div>' +
        '<div class="hdr-div"></div>' +
        trackerHtml(s.stage, isDnc(s)) +
        (s.company
          ? '<div class="hdr-div"></div><div class="pill">' + icon("sparkles", 14) + "<span>" + esc(s.company) + "</span></div>"
          : "") +
      "</div>" +
      // Presenter-only, and only on an invited link: a public homepage
      // visitor never gets the markup at all, let alone the button.
      (s.invited
        ? '<button class="bump-btn" id="bump" title="' + esc(t("bumpTitle")) + '" ' +
            'aria-label="' + esc(t("bumpTitle")) + '"' + (busy || s.done ? " disabled" : "") + ">" +
            icon("send-horizontal", 15) +
          "</button>"
        : "") +
    "</header>" +
    '<div class="wrap">' +
      '<div class="chat-col">' +
        '<div class="stream" id="stream">' +
          (s.done && s.cappedReason === "turns"
            ? '<div class="banner">' + esc(t("capped")) + "</div>"
            : "") +
          // Mobile only (CSS hides one of the two). The live quote sits ABOVE
          // the thread, because it is the context the conversation is about;
          // the finished recap sits below it, because it is the conclusion.
          (s.done ? "" : railInlineHtml(railOpts, true)) +
          messagesHtml(s, pending, {
            playingId: voice.playingMessage(),
            elapsed: voice.playedSeconds(),
            durations: voiceDur,
            urls: voiceUrls
          }) +
          (s.done ? railInlineHtml(railOpts) : "") +
        "</div>" +
        '<div class="composer-wrap">' +
          '<div class="composer' + (s.done ? " is-done" : "") + '">' +
            // The editor only exists while the conversation is live —
            // once it's done there's nothing left to type into, so it's
            // dropped entirely rather than left disabled and greyed out.
            // While a memo is being recorded the editor is replaced by the
            // recording bar rather than sitting beside it: the timer, the
            // discard and the send ARE the composer for those few seconds.
            (s.done ? "" : (recording ? recBarHtml() : inputShellHtml())) +
            // Restart sits BESIDE the editor as one button; the choices,
            // the WhatsApp handoff and the remaining-restarts count all
            // live in the popover it opens, so none of that competes with
            // the composer until it is asked for.
            //
            // Invited links get the two scenarios; a public homepage
            // session gets the plain Restart it always had. Labels and
            // heading come from the server, already in the lead's language
            // (src/automations/demo_restart.py).
            '<div class="restart-anchor">' +
              '<button class="restart-btn" id="restart-toggle" aria-haspopup="dialog" aria-expanded="' +
                (popOpen ? "true" : "false") + '" aria-controls="restart-pop"' + (busy ? " disabled" : "") + ">" +
                icon("rotate-ccw", 15) + "<span>" + esc(t("restart")) + "</span>" +
              "</button>" +
              '<div class="restart-pop" id="restart-pop" role="dialog" aria-label="' + esc(t("restartAria")) + '"' +
                (popOpen ? "" : " hidden") + ">" +
                (opts ? '<p class="pop-head">' + esc(opts[0].heading) + "</p>" : "") +
                '<div class="pop-opts">' +
                  (opts
                    ? opts.map(function (o) {
                        return '<button class="ghost restart-opt" data-scenario="' + esc(o.value) + '"' +
                          (busy || restartsLeft <= 0 ? " disabled" : "") + ">" +
                          scenarioIcon(o.value) + "<span>" + esc(o.label) + "</span></button>";
                      }).join("")
                    : '<button class="ghost" id="restart"' + (busy || restartsLeft <= 0 ? " disabled" : "") + ">" +
                      esc(t("restart")) + "</button>") +
                "</div>" +
                '<div class="pop-rule"></div>' +
                '<p class="pop-foot" id="pop-foot">' +
                  (waUrl
                    ? esc(t("onPhone")) + ' <a href="' + esc(waUrl) + '" target="_blank" rel="noopener">' +
                      esc(t("runInWa")) + "</a>."
                    : "") +
                  " " +
                  (restartsLeft > 0
                    ? esc(restartsLeft === 1
                        ? t("restartsLeftOne")
                        : t("restartsLeftMany").replace("{n}", restartsLeft))
                    : esc(t("noRestarts"))) +
                "</p>" +
              "</div>" +
            "</div>" +
          "</div>" +
        "</div>" +
      "</div>" +
      aside +
    "</div>";

  wire();
  // After the tree is in the document, so the connectors have a previous
  // width to animate away from.
  settleTracker(root);
}

// ---- composer ---------------------------------------------------------
// One round button, two jobs. An empty input has nothing to send, so it offers
// the mic; the moment anything is typed the same button in the same place
// becomes the send arrow. That is WhatsApp's arrangement, which every visitor
// already reads without being told, and it keeps the composer to input + one
// control. The mic is deliberately NOT advertised in the placeholder: a
// microphone in the send position is the affordance.
function micMode() {
  return voice.micAvailable() && !draft.trim();
}

function inputShellHtml() {
  var mic = micMode();
  var label = mic ? t("voiceRecord") : t("sendLabel");
  return '<div class="input-shell">' +
      '<label class="sr" for="msg">' + esc(t("replyLabel")) + "</label>" +
      '<textarea id="msg" rows="1" placeholder="' + esc(t("replyPlaceholder")) + '"' +
        (busy ? " disabled" : "") + "></textarea>" +
      '<button class="send" id="send" data-mode="' + (mic ? "mic" : "send") + '" ' +
        'title="' + esc(label) + '" aria-label="' + esc(label) + '"' +
        (busy ? " disabled" : "") + ">" +
        (mic ? icon("mic", 15) : SEND_SVG) +
      "</button>" +
    "</div>";
}

// Swapped in place on every keystroke rather than through render(), which
// would rebuild the textarea and drop the caret to the end of what is being
// typed. Cheap enough to run per keystroke because it returns immediately when
// the button is already in the right mode.
function setSendMode() {
  var btn = document.getElementById("send");
  if (!btn) return;
  var mic = micMode();
  var mode = mic ? "mic" : "send";
  if (btn.getAttribute("data-mode") === mode) return;
  var label = mic ? t("voiceRecord") : t("sendLabel");
  btn.setAttribute("data-mode", mode);
  btn.setAttribute("title", label);
  btn.setAttribute("aria-label", label);
  btn.innerHTML = mic ? icon("mic", 15) : SEND_SVG;
}

// Discard on the left, then the live indicators, then send: the two things
// that end the recording sit at the two ends, and neither can be hit by
// accident while reaching for the other.
function recBarHtml() {
  return '<div class="rec-bar" role="group" aria-label="' + esc(t("voiceRecording")) + '">' +
      '<button type="button" class="rec-trash" id="rec-cancel" title="' + esc(t("voiceDiscard")) +
        '" aria-label="' + esc(t("voiceDiscard")) + '">' + icon("trash", 15) + "</button>" +
      '<span class="rec-dot" aria-hidden="true"></span>' +
      '<span class="rec-time" id="rec-time">0:00</span>' +
      '<span class="rec-meter" aria-hidden="true">' + meterBars() + "</span>" +
      '<button type="button" class="send" id="rec-send" title="' + esc(t("voiceSendMemo")) +
        '" aria-label="' + esc(t("voiceSendMemo")) + '">' + SEND_SVG + "</button>" +
    "</div>";
}

// A CSS-animated meter, not a real one. Reading actual levels means an
// AudioContext and an AnalyserNode running beside the recorder for the sake of
// a decoration; what the bar has to say is "this is live and it is listening",
// and staggered bar timings say it. Fixed offsets so the motion reads as speech
// rather than as a uniform equaliser.
function meterBars() {
  var out = "";
  for (var i = 0; i < 26; i++) {
    out += '<i style="animation-delay:' + ((i * 47) % 900) / 1000 + "s;" +
      "animation-duration:" + (0.7 + (i % 5) * 0.09).toFixed(2) + 's"></i>';
  }
  return out;
}

// ---- interaction ------------------------------------------------------
// Toggles the popover in place instead of re-rendering: a render would
// rebuild the textarea and throw focus back into it, yanking the visitor
// out of the menu they just opened.
function setPop(open) {
  popOpen = open;
  var pop = document.getElementById("restart-pop");
  var btn = document.getElementById("restart-toggle");
  if (pop) { if (open) pop.removeAttribute("hidden"); else pop.setAttribute("hidden", ""); }
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
}

// Bound once, at module scope: wire() runs on every render and would stack
// a fresh copy of these on the document each time.
document.addEventListener("click", function (e) {
  if (!popOpen) return;
  if (e.target && e.target.closest && e.target.closest(".restart-anchor")) return;
  setPop(false);
});
document.addEventListener("keydown", function (e) {
  if (e.key !== "Escape" || !popOpen) return;
  setPop(false);
  var btn = document.getElementById("restart-toggle");
  if (btn) btn.focus();
});

function wire() {
  var ta = document.getElementById("msg");
  var send = document.getElementById("send");
  var restart = document.getElementById("restart");
  var toggle = document.getElementById("restart-toggle");
  var stream = document.getElementById("stream");

  if (stream) stream.scrollTop = stream.scrollHeight;

  if (toggle) toggle.addEventListener("click", function () { setPop(!popOpen); });

  // The panel itself lives outside `root` and survives renders; only its
  // trigger is repainted, so only the trigger is re-bound here.
  admin.bindTrigger();

  var bump = document.getElementById("bump");
  if (bump) bump.addEventListener("click", doBump);

  if (ta) {
    ta.value = draft;
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
    // Never steal focus while the popover or the presenter panel is open:
    // a render landing while Gabriel is typing into a panel field would yank
    // the caret into the composer mid-word.
    if (!state.done && !busy && !popOpen && !admin.isOpen()) ta.focus();
    ta.addEventListener("input", function () {
      draft = ta.value;
      ta.style.height = "auto";
      ta.style.height = Math.min(120, ta.scrollHeight) + "px";
      setSendMode();
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }
  if (send) send.addEventListener("click", function () {
    if (send.getAttribute("data-mode") === "mic") beginRecording();
    else doSend();
  });

  var recSend = document.getElementById("rec-send");
  if (recSend) recSend.addEventListener("click", function () { voice.stopRecording(); });
  var recCancel = document.getElementById("rec-cancel");
  if (recCancel) recCancel.addEventListener("click", function () { voice.cancelRecording(); });

  if (restart) restart.addEventListener("click", function () { doRestart(null); });
  Array.prototype.forEach.call(document.querySelectorAll(".restart-opt"), function (b) {
    b.addEventListener("click", function () { doRestart(b.getAttribute("data-scenario")); });
  });
}

function doSend() {
  if (busy || pending || !state || state.done) return;
  var text = draft.trim();
  if (!text) return;

  // Invalidate any poll fetch already in flight: without this, a response
  // that predates the send can land after the optimistic push below and
  // overwrite state.messages with server data that doesn't include it yet,
  // making the visitor's own message flicker or vanish.
  epoch++;

  // Optimistic: the visitor's own bubble appears instantly, then the typing
  // indicator. Waiting for the round trip to echo their own words back is
  // the single thing that makes a web chat feel broken.
  state.messages.push({ role: "visitor", text: text, at: new Date().toISOString() });
  draft = "";
  pending = true;
  busy = true;
  render();

  api("/message", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text: text })
  }).then(function () {
    busy = false;
    lastSig = "";      // force the next poll to re-render
    schedulePoll(1200);
  }).catch(function (err) {
    busy = false;
    pending = false;
    handleError(err);
  });
}

// ---- voice memos ------------------------------------------------------
// Tap to start, tap to send. Not hold-to-talk: holding is a phone idiom that
// is awkward with a mouse, and a first-time visitor never discovers it. The
// recording bar is only painted once the recorder is genuinely running, so a
// declined permission prompt never leaves a dead timer on screen.
function beginRecording() {
  if (busy || pending || starting || recording || !state || state.done) return;
  starting = true;
  voice.startRecording({ tick: onRecTick, done: onRecDone, fail: onRecFail });
}

function onRecTick(seconds) {
  if (!recording) {
    starting = false;
    recording = true;
    paint();          // the one repaint that swaps the editor for the bar
    return;
  }
  // Direct DOM write from here on. render() is suppressed while recording, and
  // this is the only thing on screen that has to change once a second.
  var el = document.getElementById("rec-time");
  if (!el) return;
  el.textContent = mmss(seconds);
  // Amber five seconds out, so the hard stop at 30 is never a surprise.
  el.classList.toggle("is-amber", seconds >= voice.AMBER_SECONDS);
}

function onRecDone(blob, mime, ms) {
  starting = false;
  recording = false;
  doSendVoice(blob, ms);
}

// A discarded recording, a mis-tap too short to be a message, or a mic that was
// refused. All three end the same way: put the editor back. A refusal also
// takes the mic button with it, since voice.micAvailable() has gone false.
function onRecFail() {
  starting = false;
  recording = false;
  paint();
}

function doSendVoice(blob, ms) {
  // `recording` is already false here (onRecDone clears it before calling
  // this), so render() actually paints instead of being suppressed. Without
  // it, a session that ended (turn cap / DNC) while this recording was in
  // flight left the composer stuck on a dead recording bar forever: nothing
  // else was left to trigger the catch-up repaint.
  if (!state || state.done) { render(); return; }
  // Same reason doSend bumps it: a poll fetched before this send would come
  // back without the memo and erase the bubble the visitor is looking at.
  epoch++;

  var url = URL.createObjectURL(blob);
  var localId = "local-" + (++localSeq);
  var seconds = Math.max(1, Math.round(ms / 1000));
  voiceUrls[localId] = url;
  voiceDur[localId] = seconds;
  // The server's id for this memo does not exist yet, so the blob waits in a
  // queue for the poll that brings the real message back (adoptVoice).
  awaitingIds.push({ url: url, localId: localId, seconds: seconds });

  // Optimistic, and this one matters more than the typed case: the whole claim
  // of the page is that this is instant, so the player has to be on screen and
  // playable from the local recording the moment the visitor stops speaking.
  // Only the transcript is actually waiting on anything, and it says so with a
  // shimmer where it will land.
  state.messages.push({
    role: "visitor", kind: "voice", id: localId, text: "",
    awaitingTranscript: true, at: new Date().toISOString()
  });
  pending = true;
  busy = true;
  render();

  voice.blobToBase64(blob).then(function (dataUrl) {
    return api("/voice", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ audio: dataUrl, durationMs: ms })
    });
  }).then(function () {
    busy = false;
    lastSig = "";      // force the next poll to re-render
    schedulePoll(1200);
  }).catch(function (err) {
    busy = false;
    pending = false;
    // Nothing reached the server, so nothing about this recording should
    // still be held: left in place, the optimistic bubble/blob would leak
    // for the life of the tab, and the awaitingIds slot could misdirect a
    // later adoptVoice match if the page ever recovered from the fatal
    // screen handleError is about to show.
    var msgs = state && state.messages;
    if (msgs) {
      for (var mi = msgs.length - 1; mi >= 0; mi--) {
        if (msgs[mi].id === localId) { msgs.splice(mi, 1); break; }
      }
    }
    URL.revokeObjectURL(url);
    delete voiceUrls[localId];
    delete voiceDur[localId];
    for (var ai = awaitingIds.length - 1; ai >= 0; ai--) {
      if (awaitingIds[ai].localId === localId) awaitingIds.splice(ai, 1);
    }
    handleError(err);
  });
}

// The server's copy of a memo recorded in this tab arrives with a real
// interaction id; the local blob follows it across rather than being fetched
// back down. In the common case (they just spoke, they press play) there is no
// network request at all.
function adoptVoice(next) {
  if (!awaitingIds.length || !next || !next.messages) return;
  // Only messages this tab has not already accounted for are eligible.
  // voiceUrls/awaitingIds reset to empty on every page load, but the thread
  // itself persists server-side, so "not already in voiceUrls" alone
  // matches the FIRST unclaimed voice message in the whole history, not the
  // one just recorded — wiring a brand-new recording's blob onto an old
  // bubble the moment a second memo is sent after a reload.
  var known = {};
  if (state && state.messages) {
    for (var k = 0; k < state.messages.length; k++) known[state.messages[k].id] = true;
  }
  for (var i = 0; i < next.messages.length && awaitingIds.length; i++) {
    var m = next.messages[i];
    if (m.kind !== "voice" || m.role !== "visitor" || known[m.id] || voiceUrls[m.id]) continue;
    var held = awaitingIds.shift();
    voiceUrls[m.id] = held.url;
    voiceDur[m.id] = held.seconds;
    delete voiceUrls[held.localId];
    delete voiceDur[held.localId];
    // If they hit play in the second before the poll landed, the audio keeps
    // running and its bubble has to keep saying so.
    voice.rename(held.localId, m.id);
  }
}

// A restart is a different conversation: the old thread's audio is unreachable
// from it, so the blobs are handed back to the browser rather than left held
// for a page that will never render them again.
function clearVoice() {
  voice.reset();
  Object.keys(voiceUrls).forEach(function (id) {
    if (String(voiceUrls[id]).indexOf("blob:") === 0) URL.revokeObjectURL(voiceUrls[id]);
  });
  voiceUrls = {};
  voiceDur = {};
  awaitingIds = [];
  fetchedIds = [];
}

// One <audio> for the page, so the play buttons are just paint. Delegated at
// module scope because render() replaces every one of them on every poll.
document.addEventListener("click", function (e) {
  var btn = e.target && e.target.closest && e.target.closest(".vplay");
  if (!btn) return;
  e.preventDefault();
  togglePlay(btn.getAttribute("data-mid"));
});

function togglePlay(id) {
  var current = voice.playingMessage();
  if (current != null && String(current) === String(id)) { voice.pause(); return; }

  if (voiceUrls[id]) { voice.play(id, voiceUrls[id]); return; }
  // Not recorded in this tab: a reload, or a link reopened tomorrow. The audio
  // is deliberately absent from the state payload (it is re-fetched every few
  // seconds), so it is asked for once, here, and then cached like a local one.
  api("/audio?id=" + encodeURIComponent(id)).then(function (data) {
    if (!data || !data.dataUrl) return;
    voiceUrls[id] = data.dataUrl;
    rememberFetchedAudio(id);
    voice.play(id, data.dataUrl);
  }).catch(function () {
    // A memo that will not play back is not worth taking the page down for;
    // the transcript underneath it still says what was said.
  });
}

// Fires on every timeupdate (about four a second), so it writes onto the
// existing bubbles rather than re-rendering: a full render four times a second
// would fight the composer for the caret and restart every bubble's animation.
voice.onPlayback(function () {
  var id = voice.playingMessage();
  if (id != null && !voiceDur[id]) {
    var d = voice.loadedDuration();
    if (d) voiceDur[id] = d;
  }
  paintPlayback();
});

// The id paintPlayback last painted as "on", so a change in which bubble is
// playing patches only the two bubbles actually affected (the one that just
// stopped, the one that just started) instead of re-querying and
// re-toggling every voice bubble in the thread on every tick — a long demo
// thread (several memos) otherwise pays that cost four times a second for
// bubbles nobody is looking at.
var paintedPlayId = null;

function patchPlayer(mid, on, elapsed) {
  var btn = document.querySelector('.vplay[data-mid="' + mid + '"]');
  if (!btn) return;
  var p = btn.closest(".vplayer");
  var label = t(on ? "voicePause" : "voicePlay");
  if (btn.getAttribute("aria-label") !== label) {
    btn.innerHTML = on ? PAUSE_SVG : PLAY_SVG;
    btn.setAttribute("aria-label", label);
  }
  var total = voiceDur[mid] || 0;
  var at = on ? elapsed : 0;
  var time = p && p.querySelector(".vtime");
  if (time) time.textContent = mmss(at > 0 ? at : total);
  var bars = p ? p.querySelectorAll(".vwave i") : [];
  var played = total > 0 ? Math.round((at / total) * bars.length) : 0;
  for (var i = 0; i < bars.length; i++) {
    bars[i].classList.toggle("played", on && i < played);
  }
}

function paintPlayback() {
  var pid = voice.playingMessage();
  var elapsed = voice.playedSeconds();
  if (paintedPlayId != null && String(paintedPlayId) !== String(pid)) {
    patchPlayer(paintedPlayId, false, 0);
  }
  if (pid != null) patchPlayer(pid, true, elapsed);
  paintedPlayId = pid;
}

// `scenario` is null for the plain replay (public sessions) and one of the
// server-supplied values for the two-option restart on an invited link.
// Returns the request promise so a caller can tell when the new conversation
// is actually on screen: the presenter panel reports "Restarting…" and would
// otherwise sit on that word forever. Callers that do not care ignore it, as
// the restart popover's own buttons do.
function doRestart(scenario) {
  if (busy || !state) return Promise.resolve();
  // A recording (or a still-pending mic-permission prompt) belongs to the
  // conversation being replaced. Left running, it either freezes the
  // composer on a dead bar (render() stays suppressed by `recording`) or —
  // if permission resolves after the restart completes — pops an uninvited
  // recording bar into the fresh conversation. voice.cancelRecording() is
  // safe to call in either phase.
  if (recording || starting) {
    voice.cancelRecording();
    recording = false;
    starting = false;
  }
  busy = true;
  pending = false;
  var prevRecap = recap;   // snapshot so a failed restart can put the recap
                            // panel back to what it showed a moment ago,
                            // instead of leaving it stuck on the "wrapping
                            // up" placeholder until the next idle poll.
  recap = null;
  draft = "";
  clearVoice();
  // Invalidate any poll fetch already in flight: a routine poll started
  // before the restart can otherwise resolve AFTER it and silently revert
  // the UI to the old scenario's messages.
  epoch++;
  render();
  return api("/restart", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(scenario ? { scenario: scenario } : {})
  }).then(function (next) {
    busy = false;
    state = next;
    lastSig = signature(next);
    popOpen = false;          // the choice was made; the menu has no reason to stay up
    render();
    // A restart is a fresh conversation, so it re-arms the celebration:
    // booking again in the new run should be celebrated again.
    celebrated = false;
    seenStage = next.stage || null;
    schedulePoll(4000);
  }).catch(function (err) {
    busy = false;
    recap = prevRecap;   // restore what was on screen before the optimistic clear
    handleError(err);
  });
}

// Presenter control: ask the engine for a real follow-up now. The reply is
// the full state, so the bump lands in the thread without waiting for the
// next poll. Failures stay quiet on purpose: this fires in front of a
// prospect, and a red error where a follow-up was promised is worse than
// nothing happening at all; the log still records it.
function doBump() {
  if (busy || !state || state.done) return;
  busy = true;
  // Same reason doSend and doRestart bump the epoch: a poll already in
  // flight predates the follow-up and would overwrite state with a thread
  // that doesn't contain it yet, erasing the bubble the presenter just
  // demonstrated until the next poll put it back.
  epoch++;
  render();
  api("/bump", { method: "POST" }).then(function (next) {
    busy = false;
    state = next;
    lastSig = signature(next);
    render();
    // render() is a no-op while recording suppresses repaints, so the new
    // message never actually appeared — flashing "sent" anyway told a
    // presenter's audience the bump worked when nothing visibly happened.
    if (!recording) {
      var btn = document.getElementById("bump");
      if (btn) {
        btn.classList.add("is-sent");
        setTimeout(function () { btn.classList.remove("is-sent"); }, 1400);
      }
    }
    schedulePoll(4000);
  }).catch(function (err) {
    busy = false;
    render();
    if (window.console && console.warn) console.warn("bump failed", err && err.code);
  });
}

function handleError(err) {
  if (err && err.status === 404) {
    fatal = "errExpired";
  } else if (err && err.code === "restart_limit") {
    // Not fatal: the conversation on screen is still readable. Render first
    // so the recap panel (restored by doRestart's catch) reflects the old
    // conversation again rather than staying on the placeholder, then patch
    // the popover's foot text to explain why the restart didn't go through.
    // popOpen is left as it was, so the message lands in the menu the
    // visitor still has open.
    render();
    var el = document.getElementById("pop-foot");
    if (el) el.textContent = t("restartLimit");
    return;
  } else {
    fatal = "errGeneric";
  }
  render();
}

// ---- polling ----------------------------------------------------------
// The engine debounces before it calls the model, so a reply can be several
// seconds out. Polling keeps each request short and lets a multi-message
// reply arrive balloon by balloon, the way it does on WhatsApp.
function schedulePoll(delay) {
  clearTimeout(pollTimer);
  pollTimer = setTimeout(poll, delay);
}

function poll() {
  if (busy) { schedulePoll(1500); return; }
  var pollEpoch = epoch;   // captured before the fetch fires
  api("").then(function (next) {
    if (pollEpoch !== epoch) {
      // A restart or send landed while this fetch was in flight and moved
      // state on already; applying this response now would clobber that
      // fresher state with stale data. The action that bumped the epoch
      // already scheduled its own follow-up poll, but reschedule anyway
      // (rather than trusting this response's own `done`/messages, which
      // may no longer be accurate) so the loop can't stall if that action
      // is still pending or failed outright.
      schedulePoll(pending ? 1600 : 6000);
      return;
    }
    // Before state is swapped, so a memo recorded here keeps its local blob
    // instead of the new bubble having to fetch its own audio back down.
    adoptVoice(next);
    var sig = signature(next);
    var grew = state && next.messages.length > state.messages.length;
    state = next;
    if (grew) pending = false;
    if (sig !== lastSig) { lastSig = sig; render(); }
    maybeCelebrate(next);

    if (next.done) {
      if (!recap) loadRecap();
      schedulePoll(15000);       // idle: keep the session warm, nothing more
    } else {
      schedulePoll(pending ? 1600 : 6000);
    }
  }).catch(function (err) {
    if (pollEpoch !== epoch) { schedulePoll(pending ? 1600 : 6000); return; }
    if (err && err.status === 404) return handleError(err);
    schedulePoll(6000);          // transient: keep trying quietly
  });
}

function loadRecap() {
  if (recap) return;
  api("/recap").then(function (data) {
    recap = data || { summary: "", brief: [] };
    render();
  }).catch(function () {
    recap = { summary: "", brief: [] };
    render();
  });
}

// ---- booking celebration ----------------------------------------------
// Fires once, on the transition INTO the booked stage ("objective"), which
// is the moment the demo pays off. Deliberately not on first paint: someone
// reopening a demo they booked yesterday should not be thrown a party for
// it, so the first state we see only records the stage.
var seenStage = null;
var celebrated = false;

function maybeCelebrate(next) {
  var stage = next && next.stage;
  if (seenStage && seenStage !== "objective" && stage === "objective" && !celebrated) {
    celebrated = true;
    confetti();
  }
  if (stage) seenStage = stage;
}

// ---- keyboard-safe header (mobile) -------------------------------------
// iOS Safari's own "scroll the focused input into view" behaviour moves
// the whole page (via the visual viewport, not any CSS overflow rule) when
// the on-screen keyboard opens on the bottom-docked composer, dragging the
// sticky header off the top of the screen with it. The composer is already
// positioned correctly by the flex layout once the keyboard is up, so that
// scroll is never needed here — this just undoes it as soon as it happens.
if (window.visualViewport) {
  window.visualViewport.addEventListener("resize", function () {
    if (window.scrollY || document.documentElement.scrollTop) {
      window.scrollTo(0, 0);
    }
  });
}

// ---- boot -------------------------------------------------------------
// The presenter panel talks to Express's own routes, not the engine proxy, so
// it gets the raw token rather than main.js's API base. `reload` exists because
// a live edit (a rename) changes nothing the poll's own signature watches on
// its next tick; forcing a poll is what makes the header pill repaint at once.
admin.init({
  token: TOKEN,
  getState: function () { return state; },
  reload: function () { schedulePoll(150); },
  // The scenario argument is the panel's quote/no-quote switch, and it is the
  // same value the restart popover's two buttons send.
  restart: function (scenario) { return doRestart(scenario); },
});

if (!TOKEN) {
  fatal = "errNoLink";
  render();
} else {
  render();
  api("").then(function (s) {
    state = s;
    lastSig = signature(s);
    render();
    maybeCelebrate(s);        // records the opening stage; cannot fire yet
    if (s.done) loadRecap();
    schedulePoll(s.done ? 15000 : 6000);
  }).catch(handleError);
}
