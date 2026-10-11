// The contact form: a small card under the message in which the assistant asks
// who she is talking to (the engine marks that message `form: "contact"`).
// Name, plus a phone number or an email address. The visitor can ignore it and
// type in the chat instead; either way the details end up on their contact.
//
// Split from widget.js so that file stays about rendering and polling. It owns
// the card's markup, its field values (the thread is rebuilt on every repaint,
// so the DOM cannot hold them) and its validation. Sending is widget.js's job.

import { esc } from "/premium/demo/format.js";
import { w } from "./copy.js";

var CHECK_SVG = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5"/></svg>';

var FIELDS = [
  { key: "name", type: "text", auto: "name", mode: "text" },
  { key: "phone", type: "tel", auto: "tel", mode: "tel" },
  { key: "email", type: "email", auto: "email", mode: "email" },
];
var ERRORS = { name: "contactErrName", reach: "contactErrReach", phone: "contactErrPhone", email: "contactErrEmail", send: "contactFailed" };

var values = { name: "", phone: "", email: "" };
var error = "";      // a key of ERRORS, or ""
var sent = {};       // message id -> true: that card is now its one-line summary
var focused = null;  // { key, start, end } while a field has the caret

function label(key) {
  return w("contact" + key.charAt(0).toUpperCase() + key.slice(1));
}

/** What the visitor has to fix, or "" when the details can be sent. */
function problem() {
  var phone = values.phone.trim(), email = values.email.trim();
  if (!/[^\s\d]/.test(values.name)) return "name";
  if (!phone && !email) return "reach";
  if (phone && (!/^[+\d\s().-]+$/.test(phone) || phone.replace(/\D/g, "").length < 8)) return "phone";
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return "email";
  return "";
}

/** The message that carries the card: the newest one asking for details. */
function anchor(msgs) {
  for (var i = msgs.length - 1; i >= 0; i--) if (msgs[i].form === "contact") return i;
  return -1;
}

function cardHtml(disabled) {
  var out = '<form class="wdg-cf" novalidate>';
  for (var i = 0; i < FIELDS.length; i++) {
    var f = FIELDS[i];
    out += '<label class="wdg-cf-row"><span>' + esc(label(f.key)) + "</span>" +
      '<input class="wdg-cf-in" data-cf="' + f.key + '" name="' + f.auto + '" type="' + f.type +
      '" inputmode="' + f.mode + '" autocomplete="' + f.auto + '" maxlength="' + (f.key === "email" ? 160 : f.key === "phone" ? 40 : 80) +
      '"' + (f.key === "name" ? ' required aria-required="true"' : "") + ' value="' + esc(values[f.key]) + '" /></label>';
  }
  return out +
    '<p class="wdg-cf-hint">' + esc(w("contactHint")) + "</p>" +
    (error ? '<div class="wdg-notice wdg-cf-err" role="alert">' + esc(w(ERRORS[error] || ERRORS.send)) + "</div>" : "") +
    '<button type="submit" class="wdg-cbtn is-go"' + (disabled ? " disabled" : "") + ">" + esc(w("contactSend")) + "</button>" +
    "</form>";
}

/** Call before the thread is rebuilt. True when the caret is in the card, so
 *  the caller leaves the focus alone and mount() can put it back. */
export function remember() {
  var el = document.activeElement;
  var key = el && el.getAttribute && el.getAttribute("data-cf");
  focused = key ? { key: key, start: el.selectionStart, end: el.selectionEnd } : null;
  return !!focused;
}

/**
 * Draw the card (or its summary) into the freshly painted thread.
 * `opts.submit(contact)` sends `{ id, text, data: { name, phone, email } }`.
 */
export function mount(root, msgs, opts) {
  var at = anchor(msgs);
  if (at < 0) return;
  var rows = root.querySelectorAll("#stream > .row");
  if (!rows[at]) return;
  var id = msgs[at].id;
  if (sent[id]) {
    rows[at].insertAdjacentHTML("afterend",
      '<div class="wdg-cf-done">' + CHECK_SVG + "<span>" + esc(w("contactSent")) + "</span></div>");
    return;
  }
  // They answered in the chat instead, or the conversation is over: the card
  // has had its turn.
  for (var i = at + 1; i < msgs.length; i++) if (msgs[i].role === "visitor") return;
  if (opts.done) return;

  rows[at].insertAdjacentHTML("afterend", cardHtml(opts.busy));
  var form = root.querySelector(".wdg-cf");
  var inputs = form.querySelectorAll("[data-cf]");
  for (var n = 0; n < inputs.length; n++) {
    inputs[n].addEventListener("input", function (e) {
      values[e.target.getAttribute("data-cf")] = e.target.value;
    });
    if (focused && focused.key === inputs[n].getAttribute("data-cf")) {
      inputs[n].focus();
      // type=email has no selection API; the caret then lands at the end.
      try { inputs[n].setSelectionRange(focused.start, focused.end); } catch (e) {}
    }
  }
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (opts.busy) return;
    error = problem();
    if (error) { opts.repaint(); return; }
    var data = { name: values.name.trim().replace(/\s+/g, " "), phone: values.phone.trim(), email: values.email.trim() };
    sent[id] = true;
    focused = null;
    opts.submit({ id: id, data: data, text: [data.name, data.phone, data.email].filter(Boolean).join(", ") });
  });
}

/** The send did not go through: open the card again and say what to fix. */
export function failed(id, field) {
  delete sent[id];
  error = ERRORS[field] ? field : "send";
}
