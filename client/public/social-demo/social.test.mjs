// client/public/social-demo/social.test.mjs
import { matchesKeyword } from "./keyword.js";
import { COPY, STATIC_POSTS, INBOX } from "./copy.js";
import { feedHtml } from "./feed.js";

let failed = 0;
function ok(label, cond) { console.log((cond ? "  ok  " : "  FAIL ") + label); if (!cond) failed++; }

console.log("keyword (Review Focus 1)");
ok("exact", matchesKeyword("ROOF", "ROOF"));
ok("lower case", matchesKeyword("roof", "ROOF"));
ok("trailing punctuation", matchesKeyword("Roof!!", "ROOF"));
ok("inside a sentence", matchesKeyword("roof please 🙏", "ROOF"));
ok("accents", matchesKeyword("telhádo", "TELHADO"));
ok("keyword typed with accent vs plain", matchesKeyword("telhado", "TELHÁDO"));
ok("not a prefix of another word", !matchesKeyword("roofing", "ROOF"));
ok("wrong word", !matchesKeyword("hello", "ROOF"));
ok("empty", !matchesKeyword("", "ROOF"));

console.log("copy");
const keys = Object.keys(COPY.en);
for (const l of ["nl", "pt"]) {
  ok(`${l} has every key`, keys.every((k) => typeof COPY[l][k] === "string" && COPY[l][k].length > 0));
  ok(`${l} two static posts`, STATIC_POSTS[l].length === 2);
  ok(`${l} eight inbox rows`, INBOX[l].length === 8);
}
ok("pt is Brazilian (no 'equipa'/'contacto')", !/equipa|contacto|pequeno-almoço/.test(JSON.stringify([COPY.pt, STATIC_POSTS.pt, INBOX.pt])));
ok("no em dashes in copy", !/\u2014/.test(JSON.stringify([COPY, STATIC_POSTS, INBOX])));

console.log("feed");
const post = { handle: "dakwerk", caption: "<img src=x onerror=alert(1)>", keyword: "DAK", cta_line: "Reageer DAK", offer: "o", likes: 412 };
const html = feedHtml({ lang: "nl", post, imageUrl: "", company: "Dakwerk", comments: [], hint: false });
ok("caption is escaped", !html.includes("<img src=x"));
ok("three posts", (html.match(/class="ig-post/g) || []).length === 3);
ok("only one live comment input", (html.match(/id="ig-comment"/g) || []).length === 1);
ok("placeholder image when none", html.includes("ig-media--placeholder"));
ok("Dutch chrome", html.includes(COPY.nl.sponsored));

if (failed) { console.log(`\n${failed} failed`); process.exit(1); }
console.log("\nall passed");
