import type { VoiceCaller, VoiceCallListItem } from "./api/voiceCallsApi";
import { maskName, maskNumber } from "./maskIdentity";
import { callStatus, type VoiceCallStatus } from "./status";

export type VoiceView = "calls" | "callers";
export const VIEWS: VoiceView[] = ["calls", "callers"];
export const VIEW_KEY = "la.voiceCalls.view";

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

/** Search by name, number (digits) and persona; newest caller first. */
export function filterCallers(callers: VoiceCaller[], query: string): VoiceCaller[] {
  const q = query.trim().toLowerCase();
  const list = !q ? callers : callers.filter((c) => {
    const qDigits = q.replace(/\D/g, "");
    return (c.name ?? "").toLowerCase().includes(q) ||
      (c.personaCompany ?? "").toLowerCase().includes(q) ||
      (c.accountName ?? "").toLowerCase().includes(q) ||
      (!!qDigits && (c.phone ?? "").replace(/\D/g, "").includes(qDigits));
  });
  return [...list].sort((a, b) => new Date(b.lastCallAt).getTime() - new Date(a.lastCallAt).getTime());
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
