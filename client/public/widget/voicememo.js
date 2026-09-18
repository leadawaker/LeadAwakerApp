// Voice memos in the widget: the bookkeeping around the demo page's recorder and
// player (voice.js), trimmed to what a website visitor needs. Same behaviour as
// the demo chat (tap mic, talk, tap send; the memo plays back from the local
// recording with no network hop), minus restart handling, which the widget
// does not have.
//
// Split from widget.js so that file stays about rendering and polling.

import * as voice from "/premium/demo/voice.js";
import { PLAY_SVG, PAUSE_SVG } from "/premium/demo/chat.js";
import { mmss } from "/premium/demo/format.js";
import { t } from "/premium/demo/copy.js";

export { voice };

// Audio and length by message id. A recording starts under a local id and is
// re-keyed onto the server's id when the poll brings it back (adopt).
var urls = {};
var durs = {};
var awaiting = [];
var seq = 0;
// Memos fetched from /audio (earlier sessions), oldest first. Each is a base64
// data URL, so only the last few are kept.
var fetched = [];
var FETCHED_CAP = 8;

/** The player state messagesHtml() paints the voice bubbles from. */
export function playerState() {
  return {
    playingId: voice.playingMessage(),
    elapsed: voice.playedSeconds(),
    durations: durs,
    urls: urls,
  };
}

/** Hold a fresh recording locally. Returns the id its optimistic bubble uses. */
export function holdLocal(blob, ms) {
  var url = URL.createObjectURL(blob);
  var id = "local-v" + (++seq);
  var seconds = Math.max(1, Math.round(ms / 1000));
  urls[id] = url;
  durs[id] = seconds;
  awaiting.push({ url: url, localId: id, seconds: seconds });
  return id;
}

/** A send that never reached the server: let go of everything it held. */
export function dropLocal(id) {
  if (urls[id]) URL.revokeObjectURL(urls[id]);
  delete urls[id];
  delete durs[id];
  for (var i = awaiting.length - 1; i >= 0; i--) {
    if (awaiting[i].localId === id) awaiting.splice(i, 1);
  }
}

/** Move each waiting local recording onto the server's copy of it, so pressing
 *  play on your own memo never touches the network. Only messages the page has
 *  not already seen are eligible, or a reload would pin a new recording onto
 *  an old bubble. */
export function adopt(prevMessages, next) {
  if (!awaiting.length || !next || !next.messages) return;
  var known = {};
  (prevMessages || []).forEach(function (m) { known[m.id] = true; });
  for (var i = 0; i < next.messages.length && awaiting.length; i++) {
    var m = next.messages[i];
    if (m.kind !== "voice" || m.role !== "visitor" || known[m.id] || urls[m.id]) continue;
    var held = awaiting.shift();
    urls[m.id] = held.url;
    durs[m.id] = held.seconds;
    delete urls[held.localId];
    delete durs[held.localId];
    voice.rename(held.localId, m.id);
  }
}

// ── playback ────────────────────────────────────────────────────────────────
// Painted onto the existing bubbles four times a second rather than through a
// full render, which would fight the composer for the caret.

var paintedId = null;

function patch(mid, on, elapsed) {
  var btn = document.querySelector('.vplay[data-mid="' + mid + '"]');
  if (!btn) return;
  var p = btn.closest(".vplayer");
  var label = t(on ? "voicePause" : "voicePlay");
  if (btn.getAttribute("aria-label") !== label) {
    btn.innerHTML = on ? PAUSE_SVG : PLAY_SVG;
    btn.setAttribute("aria-label", label);
  }
  var total = durs[mid] || 0;
  var at = on ? elapsed : 0;
  var time = p && p.querySelector(".vtime");
  if (time) time.textContent = mmss(at > 0 ? at : total);
  var bars = p ? p.querySelectorAll(".vwave i") : [];
  var played = total > 0 ? Math.round((at / total) * bars.length) : 0;
  for (var i = 0; i < bars.length; i++) bars[i].classList.toggle("played", on && i < played);
}

function paintPlayback() {
  var pid = voice.playingMessage();
  if (pid != null && !durs[pid]) {
    var d = voice.loadedDuration();
    if (d) durs[pid] = d;
  }
  if (paintedId != null && String(paintedId) !== String(pid)) patch(paintedId, false, 0);
  if (pid != null) patch(pid, true, voice.playedSeconds());
  paintedId = pid;
}

/** Wire the play buttons once. `fetchAudio(id)` resolves to { dataUrl } for a
 *  memo that was not recorded in this tab. */
export function wirePlayback(fetchAudio) {
  voice.onPlayback(paintPlayback);
  document.addEventListener("click", function (e) {
    var btn = e.target && e.target.closest && e.target.closest(".vplay");
    if (!btn) return;
    e.preventDefault();
    var id = btn.getAttribute("data-mid");
    var current = voice.playingMessage();
    if (current != null && String(current) === String(id)) { voice.pause(); return; }
    if (urls[id]) { voice.play(id, urls[id]); return; }
    fetchAudio(id).then(function (data) {
      if (!data || !data.dataUrl) return;
      urls[id] = data.dataUrl;
      fetched.push(id);
      if (fetched.length > FETCHED_CAP) delete urls[fetched.shift()];
      voice.play(id, data.dataUrl);
    }).catch(function () { /* the transcript still says what was said */ });
  });
}

// ── recording bar ───────────────────────────────────────────────────────────

/** A CSS-animated meter: it says "listening", it does not measure anything. */
export function meterBars() {
  var out = "";
  for (var i = 0; i < 22; i++) {
    out += '<i style="animation-delay:' + ((i * 47) % 900) / 1000 + "s;" +
      "animation-duration:" + (0.7 + (i % 5) * 0.09).toFixed(2) + 's"></i>';
  }
  return out;
}
