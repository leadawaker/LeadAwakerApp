// Part of the browser demo page. The microphone and the audio element: the two
// pieces of this feature that own live browser objects rather than markup.
//
// Both are module-level singletons, and both have to be, for the same reason
// from opposite directions:
//
// * The RECORDER outlives any one paint. render() rebuilds the composer, and a
//   recorder held by the composer would be torn down by a poll landing
//   mid-sentence. (main.js also suppresses render while recording, so the
//   visitor does not watch the bar rebuild under their thumb; this is the other
//   half of that.) Same shape as the CRM's client/src/lib/voiceRecorder.ts,
//   which lives outside React for the same reason.
//
// * The PLAYER must outlive every paint. render() writes root.innerHTML, so an
//   <audio> inside a bubble is destroyed on every poll, cutting playback off
//   mid-sentence. One element on document.body survives, and the bubbles just
//   paint their play/pause state from it. This mirrors the global _activeAudio
//   manager in the CRM's VoiceMemoPlayer.tsx, which solves the same problem for
//   a different reason (many bubbles, one speaker).
//
// Deliberately NOT ported from the CRM: the lazy AudioContext waveform decode
// and the 1x/1.5x/2x speed control. Nobody re-listens to their own eight-second
// memo at double speed.

// 30 seconds is the whole memo. A demo answer is a sentence or two, and the cap
// keeps both the payload (roughly 30-60KB of Opus, so 40-80KB of base64) and
// the Whisper bill small. Amber at 25 so the stop is never a surprise.
export var MAX_SECONDS = 30;
export var AMBER_SECONDS = 25;

// ---- capability -------------------------------------------------------
// Resolved once, at load. Chrome and Firefox record webm/opus; Safari (iOS
// 14.3+) records audio/mp4. Anything else, or a browser with no MediaRecorder
// or no getUserMedia at all, gets no mic button rendered: a control that cannot
// work is worse than no control. Groq's Whisper accepts both containers as they
// are, so there is no transcode anywhere in this path.
export var MIME = (function () {
  if (typeof MediaRecorder === "undefined") return null;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return null;
  var tries = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (var i = 0; i < tries.length; i++) {
    try { if (MediaRecorder.isTypeSupported(tries[i])) return tries[i]; } catch (e) { /* older Safari throws */ }
  }
  return null;
})();

// Flipped the first time the visitor declines the permission prompt. A denied
// mic is treated exactly like an absent one: the button disappears rather than
// re-prompting on every tap for a permission the browser will not ask about
// again.
var denied = false;

export function micAvailable() {
  return MIME !== null && !denied;
}

// ---- recorder ---------------------------------------------------------
var recorder = null;
var chunks = [];
var stream = null;
var ticker = null;
var startedAt = 0;
var cancelled = false;
var handlers = {};

export function isRecording() {
  return recorder !== null;
}

function teardown() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  if (stream) { stream.getTracks().forEach(function (tr) { tr.stop(); }); stream = null; }
  recorder = null;
}

/**
 * Ask for the mic and start recording.
 *
 * `on` takes { tick(seconds), done(blob, mime, ms), fail() }. `fail` fires for
 * a declined prompt and for a recorder that never got going, and the caller
 * repaints without a mic; it deliberately does not distinguish the two, because
 * the visitor's next move is the same either way.
 */
export function startRecording(on) {
  if (recorder || !micAvailable()) return;
  handlers = on || {};
  cancelled = false;

  navigator.mediaDevices.getUserMedia({ audio: true }).then(function (s) {
    stream = s;
    chunks = [];
    try {
      recorder = new MediaRecorder(s, { mimeType: MIME });
    } catch (e) {
      teardown();
      if (handlers.fail) handlers.fail();
      return;
    }
    recorder.ondataavailable = function (e) { if (e.data && e.data.size > 0) chunks.push(e.data); };
    recorder.onstop = function () {
      var ms = Date.now() - startedAt;
      var blob = new Blob(chunks, { type: MIME });
      var discard = cancelled;
      teardown();
      // Exactly one of these fires, always. A stop that produces no message
      // still has to say so, or the caller is left showing a recording bar for
      // a recorder that has already gone away — which is what "discard" looked
      // like before this was an else branch.
      //
      // A tap so fast it caught nothing is a mis-tap, not a message: sending it
      // would spend one of the session's turns on silence and come back with an
      // empty transcript.
      if (!discard && blob.size > 0 && ms >= 400) {
        if (handlers.done) handlers.done(blob, MIME, ms);
      } else if (handlers.fail) {
        handlers.fail();
      }
    };
    startedAt = Date.now();
    recorder.start();

    var seconds = 0;
    if (handlers.tick) handlers.tick(0);
    ticker = setInterval(function () {
      seconds++;
      if (handlers.tick) handlers.tick(seconds);
      if (seconds >= MAX_SECONDS) stopRecording();
    }, 1000);
  }).catch(function () {
    denied = true;
    teardown();
    if (handlers.fail) handlers.fail();
  });
}

/** Finish and hand the recording over (fires `done`). */
export function stopRecording() {
  if (ticker) { clearInterval(ticker); ticker = null; }
  if (recorder && recorder.state !== "inactive") recorder.stop();
  else teardown();
}

/** Finish and throw the recording away (fires nothing). */
export function cancelRecording() {
  cancelled = true;
  stopRecording();
}

/** A recording as a "data:audio/webm;base64,..." URL, which is how it travels. */
export function blobToBase64(blob) {
  return new Promise(function (resolve, reject) {
    var reader = new FileReader();
    reader.onloadend = function () { resolve(reader.result); };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

// ---- playback ---------------------------------------------------------
var el = null;
var playingId = null;
var notify = function () {};

function element() {
  if (el) return el;
  el = document.createElement("audio");
  el.preload = "none";
  el.style.display = "none";
  document.body.appendChild(el);
  // timeupdate rather than a requestAnimationFrame loop: it fires about four
  // times a second, the waveform is 34 bars, and a bar covers a third of a
  // second of a ten-second memo. A 60fps loop would repaint the same bars over
  // and over, and would have to be cancelled and restarted around every poll's
  // re-render.
  el.addEventListener("timeupdate", function () { notify(); });
  el.addEventListener("loadedmetadata", function () { notify(); });
  el.addEventListener("ended", function () { playingId = null; notify(); });
  el.addEventListener("error", function () { playingId = null; notify(); });
  return el;
}

/** Called whenever the playing message, its position or its length changes. */
export function onPlayback(cb) {
  notify = cb || function () {};
}

export function playingMessage() { return playingId; }
export function playedSeconds() { return el ? el.currentTime : 0; }

/** The real length, once the browser has read the file. 0 until then. */
export function loadedDuration() {
  return el && isFinite(el.duration) && el.duration > 0 ? el.duration : 0;
}

export function play(id, url) {
  var a = element();
  if (a.getAttribute("src") !== url) {
    a.setAttribute("src", url);
    a.currentTime = 0;
  }
  playingId = id;
  notify();
  return a.play().catch(function () {
    playingId = null;
    notify();
  });
}

export function pause() {
  if (el) el.pause();
  playingId = null;
  notify();
}

/** Drop the source entirely. Used on restart, where the audio is about to be
 *  revoked out from under the element. */
export function reset() {
  if (el) {
    el.pause();
    el.removeAttribute("src");
    el.load();
  }
  playingId = null;
}

/** The playing message's id follows its bubble when the optimistic local id is
 *  replaced by the server's, so playback started a moment before the poll does
 *  not leave a bubble showing "play" while audio is coming out of it. */
export function rename(fromId, toId) {
  if (playingId != null && String(playingId) === String(fromId)) playingId = toId;
}
