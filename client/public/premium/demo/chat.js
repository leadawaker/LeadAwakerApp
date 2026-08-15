// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

import { esc, linkify, clock, initials } from "./format.js";

// The message thread. `pending` is passed in rather than read from a shared
// global so this renders from its arguments alone.
var paintedCount = 0;
var paintedPending = false;

export function messagesHtml(s, pending) {
  var out = [];
  // A restart hands back a shorter thread; treat that as a fresh one so the
  // new opener animates in rather than being mistaken for an old bubble.
  if (s.messages.length < paintedCount) paintedCount = 0;
  for (var i = 0; i < s.messages.length; i++) {
    var msg = s.messages[i];
    var mine = msg.role === "visitor";
    var prev = s.messages[i - 1];
    var showAv = !mine && (!prev || prev.role !== "ai");
    var fresh = i >= paintedCount ? " is-new" : "";
    out.push(
      '<div class="row ' + (mine ? "me" : "ai") + '">' +
        (mine ? "" : (showAv
          ? '<div class="av">' + esc(initials(s.agent)) + "</div>"
          : '<div class="av" style="visibility:hidden"></div>')) +
        '<div class="bub-wrap">' +
          '<div class="bub' + fresh + '">' + linkify(esc(msg.text)) + "</div>" +
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
