// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

import { t, uiLang } from "./copy.js";
import { icon } from "./icons.js";
import { esc, linkify } from "./format.js";

var SUMMARY_SECTIONS = [
  { match: "interest",      color: "#7B2D3B", en: "Interest",      nl: "Interesse",      pt: "Interesse" },
  { match: "pain points",   color: "#B4552F", en: "Pain points",   nl: "Pijnpunten",     pt: "Pontos de dor" },
  { match: "qualification", color: "#5F6B3A", en: "Qualification", nl: "Kwalificatie",   pt: "Qualificação" },
  { match: "sentiment",     color: "#3F5A73", en: "Sentiment",     nl: "Sentiment",      pt: "Sentimento" },
  { match: "project brief", color: "#6B5478", en: "Project brief", nl: "Projectbriefing", pt: "Briefing do projeto" },
  { match: "outcome",       color: "#2F7D4F", en: "Outcome",       nl: "Uitkomst",       pt: "Resultado" }
];
// Reused for the brief and quote rows, which have no fixed label set to key
// off. Derived rather than restated: a second hand-kept copy of the same six
// hex values drifts the moment one section's colour changes, and the two
// recap cards visibly stop matching.
var SECTION_COLORS = SUMMARY_SECTIONS.map(function (s) { return s.color; });

// Lucide paths, inlined: the page is standalone vanilla JS under a strict

function calendarHtml(b) {
  if (!b || !b.year || !b.month || !b.day) return "";
  var lang = uiLang();
  var first = new Date(Date.UTC(b.year, b.month - 1, 1));

  var head;
  try {
    head = new Intl.DateTimeFormat(lang, { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  } catch (e) {
    head = b.month + "/" + b.year;
  }

  var cells = [];
  var dowFmt = null;
  try {
    dowFmt = new Intl.DateTimeFormat(lang, { weekday: "short", timeZone: "UTC" });
  } catch (e) { /* falls back to the ASCII initials below */ }
  for (var d = 0; d < 7; d++) {
    // 2024-01-01 was a Monday, so this walks Mon..Sun in order.
    var probe = new Date(Date.UTC(2024, 0, 1 + d));
    // Monday-first: the convention in every market this demo runs in
    // (NL, UK, BR). Some locales abbreviate with a trailing full stop
    // ("seg."), which is noise in a 7-column header.
    var name = dowFmt ? String(dowFmt.format(probe)).replace(/\.$/, "") : "MTWTFSS".charAt(d);
    cells.push('<span class="cal-dow">' + esc(name) + "</span>");
  }

  // getUTCDay() counts from Sunday; shift it so Monday is column 0.
  var pad = (first.getUTCDay() + 6) % 7;
  for (var p = 0; p < pad; p++) cells.push('<span class="cal-d is-pad"></span>');
  // Day 0 of the NEXT month is the last day of this one, which is also how
  // February gets its leap year right without a rule for it.
  var days = new Date(Date.UTC(b.year, b.month, 0)).getUTCDate();
  // The visitor's own real-world today, in their local calendar (not UTC:
  // unlike the booking fields above, this has no server-resolved timezone to
  // borrow, so it has to be the date on the device actually looking at the
  // screen). Only lights up when the calendar is already showing that month.
  var now = new Date();
  var isTodayMonth = now.getFullYear() === b.year && now.getMonth() + 1 === b.month;
  for (var n = 1; n <= days; n++) {
    var cls = "cal-d";
    if (n === b.day) cls += " is-pick";
    if (isTodayMonth && n === now.getDate()) cls += " is-today";
    cells.push('<span class="' + cls + '">' + n + "</span>");
  }

  return (
    '<div class="cal">' +
      '<div class="cal-head">' + esc(head) + "</div>" +
      '<div class="cal-grid">' + cells.join("") + "</div>" +
      (b.time
        ? '<div class="cal-time">' + icon("clock", 13) +
            "<b>" + esc(b.time) + "</b>" +
            (b.timezone ? "<span>" + esc(String(b.timezone).replace(/_/g, " ")) + "</span>" : "") +
          "</div>"
        : "") +
    "</div>"
  );
}

export function summaryHtml(text, booking) {
  var lines = String(text || "").split(/\r?\n/);
  var rows = [];
  var sawOutcome = false;
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line) continue;
    var colon = line.indexOf(":");
    var section = null;
    if (colon > 0) {
      var head = line.slice(0, colon).trim().toLowerCase();
      for (var j = 0; j < SUMMARY_SECTIONS.length; j++) {
        if (SUMMARY_SECTIONS[j].match === head) { section = SUMMARY_SECTIONS[j]; break; }
      }
    }
    if (!section) {
      rows.push('<li class="sum-row is-plain">' + linkify(esc(line)) + "</li>");
      continue;
    }
    var label = section[uiLang()] || section.en;
    // The calendar hangs off Outcome because that is the section it is the
    // evidence for, and it inherits the row's own --sc so the marked day is
    // the same green as the label above it. Absent on any demo that ended
    // without a booking, which is the whole point of showing it.
    var extra = "";
    if (section.match === "outcome") {
      sawOutcome = true;
      if (booking) extra = calendarHtml(booking);
    }
    rows.push(
      '<li class="sum-row" style="--sc:' + section.color + '">' +
        '<span class="sum-k">' + esc(label) + ":</span> " +
        '<span class="sum-v">' + linkify(esc(line.slice(colon + 1).trim())) + "</span>" +
        extra +
      "</li>"
    );
  }
  // A real booking must never go unshown because the summary came back in a
  // shape with no Outcome line in it (a model wobble, or a fallback summary
  // that isn't labelled at all). The calendar is the strongest thing in the
  // panel; it gets its own row rather than being lost with the label.
  if (!sawOutcome && booking) {
    var solo = calendarHtml(booking);
    if (solo) {
      var oc = SUMMARY_SECTIONS[SUMMARY_SECTIONS.length - 1];
      rows.push('<li class="sum-row is-plain" style="--sc:' + oc.color + '">' + solo + "</li>");
    }
  }
  return rows.length ? '<ul class="sum-list">' + rows.join("") + "</ul>" : "";
}

// The quote itself, as a headline total plus bulleted line items. Its own
// function because it is now rendered in two places: on its own while the
// conversation is still running, and inside the finished recap afterwards.
function quoteRowsHtml(q) {
  if (!q || (!q.total && !(q.lines && q.lines.length))) return "";
  var out = "";
  if (q.total) {
    out +=
      '<div class="quote-total">' +
        '<span class="quote-total-k">' + esc(q.totalLabel || "") + "</span>" +
        '<span class="quote-total-v">' + esc(q.total) + "</span>" +
      "</div>";
  }
  for (var k = 0; k < (q.lines || []).length; k++) {
    out +=
      '<div class="quote-row" style="--sc:' + SECTION_COLORS[k % SECTION_COLORS.length] + '">' +
        esc(q.lines[k]) +
      "</div>";
  }
  return out;
}

function briefRowsHtml(brief) {
  var out = "";
  for (var i = 0; i < (brief || []).length; i++) {
    // The brief's labels are generated per-language by the engine, so there is
    // no fixed set to key a colour off; they cycle the same palette the summary
    // uses so the two panels read as one system.
    out +=
      '<div class="brief-row" style="--sc:' + SECTION_COLORS[i % SECTION_COLORS.length] + '">' +
        '<span class="brief-k">' + esc(brief[i].label) + "</span>" +
        '<span class="brief-v">' + esc(brief[i].value) + "</span>" +
      "</div>";
  }
  return out;
}

// Everything on the right rail, in the order it stacks.
//
// The rail is no longer only an end-of-demo artefact. A decision-mode demo is a
// conversation ABOUT a quote, and someone running one needs the figures in
// front of them while it happens, not summarised afterwards: it is what makes
// the AI's answers checkable, and what gives the person testing it something to
// probe. So the quote is shown from the first paint and simply STAYS, and the
// recap arrives above it when the conversation ends.
//
// Reads nothing it is not given. `state` and `recap` used to be module globals
// here, which is what made this callable from exactly one place.
//
//   done   - the conversation has finished, so the recap belongs on the rail
//   recap  - the fetched recap, or null while it is still being generated
//   quote  - the quote for this demo, or null on a scoping demo
export function railContentHtml(opts) {
  var done = !!(opts && opts.done);
  var recap = (opts && opts.recap) || null;
  var quote = (opts && opts.quote) || null;
  var quoteRows = quoteRowsHtml(quote);

  // Live: the quote is the whole rail, so it gets the page-level heading rather
  // than the small section label it wears once the recap is above it.
  if (!done) {
    if (!quoteRows) return "";
    return (
      "<h2>" + esc(t("theQuote")) + "</h2>" +
      '<p class="sub">' + esc(t("quoteNote")) + "</p>" +
      '<div class="recap-card">' + quoteRows + "</div>"
    );
  }

  // The recap takes a couple of model calls to come back. Keeping the quote
  // rendered underneath the placeholder means the rail does not blank out and
  // then repopulate at the exact moment the demo is trying to look composed.
  var quoteBlock = quoteRows
    ? "<h3>" + esc(t("theQuote")) + '</h3><div class="recap-card">' + quoteRows + "</div>" +
      '<p class="note">' + esc(t("quoteNote")) + "</p>"
    : "";

  if (!recap) {
    return (
      "<h2>" + esc(t("wrapping")) + '</h2><p class="sub">' + esc(t("wrappingSub")) + "</p>" +
      quoteBlock
    );
  }

  var summary = summaryHtml(recap.summary, recap.booking);
  var briefRows = briefRowsHtml(recap.brief);
  return (
    "<h2>" + esc(t("recapTitle")) + "</h2>" +
    '<p class="sub">' + esc(t("recapSub")) + "</p>" +
    (summary
      ? "<h3>" + esc(t("conversation")) + '</h3><div class="recap-card">' + summary + "</div>"
      : "") +
    quoteBlock +
    (briefRows
      ? "<h3>" + esc(t("theBrief")) + '</h3><div class="recap-card">' + briefRows + "</div>" +
        '<p class="note">' + esc(t("briefNote")) + "</p>"
      // "No brief was collected" is the right thing to say about a SCOPING demo
      // that stopped early. It is simply false about a decision demo, which
      // never collects one by design and has just shown the quote instead, so
      // the quote panel suppresses it.
      : (quoteRows ? "" : '<p class="note">' + esc(t("briefEmpty")) + "</p>"))
  );
}

// Desktop: the right-hand rail. `fresh` adds the slide-in, and main.js only
// passes it the first time the rail appears: render() rebuilds the tree through
// innerHTML, so without the guard the panel re-ran its entrance animation on
// every poll, which is the same flicker the message bubbles had.
export function railAsideHtml(opts, fresh) {
  var body = railContentHtml(opts);
  return body ? '<aside class="recap' + (fresh ? " is-new" : "") + '">' + body + "</aside>" : "";
}

// Mobile: the same content as a card in the stream. CSS hides whichever of the
// two does not apply at the current width (see the 1080px media query).
// Placement differs by state and that is deliberate: the finished recap belongs
// after the last message, while the live quote belongs above the conversation
// it is the context for.
export function railInlineHtml(opts, lead) {
  var body = railContentHtml(opts);
  if (!body) return "";
  return '<div class="recap-inline' + (lead ? " is-lead" : "") + '">' + body + "</div>";
}
