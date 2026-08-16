// Part of the browser demo page. Split out of demo.html (which had grown
// past 1600 lines) so each concern can be read, and tested, on its own.
// Plain ES modules, same-origin: the page still ships no bundler and no
// third-party script.

import { t } from "./copy.js";
import { icon } from "./icons.js";
import { esc } from "./format.js";

// A wine RAMP, one colour per stage, brightening as the lead converts, so
// the row encodes progress twice over (how far along, and how hot) and the
// last stage is the loudest thing on the page at the moment it lands.
// It starts on the palette's own --wine-soft and walks lighter and pinker
// from there, staying inside the site's wine family: the flat green this
// replaced was the one colour on the page that belonged to no palette.
export var STAGES = [
  { key: "new",       icon: "user-plus",      color: "#7A2E3E" },
  { key: "responded", icon: "message-circle", color: "#98394F" },
  { key: "qualified", icon: "badge-check",    color: "#B54562" },
  { key: "objective", icon: "calendar-check", color: "#CE5077" }
];
// What the last stage becomes when the conversation ends WITHOUT a booking.
// Deliberately off the ramp entirely and into warm grey: the pipeline
// stopped rather than finished, and a closed lead should not be wearing the
// brightest colour on the row. Same slot, different ending.
var DNC_STAGE = { key: "dnc", icon: "bell-off", color: "#8A8072" };

function stageIndex(key) {
  for (var i = 0; i < STAGES.length; i++) if (STAGES[i].key === key) return i;
  return 0;
}

// How full the connector AFTER stage `i` is, given the stage the lead has
// reached. Half on arrival at the stage before it, full once the stage
// after it is reached, so every conversion moves the row twice: the bar
// grows to the middle, then completes as the next conversion lands.
function lineFill(i, at) {
  if (at > i) return 100;
  if (at === i) return 50;
  return 0;
}

// Widths the connectors were last PAINTED at. The bars are re-created from
// scratch on every render (innerHTML), which would make them snap straight
// to their new width with no transition, so each one is emitted at its
// previous width and moved to the target on the next frame, which is what
// actually makes it grow. Empty on first paint, so the opening state is
// drawn already-settled instead of animating out of nowhere on load.
var prevFills = [];

// The conversation is over and it did NOT end in a booking, so the last
// stage stops being a target and becomes an ending: do-not-disturb.
//
// The turn cap is excluded on purpose. Hitting it means the DEMO ran out of
// messages, not that the lead asked to be left alone, and labelling that
// "do not disturb" would put words in a prospect's mouth in front of them.
// Only a genuine terminal status (lost / cancelled) gets the grey ending.
export function isDnc(s) {
  return !!(s && s.done && s.stage !== "objective" && s.cappedReason !== "turns");
}

export function trackerHtml(current, dnc) {
  var last = STAGES.length - 1;
  // The reached stage is ALWAYS the real one. A do-not-disturb ending
  // recolours the final slot; it must not light the slots in between,
  // because a lead who replied once and asked to be left alone never got
  // qualified. The tracker is the artefact the prospect is being asked to
  // believe, so it cannot claim a conversion that did not happen.
  var at = stageIndex(current);
  var out = [];
  for (var i = 0; i < STAGES.length; i++) {
    var step = (dnc && i === last) ? DNC_STAGE : STAGES[i];
    // On a DNC the ending is the live slot and the stages actually reached
    // are settled behind it, so nothing before it stays "on".
    var cls;
    if (dnc && i === last) cls = "track-step on";
    else if (dnc) cls = i <= at ? "track-step done" : "track-step";
    else cls = i < at ? "track-step done" : (i === at ? "track-step on" : "track-step");
    var label = t("stage_" + step.key);
    out.push(
      '<div class="' + cls + '" style="--c:' + step.color + '" title="' + esc(label) + '">' +
        '<span class="track-dot">' + icon(step.icon, 18, "track-ic") + "</span>" +
        '<span class="track-label">' + esc(label) + "</span>" +
      "</div>"
    );
    if (i < last) {
      var target = lineFill(i, at);
      var from = prevFills[i] == null ? target : prevFills[i];
      // The connector spans two stages, so it carries both their colours and
      // the ramp reads as continuous. The one feeding the final stage ends
      // grey on a DNC, which is what makes the row visibly stop rather than
      // arrive.
      var next = (dnc && i + 1 === last) ? DNC_STAGE : STAGES[i + 1];
      out.push(
        '<div class="track-line">' +
          '<span class="track-line-fill" data-fill="' + target + '" ' +
            'style="clip-path:inset(0 ' + (100 - from) + '% 0 0);' +
            '--c0:' + step.color + ';--c1:' + next.color + '"></span>' +
        "</div>"
      );
      prevFills[i] = target;
    }
  }
  return '<div class="track">' + out.join("") + "</div>";
}

// Second half of the trick above: hand the freshly-inserted bars their real
// widths one frame later, so the browser has a previous value to animate
// FROM. Called by render() after the tree is in the document.
export function settleTracker(root) {
  var bars = root.querySelectorAll(".track-line-fill");
  if (!bars.length) return;
  requestAnimationFrame(function () {
    for (var i = 0; i < bars.length; i++) {
      var pct = Number(bars[i].getAttribute("data-fill"));
      bars[i].style.clipPath = "inset(0 " + (100 - pct) + "% 0 0)";
    }
  });
}

// How much of the thread was on screen at the end of the last render, so a
// rebuild can tell a genuinely-new bubble from one that was already there.
