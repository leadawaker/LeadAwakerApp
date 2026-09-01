// The presenter panel: the ⋯ menu that only Gabriel sees on /demo/<token>.
//
// Reconfigures a running demo (name, company, language, disclosure, Client)
// and mints prospect links, without leaving the page.
//
// WHY THIS LIVES OUTSIDE `root`
// -----------------------------
// main.js repaints by assigning `root.innerHTML` on every poll that changes
// anything. Anything holding user input inside that tree is destroyed and
// rebuilt between one poll and the next, which is why the composer mirrors its
// textarea into a module-level `draft` and restores it on each render, and why
// recording suppresses rendering wholesale behind `needsRender`.
//
// Reproducing that bookkeeping for eight controls, each with its own value,
// focus and caret, would be most of this file and most of its bugs. So the
// panel is built once into document.body instead. render() cannot reach it,
// every input keeps its state for free, and a poll landing mid-edit cannot
// overwrite what is being typed. Only the ⋯ trigger lives in the header, and
// it is stateless, so it just re-binds per render like #bump already does.
//
// The gate is `state.admin`, set server-side from the CRM session
// (server/routes/demo.ts). A prospect never receives this module's markup at
// all, and every write re-checks the session on the server, so the flag decides
// rendering only and never authority.

import { esc } from "./format.js";

var ctx = null;         // { token, getState, reload, restart }
var el = null;          // the panel root, once built
var open = false;
var config = null;      // last known server config
var clients = null;     // the Client library, fetched once
var saving = 0;         // in-flight PATCH count, for the status line
var debounce = null;

var LANGS = [["en", "English"], ["nl", "Nederlands"], ["pt", "Português"]];
var DISCLOSURES = [
  ["", "Campaign default"],
  ["off", "Off"],
  ["opener", "In the opener"],
  ["second_message", "Second message"],
];
// The quote/no-quote axis, in the engine's own words rather than its jargon.
// "inquired" resolves to conversation_mode "scoping" (no quote panel) and
// "deciding" to "decision" (quote panel shows) — see resolve_conversation_mode.
// These are deliberately the same two labels the Restart popover offers, since
// they are the same switch: two names for it would read as two features.
var SCENARIOS = [["inquired", "Never got a quote"], ["deciding", "Already has a quote"]];
var MARKETS = [["", "Default"], ["uk", "UK (£)"], ["us", "US ($)"], ["nl", "NL (€)"]];

export function init(next) { ctx = next; }
export function isOpen() { return open; }

// ---- network ----------------------------------------------------------
// Deliberately NOT main.js's api(), which is bound to /api/web-demo/<token>
// (the engine proxy). These routes are Express's own and carry a CRM session.
function req(path, opts) {
  return fetch(path, Object.assign({ credentials: "same-origin" }, opts || {})).then(function (r) {
    return r.json().catch(function () { return {}; }).then(function (body) {
      if (!r.ok) throw new Error(body.message || "Request failed");
      return body;
    });
  });
}

function configUrl() { return "/api/demo/" + encodeURIComponent(ctx.token) + "/config"; }

/** Was this link minted for a named prospect? Public sessions cannot restart
 *  into the other scenario, and the engine enforces that on its own side. */
function invited() {
  var s = ctx.getState();
  return !!(s && s.invited);
}

// ---- markup -----------------------------------------------------------
function options(pairs, current) {
  return pairs
    .map(function (p) {
      return '<option value="' + esc(p[0]) + '"' + (p[0] === current ? " selected" : "") + ">" + esc(p[1]) + "</option>";
    })
    .join("");
}

function clientOptions(current) {
  var head = '<option value="">Campaign default</option>';
  if (!clients) return head + (current ? '<option value="' + esc(current) + '" selected>' + esc(current) + "</option>" : "");
  return (
    head +
    clients
      .map(function (c) {
        // The language badge is the same list create-link validates against,
        // so a Client that will be refused is visible before it is picked
        // rather than as a 409 afterwards.
        var langs = (c.languages || []).join("/").toUpperCase();
        var label = (c.emoji ? c.emoji + " " : "") + (c.label || c.niche) + (langs ? "  ·  " + langs : "");
        return '<option value="' + esc(c.niche) + '"' + (c.niche === current ? " selected" : "") + ">" + esc(label) + "</option>";
      })
      .join("")
  );
}

function fieldsHtml() {
  var c = config || {};
  var isEn = (c.language || "en") === "en";
  return (
    '<div class="ap-sec">Live · applies to this conversation</div>' +
    '<label class="ap-f"><span>Lead name</span>' +
      '<input id="ap-name" type="text" autocomplete="off" value="' + esc(c.firstName || "") + '" /></label>' +
    '<label class="ap-f"><span>Company</span>' +
      '<input id="ap-company" type="text" autocomplete="off" value="' + esc(c.companyName || "") + '" /></label>' +
    '<label class="ap-f"><span>Language</span>' +
      '<select id="ap-lang">' + options(LANGS, c.language || "en") + "</select></label>" +

    '<div class="ap-sec">Restarts the demo</div>' +
    '<label class="ap-f"><span>Client</span>' +
      '<select id="ap-client">' + clientOptions(c.clientNiche || "") + "</select></label>" +
    '<label class="ap-f"><span>AI disclosure</span>' +
      '<select id="ap-disc">' + options(DISCLOSURES, c.aiDisclosure || "") + "</select></label>" +
    // Only an invited link may switch scenario (the engine 403s a public
    // session), so the control is disabled rather than offered and refused.
    '<label class="ap-f"><span>Lead has a quote?</span>' +
      '<select id="ap-scen"' + (invited() ? "" : " disabled") + ">" +
      options(SCENARIOS, c.scenario || "inquired") + "</select></label>" +
    (invited() ? "" : '<div class="ap-note">Scenario switching needs an invited link.</div>') +

    '<div class="ap-sec">This session</div>' +
    '<div class="ap-row">' +
      '<button class="ap-btn" id="ap-copy">Copy link</button>' +
      '<button class="ap-btn" id="ap-wa">WhatsApp</button>' +
    "</div>" +

    '<div class="ap-sec">Send to a prospect</div>' +
    '<label class="ap-f"><span>Their name</span>' +
      '<input id="ap-gname" type="text" autocomplete="off" placeholder="required" value="' + esc(c.firstName || "") + '" /></label>' +
    '<label class="ap-f"><span>New niche</span>' +
      '<input id="ap-gniche" type="text" autocomplete="off" placeholder="optional · overrides Client" /></label>' +
    // Market only reaches create-link on an English link; nl and pt resolve
    // their own market inside generateNicheContext. Rendering it otherwise
    // would be a control that silently does nothing.
    (isEn
      ? '<label class="ap-f"><span>Market</span><select id="ap-market">' + options(MARKETS, c.market || "") + "</select></label>"
      : "") +
    '<button class="ap-btn ap-primary" id="ap-gen">Generate link</button>' +
    '<div class="ap-out" id="ap-out" hidden></div>'
  );
}

function build() {
  el = document.createElement("div");
  el.className = "admin-panel";
  el.id = "admin-panel";
  el.setAttribute("hidden", "");
  el.innerHTML =
    '<div class="ap-head"><span>Presenter</span>' +
      '<button class="ap-x" id="ap-close" aria-label="Close">×</button></div>' +
    '<div class="ap-body" id="ap-body"></div>' +
    '<div class="ap-status" id="ap-status"></div>';
  document.body.appendChild(el);

  el.addEventListener("click", function (e) { e.stopPropagation(); });
  document.getElementById("ap-close").addEventListener("click", function () { toggle(false); });
}

/**
 * Report a restart's real outcome rather than its intention.
 *
 * doRestart() resolves once the new conversation is on screen. Without waiting
 * on it the panel sits on "Restarting…" forever, which reads as a hang even
 * though the demo behind it restarted fine. Failures are already surfaced by
 * the page's own error handling, so this only has to stop lying.
 */
function settle(p, done) {
  if (!p || !p.then) { status(done); return; }
  p.then(function () { status(done); }, function () { status("Restart failed", true); });
}

function status(msg, bad) {
  var s = document.getElementById("ap-status");
  if (!s) return;
  s.textContent = msg || "";
  s.className = "ap-status" + (bad ? " is-bad" : "");
}

function paint() {
  var body = document.getElementById("ap-body");
  if (!body) return;
  body.innerHTML = fieldsHtml();
  bindFields();
}

// ---- writes -----------------------------------------------------------
// `repaint` is false for the debounced text fields, and that is not an
// optimisation: paint() rebuilds the body, so repainting 500ms after the last
// keystroke would replace the very input being typed into and drop the caret
// to the end mid-word. Only a change that alters the panel's SHAPE (the
// language, which shows or hides the market control) or its whole contents (a
// restart) is allowed to repaint.
function patch(payload, thenRestart, repaint) {
  saving++;
  status(thenRestart ? "Restarting…" : "Saving…");
  return req(configUrl(), {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(function (next) {
      config = next;
      saving--;
      if (thenRestart) {
        // The persona is on the lead now; restart replays the opener against
        // it. restart_demo() only merges two keys into demo_niche, so what was
        // just written survives.
        settle(ctx.restart(), "Restarted");
      } else {
        status("Saved");
        // Nudges the poll so the header pill and the AI's next reply pick the
        // change up without waiting out the idle interval.
        ctx.reload();
      }
      if (repaint) paint();
    })
    .catch(function (e) {
      saving--;
      status(e.message || "Could not save", true);
    });
}

function livePatch(payload) {
  clearTimeout(debounce);
  debounce = setTimeout(function () { patch(payload, false, false); }, 500);
}

function generate() {
  var name = (document.getElementById("ap-gname") || {}).value || "";
  if (!name.trim()) { status("A name is required", true); return; }
  var niche = ((document.getElementById("ap-gniche") || {}).value || "").trim();
  var marketEl = document.getElementById("ap-market");
  var c = config || {};

  var payload = {
    firstName: name.trim(),
    language: c.language || "en",
    campaignId: c.campaignId,
    scenario: c.scenario || "inquired",
  };
  if (!payload.campaignId) { status("This demo has no campaign", true); return; }
  // Free text beats the picker: typing a niche is an explicit request for a
  // new persona, and create-link ignores `niche` whenever `clientNiche` is set.
  if (niche) payload.niche = niche;
  else if (c.clientNiche) payload.clientNiche = c.clientNiche;
  if (c.companyName) payload.companyName = c.companyName;
  if (c.aiDisclosure) payload.aiDisclosure = c.aiDisclosure;
  if (marketEl && marketEl.value) payload.market = marketEl.value;

  status("Generating…");
  req("/api/demo/create-link", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  })
    .then(function (r) {
      var out = document.getElementById("ap-out");
      // `generated: false` means the model did not run and the link carries a
      // generic fallback persona. It looks identical to a good one, and sending
      // a prospect a generic demo believing it is theirs is the worst thing
      // this panel can do, so it is said out loud.
      var warn = r.generated === false
        ? '<div class="ap-warn">Fell back to a generic persona — the niche model did not run.</div>'
        : "";
      out.innerHTML =
        warn +
        linkRow("Browser", r.demoUrl) +
        linkRow("WhatsApp", r.whatsappUrl) +
        '<a class="ap-open" href="' + esc(r.demoUrl) + '" target="_blank" rel="noopener">Open it →</a>';
      out.removeAttribute("hidden");
      out.querySelectorAll("[data-copy]").forEach(function (b) {
        b.addEventListener("click", function () { copy(b.getAttribute("data-copy"), b); });
      });
      status(r.reused ? "Minted from " + r.reused : "Link ready");
    })
    .catch(function (e) { status(e.message || "Could not generate", true); });
}

function linkRow(label, url) {
  return (
    '<div class="ap-link"><span>' + esc(label) + "</span>" +
    '<input readonly value="' + esc(url) + '" />' +
    '<button class="ap-btn" data-copy="' + esc(url) + '">Copy</button></div>'
  );
}

function copy(text, btn) {
  var done = function () {
    if (!btn) return status("Copied");
    var was = btn.textContent;
    btn.textContent = "Copied";
    setTimeout(function () { btn.textContent = was; }, 1400);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done, function () { status("Copy failed", true); });
    return;
  }
  // execCommand path for a non-secure context or an old iOS Safari, where
  // navigator.clipboard is absent and the button would otherwise do nothing.
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.position = "fixed";
  ta.style.opacity = "0";
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand("copy"); done(); } catch (_) { status("Copy failed", true); }
  document.body.removeChild(ta);
}

function bindFields() {
  var name = document.getElementById("ap-name");
  var company = document.getElementById("ap-company");
  var lang = document.getElementById("ap-lang");
  var client = document.getElementById("ap-client");
  var disc = document.getElementById("ap-disc");
  var scen = document.getElementById("ap-scen");

  if (name) name.addEventListener("input", function () { livePatch({ firstName: name.value.trim() || "there" }); });
  if (company) company.addEventListener("input", function () { livePatch({ companyName: company.value }); });
  // Repaints: the market control only exists on an English link.
  if (lang) lang.addEventListener("change", function () { patch({ language: lang.value }, false, true); });

  // Both of these change what the conversation IS, so they confirm first. A
  // different Client is a different business; a disclosure only ever fires on
  // message one or two, so changing it mid-run would appear to do nothing.
  if (client) client.addEventListener("change", function () {
    if (!confirm("Switching Client restarts the demo. Continue?")) { paint(); return; }
    patch({ clientNiche: client.value || undefined, scenario: (scen && scen.value) || "inquired" }, true, true);
  });
  if (disc) disc.addEventListener("change", function () {
    if (!confirm("Changing disclosure restarts the demo. Continue?")) { paint(); return; }
    // disc.value is "" for "Campaign default", and that has to reach the
    // server as an explicit empty string, not get dropped: "" is what clears
    // a per-session override back to the campaign's own column. Sending
    // `undefined` here used to serialize away to `{}`, which the server
    // rejects as "Nothing to change." before it ever got applied.
    patch({ aiDisclosure: disc.value }, true, true);
  });
  // The quote/no-quote switch. It restarts through the engine's own scenario
  // path rather than writing demo_niche here: restart_demo() re-stages the
  // persona itself (_patch_demo_niche sets what_lead_did and lead_stage from
  // its per-language table), so writing those keys from here would be a second,
  // drifting copy of that logic. Exactly what the Restart popover's two buttons
  // do, reachable without leaving the panel.
  if (scen) scen.addEventListener("change", function () {
    if (config) config.scenario = scen.value;
    if (!invited()) return;
    if (!confirm("Switching the quote scenario restarts the demo. Continue?")) { paint(); return; }
    status("Restarting…");
    settle(ctx.restart(scen.value), scen.value === "deciding" ? "Now: already has a quote" : "Now: never got a quote");
  });

  var copyBtn = document.getElementById("ap-copy");
  if (copyBtn) copyBtn.addEventListener("click", function () { copy(location.href, copyBtn); });
  var wa = document.getElementById("ap-wa");
  if (wa) wa.addEventListener("click", function () {
    var s = ctx.getState();
    if (s && s.waLink) window.open(s.waLink, "_blank", "noopener");
    else status("No WhatsApp link on this session", true);
  });
  var gen = document.getElementById("ap-gen");
  if (gen) gen.addEventListener("click", generate);
}

// ---- open / close -----------------------------------------------------
export function toggle(next) {
  open = next === undefined ? !open : !!next;
  if (open && !el) build();
  if (!el) return;
  if (open) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");

  var btn = document.getElementById("admin-toggle");
  if (btn) btn.setAttribute("aria-expanded", open ? "true" : "false");
  if (!open) return;

  // Read on open, never continuously: a poll landing mid-edit must not
  // overwrite a field being typed into.
  status("");
  paint();
  req(configUrl())
    .then(function (c) {
      config = c;
      paint();
      if (clients) return null;
      return req("/api/demo/clients").then(function (r) {
        clients = r.clients || [];
        paint();
      });
    })
    .catch(function (e) { status(e.message || "Could not load", true); });
}

/** Called from wire() on every render, since the trigger lives in the header. */
export function bindTrigger() {
  var btn = document.getElementById("admin-toggle");
  if (!btn) return;
  btn.setAttribute("aria-expanded", open ? "true" : "false");
  btn.addEventListener("click", function (e) { e.stopPropagation(); toggle(); });
}

document.addEventListener("click", function () { if (open) toggle(false); });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape" && open) {
    toggle(false);
    var btn = document.getElementById("admin-toggle");
    if (btn) btn.focus();
  }
});
