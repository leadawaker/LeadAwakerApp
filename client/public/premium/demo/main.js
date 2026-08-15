// Entry point for the browser demo page. Owns the DOM, the session state and
// the network, and nothing else: everything that turns data into markup lives
// in the sibling modules, which is what lets them be tested without a browser.
//
// Split out of demo.html (which had grown past 1600 lines). Plain ES modules,
// same-origin, no bundler and no third-party script. The old file wrapped
// everything in an IIFE to stay off the global scope; a module already is.

import { setLang, t } from "./copy.js";
import { icon } from "./icons.js";
import { esc, signature } from "./format.js";
import { trackerHtml, settleTracker, isDnc } from "./tracker.js";
import { messagesHtml } from "./chat.js";
import { railAsideHtml, railInlineHtml } from "./recap.js";
import { confetti } from "./confetti.js";

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

function render() {
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
          messagesHtml(s, pending) +
          (s.done ? railInlineHtml(railOpts) : "") +
        "</div>" +
        '<div class="composer-wrap">' +
          '<div class="composer' + (s.done ? " is-done" : "") + '">' +
            // The editor only exists while the conversation is live —
            // once it's done there's nothing left to type into, so it's
            // dropped entirely rather than left disabled and greyed out.
            (s.done ? "" :
            '<div class="input-shell">' +
              '<label class="sr" for="msg">' + esc(t("replyLabel")) + "</label>" +
              '<textarea id="msg" rows="1" placeholder="' + esc(t("replyPlaceholder")) + '"' +
                (busy ? " disabled" : "") + "></textarea>" +
              '<button class="send" id="send" title="Send"' + (busy ? " disabled" : "") + ">" +
                '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>' +
              "</button>" +
            "</div>") +
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
                          (busy || restartsLeft <= 0 ? " disabled" : "") + ">" + esc(o.label) + "</button>";
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

  var bump = document.getElementById("bump");
  if (bump) bump.addEventListener("click", doBump);

  if (ta) {
    ta.value = draft;
    ta.style.height = "auto";
    ta.style.height = Math.min(120, ta.scrollHeight) + "px";
    // Never steal focus while the popover is open.
    if (!state.done && !busy && !popOpen) ta.focus();
    ta.addEventListener("input", function () {
      draft = ta.value;
      ta.style.height = "auto";
      ta.style.height = Math.min(120, ta.scrollHeight) + "px";
    });
    ta.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); doSend(); }
    });
  }
  if (send) send.addEventListener("click", doSend);
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

// `scenario` is null for the plain replay (public sessions) and one of the
// server-supplied values for the two-option restart on an invited link.
function doRestart(scenario) {
  if (busy || !state) return;
  busy = true;
  pending = false;
  var prevRecap = recap;   // snapshot so a failed restart can put the recap
                            // panel back to what it showed a moment ago,
                            // instead of leaving it stuck on the "wrapping
                            // up" placeholder until the next idle poll.
  recap = null;
  draft = "";
  // Invalidate any poll fetch already in flight: a routine poll started
  // before the restart can otherwise resolve AFTER it and silently revert
  // the UI to the old scenario's messages.
  epoch++;
  render();
  api("/restart", {
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
    var btn = document.getElementById("bump");
    if (btn) {
      btn.classList.add("is-sent");
      setTimeout(function () { btn.classList.remove("is-sent"); }, 1400);
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
