// client/public/social-demo/dm.js
import { INBOX, tr } from "./copy.js";
import { esc, svg } from "./feed.js";
import { messagesHtml } from "/premium/demo/chat.js";
import { trackerHtml, isDnc } from "/premium/demo/tracker.js";
import { railInlineHtml } from "/premium/demo/recap.js";

function inboxHtml({ lang, company, handle, lastText }) {
  const rows = (INBOX[lang] || INBOX.en).map((r) => `<li class="ig-row">
      <img class="ig-row-av" src="${esc(r.avatar)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
      <span class="ig-row-txt"><b class="${r.unread ? "is-unread" : ""}">${esc(r.name)}</b>
        <small>${esc(r.snippet)} · ${esc(r.time)}</small></span>
      ${r.unread ? '<span class="ig-dot"></span>' : ""}
    </li>`).join("");
  return `<aside class="ig-inbox">
    <header class="ig-inbox-hdr"><b>${esc(tr(lang, "direct"))}</b></header>
    <div class="ig-tabs"><span class="is-on">${esc(tr(lang, "primary"))}</span><span>${esc(tr(lang, "general"))}</span><span class="ig-req">${esc(tr(lang, "requests"))}</span></div>
    <ul>
      <li class="ig-row is-active" id="ig-open-thread">
        <span class="ig-row-av ig-avatar--ring">${esc((company || handle).slice(0, 1).toUpperCase())}</span>
        <span class="ig-row-txt"><b>${esc(company || handle)}</b><small>${esc(lastText || "")}</small></span>
      </li>
      ${rows}
    </ul>
  </aside>`;
}

function threadHtml({ lang, company, handle, state, pending, recap, admin, wide }) {
  const railOpts = { done: state.done, recap, quote: state.quote };
  return `<section class="ig-thread">
    <header class="ig-thread-hdr">
      ${wide ? "" : `<button class="ig-back" id="ig-back" aria-label="${esc(tr(lang, "back"))}">‹</button>`}
      <span class="ig-avatar ig-avatar--ring">${esc((company || handle).slice(0, 1).toUpperCase())}</span>
      <span class="ig-thread-name"><b>${esc(company || handle)}</b><small>@${esc(handle)} · ${esc(tr(lang, "activeNow"))}</small></span>
      ${admin ? `<button class="admin-toggle" id="admin-toggle" aria-label="Presenter settings" aria-haspopup="dialog" aria-expanded="false">•••</button>` : ""}
    </header>
    <div class="ig-tracker">${trackerHtml(state.stage, isDnc(state))}</div>
    <div class="ig-stream stream" id="stream">
      <div class="ig-day">${esc(tr(lang, "today"))}</div>
      ${!state.done ? railInlineHtml(railOpts, true) : ""}
      ${messagesHtml(state, pending, {}, {})}
      ${state.done ? railInlineHtml(railOpts) : ""}
    </div>
    <form class="ig-composer" id="ig-composer" autocomplete="off">
      <input id="msg" maxlength="1000" placeholder="${esc(tr(lang, "message"))}" ${state.done ? "disabled" : ""} />
      <button type="submit" id="send" aria-label="Send">${svg("send", 20)}</button>
    </form>
  </section>`;
}

export function dmHtml(opts) {
  const last = opts.state && opts.state.messages.length ? opts.state.messages[opts.state.messages.length - 1].text : "";
  const list = inboxHtml({ ...opts, lastText: last });
  if (opts.wide) return `<div class="ig-dm is-wide">${list}${threadHtml(opts)}</div>`;
  return `<div class="ig-dm">${opts.showList ? list : threadHtml(opts)}</div>`;
}
