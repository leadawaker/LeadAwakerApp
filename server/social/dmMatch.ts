// Comment-to-DM: keyword matching, opt-out words and the first-message template. Pure.
// Matching follows the Socials demo (client/public/social-demo/keyword.js): case and accents ignored,
// punctuation ignored, the keyword as a whole word anywhere in the comment. "kozijn!" matches KOZIJN,
// "roof please" matches ROOF, "roofing" does not. Digits count as letters here (live keywords may have them).

export function normalizeWord(s: string): string {
  return String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase();
}

/** The keyword as stored for matching: letters and digits only, upper case, no accents. Empty when unusable. */
export function keywordNorm(keyword: string): string {
  return normalizeWord(keyword).replace(/[^A-Z0-9]/g, "");
}

export function words(text: string): string[] {
  return normalizeWord(text).split(/[^A-Z0-9]+/).filter(Boolean);
}

export function matchesKeyword(comment: string, keyword: string): boolean {
  const kw = keywordNorm(keyword);
  return !!kw && words(comment).includes(kw);
}

/** A DM that is one of these words (alone, any case, any punctuation) stops all automated messages to that person. */
export const STOP_WORDS = ["PARAR", "PARE", "STOP", "SAIR", "STOPPEN", "UNSUBSCRIBE"] as const;

export function isStopMessage(text: string): boolean {
  const w = words(text);
  return w.length > 0 && w.length <= 2 && w.some((x) => (STOP_WORDS as readonly string[]).includes(x));
}

/** {username} and {first_name} in the first-message template. Unknown placeholders are left out. */
export function renderFirstMessage(template: string, vars: { username?: string | null }): string {
  const username = (vars.username ?? "").trim();
  return template
    .replace(/\{(\w+)\}/g, (_m, k: string) => (k === "username" ? (username ? `@${username}` : "") : k === "first_name" ? username : ""))
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const DM_TEXT_MAX = 1000;
export const KEYWORD_MAX = 30;
