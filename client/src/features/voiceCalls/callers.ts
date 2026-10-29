import type { VoiceCaller, VoiceCallListItem, VoiceOutcome } from "./api/voiceCallsApi";
import { maskName, maskNumber } from "./maskIdentity";
import { phoneMatches } from "./phoneMatch";
import { callStatus, normalizeOutcome, type VoiceCallStatus } from "./status";

/** Calls page tabs: People and All calls, for everyone. The figures live on the Stats page (/platform/home). */
export type CallsTab = "people" | "calls";
export const CALLS_TABS: CallsTab[] = ["people", "calls"];
export const LAST_TAB_PAGE = "calls";
/** Which list (People or All calls) the "Calls" pill reopens after Settings. */
export const LAST_LIST_PAGE = "calls.list";

/** Presenting mode, applied once at the render edge (same rule as maskCaller for calls). */
export function maskVoiceCaller(caller: VoiceCaller, masked: boolean): VoiceCaller {
  if (!masked) return caller;
  return { ...caller, name: maskName(caller.name), phone: maskNumber(caller.phone), email: null };
}

/** Avatar tint: what the best call amounted to, with DND winning like on call rows. */
export function callerStatus(caller: VoiceCaller): VoiceCallStatus {
  return callStatus({
    bookedSlot: caller.bestOutcome === "booked" ? caller.bookedSlot : null,
    intents: [],
    leadStatus: caller.dnd ? "DND" : caller.leadStatus,
    outcome: caller.bestOutcome,
  });
}

export type PeopleSort = "latest" | "most";
export type PeopleGroup = "date" | "outcome" | "none";
export type PeopleRange = "all" | "7d" | "30d" | "90d";
export const PEOPLE_SORTS: PeopleSort[] = ["latest", "most"];
export const PEOPLE_GROUPS: PeopleGroup[] = ["date", "outcome", "none"];
export const PEOPLE_RANGES: PeopleRange[] = ["all", "7d", "30d", "90d"];

/** The People tab's menus: same idea as the calls list, judged on each person's calls. */
export interface PeopleOptions {
  /** Empty means every outcome. Matched against what the person's calls amounted to (best outcome). */
  outcomes: VoiceOutcome[];
  /** Latest call within this many days. */
  range: PeopleRange;
  sort: PeopleSort;
  group: PeopleGroup;
}

export const DEFAULT_PEOPLE_OPTIONS: PeopleOptions = { outcomes: [], range: "all", sort: "latest", group: "date" };

export function peopleFiltered(o: PeopleOptions): boolean {
  return o.outcomes.length > 0 || o.range !== "all";
}

const RANGE_DAYS: Record<Exclude<PeopleRange, "all">, number> = { "7d": 7, "30d": 30, "90d": 90 };

/** Search by name, number (any format) and persona, then the People filters and sort. */
export function filterCallers(callers: VoiceCaller[], query: string, opts: PeopleOptions = DEFAULT_PEOPLE_OPTIONS, now = Date.now()): VoiceCaller[] {
  const q = query.trim().toLowerCase();
  let list = !q ? callers : callers.filter((c) =>
    (c.name ?? "").toLowerCase().includes(q) ||
    (c.personaCompany ?? "").toLowerCase().includes(q) ||
    (c.accountName ?? "").toLowerCase().includes(q) ||
    phoneMatches(c.phone, q) ||
    (c.key.startsWith("num:") && phoneMatches(c.key.slice(4), q)));
  if (opts.outcomes.length) list = list.filter((c) => opts.outcomes.includes(normalizeOutcome(c.bestOutcome)));
  if (opts.range !== "all") {
    const since = now - RANGE_DAYS[opts.range] * 86_400_000;
    list = list.filter((c) => new Date(c.lastCallAt).getTime() >= since);
  }
  const latest = (c: VoiceCaller) => new Date(c.lastCallAt).getTime();
  return [...list].sort((a, b) => (opts.sort === "most" ? b.callCount - a.callCount : 0) || latest(b) - latest(a));
}

/** This person's calls from the already-loaded calls list, newest first. */
export function callsOfCaller(calls: VoiceCallListItem[], caller: VoiceCaller): VoiceCallListItem[] {
  const mine = caller.leadsId != null
    ? calls.filter((c) => c.leadsId === caller.leadsId)
    : calls.filter((c) => c.leadsId == null && !!caller.phone && c.callerNumber === caller.phone);
  return [...mine].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
}

/** Digits only, for wa.me links. Null when nothing dialable is left. */
export function dialDigits(phone: string | null): string | null {
  const digits = (phone ?? "").replace(/\D/g, "");
  return digits.length >= 6 ? digits : null;
}

/** "5 minutes ago", "yesterday", in the UI language. */
export function relativeFromNow(iso: string, locale: string): string {
  const diffSec = (new Date(iso).getTime() - Date.now()) / 1000;
  if (Number.isNaN(diffSec)) return "";
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const steps: [Intl.RelativeTimeFormatUnit, number][] = [["second", 60], ["minute", 60], ["hour", 24], ["day", 7], ["week", 4.35], ["month", 12]];
  let value = diffSec;
  for (const [unit, size] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return rtf.format(Math.round(value), "year");
}

/**
 * The last time someone pressed Call back or WhatsApp for this person. The
 * press is all that is known (the call or message itself is not tracked), so
 * the line says what was opened: "WhatsApp opened by Gabriel, 2 hours ago".
 */
export function lastContactAttempt(
  rec: { lastCalledBackAt: string | null; lastCalledBackBy: string | null; lastCalledBackChannel?: "phone" | "whatsapp" | null },
  t: (key: string, opts?: Record<string, unknown>) => string,
  locale: string,
): string | null {
  if (!rec.lastCalledBackAt) return null;
  const key = rec.lastCalledBackChannel === "whatsapp" ? "callers.lastAttempt.whatsapp" : "callers.lastAttempt.phone";
  return t(key, { name: rec.lastCalledBackBy || t("callers.lastAttempt.someone"), when: relativeFromNow(rec.lastCalledBackAt, locale) });
}
