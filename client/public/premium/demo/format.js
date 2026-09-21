// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

import { t } from "./copy.js";

// ---- text and formatting helpers ----

export function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// Hosts whose links exist to be clicked once, to pick a time. Matched on the
// host only: the path carries a token that differs per lead.
var BOOKING_HOSTS = /(^|\.)(cal\.leadawaker\.com|book\.leadawaker\.com|cal\.com|caldiy\.[a-z.]+)$/i;

var CAL_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" ' +
  'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<rect x="3" y="4.5" width="18" height="16" rx="2.5"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></svg>';

function urlHost(url) {
  // The URL has been HTML-escaped by now, so &amp; is back to & before parsing.
  try { return new URL(String(url).replace(/&amp;/g, "&")).hostname; } catch (e) { return ""; }
}

export function isBookingUrl(url) {
  return BOOKING_HOSTS.test(urlHost(url));
}

/** "cal.leadawaker.com/x/y" -> "cal.leadawaker.com". Falls back to the raw
 *  string when the URL will not parse, so a link is never lost. */
function hostLabel(url) {
  var host = urlHost(url);
  return host ? host.replace(/^www\./, "") : String(url);
}

// Turn bare URLs in a message into real links.
//
// Runs on ALREADY-ESCAPED text and never unescapes it: the matched run is
// dropped into both the href and the link text exactly as esc() left it, so
// the escaping still holds and `&amp;` in a query string is what an href
// attribute wants anyway. Only http(s) is matched, so there is no route
// here for a `javascript:` URL to become a clickable link.
export function linkify(escaped) {
  return String(escaped).replace(/\bhttps?:\/\/[^\s<]+/g, function (match) {
    var url = match, tail = "";
    // Peel trailing punctuation that belongs to the sentence rather than
    // the URL. "book here: https://x.test/a." must not link the full stop.
    // Entities are checked too, since by this point a closing quote is
    // "&quot;" and an apostrophe "&#39;".
    for (;;) {
      var punct = url.match(/(&quot;|&#39;|&gt;|&amp;|[.,!?;:])$/);
      if (punct) { tail = punct[0] + tail; url = url.slice(0, -punct[0].length); continue; }
      // A closing bracket is part of the URL only when something inside
      // opened it, so "(see https://x.test/a)" keeps the paren out while a
      // wiki-style ".../Foo_(bar)" keeps it in.
      var last = url.slice(-1);
      if (last === ")" || last === "]") {
        var open = last === ")" ? "(" : "[";
        if ((url.split(last).length - 1) > (url.split(open).length - 1)) {
          tail = last + tail; url = url.slice(0, -1); continue;
        }
      }
      break;
    }
    if (!/^https?:\/\/\S/.test(url)) return match;
    // A booking link is an action, not a reference, so it reads as a button
    // with a calendar icon rather than forty characters of URL in the middle
    // of a sentence. Every other link keeps its host as the label for the same
    // reason: nobody reads a query string, and a wrapped URL makes an
    // otherwise human-sounding message look machine-generated.
    if (isBookingUrl(url)) {
      return '<a class="lnk-btn" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
        CAL_SVG + "<span>" + t("openCalendar") + "</span></a>" + tail;
    }
    return '<a class="lnk" href="' + url + '" target="_blank" rel="noopener noreferrer">' +
      esc(hostLabel(url)) + "</a>" + tail;
  });
}

export function clock(iso) {
  if (!iso) return "";
  var d = new Date(iso);
  if (isNaN(d)) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

// m:ss, for the recording timer and the voice player's elapsed/total. Both
// count in seconds and neither can reach an hour (the recorder caps at 30
// seconds), so there is no hours branch to get wrong. A non-finite duration
// reads as 0:00 rather than NaN:NaN: webm from MediaRecorder often reports
// Infinity until it has been played through once.
export function mmss(seconds) {
  var s = Math.floor(Number(seconds));
  if (!isFinite(s) || s < 0) s = 0;
  var rest = s % 60;
  return Math.floor(s / 60) + ":" + (rest < 10 ? "0" : "") + rest;
}

export function initials(name) {
  var parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "AI";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
}

export function signature(s) {
  // Cheap change detector so a poll that returns nothing new does not
  // re-render and blow away the caret position in the composer.
  //
  // The last message's id and kind are in here because stage, done, the turn
  // count, the message count and the last message's text can ALL be unchanged
  // while something the page has to repaint did change: a voice memo whose
  // transcript arrives, or one interaction row replaced by another with the
  // same text. Without them that repaint waits for the AI's next reply.
  // company, firstName and language are here for the presenter panel: renaming
  // the company mid-demo changes none of the fields above, so without them the
  // header pill would sit on the old name until the AI's next reply and a
  // working edit would look like a broken one.
  if (!s) return "";
  var last = s.messages.length ? s.messages[s.messages.length - 1] : null;
  return [s.stage, s.done, s.turnsUsed, s.messages.length,
          last ? last.text : "", last ? last.id : "", last ? last.kind : "",
          s.company || "", s.firstName || "", s.language || ""].join("|");
}
