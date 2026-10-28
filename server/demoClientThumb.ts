// The two images the Demos persona list can show beside a persona: its logo,
// else its website screenshot. Both are content-addressed .webp files served by
// GET /api/site-shot/:file, which 404s any other name, so a name that does not
// have that shape is dropped here rather than rendered as a broken image.
// Pure on purpose (no db import), so node:test runs it without a database; the
// pattern is the one the serve route and clientLogo.ts use.
const FILE_RE = /^[a-f0-9]{16}\.webp$/;

export interface ClientThumbFiles {
  /** The logo file, only while the Client's logo switch is on. */
  logo: string | null;
  /** The homepage screenshot file (also what the editor's "Website image" shows). */
  screenshot: string | null;
}

export function clientThumbFiles(row: {
  logoPath?: string | null;
  logoEnabled?: boolean | null;
  screenshotPath?: string | null;
}): ClientThumbFiles {
  const ok = (f: string | null | undefined): f is string => typeof f === "string" && FILE_RE.test(f);
  return {
    // `=== false`, like logoUrlFor: a missing switch reads as on.
    logo: row.logoEnabled !== false && ok(row.logoPath) ? row.logoPath : null,
    screenshot: ok(row.screenshotPath) ? row.screenshotPath : null,
  };
}
