// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

import { esc, linkify, clock, initials, mmss } from "./format.js";
import { t } from "./copy.js";
import { icon } from "./icons.js";

// ---- voice memos ------------------------------------------------------
// A visitor recording renders as a player with the transcript underneath,
// matching the CRM's own treatment of a WhatsApp voice note
// (features/conversations/.../ChatBubble.tsx). The player is on top because it
// is the message; the transcript is dimmed and italic underneath because it is
// what the AI HEARD, and reading that back is what turns a noisy-room
// mistranscription into "I mumbled" rather than "this thing is broken".

var BAR_COUNT = 34;

// Bars seeded from the message id, so they are painted instantly and are
// stable across the re-render every poll causes. Decoding the real waveform
// through an AudioContext is what the CRM does, and it is not worth it here:
// nobody studies the shape of their own eight-second memo, and the decode
// would land after the bubble is already on screen.
function waveBars(id, playedCount) {
  var s = String(id), seed = 0;
  for (var i = 0; i < s.length; i++) seed += s.charCodeAt(i);
  var out = "";
  for (var b = 0; b < BAR_COUNT; b++) {
    var h = Math.abs(Math.sin((seed + b * 137.5) * 0.1));
    out += '<i class="' + (b < playedCount ? "played" : "") +
      '" style="height:' + Math.round(3 + h * 14) + 'px"></i>';
  }
  return out;
}

// Exported because main.js writes them straight onto a button four times a
// second while a memo plays, rather than re-rendering the page for it. One
// definition, so the painted state and the rendered state cannot disagree.
export var PLAY_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><polygon points="6 3 20 12 6 21 6 3"></polygon></svg>';
export var PAUSE_SVG = '<svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';

// `voice` carries the singleton player's state: which message is playing, how
// far in, and what each memo's length is. It lives in main.js because there is
// exactly one <audio> element for the whole page (a per-bubble one would be
// destroyed mid-sentence by the next poll's re-render), and it is passed in
// here so this module still renders from its arguments alone.
function voiceBubbleHtml(msg, voice) {
  var id = msg.id;

  // The audio can be genuinely missing: the engine stores it alongside the
  // transcript, so a clip Whisper could not read has neither. Reached only
  // after a reload, since a recording made in this tab is still held locally
  // (voice.urls) whatever the server made of it. A mic glyph rather than a
  // play button that does nothing, which is the same fallback the CRM shows
  // for a voice note with no attachment.
  if (msg.hasAudio === false && !(voice.urls && voice.urls[id])) {
    return '<div class="vgone">' + icon("mic", 13) + "<span>" + esc(t("voiceNote")) + "</span></div>" +
      '<div class="vtranscript' + (msg.text ? "" : " is-none") + '">' +
        esc(msg.text || t("voiceNoTranscript")) + "</div>";
  }

  var playing = voice.playingId != null && String(voice.playingId) === String(id);
  var total = voice.durations && voice.durations[id] ? voice.durations[id] : 0;
  var elapsed = playing ? (voice.elapsed || 0) : 0;
  var played = total > 0 ? Math.round((elapsed / total) * BAR_COUNT) : 0;

  return '<div class="vplayer">' +
      '<button type="button" class="vplay" data-mid="' + esc(id) + '" aria-label="' +
        esc(t(playing ? "voicePause" : "voicePlay")) + '">' +
        (playing ? PAUSE_SVG : PLAY_SVG) +
      "</button>" +
      '<span class="vwave" data-wave="' + esc(id) + '" aria-hidden="true">' +
        waveBars(id, played) +
      "</span>" +
      '<span class="vtime" data-time="' + esc(id) + '">' +
        esc(mmss(playing || elapsed > 0 ? elapsed : total)) +
      "</span>" +
    "</div>" +
    // Three states, not two. A memo still being transcribed shows a shimmer
    // where its transcript will land, because the bubble is on screen from the
    // moment recording stops and Whisper takes another second or three; making
    // the visitor watch a spinner where their own message should be is exactly
    // the feeling this page exists to disprove. An empty transcript on a
    // message that is NOT pending means transcription actually failed.
    (msg.text
      ? '<div class="vtranscript">' + esc(msg.text) + "</div>"
      : msg.awaitingTranscript
        ? '<span class="vpending" role="status" aria-label="' + esc(t("voiceTranscribing")) + '"></span>'
        : '<div class="vtranscript is-none">' + esc(t("voiceNoTranscript")) + "</div>");
}

// The message thread. `pending` is passed in rather than read from a shared
// global so this renders from its arguments alone.
var paintedCount = 0;
var paintedPending = false;

export function messagesHtml(s, pending, voice) {
  var out = [];
  var v = voice || {};
  // A restart hands back a shorter thread; treat that as a fresh one so the
  // new opener animates in rather than being mistaken for an old bubble.
  if (s.messages.length < paintedCount) paintedCount = 0;
  for (var i = 0; i < s.messages.length; i++) {
    var msg = s.messages[i];
    var mine = msg.role === "visitor";
    var prev = s.messages[i - 1];
    var showAv = !mine && (!prev || prev.role !== "ai");
    var fresh = i >= paintedCount ? " is-new" : "";
    var isVoice = msg.kind === "voice";
    out.push(
      '<div class="row ' + (mine ? "me" : "ai") + '">' +
        (mine ? "" : (showAv
          ? '<div class="av">' + esc(initials(s.agent)) + "</div>"
          : '<div class="av" style="visibility:hidden"></div>')) +
        '<div class="bub-wrap">' +
          '<div class="bub' + (isVoice ? " is-voice" : "") + fresh + '">' +
            (isVoice ? voiceBubbleHtml(msg, v) : linkify(esc(msg.text))) +
          "</div>" +
          '<div class="ts">' + esc(clock(msg.at)) + "</div>" +
        "</div>" +
      "</div>"
    );
  }
  if (pending) {
    out.push(
      '<div class="row ai">' +
        '<div class="av">' + esc(initials(s.agent)) + "</div>" +
        '<div class="bub-wrap"><div class="bub typing' + (paintedPending ? "" : " is-new") +
          '"><i></i><i></i><i></i></div></div>' +
      "</div>"
    );
  }
  paintedCount = s.messages.length;
  paintedPending = pending;
  return out.join("");
}

// Shared markup for both the desktop aside and the mobile in-stream card
// (`recapHtml` / `recapInlineHtml` below) — one source of truth so the two
// surfaces can never drift apart.
// Turn the engine's labelled summary into coloured, bulleted rows.
//
// The text arrives as "Interest: ...\nPain points: ..." with English labels
// and the body in the lead's language. Each known label is swapped for its
// translation and given its own colour; a line whose label isn't in the
// table (or that carries no label at all) is still rendered, unstyled,
// rather than dropped: a summary is not worth losing to a format change.
// The booked day, drawn as a month with one date lit up, under the Outcome
// line. A sentence saying a call is booked is read past; a calendar with a
// day marked on it is the thing a prospect actually believes.
//
// Every Date below is constructed in UTC and formatted with timeZone:"UTC",
// and that is load-bearing rather than incidental. The server has already
// resolved the booking to a wall-clock year/month/day in the LEAD's zone, so
// these are calendar coordinates, not instants. Reading them back through
// the visitor's own zone would slide the grid a day for anyone whose local
// midnight falls on the other side of the server's.
//
// Month and weekday names come from Intl in the panel's language, so a Dutch
