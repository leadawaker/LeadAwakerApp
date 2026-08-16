// Tests for the browser demo's render modules.
//
// Run: node client/public/premium/demo/demo.test.mjs
//
// These import the real modules. The previous version scraped functions out of
// demo.html with a regex, which is part of what splitting the page was for:
// every module here renders strings from its arguments and touches no DOM, so
// it runs in node exactly as it runs in the browser. main.js is the one
// exception (it owns the DOM) and is deliberately not imported.

import { setLang, t, uiLang, browserLang } from "./copy.js";
import { esc, linkify, clock, initials, mmss, signature } from "./format.js";
import { trackerHtml, isDnc } from "./tracker.js";
import { messagesHtml } from "./chat.js";
import { summaryHtml, railContentHtml, railAsideHtml, railInlineHtml } from "./recap.js";

let fails = 0;
function section(name) { console.log("\n=== " + name + " ==="); }
function ok(label, cond, extra) {
  if (!cond) fails++;
  console.log((cond ? "  PASS  " : "  FAIL  ") + label + (cond ? "" : "   <<< " + (extra ?? "")));
}

// navigator is read-only on globalThis in node 24, so define it rather than assign.
function setNav(languages) {
  Object.defineProperty(globalThis, "navigator", {
    value: { languages, language: languages[0] }, configurable: true,
  });
}
setNav(["en-US"]);

section("language resolution");
setLang(null);
setNav(["nl-NL", "en-US"]);
ok("no demo language falls back to the browser's", t("errExpiredTitle") === "Deze link is niet geldig", t("errExpiredTitle"));
setNav(["pt-BR"]);
ok("pt-BR resolves to Brazilian Portuguese", t("errGenericTitle") === "Algo deu errado", t("errGenericTitle"));
setNav(["de-DE"]);
ok("an unsupported browser language falls back to English", t("errGenericTitle") === "Something went wrong", t("errGenericTitle"));
setNav(["en-GB"]);
ok("en-GB prefix-matches English", browserLang() === "en", browserLang());
setLang("pt");
ok("the demo language beats the browser's", t("errExpiredTitle") === "Este link não é válido", t("errExpiredTitle"));
ok("uiLang agrees with the pack in use", uiLang() === "pt", uiLang());
setLang("xx");
ok("an unknown demo language falls back to English strings", t("restart") === "Restart", t("restart"));
ok("...and uiLang agrees, rather than handing Intl a dead tag", uiLang() === "en", uiLang());
setLang("en");

section("escaping and links");
ok("markup is escaped", esc('<img src=x onerror="a">') === "&lt;img src=x onerror=&quot;a&quot;&gt;");
ok("a bare url becomes a link", /<a class="lnk" href="https:\/\/x.test\/a"/.test(linkify(esc("book: https://x.test/a"))));
ok("a trailing full stop stays out of the href", /href="https:\/\/x.test\/a"[^>]*>https:\/\/x.test\/a<\/a>\./.test(linkify(esc("go https://x.test/a."))), linkify(esc("go https://x.test/a."))); 
ok("javascript: is never linked", !/<a /.test(linkify(esc("javascript:alert(1)"))));
ok("a wiki-style closing paren stays in the url", /href="https:\/\/x.test\/F_\(b\)"/.test(linkify(esc("see https://x.test/F_(b)"))));
ok("a wrapping paren stays out", linkify(esc("(see https://x.test/a)")).endsWith('>https://x.test/a</a>)'), linkify(esc("(see https://x.test/a)")));
ok("escaping survives linkifying", !/<script/.test(linkify(esc("<script>https://x.test/a</script>"))));
ok("clock() tolerates a null timestamp", clock(null) === "");
ok("initials() falls back rather than crashing", initials("") === "AI" && initials("Mark Bakker") === "MB");
ok("mmss pads the seconds", mmss(7) === "0:07" && mmss(65) === "1:05");
ok("mmss floors rather than rounding a part-second up", mmss(3.9) === "0:03");
// MediaRecorder's webm reports Infinity for duration until it has been played
// through once, which is exactly where this would otherwise print NaN:NaN.
ok("a non-finite duration reads as 0:00", mmss(Infinity) === "0:00" && mmss(NaN) === "0:00");

section("poll signature");
// The cheap change detector that decides whether a poll repaints. It has to
// notice a voice memo's transcript arriving, which can leave stage, done, the
// turn count, the message count and the last message's text all identical.
const sig = { stage: "responded", done: false, turnsUsed: 1, messages: [{ id: 5, text: "hi" }] };
ok("an identical payload has an identical signature",
   signature(sig) === signature({ ...sig, messages: [{ id: 5, text: "hi" }] }));
ok("a last message gaining a kind changes it",
   signature(sig) !== signature({ ...sig, messages: [{ id: 5, text: "hi", kind: "voice" }] }));
ok("so does one row replacing another with the same text",
   signature(sig) !== signature({ ...sig, messages: [{ id: 6, text: "hi" }] }));
ok("an empty thread still signs", signature({ ...sig, messages: [] }) !== "");
ok("no state at all signs as empty", signature(null) === "");

section("stage tracker");
const at3 = trackerHtml("qualified", false);
ok("no green survives from the old palette", !/22C55E/i.test(at3));
ok("all four ramp colours render", ["#7A2E3E", "#98394F", "#B54562", "#CE5077"].every((c) => at3.includes(c)));
ok("connectors carry a two-colour gradient", at3.includes("--c0:#7A2E3E;--c1:#98394F"));
ok("fills read 100/100/50 at qualified", JSON.stringify(at3.match(/data-fill="\d+"/g)) === '["data-fill=\\"100\\"","data-fill=\\"100\\"","data-fill=\\"50\\""]', JSON.stringify(at3.match(/data-fill="\d+"/g)));
// clip-path, not width: a width animation rescales the gradient, and the mobile
// rules stretch the track well past any fixed background-size.
ok("no width-based fill remains", !at3.includes('style="width:'));
ok("a half fill clips half from the right", at3.includes("clip-path:inset(0 50% 0 0)"));
// The connector widths are module state on purpose: each render emits the
// PREVIOUS fill and hands the new one over in data-fill, which is the only
// reason the bar has something to animate FROM (the tree is rebuilt through
// innerHTML every time). So this compares two successive renders rather than
// reading one in isolation.
trackerHtml("new", false);
const moved = trackerHtml("qualified", false);
ok("a bar is emitted at its previous fill and animates to the new one",
   moved.includes("clip-path:inset(0 50% 0 0)") && moved.includes('data-fill="100"'), moved.match(/clip-path:inset\([^)]*\)/g));

const dnc = trackerHtml("responded", true);
const cls = [...dnc.matchAll(/class="track-step( done| on)?"/g)].map((m) => (m[1] || "").trim() || "ahead");
ok("do-not-disturb replaces the final label", dnc.includes("Do not disturb") && !dnc.includes("Objective reached"));
ok("...in warm grey, off the ramp", dnc.includes("#8A8072") && !dnc.includes("#CE5077"));
ok("...and it lights ONLY what was really reached", JSON.stringify(cls) === '["done","done","ahead","on"]', JSON.stringify(cls));
ok("a lead that did qualify shows three reached", JSON.stringify([...trackerHtml("qualified", true).matchAll(/class="track-step( done| on)?"/g)].map((m) => (m[1] || "").trim() || "ahead")) === '["done","done","done","on"]');
ok("connectors follow real progress, not the ending", JSON.stringify(dnc.match(/data-fill="\d+"/g)) === '["data-fill=\\"100\\"","data-fill=\\"50\\"","data-fill=\\"0\\""]', JSON.stringify(dnc.match(/data-fill="\d+"/g)));
setLang("nl");
ok("do-not-disturb in Dutch", trackerHtml("responded", true).includes("Niet storen"));
setLang("pt");
ok("do-not-disturb in Portuguese", trackerHtml("responded", true).includes("Não perturbe"));
setLang("en");

ok("a booked demo is not do-not-disturb", isDnc({ done: true, stage: "objective" }) === false);
ok("a live conversation is not do-not-disturb", isDnc({ done: false, stage: "responded" }) === false);
ok("a lost conversation is", isDnc({ done: true, stage: "responded", cappedReason: null }) === true);
ok("the turn cap is NOT (the demo ran out, the lead did not opt out)", isDnc({ done: true, stage: "responded", cappedReason: "turns" }) === false);

section("message thread");
const thread = { agent: "Mark", messages: [{ role: "ai", text: "hi", at: null }, { role: "visitor", text: "hello", at: null }] };
ok("first paint animates every bubble in", (messagesHtml(thread, false).match(/is-new/g) || []).length === 2);
ok("an unchanged re-render animates nothing", (messagesHtml(thread, false).match(/is-new/g) || []).length === 0);
const grown = { agent: "Mark", messages: [...thread.messages, { role: "ai", text: "more", at: null }] };
ok("only the new bubble animates", (messagesHtml(grown, false).match(/is-new/g) || []).length === 1);
ok("and not again on the next poll", (messagesHtml(grown, false).match(/is-new/g) || []).length === 0);
ok("a restart's shorter thread animates afresh", (messagesHtml({ agent: "Mark", messages: [{ role: "ai", text: "reset", at: null }] }, false).match(/is-new/g) || []).length === 1);
ok("message text is escaped in the bubble", messagesHtml({ agent: "M", messages: [{ role: "visitor", text: "<b>x</b>", at: null }] }, false).includes("&lt;b&gt;"));

section("voice memos");
setLang("en");
// The player's live state lives in main.js (one <audio> for the whole page,
// because render() rebuilds every bubble) and is passed in, so this stays a
// pure render.
const memo = (extra) => ({
  agent: "Mark",
  messages: [{ role: "visitor", kind: "voice", id: 812, text: "", at: null, ...extra }],
});
const spoken = messagesHtml(memo({ text: "ja hoi, wat kost het ongeveer" }), false, { durations: { 812: 7 } });
ok("a voice message renders a player, not a text bubble",
   spoken.includes('class="bub is-voice') && spoken.includes('class="vplayer"'));
ok("the play button carries its message id, so one <audio> can serve them all",
   spoken.includes('class="vplay" data-mid="812"'));
ok("the waveform is painted instantly from that id", (spoken.match(/<i class="[^"]*" style="height:/g) || []).length === 34);
ok("the transcript sits UNDER the player", spoken.indexOf('class="vplayer"') < spoken.indexOf('class="vtranscript"'));
ok("...and it is the transcript, never the [Voice Note] prefix",
   spoken.includes("ja hoi, wat kost het ongeveer") && !spoken.includes("[Voice Note]"));
ok("a known length renders as m:ss", spoken.includes(">0:07<"));
ok("a transcript is escaped like any other message text",
   messagesHtml(memo({ text: "<b>x</b>" }), false, {}).includes("&lt;b&gt;"));

const waiting = messagesHtml(memo({ awaitingTranscript: true }), false, {});
ok("a memo still being transcribed shimmers where the text will land",
   waiting.includes('class="vpending"') && !waiting.includes("vtranscript"));
const failed = messagesHtml(memo({}), false, {});
ok("an empty transcript that is NOT pending means it failed", failed.includes("Transcription unavailable"));
setLang("nl");
ok("...said in the demo's language", messagesHtml(memo({}), false, {}).includes("Transcriptie niet beschikbaar"));
setLang("en");

// The engine stores the audio next to the transcript, so a clip Whisper could
// not read has neither — and a play button that does nothing is worse than
// saying plainly what the message was.
const noAudio = messagesHtml(memo({ hasAudio: false }), false, {});
ok("a memo with no stored audio shows no player", !noAudio.includes("vplayer") && noAudio.includes("vgone"));
ok("...and still says the transcription failed", noAudio.includes("Transcription unavailable"));
ok("a memo recorded in THIS tab still plays, whatever the server kept",
   messagesHtml(memo({ hasAudio: false }), false, { urls: { 812: "blob:x" } }).includes("vplayer"));
ok("a memo the server has audio for plays", messagesHtml(memo({ hasAudio: true }), false, {}).includes("vplayer"));

const playing = messagesHtml(memo({ text: "x" }), false, { playingId: 812, elapsed: 3.5, durations: { 812: 7 } });
ok("the playing bubble shows pause", playing.includes("<rect") && playing.includes('aria-label="Pause"'));
ok("...with the played half of the waveform lit", (playing.match(/class="played"/g) || []).length === 17);
ok("...and the elapsed time in place of the total", playing.includes(">0:03<"));
ok("another bubble playing leaves this one on play",
   messagesHtml(memo({ text: "x" }), false, { playingId: 999, durations: { 812: 7 } }).includes('aria-label="Play"'));
ok("a typed message is untouched by any of this",
   !messagesHtml({ agent: "M", messages: [{ role: "visitor", text: "hi", at: null }] }, false).includes("vplayer"));

section("booked-date calendar");
const booking = { year: 2026, month: 8, day: 18, time: "15:00", timezone: "Europe/Amsterdam" };
const SUM = "Interest: panels\nPain points: price\nQualification: decides with partner\nSentiment: warm\nOutcome: booked a call";
const cal = summaryHtml(SUM, booking);
ok("the month and year are localized", cal.includes("August 2026"));
ok("the booked day is marked", /class="cal-d is-pick">18</.test(cal));
ok("exactly one day is marked", (cal.match(/is-pick/g) || []).length === 1);
ok("August has 31 cells", (cal.match(/class="cal-d(?: is-pick)?(?: is-today)?"/g) || []).length === 31);
ok("5 Monday-first blanks before Sat 1 Aug", (cal.match(/is-pad/g) || []).length === 5);
ok("the time and zone render", cal.includes("<b>15:00</b>") && cal.includes("Europe/Amsterdam"));
ok("the calendar hangs off the Outcome row", /Outcome:<\/span> <span class="sum-v">booked a call<\/span><div class="cal">/.test(cal));
setLang("nl");
ok("Dutch month name", summaryHtml(SUM, booking).includes("augustus 2026"));
setLang("pt");
ok("Portuguese month name", /agosto de 2026/i.test(summaryHtml(SUM, booking)));
setLang("en");
ok("no booking means no calendar", !summaryHtml(SUM, null).includes('class="cal"'));
ok("the summary still renders without one", (summaryHtml(SUM, null).match(/class="sum-row"/g) || []).length === 5);
ok("a booking survives a summary with no Outcome line", summaryHtml("unlabelled fallback text", booking).includes('class="cal"'));
ok("leap February has 29 days", (summaryHtml(SUM, { year: 2028, month: 2, day: 29, time: "9:00" }).match(/class="cal-d(?: is-pick)?(?: is-today)?"/g) || []).length === 29);
ok("non-leap February has 28", (summaryHtml(SUM, { year: 2026, month: 2, day: 2, time: "9:00" }).match(/class="cal-d(?: is-pick)?(?: is-today)?"/g) || []).length === 28);

// The current day, computed from the real device clock so the test still
// passes whenever it happens to run rather than only on the day it was
// written. A booked day distinct from today's, so is-pick and is-today are
// never accidentally testing the same cell.
const today = new Date();
const otherDay = today.getDate() === 1 ? 5 : 1;
const todayCal = summaryHtml(SUM, { year: today.getFullYear(), month: today.getMonth() + 1, day: otherDay, time: "9:00" });
ok("today is marked in its own month", new RegExp('class="cal-d is-today">' + today.getDate() + '<').test(todayCal));
ok("the booked day stays is-pick, not is-today", new RegExp('class="cal-d is-pick">' + otherDay + '<').test(todayCal));
ok("a calendar for a different month marks no day as today",
   !summaryHtml(SUM, { year: 2028, month: 2, day: 29, time: "9:00" }).includes("is-today"));

section("right rail");
const quote = { totalLabel: "Total", total: "€11,450", lines: ["Ten panels", "One battery"] };
const recap = { summary: SUM, brief: [], booking };

const live = railContentHtml({ done: false, recap: null, quote });
ok("the quote shows while the conversation is still running", live.includes("€11,450") && live.includes("Ten panels"));
ok("...under a page-level heading, since it is the whole rail", live.includes("<h2>The quote</h2>"));
ok("...and carries no recap yet", !live.includes("What just happened"));
ok("a scoping demo shows no rail at all mid-conversation", railContentHtml({ done: false, recap: null, quote: null }) === "");
ok("...so no empty aside is emitted", railAsideHtml({ done: false, recap: null, quote: null }, true) === "");

// The rail must not blank out and repopulate while the recap generates.
const wrapping = railContentHtml({ done: true, recap: null, quote });
ok("the quote stays put while the recap is still generating", wrapping.includes("€11,450"));
ok("...beneath the wrapping-up placeholder", wrapping.indexOf("Wrapping up") < wrapping.indexOf("€11,450"));

const done = railContentHtml({ done: true, recap, quote });
ok("the finished recap appears ABOVE the quote", done.indexOf("What just happened") < done.indexOf("The quote"));
ok("the quote is still there afterwards", done.includes("€11,450"));
ok("...demoted to a section heading", done.includes("<h3>The quote</h3>") && !done.includes("<h2>The quote</h2>"));
ok("the calendar rides along in the summary", done.includes('class="cal"'));
ok("a quote suppresses the empty-brief note", !done.includes("before a full brief"));
ok("no quote and no brief DOES show it", railContentHtml({ done: true, recap, quote: null }).includes("before a full brief"));
ok("a collected brief renders instead", railContentHtml({ done: true, recap: { ...recap, brief: [{ label: "Roof", value: "South facing" }] }, quote: null }).includes("South facing"));
ok("quote values are escaped", railContentHtml({ done: false, recap: null, quote: { total: "<b>x</b>", lines: [] } }).includes("&lt;b&gt;"));
ok("a quote with only a total still renders", railContentHtml({ done: false, recap: null, quote: { totalLabel: "Total", total: "€9,000", lines: [] } }).includes("€9,000"));

ok("the aside animates only when it first appears", railAsideHtml({ done: false, recap: null, quote }, true).includes('class="recap is-new"'));
ok("...and not on later renders", railAsideHtml({ done: false, recap: null, quote }, false).includes('class="recap"'));
ok("the live inline card is flagged as a lead-in", railInlineHtml({ done: false, recap: null, quote }, true).includes("recap-inline is-lead"));
ok("the finished inline card is not", !railInlineHtml({ done: true, recap, quote }).includes("is-lead"));

console.log(fails ? "\n" + fails + " FAILURE(S)\n" : "\nall green\n");
process.exit(fails ? 1 : 0);
