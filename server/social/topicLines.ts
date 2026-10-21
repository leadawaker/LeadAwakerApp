// Topic ideas arrive as one text box: one idea per line. This turns that text into the list of ideas.
// Only newlines split (a spoken transcript with several sentences on one line stays one idea).

export const TOPIC_LINE_MAX = 500;
export const TOPICS_PER_SUBMIT = 50;
/** A single line keeps today's limit; the raw text of a batch may be longer than that. */
export const TOPIC_BATCH_RAW_MAX = 30_000;

/** "- x", "* x", "• x", "1. x", "1) x": a bullet or number followed by a space (or nothing: an empty bullet). */
const BULLET = /^(?:[-*•–]|\d{1,3}[.)])(?:\s+|$)/;

function clamp(line: string, max: number): string {
  if (line.length <= max) return line;
  const cut = line.slice(0, max - 1);
  const space = cut.lastIndexOf(" ");
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).trimEnd()}…`;
}

/** The ideas in the text, in order: trimmed, bullets removed, blank lines dropped, long lines cut, at most 50. */
export function splitTopicLines(raw: string): string[] {
  const lines = raw
    .replace(/\r\n?/g, "\n")
    .split("\n")
    .map((l) => l.trim().replace(BULLET, "").trim())
    .filter(Boolean);
  const multi = lines.length > 1;
  return lines.slice(0, TOPICS_PER_SUBMIT).map((l) => (multi ? clamp(l, TOPIC_LINE_MAX) : l));
}
