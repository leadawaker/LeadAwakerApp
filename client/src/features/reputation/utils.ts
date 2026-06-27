import type { Review, AutoRule } from "./types";

export function repAgeHours(ago: string): number {
  const m = /^(\d+)\s*([hdw])$/.exec(ago.trim());
  if (!m) return 9999;
  const n = +m[1];
  return m[2] === "h" ? n : m[2] === "d" ? n * 24 : n * 168;
}

export function repAgoDays(ago: string): number {
  const m = /^(\d+)\s*([hdw])$/.exec(ago.trim());
  if (!m) return 0;
  const n = +m[1];
  return m[2] === "h" ? n / 24 : m[2] === "d" ? n : n * 7;
}

export function repRatingColor(rating: number): string {
  if (rating <= 2) return "var(--wine)";
  if (rating === 3) return "var(--warn)";
  return "var(--good)";
}

export function repAutoPosts(review: Review, auto: AutoRule): boolean {
  if (auto.threshold === "never" || auto.threshold == null) return false;
  if ((review.rating ?? 0) < auto.threshold) return false;
  if (auto.holdNegative && review.rating <= 3) return false;
  if (auto.confidenceHold && review.confidence != null && review.confidence < auto.confidenceMin) return false;
  return true;
}

export function repDelayLabel(d: string): string {
  return d === "15m" ? "15 min" : d === "2h" ? "2 hours" : "1 hour";
}

export function repRuleSummary(auto: AutoRule): string {
  if (auto.threshold === "never") {
    return "Nothing is auto-posted — every AI reply waits for your approval.";
  }
  const band = auto.threshold === 5 ? "5★" : auto.threshold === 4 ? "4–5★" : "3–5★";
  const below = auto.threshold === 5 ? "1–4★" : auto.threshold === 4 ? "1–3★" : "1–2★";
  const delay = auto.delay === "15m" ? "15 minutes" : auto.delay === "2h" ? "2 hours" : "1 hour";
  let s = `${band} reviews are answered automatically after ${delay}. ${below} wait for your approval.`;
  if (auto.confidenceHold) s += ` Any AI reply under ${auto.confidenceMin}% confidence is held too.`;
  return s;
}

export function lerpHex(a: string, b: string, t: number): string {
  const h = (s: string, i: number) => parseInt(s.slice(1 + i * 2, 3 + i * 2), 16);
  const c = [0, 1, 2].map((i) => Math.round(h(a, i) + (h(b, i) - h(a, i)) * t));
  return "#" + c.map((v) => v.toString(16).padStart(2, "0")).join("");
}
