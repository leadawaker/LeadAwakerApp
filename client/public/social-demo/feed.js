// client/public/social-demo/feed.js
import { STATIC_POSTS, tr } from "./copy.js";

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}

const ICON = {
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  comment: '<path d="M20 12a8 8 0 1 1-3.3-6.5A8 8 0 0 1 20 12zM20 20l-3.3-1.5"/>',
  send: '<path d="M21 3 10 14M21 3l-7 18-4-7-7-4z"/>',
  save: '<path d="M6 3h12v18l-6-5-6 5z"/>',
  square: '<rect x="4" y="4" width="16" height="16" rx="4"/>',
};
export function svg(name, size = 24) {
  return `<svg class="ig-ico" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[name]}</svg>`;
}

function actions() {
  return `<div class="ig-actions"><span>${svg("heart")}${svg("comment")}${svg("send")}</span>${svg("save")}</div>`;
}

function staticPost(lang, p) {
  return `<article class="ig-post">
    <header class="ig-phdr"><span class="ig-avatar ig-avatar--letter">${esc(p.avatarLetter)}</span>
      <span class="ig-handle">${esc(p.handle)}</span><span class="ig-more">•••</span></header>
    <img class="ig-media" src="${esc(p.image)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'" />
    ${actions()}
    <div class="ig-likes">${esc(tr(lang, "likes", { n: p.likes.toLocaleString(lang) }))}</div>
    <p class="ig-caption"><b>${esc(p.handle)}</b> ${esc(p.caption)}</p>
    <div class="ig-add-comment is-static">${esc(tr(lang, "addComment"))}</div>
  </article>`;
}

function demoPost({ lang, post, imageUrl, company, comments, hint }) {
  const media = imageUrl
    ? `<img class="ig-media" src="${esc(imageUrl)}" alt="" onerror="this.style.visibility='hidden'" />`
    : `<div class="ig-media ig-media--placeholder"><span>${esc(company || post.handle)}</span></div>`;
  const list = comments.map((c) => `<p class="ig-comment"><b>${esc(c.author)}</b> ${esc(c.text)}</p>`).join("");
  return `<article class="ig-post ig-post--demo" id="ig-demo-post">
    <header class="ig-phdr"><span class="ig-avatar ig-avatar--ring">${esc((company || post.handle).slice(0, 1).toUpperCase())}</span>
      <span class="ig-handle">${esc(post.handle)}<small>${esc(tr(lang, "sponsored"))}</small></span><span class="ig-more">•••</span></header>
    ${media}
    ${actions()}
    <div class="ig-likes">${esc(tr(lang, "likes", { n: Number(post.likes).toLocaleString(lang) }))}</div>
    <p class="ig-caption"><b>${esc(post.handle)}</b> ${esc(post.caption)}</p>
    <div class="ig-cta">${esc(post.cta_line)}</div>
    ${list}
    ${hint ? `<p class="ig-hint">${esc(tr(lang, "noMatch", { kw: post.keyword }))}</p>` : ""}
    <form class="ig-comment-form" id="ig-comment-form" autocomplete="off">
      <span class="ig-avatar ig-avatar--me"></span>
      <input id="ig-comment" name="c" maxlength="200" placeholder="${esc(tr(lang, "commentHint", { kw: post.keyword }))}" />
      <button type="submit" class="ig-pbtn">${esc(tr(lang, "post"))}</button>
    </form>
  </article>`;
}

export function feedHtml(opts) {
  const [before, after] = STATIC_POSTS[opts.lang] || STATIC_POSTS.en;
  return `<div class="ig-feed">
    <header class="ig-topbar"><span class="ig-wordmark">Instagram</span><span class="ig-topbar-icons">${svg("square")}${svg("square")}</span></header>
    <div class="ig-scroll-pill" id="ig-scroll-pill">↓ ${esc(tr(opts.lang, "scrollHint"))}</div>
    ${staticPost(opts.lang, before)}
    ${opts.post ? demoPost(opts) : ""}
    ${staticPost(opts.lang, after)}
    <nav class="ig-tabbar">${svg("square")}${svg("square")}${svg("square")}${svg("square")}<span class="ig-avatar ig-avatar--me"></span></nav>
    <div class="ig-demo-by">${esc(tr(opts.lang, "demoBy"))}</div>
  </div>`;
}

/** The page for a link past the engine's token lifetime: Instagram chrome, one message. */
export function expiredHtml(lang) {
  return `<div class="ig-feed">
    <header class="ig-topbar"><span class="ig-wordmark">Instagram</span><span class="ig-topbar-icons">${svg("square")}${svg("square")}</span></header>
    <div class="ig-expired" role="status">
      <h1>${esc(tr(lang, "expiredTitle"))}</h1>
      <p>${esc(tr(lang, "expiredBody"))}</p>
    </div>
    <div class="ig-demo-by">${esc(tr(lang, "demoBy"))}</div>
  </div>`;
}
