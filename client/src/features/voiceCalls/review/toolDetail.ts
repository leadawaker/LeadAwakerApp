// A tool's facts (reviewMath ToolFacts, picked by the server) as words: one line after the
// tag ("Porsche Panamera · 5 found", "Booked · Wed 28 Oct, 16:00 · Danique") and, for the
// hover card, the few values and found things the line shortens. No React: the hook in
// ToolTag.tsx supplies `say` (i18n `test.facts.*`) and the language.
import type { ToolFacts } from "./reviewMath";
import { toolTag } from "./toolTags";

export type Say = (key: string, vars?: Record<string, string | number>) => string;

export interface ToolDetail {
  line: string;
  rows: { label: string; value: string }[];
  /** The first few things found, and "+N more" when there were others (else empty). */
  items: string[];
  more: string;
  failed: boolean;
}

const LOCAL = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/;

/** "2026-10-28T16:00" as "Wed 28 Oct, 16:00" (no time part: no time); anything else (a spoken moment) as it is. */
export function formatMoment(at: string, lang: string): string {
  const m = at.match(LOCAL);
  if (!m) return at;
  const [, y, mo, d, h, mi] = m;
  const date = new Date(Number(y), Number(mo) - 1, Number(d), Number(h ?? 0), Number(mi ?? 0));
  if (Number.isNaN(date.getTime())) return at;
  return new Intl.DateTimeFormat(lang, {
    weekday: "short", day: "numeric", month: "short", ...(h === undefined ? null : { hour: "2-digit", minute: "2-digit" }),
  }).format(date);
}

const join = (parts: (string | undefined | false)[]): string => parts.filter(Boolean).join(" · ");

export function describeTool(name: string, f: ToolFacts, say: Say, lang: string): ToolDetail {
  const rows: ToolDetail["rows"] = [];
  const row = (key: string, value: string | undefined) => { if (value) rows.push({ label: say(`row.${key}`), value }); };
  const kind = f.kind === "visit" || f.kind === "callback" ? say(`kind.${f.kind}`) : f.kind;
  const moment = f.at ? formatMoment(f.at, lang) : undefined;
  const none = f.state === "none";
  const failed = f.state === "failed";
  const count = f.total ?? f.items?.length ?? 0;
  let items = f.items ?? [];
  let line: string;

  switch (toolTag(name).key) {
    case "search_stock":
      line = join([f.query, none || count === 0 ? say("noneFound") : say("foundCount", { n: count })]);
      break;
    case "car_details":
      line = f.title ?? join([f.query, say("notInStock")]);
      break;
    case "check_availability":
      line = join([f.query && formatMoment(f.query, lang), none || count === 0 ? say("nothingFree") : say("freeCount", { n: count })]);
      items = items.map((x) => { const m = x.match(LOCAL); return m?.[4] ? `${m[4]}:${m[5]}` : x; });
      break;
    case "book_appointment":
      line = join([say(f.status === "moved" ? "moved" : failed ? "notBooked" : "booked"), moment, f.name]);
      row("name", f.name); row("when", moment); row("type", kind);
      break;
    case "cancel_appointment":
      line = join([say(none ? "noAppointment" : "cancelled"), kind, moment]);
      row("type", kind); row("when", moment); row("reason", f.reason);
      break;
    case "request_callback":
      line = join([say("callback"), f.when, f.reason]);
      row("when", f.when); row("reason", f.reason); row("number", f.number);
      break;
    case "update_call_summary":
      line = join([say("notes"), items.join(", ")]);
      break;
    case "end_call":
      line = join([say("ended"), f.reason]);
      row("reason", f.reason);
      break;
    case "transfer_to_human":
      line = join([say(failed ? "transferFailed" : "transferring"), f.name, f.reason]);
      row("name", f.name); row("reason", f.reason);
      break;
    case "rdw_plate_lookup":
      line = join([f.query, f.title ?? say(failed ? "plateInvalid" : "plateNone")]);
      break;
    default:
      line = join([f.title, f.query]);
  }

  // The notes' items are already in the line; the card lists only what was found.
  const listed = toolTag(name).key === "update_call_summary" ? [] : items;
  const left = listed.length ? Math.max(0, count - listed.length) : 0;
  return { line, rows, items: listed, more: left ? say("more", { n: left }) : "", failed };
}
