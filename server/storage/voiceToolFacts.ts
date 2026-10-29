/**
 * What a tool call did, as a few plain facts for the call review's readable tool lines
 * ("5 cars found", "booked Wed 28 Oct 16:00 for Danique"). The page words them (i18n);
 * this file only picks the main findings.
 *
 * Each known tool has an allowlist of the fields it copies, cut short, so the result is safe
 * for clients too: raw arguments, results, the instructions a result carries for the AI and
 * any other field never leave here. A tool this file does not know gives null.
 */

export interface ToolFacts {
  /** ok: it did its job. none: nothing found or nothing to act on. failed: it did not work. */
  state: "ok" | "none" | "failed";
  /** The tool's own status word (booked, moved, checking, ...) when the page words it differently. */
  status?: string;
  /** What was asked for: a search, a date, a plate. */
  query?: string;
  /** The main thing found: a car, a plate's description. */
  title?: string;
  name?: string;
  /** visit | callback */
  kind?: string;
  /** A local time "YYYY-MM-DDTHH:mm" when known, else the spoken moment. */
  at?: string;
  /** A callback's wanted moment, as the caller said it. */
  when?: string;
  reason?: string;
  number?: string;
  /** The first few things found (cars, free times, notes), `total` how many there were. */
  items?: string[];
  total?: number;
}

const MAX_ITEMS = 4;
const MAX_FACT = 110;

type Rec = Record<string, unknown>;

/** An object, or the object inside a JSON string (results sometimes arrive as text). */
function rec(v: unknown): Rec {
  let x = v;
  if (typeof x === "string") {
    try { x = JSON.parse(x); } catch { return {}; }
  }
  return x && typeof x === "object" && !Array.isArray(x) ? (x as Rec) : {};
}

function str(v: unknown, max = MAX_FACT): string | undefined {
  if (typeof v !== "string") return undefined;
  const s = v.replace(/\s+/g, " ").trim();
  if (!s) return undefined;
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

const num = (v: unknown): number | undefined => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
const list = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const status = (r: Rec): string | undefined => {
  const s = typeof r.status === "string" ? r.status.trim().toLowerCase() : "";
  return /^[a-z_]{1,24}$/.test(s) ? s : undefined;
};

/** A stock line without the plate: "Porsche Cayenne, 2021, 55.000 km, zwart, € 55.490". */
const noPlate = (s: string) => s.replace(/,?\s*kenteken\b.*$/i, "").trim();

const nl = new Intl.NumberFormat("nl-NL");

/** The stock search's filters when it had no text: "Diesel, ≤ 80.000 km, ≤ € 25.000". */
function filters(a: Rec): string | undefined {
  const parts = [
    str(a.fuel, 24),
    num(a.max_km) ? `≤ ${nl.format(num(a.max_km) as number)} km` : undefined,
    num(a.max_price) ? `≤ € ${nl.format(num(a.max_price) as number)}` : undefined,
    num(a.min_price) ? `≥ € ${nl.format(num(a.min_price) as number)}` : undefined,
  ].filter((x): x is string => !!x);
  return parts.length ? parts.join(", ") : undefined;
}

/** First few strings of a list, with how many there were. */
function sample(values: (string | undefined)[], total = values.length): Pick<ToolFacts, "items" | "total"> {
  const items = values.filter((x): x is string => !!x).slice(0, MAX_ITEMS);
  return { items, total: Math.max(total, items.length) };
}

const BUILDERS: Record<string, (a: Rec, r: Rec) => Omit<ToolFacts, "state">> = {
  search_stock: (a, r) => {
    const cars = list(r.cars);
    return { query: str(a.query) ?? filters(a), ...sample(cars.map((c) => str(typeof c === "string" ? noPlate(c) : undefined)), num(r.count) ?? cars.length) };
  },
  car_details: (a, r) => {
    const text = typeof r.car === "string" ? r.car : typeof r.truncated === "string" ? r.truncated : "";
    const title = text.match(/#\s+([^\n\\]+)/)?.[1];
    return { query: str(a.query), title: title ? str(noPlate(title)) : undefined };
  },
  check_availability: (a, r) => {
    const slots = list(r.free_slots);
    return { query: str(a.date, 10), kind: str(a.kind, 16), ...sample(slots.map((s) => str(rec(s).start, 16)), slots.length) };
  },
  book_appointment: (a, r) => ({
    name: str(a.name, 60), kind: str(r.kind ?? a.kind, 16), at: str(r.start ?? a.start, 16) ?? str(r.slot),
  }),
  cancel_appointment: (a, r) => ({ kind: str(a.kind, 16), at: str(r.slot), reason: str(a.reason, 160) }),
  request_callback: (a) => ({ when: str(a.when, 60), reason: str(a.reason, 160), number: str(a.callback_number, 24) }),
  update_call_summary: (a) => {
    const items = list(a.items).map((x) => str(rec(x).interest) ?? str(rec(x).intent));
    return { name: str(a.name, 60), ...sample(items) };
  },
  end_call: (a) => ({ reason: str(a.reason, 160) }),
  transfer_to_human: (a) => ({ name: str(a.caller_name, 60), reason: str(a.reason, 160) }),
  rdw_plate_lookup: (a, r) => ({ query: str(r.plate, 12) ?? str(a.plate, 12), title: str(r.summary) }),
};

const OK = new Set(["ok", "found", "booked", "moved", "cancelled", "noted", "checking", "transferring", "already_transferring"]);
const NONE = new Set(["none", "not_found", "day_full"]);

/** "functions.Book_Appointment" is the book_appointment tool. */
const idOf = (name: string): string => name.trim().slice(name.trim().lastIndexOf(".") + 1).toLowerCase();

export function toolFacts(toolName: string | null, args: unknown, result: unknown, error?: string | null): ToolFacts | null {
  const build = toolName ? BUILDERS[idOf(toolName)] : undefined;
  if (!build) return null;
  const r = rec(result);
  const facts = build(rec(args), r);
  const word = status(r);
  let state: ToolFacts["state"] = "ok";
  if (error) state = "failed";
  else if (word && NONE.has(word)) state = "none";
  else if (word && !OK.has(word)) state = "failed";
  else if (facts.total === 0) state = "none";
  const out: ToolFacts = { state, ...(word ? { status: word } : null) };
  for (const [k, v] of Object.entries(facts)) {
    if (v !== undefined && !(Array.isArray(v) && v.length === 0)) Object.assign(out, { [k]: v });
  }
  return out;
}
