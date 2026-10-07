/**
 * Presenting mode: hide who called without breaking the layout. Pure and total,
 * so it can run at the render edge on whatever the API sends (null, a label
 * such as "web", a foreign or truncated number, a one-word name).
 */

const DOT = "•••";
/** Digits kept visible at the front (country code) and one after it. */
const HEAD_DIGITS = 2;
/** Digits kept visible at the end. */
const TAIL_DIGITS = 2;
/** The long form must hide at least this many digits, otherwise it barely masks. */
const MIN_HIDDEN = 4;
const LONG_FORM_MIN_DIGITS = HEAD_DIGITS + 1 + MIN_HIDDEN + TAIL_DIGITS;

const PHONE_LIKE = /^\+?[\d\s().-]+$/;

export function maskNumber(raw: string | null | undefined): string | null {
  const value = (raw ?? "").trim();
  if (!value) return null;
  // A label such as "web" is not an identity: leave it.
  if (!/\d/.test(value)) return value;
  // Mixed text with digits (a channel identifier, say): reveal nothing but the tail.
  const digits = value.replace(/\D/g, "");
  if (!PHONE_LIKE.test(value)) return DOT;
  if (digits.length < LONG_FORM_MIN_DIGITS) {
    return digits.length > TAIL_DIGITS + 1 ? `${DOT} ${digits.slice(-TAIL_DIGITS)}` : DOT;
  }
  const plus = value.startsWith("+") ? "+" : "";
  const head = digits.slice(0, HEAD_DIGITS);
  const next = digits.charAt(HEAD_DIGITS);
  const tail = digits.slice(-TAIL_DIGITS);
  return `${plus}${head} ${next} ${DOT} ${DOT} ${tail}`;
}

export function maskName(raw: string | null | undefined): string | null {
  const words = (raw ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return null;
  // One word is the whole identity ("Gabriel"): keep only its initial.
  if (words.length === 1) return `${words[0].charAt(0).toUpperCase()}.`;
  const last = words[words.length - 1];
  return `${words[0]} ${last.charAt(0).toUpperCase()}.`;
}

/** A run of digits long enough to be a phone number, with its usual separators. */
const SPOKEN_NUMBER = /\+?\d[\d\s().-]{6,}\d/g;
const MIN_SPOKEN_DIGITS = 8;
/** Shorter name words ("de", "van") are too common to replace in running text. */
const MIN_NAME_WORD = 3;

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function wholeWord(word: string): RegExp {
  return new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegExp(word)}(?![\\p{L}\\p{N}])`, "giu");
}

/**
 * Transcript text in Presenting mode: the caller's known name and any phone
 * number they read out are masked the same way as the header. Audio is not.
 */
export function maskSpoken(text: string, name: string | null | undefined): string {
  let out = text.replace(SPOKEN_NUMBER, (m) =>
    m.replace(/\D/g, "").length >= MIN_SPOKEN_DIGITS ? maskNumber(m) ?? m : m);
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return out;
  const masked = maskName(name) as string;
  out = out.replace(wholeWord(words.join(" ")), masked);
  // The first name stays visible for a multi-word name (as in maskName).
  const hidden = words.length === 1 ? words : words.slice(1);
  for (const w of hidden) {
    if (w.length < MIN_NAME_WORD) continue;
    out = out.replace(wholeWord(w), `${w.charAt(0).toUpperCase()}.`);
  }
  return out;
}
