// Client logo for the Instagram and Reputation demos: the business's own logo,
// fetched from its website or uploaded on the Demos page, shown in place of the
// initials circle. logo_path is a content-addressed .webp in uploads/site-shots
// (same convention as screenshot_path); logo_source is "site" or "upload";
// logo_enabled switches it off for every demo of that Client at once.
// Run: node --env-file=.env scripts/migrations/2026-09-client-logo.js
import pg from "pg";
const { Client } = pg;

const c = new Client({ connectionString: process.env.DATABASE_URL });
await c.connect();
await c.query(`
  alter table p2mxx34fvbf3ll6."Niche_Vocabulary"
    add column if not exists logo_path text,
    add column if not exists logo_source text,
    add column if not exists logo_enabled boolean not null default true
`);
console.log("Niche_Vocabulary: logo_path, logo_source, logo_enabled ready");
await c.end();
