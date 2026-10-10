import { readFile, writeFile, readdir } from "node:fs/promises";
import path from "node:path";
import { transformSync } from "esbuild";

// Search and AI-answer plumbing for the pages in client/public/site/, applied
// to the BUILT copies in dist/public/site/ by vercel.json's buildCommand (after
// build-premium, before index.html is copied to the root). The sources stay as
// they are written by hand and by the language builds; this adds what is
// derived from them:
//
//   1. Structured data (JSON-LD) on the three homepages: who Lead Awaker is,
//      the receptionist service, and the FAQ. The FAQ block is read from the
//      page's own #faq section, so it can never disagree with the visible
//      answers (a mismatch is a structured-data violation for Google, and the
//      homepage is edited by hand often).
//   2. Minified inline CSS and JS on every page in the directory. The homepage
//      carries about 260 KB of both.
//
// Run by hand against any directory to check a change:
//   npx tsx script/build-site.ts /tmp/copy-of-site

const SITE_DIR = path.resolve(process.argv[2] || "dist/public/site");
const ORIGIN = "https://www.leadawaker.com";
const ORG_ID = `${ORIGIN}/#organization`;
const WEBSITE_ID = `${ORIGIN}/#website`;

// The homepages that get structured data. `service` is the name of the service
// in that page's language; title, description and canonical URL are read from
// the page's own <head>.
const HOMEPAGES: Record<string, { service: string }> = {
  "index.html": { service: "AI receptionist" },
  "nl.html": { service: "AI-receptioniste" },
  "pt.html": { service: "Recepcionista com IA" },
};

// Facts about the company. Same address and coordinates as the structured data
// on /reactivate (client/public/premium/index.html): keep the two in step.
const ORGANIZATION = {
  "@type": "ProfessionalService",
  "@id": ORG_ID,
  name: "Lead Awaker",
  alternateName: "LeadAwaker",
  url: `${ORIGIN}/`,
  logo: `${ORIGIN}/icon-512.png`,
  email: "admin@leadawaker.com",
  founder: {
    "@type": "Person",
    name: "Gabriel Fronza",
    jobTitle: "Founder",
    sameAs: ["https://www.linkedin.com/in/gabriel-barbosa-fronza-47085766/"],
  },
  address: {
    "@type": "PostalAddress",
    streetAddress: "Christiaan Huygensweg 32",
    postalCode: "5223 BH",
    addressLocality: "'s-Hertogenbosch",
    addressCountry: "NL",
  },
  geo: { "@type": "GeoCoordinates", latitude: 51.691872, longitude: 5.2869323 },
  identifier: { "@type": "PropertyValue", propertyID: "KvK", value: "99366738" },
  knowsLanguage: ["en", "nl", "pt-BR"],
};

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " };

// Visible text of an HTML fragment: tags out, entities decoded, whitespace collapsed.
function textOf(fragment: string): string {
  return fragment
    .replace(/<[^>]+>/g, " ")
    .replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, code: string) => {
      if (code[0] !== "#") return ENTITIES[code.toLowerCase()] ?? whole;
      const point = code[1].toLowerCase() === "x" ? parseInt(code.slice(2), 16) : parseInt(code.slice(1), 10);
      return Number.isFinite(point) ? String.fromCodePoint(point) : whole;
    })
    .replace(/\s+/g, " ")
    .trim();
}

function required(html: string, re: RegExp, label: string, file: string): string {
  const match = html.match(re);
  if (!match) throw new Error(`build-site: ${file} has no ${label}; the markup may have changed`);
  return textOf(match[1]);
}

function readFaq(html: string, file: string): { question: string; answer: string }[] {
  const section = html.match(/<section[^>]*\bid="faq"[^>]*>([\s\S]*?)<\/section>/);
  if (!section) throw new Error(`build-site: ${file} has no <section id="faq">; the markup may have changed`);
  const faq = [...section[1].matchAll(/<details[^>]*>\s*<summary[^>]*>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)]
    .map((m) => ({ question: textOf(m[1]), answer: textOf(m[2]) }))
    .filter((item) => item.question && item.answer);
  if (faq.length === 0) throw new Error(`build-site: found no questions in the #faq section of ${file}`);
  return faq;
}

function structuredData(html: string, file: string): string {
  const lang = required(html, /<html[^>]*\blang="([^"]+)"/, "lang attribute on <html>", file);
  const url = required(html, /<link rel="canonical" href="([^"]+)"/, "canonical link", file);
  const title = required(html, /<title>([\s\S]*?)<\/title>/, "<title>", file);
  const description = required(html, /<meta name="description" content="([^"]*)"/, "meta description", file);
  const image = required(html, /<meta property="og:image" content="([^"]+)"/, "og:image", file);
  const faq = readFaq(html, file);
  const serviceId = `${url}#service`;

  const graph = [
    { ...ORGANIZATION, description, image },
    {
      "@type": "WebSite",
      "@id": WEBSITE_ID,
      url: `${ORIGIN}/`,
      name: "Lead Awaker",
      publisher: { "@id": ORG_ID },
      inLanguage: ["en", "nl", "pt-BR"],
    },
    {
      "@type": "WebPage",
      "@id": `${url}#webpage`,
      url,
      name: title,
      description,
      inLanguage: lang,
      isPartOf: { "@id": WEBSITE_ID },
      about: { "@id": serviceId },
      primaryImageOfPage: image,
    },
    {
      "@type": "Service",
      "@id": serviceId,
      name: HOMEPAGES[file].service,
      serviceType: "AI receptionist",
      description,
      url,
      provider: { "@id": ORG_ID },
      availableLanguage: ["English", "Dutch", "Portuguese"],
    },
    {
      "@type": "FAQPage",
      "@id": `${url}#faq`,
      inLanguage: lang,
      mainEntity: faq.map(({ question, answer }) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer },
      })),
    },
  ];
  // "<" is escaped so no answer text can close the <script> element early.
  const json = JSON.stringify({ "@context": "https://schema.org", "@graph": graph }).replace(/</g, "\\u003c");
  console.log(`build-site: ${file}: structured data with ${faq.length} FAQ questions (${lang}, ${url})`);
  return `<script type="application/ld+json" id="site-ld">${json}</script>`;
}

function addStructuredData(html: string, file: string): string {
  const tag = structuredData(html, file);
  const existing = /<script type="application\/ld\+json" id="site-ld">[\s\S]*?<\/script>\n?/;
  const without = html.replace(existing, "");
  if (!without.includes("</head>")) throw new Error(`build-site: ${file} has no </head>`);
  return without.replace("</head>", () => `${tag}\n</head>`);
}

// Minifies inline <style> and classic inline <script> blocks. A block esbuild
// cannot parse is shipped as written, with a warning: this step only makes the
// page lighter, so it must never be the reason a deploy fails or a page breaks.
// esbuild leaves top-level names alone when it is given no output format, so a
// function one inline script declares is still there for the next one.
function minifyInline(html: string, file: string): string {
  const shrink = (code: string, loader: "css" | "js", what: string): string => {
    if (!code.trim()) return code;
    try {
      return transformSync(code, { loader, minify: true, charset: "utf8", legalComments: "none", logLevel: "silent" }).code.trim();
    } catch (err) {
      const reason = err instanceof Error ? err.message.split("\n")[0] : String(err);
      console.warn(`build-site: WARNING ${file}: left ${what} unminified (${reason})`);
      return code;
    }
  };

  let styles = 0;
  let scripts = 0;
  let out = html.replace(/(<style(?:\s[^>]*)?>)([\s\S]*?)(<\/style>)/g, (_whole, open: string, css: string, close: string) => {
    styles += 1;
    return open + shrink(css, "css", `<style> block ${styles}`) + close;
  });
  out = out.replace(/(<script(\s[^>]*)?>)([\s\S]*?)(<\/script>)/g, (whole, open: string, attrs = "", body: string, close: string) => {
    if (/\bsrc=/.test(attrs)) return whole;
    const type = attrs.match(/\btype="([^"]*)"/)?.[1];
    if (type === "application/json") {
      // Data for the page's own scripts. Re-serialised without spaces; "</" is
      // escaped so a string in the data cannot close the element.
      try {
        return open + JSON.stringify(JSON.parse(body)).replace(/<\//g, "<\\/") + close;
      } catch {
        return whole;
      }
    }
    if (type && type !== "text/javascript") return whole;
    scripts += 1;
    return open + shrink(body, "js", `inline <script> ${scripts}`) + close;
  });
  const saved = Buffer.byteLength(html) - Buffer.byteLength(out);
  console.log(`build-site: ${file}: minified ${styles} style and ${scripts} script blocks, ${(saved / 1024).toFixed(1)} KB smaller`);
  return out;
}

async function main() {
  const files = (await readdir(SITE_DIR)).filter((name) => name.endsWith(".html"));
  for (const file of Object.keys(HOMEPAGES)) {
    if (!files.includes(file)) throw new Error(`build-site: ${path.join(SITE_DIR, file)} is missing`);
  }
  for (const file of files) {
    const filePath = path.join(SITE_DIR, file);
    let html = await readFile(filePath, "utf-8");
    if (file in HOMEPAGES) html = addStructuredData(html, file);
    html = minifyInline(html, file);
    await writeFile(filePath, html);
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
